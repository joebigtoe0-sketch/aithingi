import fs from "fs";
import path from "path";
import multer from "multer";
import { UPLOAD_ROOT } from "./upload.js";
import { getNextPairNumber } from "./db.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ext(file) {
  return path.extname(file.originalname || "") || ".jpg";
}

export const pairSpawnUpload = multer({
  storage: multer.diskStorage({
    async destination(req, file, cb) {
      try {
        if (req.pairNum == null) req.pairNum = await getNextPairNumber();
        const scope = file.fieldname === "tokenImage" ? "tokens" : "devs";
        const dir = path.join(UPLOAD_ROOT, scope);
        ensureDir(dir);
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename(req, file, cb) {
      const pad = String(req.pairNum || 1).padStart(3, "0");
      const name = file.fieldname === "tokenImage" ? `TKN-${pad}` : `DEV-${pad}`;
      cb(null, name + ext(file));
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error("only JPEG, PNG, WebP, or GIF images are allowed"));
    cb(null, true);
  },
}).fields([
  { name: "tokenImage", maxCount: 1 },
  { name: "devImage", maxCount: 1 },
]);

export const agentSpawnUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      ensureDir(path.join(UPLOAD_ROOT, "agents"));
      cb(null, path.join(UPLOAD_ROOT, "agents"));
    },
    filename(req, file, cb) {
      const type = String(req.body?.type || "agent").toLowerCase();
      const stamp = Date.now();
      cb(null, `${type}-${stamp}${ext(file)}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error("only JPEG, PNG, WebP, or GIF images are allowed"));
    cb(null, true);
  },
}).single("image");
