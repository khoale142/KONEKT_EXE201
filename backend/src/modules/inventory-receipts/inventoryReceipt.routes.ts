import { NextFunction, Request, Response, Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  getIngredients,
  openReceipt,
  getCurrentReceipt,
  getReceiptWorkspace,
  createSheet,
  getSheetDetail,
  saveDraftSheet,
  submitSheet,
  getReceiptReport,
  submitReceipt,
  approveShiftLeaderReceipt,
  approveStoreManagerReceipt,
  rejectReceipt,
  searchReceipts,
  getPendingShiftLeaderList,
  getPendingStoreManagerList,
} from "./inventoryReceipt.controller";

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

const storeReceiptCreators = [portalGuard(["STORE"]), roleGuard(["staff", "shift_leader", "store_manager"])];
const shiftLeaderStoreOnly = [portalGuard(["STORE"]), exactRoleGuard(["shift_leader"])];
const storeManagerStoreOnly = [portalGuard(["STORE"]), exactRoleGuard(["store_manager"])];
const storeRejectors = [portalGuard(["STORE"]), exactRoleGuard(["shift_leader", "store_manager"])];
const sharedReceiptReaders = mixedPortalGuard({
  STORE: ["staff", "shift_leader", "store_manager"],
  OFFICE: ["district_manager", "admin"],
});

router.get("/ingredients", ...storeReceiptCreators, getIngredients);
router.post("/receipts/open", ...storeReceiptCreators, openReceipt);
router.get("/receipts/current", ...storeReceiptCreators, getCurrentReceipt);
router.get("/receipts/workspace", ...storeReceiptCreators, getReceiptWorkspace);
router.get("/receipts/search", sharedReceiptReaders, searchReceipts);
router.get("/receipts/pending-shift-leader", ...shiftLeaderStoreOnly, getPendingShiftLeaderList);
router.get("/receipts/pending-store-manager", ...storeManagerStoreOnly, getPendingStoreManagerList);
router.get("/receipts/:id/report", sharedReceiptReaders, getReceiptReport);
router.post("/receipts/:receiptId/sheets", ...storeReceiptCreators, createSheet);
router.post("/receipts/:id/submit", ...storeReceiptCreators, submitReceipt);
router.post("/receipts/:id/approve-shift-leader", ...shiftLeaderStoreOnly, approveShiftLeaderReceipt);
router.post("/receipts/:id/approve-store-manager", ...storeManagerStoreOnly, approveStoreManagerReceipt);
router.post("/receipts/:id/reject", ...storeRejectors, rejectReceipt);

router.get("/sheets/:id", ...storeReceiptCreators, getSheetDetail);
router.post("/sheets/:id/save-draft", ...storeReceiptCreators, saveDraftSheet);
router.post("/sheets/:id/submit", ...storeReceiptCreators, submitSheet);

export default router;
