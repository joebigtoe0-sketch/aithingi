/* ============================================================
   data.js — seeded log + projects + live tick (vanilla JS,
   exposes globals on window for Babel scripts to consume)
   ============================================================ */

// Deploy / uptime: persist site "boot date" so uptime is real.
const DEPLOY_KEY = "network_deploy_ts";
(function ensureDeploy(){
  if (!localStorage.getItem(DEPLOY_KEY)) {
    localStorage.setItem(DEPLOY_KEY, String(Date.now()));
  }
})();
function deployTs() { return parseInt(localStorage.getItem(DEPLOY_KEY), 10); }

function isoTs(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ---------- projects (populated via admin spawn / API later) ----------
const PROJECTS = [];

// ---------- seed log (empty — operator spawns all entries from admin) ----------
const SEED_LINES = [];

// build with absolute timestamps relative to now
function buildSeed() {
  const now = Date.now();
  return SEED_LINES.map((l, i) => ({
    id: "L" + (1000 + i),
    ts: now + l.dt,
    src: l.src,
    tag: l.tag,
    msg: l.msg,
    public: true,
  })).sort((a,b) => a.ts - b.ts);
}

// persistent log storage (v3: cleared placeholder seed)
const LOG_KEY = "network_log_v3";
function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e){}
  const seed = buildSeed();
  localStorage.setItem(LOG_KEY, JSON.stringify(seed));
  return seed;
}
function saveLog(arr) {
  // cap at 800 entries to avoid runaway
  const trimmed = arr.length > 800 ? arr.slice(arr.length - 800) : arr;
  localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
}

// ---------- live ticker (disabled until developers exist) ----------
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

// ---------- src styling ----------
function srcColor(src) {
  if (!src) return "muted";
  if (src === "CENTRAL") return "cent";
  if (src === "DISPATCH") return "muted";
  if (src.startsWith("DEV-")) return "dev";
  return "sub";
}

// ---------- formatting helpers ----------
function shortWallet(w) {
  if (!w) return "—";
  return w.slice(0,4) + "…" + w.slice(-4);
}
function fmtBalance(b) {
  return b.toFixed(3) + " SOL";
}
function fmtMcap(m) {
  if (m >= 1e6) return "$" + (m/1e6).toFixed(2) + "M";
  if (m >= 1e3) return "$" + (m/1e3).toFixed(1) + "k";
  return "$" + m;
}
function uptimeStr(launched) {
  let s = Math.floor((Date.now() - launched) / 1000);
  const d = Math.floor(s / 86400); s -= d*86400;
  const h = Math.floor(s / 3600); s -= h*3600;
  const m = Math.floor(s / 60); s -= m*60;
  const sec = s;
  return (d).toString().padStart(2,"0") + "d " +
         (h).toString().padStart(2,"0") + "h " +
         (m).toString().padStart(2,"0") + "m " +
         (sec).toString().padStart(2,"0") + "s";
}
function uptimeShort(launched) {
  let s = Math.floor((Date.now() - launched) / 1000);
  const d = Math.floor(s / 86400); s -= d*86400;
  const h = Math.floor(s / 3600); s -= h*3600;
  const m = Math.floor(s / 60);
  return d + "d " + h + "h " + m + "m";
}

window.NETWORK = {
  PROJECTS,
  loadLog, saveLog,
  genTickEntry,
  srcColor,
  shortWallet, fmtBalance, fmtMcap,
  uptimeStr, uptimeShort,
  deployTs,
  isoTs,
};
