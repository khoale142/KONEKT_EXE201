import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { requirePermission, requireStoreAccess } from "../../middlewares/canonicalAuthorizationGuard";
import {
  closePosShiftReconciliation,
  getCurrentPosShiftReconciliation,
  getPosShiftReconciliationDetail,
  listPosShiftReconciliations,
  openPosShiftReconciliation,
  verifyPosShiftClose,
} from "./shiftReconciliation.controller";


const router = Router();

router.use(authGuard, portalGuard(["POS", "STORE", "OFFICE"]));
router.use(
  requirePermission("pos.access"),
  requireStoreAccess((req) => Number(req.headers["x-store-id"] ?? req.query.storeId ?? req.body?.storeId ?? req.user?.storeId) || undefined),
);

router.get("/current", getCurrentPosShiftReconciliation);
router.get("/", listPosShiftReconciliations);
router.post("/open", requirePermission("shift.operate"), openPosShiftReconciliation);
router.get("/:id", getPosShiftReconciliationDetail);
router.post("/:id/verify-close", requirePermission("shift.operate"), verifyPosShiftClose);
router.post("/:id/close", requirePermission("shift.operate"), closePosShiftReconciliation);

export default router;
