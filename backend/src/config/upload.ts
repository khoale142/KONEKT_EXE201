import multer from "multer";
import path from "path";
import fs from "fs";
import { ApiError } from "../utils/apiError";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "tickets");

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/jpg"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

export const ticketUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Chỉ chấp nhận file ảnh (jpg, jpeg, png)"));
    }
  },
});
