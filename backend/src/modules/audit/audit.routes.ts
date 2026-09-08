import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  getStoreData, getFlags, patchResolveFlag,
  getReports, postReport, acknowledgeReport,
} from "./audit.controller";

/* ── Multer config cho audit uploads ── */
const AUDIT_UPLOAD_DIR = path.join(__dirname, "..", "..", "..", "uploads", "audit");
if (!fs.existsSync(AUDIT_UPLOAD_DIR)) fs.mkdirSync(AUDIT_UPLOAD_DIR, { recursive: true });

const auditUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AUDIT_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, "Chỉ chấp nhận file ảnh (jpg, jpeg, png)"));
  },
});

const router = Router();

/* ═══════════════════════════════════════════════════════════
   GROUP A: Auditor-only endpoints (OFFICE portal)
   Giữ nguyên quyền truy cập cũ — không ảnh hưởng luồng hiện tại
   ═══════════════════════════════════════════════════════════ */
router.get("/stores", authGuard, portalGuard(["OFFICE"]), roleGuard(["auditor", "district_manager"]), asyncHandler(getStoreData));
router.get("/flags", authGuard, portalGuard(["OFFICE"]), roleGuard(["auditor", "district_manager"]), asyncHandler(getFlags));
router.patch("/flags/resolve", authGuard, portalGuard(["OFFICE"]), roleGuard(["auditor", "district_manager"]), asyncHandler(patchResolveFlag));
router.post("/reports", authGuard, portalGuard(["OFFICE"]), roleGuard(["auditor", "district_manager"]), auditUpload.single("attachment"), asyncHandler(postReport));

/* ═══════════════════════════════════════════════════════════
   GROUP B: Shared report endpoints (OFFICE + STORE portal)
   - GET /reports: Controller tự filter data theo role (JWT claims)
   - PATCH /reports/:id/acknowledge: Chỉ SM, có ownership check trong service
   ═══════════════════════════════════════════════════════════ */
router.get("/reports", authGuard, portalGuard(["OFFICE", "STORE"]), roleGuard(["auditor", "district_manager", "store_manager"]), asyncHandler(getReports));
router.patch("/reports/:id/acknowledge", authGuard, portalGuard(["STORE"]), roleGuard(["store_manager"]), asyncHandler(acknowledgeReport));

export default router;
