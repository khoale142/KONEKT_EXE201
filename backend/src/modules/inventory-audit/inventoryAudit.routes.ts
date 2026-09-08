import { NextFunction, Request, Response, Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  openBatch,
  getCurrentBatch,
  getBatchWorkspace,
  getPendingShiftLeaderBatches,
  getPendingStoreManagerBatches,
  getPendingDmBatches,
  searchBatches,
  getBatchReport,
  createSheet,
  submitBatch,
  approveShiftLeaderBatch,
  approveStoreManagerBatch,
  approveDmBatch,
  rejectBatch,
  getSheetDetail,
  saveDraftSheet,
  submitSheet,
  recallBatch,
} from "./inventoryAudit.controller";

const router = Router();

router.use(authGuard);

function exactRoleGuard(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles.map((x) => String(x)) : [];
    if (roles.some((role) => allowedRoles.includes(role))) return next();
    return res.status(403).json({ message: "Forbidden (role)" });
  };
}

function mixedPortalGuard(config: { STORE?: string[]; OFFICE?: string[] }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const portal = req.user?.portal;
    const roles = Array.isArray(req.user?.roles) ? req.user.roles.map((x) => String(x)) : [];

    if (portal === "STORE" && config.STORE?.length) {
      return portalGuard(["STORE"])(req, res, () => {
        if (roles.some((role) => config.STORE!.includes(role))) return next();
        return res.status(403).json({ message: "Forbidden (role)" });
      });
    }

    if (portal === "OFFICE" && config.OFFICE?.length) {
      return portalGuard(["OFFICE"])(req, res, () => {
        if (roles.some((role) => config.OFFICE!.includes(role))) return next();
        return res.status(403).json({ message: "Forbidden (role)" });
      });
    }

    return res.status(403).json({ message: "Forbidden (portal)" });
  };
}

const storeBatchCreators = [portalGuard(["STORE"]), roleGuard(["staff", "shift_leader", "store_manager"])];
const shiftLeaderStoreOnly = [portalGuard(["STORE"]), exactRoleGuard(["shift_leader"])];
const storeManagerStoreOnly = [portalGuard(["STORE"]), exactRoleGuard(["store_manager"])];
const officeDmOnly = [portalGuard(["OFFICE"]), exactRoleGuard(["district_manager", "admin"])];
const sharedAuditReaders = mixedPortalGuard({
  STORE: ["staff", "shift_leader", "store_manager"],
  OFFICE: ["district_manager", "admin"],
});
const mixedRejectors = mixedPortalGuard({
  STORE: ["shift_leader", "store_manager"],
  OFFICE: ["district_manager", "admin"],
});

router.post("/batches/open", ...storeBatchCreators, openBatch);
router.get("/batches/current", ...storeBatchCreators, getCurrentBatch);
router.get("/batches/workspace", ...storeBatchCreators, getBatchWorkspace);
router.get("/batches/pending-shift-leader", ...shiftLeaderStoreOnly, getPendingShiftLeaderBatches);
router.get("/batches/pending-store-manager", ...storeManagerStoreOnly, getPendingStoreManagerBatches);
router.get("/batches/pending-dm", ...officeDmOnly, getPendingDmBatches);
router.get("/batches/search", sharedAuditReaders, searchBatches);
router.get("/batches/:id/report", sharedAuditReaders, getBatchReport);
router.post("/batches/:batchId/sheets", ...storeBatchCreators, createSheet);
router.post("/batches/:id/submit", ...storeBatchCreators, submitBatch);
router.post("/batches/:id/approve-shift-leader", ...shiftLeaderStoreOnly, approveShiftLeaderBatch);
router.post("/batches/:id/approve-store-manager", ...storeManagerStoreOnly, approveStoreManagerBatch);
router.post("/batches/:id/approve-dm", ...officeDmOnly, approveDmBatch);
router.post("/batches/:id/reject", mixedRejectors, rejectBatch);

router.get("/sheets/:id", ...storeBatchCreators, getSheetDetail);
router.post("/sheets/:id/save-draft", ...storeBatchCreators, saveDraftSheet);
router.post("/sheets/:id/submit", ...storeBatchCreators, submitSheet);
router.post("/batches/:id/recall", ...storeBatchCreators, recallBatch);

export default router;
