import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PROJECTS, buildSeedLog } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;
let memoryStore = { entries: [], projects: [], deployTs: null, seeded: false };

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool() {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function runSchema(client) {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await client.query(sql);
}

function rowToEntry(r) {
  return {
    id: r.id,
    ts: Number(r.ts),
    src: r.src,
    tag: r.tag,
    msg: r.msg,
    public: r.public,
    redacted: r.redacted,
  };
}

function parseAgents(subagents) {
  if (!subagents) return [];
  if (Array.isArray(subagents)) return subagents;
  if (typeof subagents === "string") {
    try { return JSON.parse(subagents); } catch { return []; }
  }
  return [];
}

export const CONTRACTOR_TYPES = ["builder", "voice", "watcher", "art", "shill", "comms", "analytics"];

export function normalizeProject(p) {
  if (!p) return p;
  const rawId = p.id || "";
  let devId = p.devId || p.dev_id || null;
  let tokenId = p.tokenId || p.token_id || null;
  if (rawId.startsWith("DEV-") && !devId) devId = rawId;
  if (rawId.startsWith("TKN-") && !tokenId) tokenId = rawId;
  const numMatch = (devId || tokenId || rawId).match(/(\d+)/);
  const pad = numMatch ? String(parseInt(numMatch[1], 10)).padStart(3, "0") : "001";
  devId = devId || `DEV-${pad}`;
  tokenId = tokenId || `TKN-${pad}`;
  return {
    ...p,
    devId,
    tokenId,
    tokenImage: p.tokenImage || p.token_image || null,
    devImage: p.devImage || p.dev_image || null,
    agents: p.agents || parseAgents(p.subagents),
  };
}

function rowToProject(r) {
  return normalizeProject({
    id: r.id,
    codename: r.codename,
    ticker: r.ticker,
    status: r.status,
    launched: r.launched ? Number(r.launched) : null,
    wallet: r.wallet,
    balance: Number(r.balance) || 0,
    marketCap: r.market_cap != null ? Number(r.market_cap) : 0,
    holders: r.holders != null ? Number(r.holders) : 0,
    thesis: r.thesis || "",
    agents: parseAgents(r.subagents),
    pumpfun: r.pumpfun,
    tokenId: r.token_id,
    devId: r.dev_id,
    tokenImage: r.token_image,
    devImage: r.dev_image,
  });
}

function projectToDbRow(p) {
  const n = normalizeProject(p);
  return [
    n.tokenId || n.id,
    n.codename,
    n.ticker,
    n.status,
    n.launched,
    n.wallet,
    n.balance,
    n.marketCap ?? 0,
    n.holders ?? 0,
    n.thesis || "",
    JSON.stringify(n.agents || []),
    n.pumpfun || null,
    n.tokenId,
    n.devId,
    n.tokenImage,
    n.devImage,
  ];
}

async function migrateProjectColumns(client) {
  await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS token_id TEXT`);
  await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS dev_id TEXT`);
  await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS token_image TEXT`);
  await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS dev_image TEXT`);
  await client.query(`
    UPDATE projects SET
      dev_id = id,
      token_id = 'TKN-' || LPAD(SUBSTRING(id FROM 'DEV-([0-9]+)'), 3, '0')
    WHERE id LIKE 'DEV-%' AND (token_id IS NULL OR dev_id IS NULL)
  `);
}

function pairNumFromId(id) {
  if (!id) return 0;
  const m = /^(?:TKN|DEV)-(\d+)$/i.exec(id);
  return m ? parseInt(m[1], 10) : 0;
}

export async function getNextPairNumber() {
  const projects = await getProjects();
  let max = 0;
  for (const p of projects) {
    max = Math.max(max, pairNumFromId(p.id), pairNumFromId(p.tokenId), pairNumFromId(p.devId));
  }
  return max + 1;
}

export async function getNextDevNumber() {
  return getNextPairNumber();
}

export async function findProjectByKey(key) {
  if (!key) return null;
  const k = String(key).toUpperCase();
  const projects = await getProjects();
  return projects.find(
    (p) => p.id === k || p.tokenId === k || p.devId === k
  ) || null;
}

