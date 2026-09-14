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
  requireStoreAccess((req) => Number(req.headers["x-store-id"] ?? req.query.storeId ?? req.body?.storeId ?? req.user?.storeId ?? req.user?.storeIds?.[0]) || undefined),
);

router.get("/current", getCurrentPosShiftReconciliation);
router.get("/", listPosShiftReconciliations);
router.post("/open", openPosShiftReconciliation);
router.get("/:id", getPosShiftReconciliationDetail);
router.post("/:id/verify-close", verifyPosShiftClose);
router.post("/:id/close", closePosShiftReconciliation);

export default router;
