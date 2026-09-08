import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  closePosShiftReconciliation,
  getCurrentPosShiftReconciliation,
  getPosShiftReconciliationDetail,
  listPosShiftReconciliations,
  openPosShiftReconciliation,
  verifyPosShiftClose,
} from "./shiftReconciliation.controller";

const router = Router();

router.use(authGuard, portalGuard(["POS"]));

router.get("/current", getCurrentPosShiftReconciliation);
router.get("/", listPosShiftReconciliations);
router.post("/open", openPosShiftReconciliation);
router.get("/:id", getPosShiftReconciliationDetail);
router.post("/:id/verify-close", verifyPosShiftClose);
router.post("/:id/close", closePosShiftReconciliation);

export default router;