function buildAgent(project, type, imageUrl) {
  const t = String(type || "").toLowerCase();
  if (!CONTRACTOR_TYPES.includes(t)) throw new Error(`invalid agent type: ${type}`);
  const n = (project.agents || []).length + 1;
  const num = String(n).padStart(3, "0");
  const id = `${t.toUpperCase()}-${num}`;
  return {
    id,
    type: t,
    num,
    name: `${t.toUpperCase()} ${num}`,
    seed: (project.codename?.charCodeAt(0) || 1) + n * 11,
    imageUrl: imageUrl || null,
  };
}

function makeWallet() {
  const a = Math.random().toString(36).slice(2, 8).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${a}…${b}`;
}

export async function insertProject(project) {
  const p = getPool();
  const row = { ...project, agents: project.agents || [] };
  if (!p) {
    const norm = normalizeProject(row);
    if (memoryStore.projects.some((x) => x.tokenId === norm.tokenId || x.devId === norm.devId)) {
      throw new Error("project already exists");
    }
    memoryStore.projects.push(rowToProject({
      ...row,
      market_cap: row.marketCap,
      subagents: row.agents,
    }));
    memoryStore.projects.sort((a, b) => a.id.localeCompare(b.id));
    return memoryStore.projects.find((x) => x.id === row.id);
  }
  await p.query(
    `INSERT INTO projects (id, codename, ticker, status, launched, wallet, balance, market_cap, holders, thesis, subagents, pumpfun, token_id, dev_id, token_image, dev_image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    projectToDbRow(row)
  );
  const { rows } = await p.query("SELECT * FROM projects WHERE id = $1", [row.id]);
  return rows.length ? rowToProject(rows[0]) : rowToProject({ ...row, subagents: row.agents });
}

export async function createDeveloperProject({ codename, ticker, budget, thesis, tokenImage, devImage }) {
  return createTokenPair({ codename, ticker, budget, thesis, tokenImage, devImage });
}

export async function createTokenPair({ codename, ticker, budget, thesis, tokenImage, devImage }) {
  const num = await getNextPairNumber();
  const pad = String(num).padStart(3, "0");
  const tokenId = "TKN-" + pad;
  const devId = "DEV-" + pad;
  const code = String(codename || "").trim().toUpperCase();
  if (!code) throw new Error("codename required");
  const tick = (ticker || "$" + code).trim();
  const bal = Number(budget);
  const project = normalizeProject({
    id: tokenId,
    tokenId,
    devId,
    codename: code,
    ticker: tick.startsWith("$") ? tick : "$" + tick.replace(/^\$/, ""),
    status: "booting",
    launched: Date.now(),
    wallet: makeWallet(),
    balance: Number.isFinite(bal) ? bal : 2,
    marketCap: 0,
    holders: 0,
    thesis: String(thesis || "").trim(),
    agents: [],
    pumpfun: null,
    tokenImage: tokenImage || null,
    devImage: devImage || null,
  });
  return insertProject(project);
}

export async function updateProjectAgents(dbId, agents) {
  const p = getPool();
  const json = JSON.stringify(agents || []);
  if (!p) {
    const row = memoryStore.projects.find((x) => x.id === dbId || x.tokenId === dbId);
    if (!row) throw new Error("project not found");
    row.agents = agents;
    return normalizeProject(row);
  }
  await p.query("UPDATE projects SET subagents = $1::jsonb WHERE id = $2 OR token_id = $2 OR dev_id = $2", [json, dbId]);
  return findProjectByKey(dbId);
}

export async function addProjectAgent(projectKey, { type, imageUrl }) {
  const project = await findProjectByKey(projectKey);
  if (!project) throw new Error("project not found");
  const agent = buildAgent(project, type, imageUrl);
  const agents = [...(project.agents || []), agent];
  await updateProjectAgents(project.id, agents);
  const updated = await findProjectByKey(projectKey);
  return { agent, project: updated };
}

