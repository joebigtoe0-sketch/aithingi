import { getProjects, insertLogEntry, syncAllProjectMetrics } from "./db.js";
import { generateDevAutopilotMessage, isAiConfigured } from "./ai.js";

let timer = null;
let initialTimer = null;
let running = false;

export function isDevAutopilotEnabled() {
  if (!isAiConfigured()) return false;
  const flag = process.env.DEV_AUTOPILOT_ENABLED;
  if (flag === "0" || flag === "false") return false;
  return true;
}

function intervalMs() {
  const n = parseInt(process.env.DEV_AUTOPILOT_INTERVAL_MS || String(3600000), 10);
  return Number.isFinite(n) && n >= 60000 ? n : 3600000;
}

function initialDelayMs() {
  const n = parseInt(process.env.DEV_AUTOPILOT_INITIAL_DELAY_MS || String(180000), 10);
  return Number.isFinite(n) && n >= 0 ? n : 180000;
}

function staggerMs() {
  const n = parseInt(process.env.DEV_AUTOPILOT_STAGGER_MS || "4000", 10);
  return Number.isFinite(n) && n >= 0 ? n : 4000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEntryId(devId) {
  return `AUTO-${devId}-${Date.now()}`;
}

export async function runDevAutopilotTick() {
  if (running) {
    console.log("[dev-autopilot] tick skipped — previous run still active");
    return { skipped: true };
  }
  if (!isDevAutopilotEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  running = true;
  const results = { ok: 0, failed: 0, projects: 0 };

  try {
    let projects = await getProjects();
    projects = projects.filter((p) => p.status !== "archived" && p.devId);

    if (process.env.DEV_AUTOPILOT_REFRESH_METRICS !== "0" && projects.length) {
      try {
        projects = await syncAllProjectMetrics(projects, { force: false });
      } catch (err) {
        console.warn("[dev-autopilot] metrics refresh skipped:", err.message);
      }
    }

    results.projects = projects.length;
    console.log(`[dev-autopilot] tick — ${projects.length} dev brain(s)`);

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      if (i > 0) await sleep(staggerMs());
      try {
        const { msg, tag, src } = await generateDevAutopilotMessage(project);
        const entry = {
          id: makeEntryId(src),
          ts: Date.now(),
          src,
          tag,
          msg,
          public: true,
          redacted: false,
        };
        await insertLogEntry(entry);
        results.ok++;
        console.log(`[dev-autopilot] ${src} · ${tag}: ${msg.slice(0, 80)}${msg.length > 80 ? "…" : ""}`);
      } catch (err) {
        results.failed++;
        console.error(`[dev-autopilot] ${project.devId} failed:`, err.message);
      }
    }
  } finally {
    running = false;
  }

  return results;
}

export function startDevAutopilot() {
  if (!isDevAutopilotEnabled()) {
    console.log("[dev-autopilot] disabled (set ANTHROPIC_API_KEY and DEV_AUTOPILOT_ENABLED=1)");
    return;
  }

  const every = intervalMs();
  const first = initialDelayMs();

  console.log(
    `[dev-autopilot] scheduled — first run in ${Math.round(first / 1000)}s, then every ${Math.round(every / 1000)}s`
  );

  initialTimer = setTimeout(() => {
    runDevAutopilotTick().catch((err) => console.error("[dev-autopilot]", err));
    timer = setInterval(() => {
      runDevAutopilotTick().catch((err) => console.error("[dev-autopilot]", err));
    }, every);
  }, first);
}

export function stopDevAutopilot() {
  if (initialTimer) clearTimeout(initialTimer);
  if (timer) clearInterval(timer);
  initialTimer = null;
  timer = null;
}
