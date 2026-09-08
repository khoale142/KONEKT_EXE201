import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  approveInventoryDisposalOrder,
  cancelInventoryDisposalOrder,
  cancelInventoryDisposalReport,
  createInventoryDisposalOrder,
  createInventoryDisposalReport,
  getInventoryDisposalOrderDetail,
  listInventoryDisposalIngredientOptions,
  listInventoryDisposalOrders,
  listInventoryDisposalProductVariantOptions,
  listMyInventoryDisposalReports,
  listStoreInventoryDisposalReports,
  markInventoryDisposalReportDuplicate,
  markInventoryDisposalReportVerified,
  releaseInventoryDisposalReportBackToStock,
  returnInventoryDisposalOrderToSm,
  submitInventoryDisposalOrder,
} from "./inventoryDisposals.controller";

const router = Router();

router.use(authGuard);

router.get("/lookups/ingredients", listInventoryDisposalIngredientOptions);
router.get("/lookups/variants", listInventoryDisposalProductVariantOptions);

// Staff / Shift leader / SM tạo report
router.post(
  "/reports",
  portalGuard(["STORE"]),
  roleGuard(["staff", "shift_leader", "store_manager"]),
  createInventoryDisposalReport
);

router.get(
  "/reports/my",
  portalGuard(["STORE"]),
  roleGuard(["staff", "shift_leader", "store_manager"]),
  listMyInventoryDisposalReports
);

// SM review report
router.get(
  "/reports/store-review",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  listStoreInventoryDisposalReports
);

router.patch(
  "/reports/:id/cancel",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  cancelInventoryDisposalReport
);

router.patch(
  "/reports/:id/mark-verified",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  markInventoryDisposalReportVerified
);

router.patch(
  "/reports/:id/mark-duplicate",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  markInventoryDisposalReportDuplicate
);

router.patch(
  "/reports/:id/release-back",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  releaseInventoryDisposalReportBackToStock
);

// SM tạo + submit lệnh hủy
router.post(
  "/orders",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  createInventoryDisposalOrder
);

router.get(
  "/orders",
  portalGuard(["STORE", "OFFICE"]),
  roleGuard(["store_manager", "district_manager"]),
  listInventoryDisposalOrders
);

router.get(
  "/orders/:id",
  portalGuard(["STORE", "OFFICE"]),
  roleGuard(["store_manager", "district_manager"]),
  getInventoryDisposalOrderDetail
);

router.post(
  "/orders/:id/submit",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  submitInventoryDisposalOrder
);

router.post(
  "/orders/:id/cancel",
  portalGuard(["STORE"]),
  roleGuard(["store_manager"]),
  cancelInventoryDisposalOrder
);

// DM xử lý
router.post(
  "/orders/:id/return",
  portalGuard(["OFFICE"]),
  roleGuard(["district_manager"]),
  returnInventoryDisposalOrderToSm
);

router.post(
  "/orders/:id/approve",
  portalGuard(["OFFICE"]),
  roleGuard(["district_manager"]),
  approveInventoryDisposalOrder
);

export default router;