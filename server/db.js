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

function rowToProject(r) {
  const agents = parseAgents(r.subagents);
  return {
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
    agents,
    pumpfun: r.pumpfun,
  };
}

function projectToDbRow(p) {
  return [
    p.id,
    p.codename,
    p.ticker,
    p.status,
    p.launched,
    p.wallet,
    p.balance,
    p.marketCap ?? 0,
    p.holders ?? 0,
    p.thesis || "",
    JSON.stringify(p.agents || []),
    p.pumpfun || null,
  ];
}

export async function getNextDevNumber() {
  const projects = await getProjects();
  let max = 0;
  for (const p of projects) {
    const m = /^DEV-(\d+)$/i.exec(p.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
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
    if (memoryStore.projects.some((x) => x.id === row.id)) {
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
    `INSERT INTO projects (id, codename, ticker, status, launched, wallet, balance, market_cap, holders, thesis, subagents, pumpfun)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    projectToDbRow(row)
  );
  const { rows } = await p.query("SELECT * FROM projects WHERE id = $1", [row.id]);
  return rows.length ? rowToProject(rows[0]) : rowToProject({ ...row, subagents: row.agents });
}

export async function createDeveloperProject({ codename, ticker, budget, thesis }) {
  const num = await getNextDevNumber();
  const id = "DEV-" + String(num).padStart(3, "0");
  const code = String(codename || "").trim().toUpperCase();
  if (!code) throw new Error("codename required");
  const tick = (ticker || "$" + code).trim();
  const bal = Number(budget);
  const project = {
    id,
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
  };
  return insertProject(project);
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
      `INSERT INTO projects (id, codename, ticker, status, launched, wallet, balance, market_cap, holders, thesis, subagents, pumpfun)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
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
  if (!p) return memoryStore.projects;
  const { rows } = await p.query("SELECT * FROM projects ORDER BY id ASC");
  return rows.map(rowToProject);
}
