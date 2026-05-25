import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, closePool } from "./db.js";
import { createApiRouter } from "./routes.js";
import { startDevAutopilot, stopDevAutopilot } from "./dev-autopilot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Load env from server/.env or project root .env (not .env.example)
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(ROOT, ".env") });
const PUBLIC = path.join(ROOT, "public");
const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();
app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use("/api", createApiRouter());

app.use(express.static(PUBLIC, { index: "index.html" }));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(PUBLIC, "index.html"));
});

async function main() {
  const db = await initDb();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on 0.0.0.0:${PORT}  db=${db.mode}  ai=${!!process.env.ANTHROPIC_API_KEY}`);
    startDevAutopilot();
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} — shutting down`);
    stopDevAutopilot();
    server.close();
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
