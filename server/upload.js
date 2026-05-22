import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.join(__dirname, "..", "public", "uploads");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const scope = req.uploadScope || "misc";
    const dir = path.join(UPLOAD_ROOT, scope);
    ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const base = (req.uploadBasename || "asset").replace(/[^\w.-]+/g, "_");
    const ext = path.extname(file.originalname || "") || mimeToExt(file.mimetype);
    cb(null, `${base}${ext}`);
  },
});

function mimeToExt(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".jpg";
}

function fileFilter(_req, file, cb) {
  if (!ALLOWED.has(file.mimetype)) {
    return cb(new Error("only JPEG, PNG, WebP, or GIF images are allowed"));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

export function publicUrl(scope, filename) {
  return `/uploads/${scope}/${filename}`;
}
