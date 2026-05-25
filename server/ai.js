import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt, getDevBrainPrompt, getAgentPrompt, getDevAutopilotPrompt } from "./brain-prompt.js";
import { getRecentLogEntries, getProjects, findProjectByKey } from "./db.js";

const ALLOWED_TAGS = new Set(["THOUGHT", "DECISION", "DIRECTIVE", "OBSERVATION"]);

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function formatContext(entries, projects) {
  const recent = entries.slice(-25).map((e) => `[${e.src}] ${e.tag}: ${e.msg}`).join("\n");
  const devs = projects
    .map((p) => `${p.id} ${p.codename} (${p.status}) — ${p.thesis}`)
    .join("\n");
  return `ACTIVE DEVELOPERS:\n${devs}\n\nRECENT LOG (newest last):\n${recent}`;
}

export async function generateCentralMessage({ brief, tag, target }) {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  const safeTag = ALLOWED_TAGS.has(tag) ? tag : "THOUGHT";
  const targetLine = target && target !== "ALL" ? `Target developer: ${target}` : "Target: network-wide (ALL)";

  const [entries, projects] = await Promise.all([
    getRecentLogEntries(50),
    getProjects(),
  ]);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const userPrompt = `${formatContext(entries, projects)}

OPERATOR BRIEF (your instructions — synthesize into one ${safeTag} line):
${brief.trim()}

${targetLine}
Required tag for this message: ${safeTag}

Write the single log message body now.`;

  const response = await client.messages.create({
    model,
    max_tokens: 320,
    system: getSystemPrompt(),
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("AI returned empty message");

  let msg = text.replace(/^["']|["']$/g, "").trim();
  if (target && target !== "ALL" && safeTag === "DIRECTIVE" && !msg.includes(target)) {
    msg = `${target} → ${msg.replace(/^DEV-\d+\s*→\s*/i, "")}`;
  }

  return { msg, tag: safeTag, model };
}

function findAgentInProjects(projects, src) {
  for (const p of projects) {
    const agent = (p.agents || []).find((a) => a.id === src);
    if (agent) return { agent, project: p };
  }
  return null;
}

export async function generateEntityMessage({ brief, tag, src }) {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  const entitySrc = String(src || "").trim().toUpperCase();
  if (!entitySrc || entitySrc === "CENTRAL") {
    return generateCentralMessage({ brief, tag: tag || "THOUGHT", target: "ALL" });
  }

  const safeTag = tag === "THOUGHT" ? "THOUGHT" : (ALLOWED_TAGS.has(tag) ? tag : "THOUGHT");
  const [entries, projects] = await Promise.all([
    getRecentLogEntries(50),
    getProjects(),
  ]);

  let systemPrompt;
  let scopedLog;
  const project = await findProjectByKey(entitySrc);
  if (project && (entitySrc.startsWith("DEV-") || project.devId === entitySrc)) {
    const p = project;
    systemPrompt = getDevBrainPrompt(p);
    scopedLog = entries
      .filter((e) =>
        e.src === p.devId || e.src === p.tokenId ||
        (p.agents || []).some((a) => a.id === e.src) ||
        (e.src === "CENTRAL" && e.msg.toLowerCase().includes(p.codename.toLowerCase()))
      )
      .slice(-25);
  } else {
    const hit = findAgentInProjects(projects, entitySrc);
    if (!hit) throw new Error(`unknown entity: ${entitySrc}`);
    systemPrompt = getAgentPrompt(hit.agent, hit.project);
    scopedLog = entries
      .filter((e) =>
        e.src === hit.agent.id || e.src === hit.project.devId ||
        e.src === hit.project.tokenId
      )
      .slice(-25);
  }

  const recent = scopedLog.map((e) => `[${e.src}] ${e.tag}: ${e.msg}`).join("\n");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const userPrompt = `RECENT LOG (scoped to you and your token — newest last):
${recent || "(no prior lines)"}

OPERATOR BRIEF:
${brief.trim()}

Entity posting this line: ${entitySrc}
Required tag: ${safeTag}

Write the single log message body now.`;

  const response = await client.messages.create({
    model,
    max_tokens: 280,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("AI returned empty message");
  const msg = text.replace(/^["']|["']$/g, "").trim();
  return { msg, tag: safeTag, model, src: entitySrc };
}

function scopeEntriesToProject(entries, project) {
  const codename = String(project.codename || "").toLowerCase();
  return entries.filter((e) =>
    e.src === project.devId ||
    e.src === project.tokenId ||
    (project.agents || []).some((a) => a.id === e.src) ||
    (e.src === "CENTRAL" && codename && e.msg.toLowerCase().includes(codename))
  );
}

function parseAutopilotResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI returned empty message");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tagMatch = (lines[0] || "").match(/^(THOUGHT|PLAN|POST|OBSERVATION)\b/i);
  let tag = tagMatch ? tagMatch[1].toUpperCase() : "THOUGHT";
  let msgLines = tagMatch ? lines.slice(1) : lines;
  if (!msgLines.length) {
    const inline = raw.match(/^(THOUGHT|PLAN|POST|OBSERVATION)\s*[:\-]?\s*(.+)$/is);
    if (inline) {
      tag = inline[1].toUpperCase();
      msgLines = [inline[2].trim()];
    } else if (!tagMatch) {
      msgLines = [raw];
    }
  }
  const msg = msgLines.join(" ").replace(/^["']|["']$/g, "").trim();
  if (!msg) throw new Error("AI returned empty message body");
  return { tag, msg };
}

function formatMetrics(project) {
  const parts = [];
  if (project.marketCap) parts.push(`mcap ${project.marketCap}`);
  if (project.holders) parts.push(`holders ${project.holders}`);
  if (project.balance != null) parts.push(`treasury ${project.balance} SOL`);
  return parts.length ? parts.join(" · ") : "metrics pending";
}

export async function generateDevAutopilotMessage(project) {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  if (!project?.devId) throw new Error("project missing devId");

  const hourMs = parseInt(process.env.DEV_AUTOPILOT_LOOKBACK_MS || String(3600000), 10);
  const since = Date.now() - hourMs;

  const entries = await getRecentLogEntries(120);
  const scoped = scopeEntriesToProject(entries, project);
  const hourScoped = scoped.filter((e) => e.ts >= since);

  const recent = scoped.slice(-30).map((e) => `[${e.src}] ${e.tag}: ${e.msg}`).join("\n");
  const hourLog = hourScoped.length
    ? hourScoped.map((e) => `[${e.src}] ${e.tag}: ${e.msg}`).join("\n")
    : "(no activity in the last hour on this token)";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const userPrompt = `HOURLY AUTONOMOUS TICK — ${new Date().toISOString()}

TOKEN STATUS: ${project.status || "live"}
${formatMetrics(project)}

LAST HOUR (scoped to your token):
${hourLog}

RECENT HISTORY (scoped — newest last):
${recent || "(no prior lines)"}

Write your single log line now. Remember: line 1 = TAG, line 2+ = message body.`;

  const response = await client.messages.create({
    model,
    max_tokens: 320,
    system: getDevAutopilotPrompt(project),
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const { tag, msg } = parseAutopilotResponse(text);
  return { msg, tag, model, src: project.devId };
}
