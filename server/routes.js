import { Router } from "express";
import crypto from "crypto";
import {
  getDeployTs,
  getLogEntries,
  insertLogEntry,
  updateLogEntry,
  deleteLogEntry,
  getProjects,
  createDeveloperProject,
  getNextPairNumber,
  addProjectAgent,
  findProjectByKey,
  syncProjectMetrics,
  syncAllProjectMetrics,
  hasDatabase,
} from "./db.js";
import { isAlchemyConfigured } from "./metrics.js";
import { publicUrl } from "./upload.js";
import { tokenSpawnUpload } from "./spawn-upload.js";
import { generateCentralMessage, generateEntityMessage, isAiConfigured } from "./ai.js";

const ADMIN_TOKEN_KEY = "admin_token";

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "central";
}

function issueToken() {
  return crypto.randomBytes(24).toString("hex");
}

const sessions = new Map();

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-admin-token"];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

export function createApiRouter() {
  const api = Router();

  api.get("/health", (_req, res) => {
    res.json({
      ok: true,
      database: hasDatabase() ? "postgres" : "memory",
      ai: isAiConfigured(),
      metrics: isAlchemyConfigured(),
    });
  });

  api.get("/config", (_req, res) => {
    res.json({
      aiEnabled: isAiConfigured(),
      database: hasDatabase() ? "postgres" : "memory",
      metricsEnabled: isAlchemyConfigured(),
    });
  });

  api.post("/admin/login", (req, res) => {
    const { password } = req.body || {};
    if (password !== adminPassword()) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    const token = issueToken();
    sessions.set(token, { at: Date.now() });
    res.json({ token });
  });

  api.post("/admin/logout", requireAdmin, (req, res) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-admin-token"];
    sessions.delete(token);
    res.json({ ok: true });
  });

  api.post("/admin/generate", requireAdmin, async (req, res) => {
    try {
      const { brief, tag, target, src } = req.body || {};
      if (!brief?.trim()) {
        return res.status(400).json({ error: "brief is required" });
      }
      const entitySrc = src?.trim();
      const result = entitySrc && entitySrc.toUpperCase() !== "CENTRAL"
        ? await generateEntityMessage({
            brief: brief.trim(),
            tag: tag || "THOUGHT",
            src: entitySrc,
          })
        : await generateCentralMessage({
            brief: brief.trim(),
            tag: tag || "THOUGHT",
            target: target || "ALL",
          });
      res.json(result);
    } catch (err) {
      console.error("[ai]", err);
      res.status(500).json({ error: err.message || "generation failed" });
    }
  });

  api.get("/log", async (_req, res) => {
    try {
      const entries = await getLogEntries(800);
      const deployTs = await getDeployTs();
      res.json({ entries, deployTs });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "failed to load log" });
    }
  });

  api.get("/projects", async (req, res) => {
    try {
      let projects = await getProjects();
      const refresh = req.query.refresh !== "0";
      if (refresh && projects.length) {
        projects = await syncAllProjectMetrics(projects, { force: req.query.force === "1" });
      }
      const nextDev = await getNextPairNumber();
      res.json({ projects, nextDev });
    } catch (err) {
      res.status(500).json({ error: "failed to load projects" });
    }
  });

  api.post("/projects/:key/refresh-metrics", async (req, res) => {
    try {
      const project = await findProjectByKey(req.params.key);
      if (!project) return res.status(404).json({ error: "project not found" });
      const updated = await syncProjectMetrics(project, { force: true });
      res.json({ project: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "metrics refresh failed" });
    }
  });

  api.post("/projects", requireAdmin, (req, res, next) => {
    tokenSpawnUpload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || "upload failed" });
      next();
    });
  }, async (req, res) => {
    try {
      const { codename, ticker, budget, thesis, wallet, tokenMint } = req.body || {};
      if (!codename?.trim()) return res.status(400).json({ error: "codename required" });
      if (!thesis?.trim()) return res.status(400).json({ error: "brief required" });
      if (!wallet?.trim()) return res.status(400).json({ error: "dev wallet address required" });
      if (!tokenMint?.trim()) return res.status(400).json({ error: "token contract address required" });
      if (!req.file) return res.status(400).json({ error: "token image required" });
      const tokenImage = publicUrl("tokens", req.file.filename);
      const project = await createDeveloperProject({
        codename, ticker, budget, thesis, wallet, tokenMint, tokenImage,
      });
      const nextDev = await getNextPairNumber();
      res.status(201).json({ project, nextDev });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "spawn failed" });
    }
  });

  api.post("/projects/:key/agents", requireAdmin, async (req, res) => {
    try {
      const { type } = req.body || {};
      if (!type?.trim()) return res.status(400).json({ error: "agent type required" });
      const { agent, project } = await addProjectAgent(req.params.key, { type });
      res.status(201).json({ agent, project });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "hire failed" });
    }
  });

  api.post("/log", requireAdmin, async (req, res) => {
    try {
      const { src, tag, msg, public: isPublic, redacted, ts } = req.body || {};
      if (!msg?.trim()) return res.status(400).json({ error: "msg required" });
      const entry = {
        id: "INJ" + Date.now(),
        ts: ts || Date.now(),
        src: src || "CENTRAL",
        tag: tag || "THOUGHT",
        msg: msg.trim(),
        public: isPublic !== false,
        redacted: !!redacted,
      };
      await insertLogEntry(entry);
      res.status(201).json({ entry });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "inject failed" });
    }
  });

  api.patch("/log/:id", requireAdmin, async (req, res) => {
    try {
      const entry = await updateLogEntry(req.params.id, req.body || {});
      if (!entry) return res.status(404).json({ error: "not found" });
      res.json({ entry });
    } catch (err) {
      res.status(500).json({ error: "update failed" });
    }
  });

  api.delete("/log/:id", requireAdmin, async (req, res) => {
    try {
      await deleteLogEntry(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "delete failed" });
    }
  });

  return api;
}