export async function initDb() {
  const p = getPool();
  if (!p) {
    if (!memoryStore.seeded) {
      memoryStore.entries = buildSeedLog();
      memoryStore.projects = PROJECTS;
      memoryStore.deployTs = Date.now();
      memoryStore.seeded = true;
    }
    console.log("[db] no DATABASE_URL — using in-memory store (dev only)");
    return { mode: "memory" };
  }

  const client = await p.connect();
  try {
    await runSchema(client);
    await migrateProjectColumns(client);
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM log_entries");
    if (rows[0].n === 0) {
      await seedDatabase(client);
      console.log("[db] seeded postgres");
    }
    const deploy = await client.query("SELECT value FROM settings WHERE key = $1", ["deploy_ts"]);
    if (!deploy.rows.length) {
      const ts = String(Date.now() - (31 * 86400 * 1000 + 4 * 3600 * 1000 + 17 * 60 * 1000));
      await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ["deploy_ts", ts]);
    }
  } finally {
    client.release();
  }
  return { mode: "postgres" };
}

async function seedDatabase(client) {
  const entries = buildSeedLog();
  for (const e of entries) {
    await client.query(
      `INSERT INTO log_entries (id, ts, src, tag, msg, public, redacted)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [e.id, e.ts, e.src, e.tag, e.msg, e.public, !!e.redacted]
    );
  }
  for (const p of PROJECTS) {
    await client.query(
      `INSERT INTO projects (id, codename, ticker, status, launched, wallet, balance, market_cap, holders, thesis, subagents, pumpfun, token_id, dev_id, token_image, dev_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`,
      projectToDbRow({ ...p, agents: p.agents || p.subagents || [] })
    );
  }
  const deployTs = String(Date.now());
  await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", ["deploy_ts", deployTs]);
}

export async function getDeployTs() {
  const p = getPool();
  if (!p) return memoryStore.deployTs;
  const { rows } = await p.query("SELECT value FROM settings WHERE key = $1", ["deploy_ts"]);
  return rows.length ? parseInt(rows[0].value, 10) : Date.now();
}

export async function getLogEntries(limit = 800) {
  const p = getPool();
  if (!p) return memoryStore.entries.slice(-limit);
  const { rows } = await p.query(
    `SELECT * FROM log_entries ORDER BY ts ASC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToEntry);
}

export async function getRecentLogEntries(n = 40) {
  const p = getPool();
  if (!p) return memoryStore.entries.slice(-n);
  const { rows } = await p.query(
    `SELECT * FROM log_entries ORDER BY ts DESC LIMIT $1`,
    [n]
  );
  return rows.map(rowToEntry).reverse();
}

export async function insertLogEntry(entry) {
  const p = getPool();
  if (!p) {
    memoryStore.entries.push(entry);
    if (memoryStore.entries.length > 800) memoryStore.entries = memoryStore.entries.slice(-800);
    return entry;
  }
  await p.query(
    `INSERT INTO log_entries (id, ts, src, tag, msg, public, redacted)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entry.id, entry.ts, entry.src, entry.tag, entry.msg, entry.public !== false, !!entry.redacted]
  );
  await p.query(
    `DELETE FROM log_entries WHERE id NOT IN (
      SELECT id FROM log_entries ORDER BY ts DESC LIMIT 800
    )`
  );
  return entry;
}

export async function updateLogEntry(id, patch) {
  const p = getPool();
  if (!p) {
    memoryStore.entries = memoryStore.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    return memoryStore.entries.find((e) => e.id === id);
  }
  const fields = [];
  const vals = [];
  let i = 1;
  if ("public" in patch) { fields.push(`public = $${i++}`); vals.push(patch.public); }
  if ("redacted" in patch) { fields.push(`redacted = $${i++}`); vals.push(patch.redacted); }
  if ("msg" in patch) { fields.push(`msg = $${i++}`); vals.push(patch.msg); }
  if (!fields.length) return null;
  vals.push(id);
  await p.query(`UPDATE log_entries SET ${fields.join(", ")} WHERE id = $${i}`, vals);
  const { rows } = await p.query("SELECT * FROM log_entries WHERE id = $1", [id]);
  return rows.length ? rowToEntry(rows[0]) : null;
}

export async function deleteLogEntry(id) {
  const p = getPool();
  if (!p) {
    memoryStore.entries = memoryStore.entries.filter((e) => e.id !== id);
    return true;
  }
  await p.query("DELETE FROM log_entries WHERE id = $1", [id]);
  return true;
}

export async function getProjects() {
  const p = getPool();
  if (!p) return memoryStore.projects.map(normalizeProject);
  const { rows } = await p.query("SELECT * FROM projects ORDER BY COALESCE(token_id, id) ASC");
  return rows.map(rowToProject);
}
