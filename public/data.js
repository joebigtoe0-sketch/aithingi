/* ============================================================
   data.js — projects, agent roster, log, live tick
   ============================================================ */

const DEPLOY_KEY = "network_deploy_ts";
(function ensureDeploy(){
  if (!localStorage.getItem(DEPLOY_KEY)) {
    localStorage.setItem(DEPLOY_KEY, String(Date.now()));
  }
})();
function deployTs() { return parseInt(localStorage.getItem(DEPLOY_KEY), 10); }
function isoTs(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"); }

const CENTRAL = {
  id: "CENTRAL",
  num: "000",
  type: "central",
  name: "CENTRAL BRAIN",
  seed: 7,
};

const DISPATCH = {
  id: "DISPATCH",
  num: "001",
  type: "dispatch",
  name: "DISPATCH",
  seed: 11,
};

// Populated via admin spawn; each project may include `agents: [...]`
const PROJECTS = [];

const SEED_LINES = [];

function buildSeed() {
  const now = Date.now();
  return SEED_LINES.map((l, i) => ({
    id: "L" + (1000 + i),
    ts: now + l.dt,
    src: l.src,
    tag: l.tag,
    msg: l.msg,
    public: true,
    redacted: false,
  })).sort((a, b) => a.ts - b.ts);
}

const LOG_KEY = "network_log_v3";
function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seed = buildSeed();
  localStorage.setItem(LOG_KEY, JSON.stringify(seed));
  return seed;
}
function saveLog(arr) {
  const trimmed = arr.length > 800 ? arr.slice(arr.length - 800) : arr;
  localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
}

const TICK_TEMPLATES = [];

function genTickEntry() {
  if (!TICK_TEMPLATES.length) return null;
  const tpl = TICK_TEMPLATES[Math.floor(Math.random() * TICK_TEMPLATES.length)];
  return Object.assign({
    id: "L" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    ts: Date.now(),
    public: true,
  }, tpl());
}

function findAgent(id) {
  if (id === "CENTRAL") return CENTRAL;
  if (id === "DISPATCH") return DISPATCH;
  for (const p of PROJECTS) {
    if (p.id === id) return null;
    for (const a of (p.agents || [])) if (a.id === id) return a;
  }
  return null;
}
function findProject(id) { return PROJECTS.find(p => p.id === id); }
function projectOfAgent(agentId) {
  for (const p of PROJECTS) {
    for (const a of (p.agents || [])) if (a.id === agentId) return p;
  }
  return null;
}

function srcColor(src) {
  if (!src) return "muted";
  if (src === "CENTRAL") return "cent";
  if (src === "DISPATCH") return "muted";
  if (src.startsWith("DEV-")) return "dev";
  return "sub";
}

function srcAgent(src) {
  if (src === "CENTRAL") return CENTRAL;
  if (src === "DISPATCH") return DISPATCH;
  if (src.startsWith("DEV-")) return null;
  return findAgent(src);
}

function shortWallet(w) { return !w ? "—" : w.slice(0, 4) + "…" + w.slice(-4); }
function fmtBalance(b) { return b.toFixed(3) + " SOL"; }
function fmtMcap(m) {
  if (m >= 1e6) return "$" + (m / 1e6).toFixed(2) + "M";
  if (m >= 1e3) return "$" + (m / 1e3).toFixed(1) + "k";
  return "$" + m;
}
function uptimeStr(launched) {
  let s = Math.floor((Date.now() - launched) / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return String(d).padStart(2, "0") + "d " +
    String(h).padStart(2, "0") + "h " +
    String(m).padStart(2, "0") + "m " +
    String(s).padStart(2, "0") + "s";
}
function uptimeShort(launched) {
  let s = Math.floor((Date.now() - launched) / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  return d + "d " + h + "h " + m + "m";
}

window.NETWORK = {
  CENTRAL, DISPATCH, PROJECTS,
  loadLog, saveLog, genTickEntry,
  findAgent, findProject, projectOfAgent, srcAgent,
  srcColor, shortWallet, fmtBalance, fmtMcap,
  uptimeStr, uptimeShort, deployTs, isoTs,
};
