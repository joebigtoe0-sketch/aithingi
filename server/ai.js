import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt } from "./brain-prompt.js";
import { getRecentLogEntries, getProjects } from "./db.js";

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
