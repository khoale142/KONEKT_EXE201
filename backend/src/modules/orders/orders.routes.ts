import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  posConfirmOnlineOrder,
  posCreateVoidRequest,
  posListOnlinePendingOrders,
  posListVoidRequests,
  posRefundOrder,
  posListOrderIssues,
  posUpdateOrderIssueStatus,
  publicGetPickupBoard,
} from "./orders.controller";
import {
  posCreateOrderHandler,
  posListOrdersHandler,
  posGetOrderDetailHandler,
  posHoldOrderHandler,
  posListHeldOrdersHandler,
  posDeleteHeldOrderHandler,
  posListPaidOrdersHandler,
  posGetStoreConfigHandler,
  posUpdateStoreConfigHandler,
  posPreviewOrderPricingHandler,
  posListAvailablePromotionsHandler,
  posGetHeldOrderSnapshotHandler,
  posPayHeldOrderHandler,
} from "../pos-orders/posOrder.controller";

const router = Router();

router.get("/pickup-board/:storeId", publicGetPickupBoard);
router.use(authGuard, portalGuard(["POS"]));

// Cấu hình POS Store Settings
router.get("/config", posGetStoreConfigHandler);
router.patch("/config", posUpdateStoreConfigHandler);

// Đơn tạm lưu (Hold orders)
router.get("/held", posListHeldOrdersHandler);
router.post("/hold", posHoldOrderHandler);
router.delete("/held/:id", posDeleteHeldOrderHandler);

// Tra cứu đơn đã bán (Paid search)
router.get("/paid-search", posListPaidOrdersHandler);

// Tạo đơn & danh sách đơn
router.get("/", posListOrdersHandler);
router.post("/create-for-gateway", posCreateOrderHandler);
router.post("/", posCreateOrderHandler);

// Chi tiết đơn
router.get("/:id", posGetOrderDetailHandler);

// POS Drizzle-native routes (thay thế hoàn toàn legacy coffee_chain_db)
router.post("/preview-pricing", posPreviewOrderPricingHandler);
router.post("/available-promotions", posListAvailablePromotionsHandler);
router.get("/:id/hold-snapshot", posGetHeldOrderSnapshotHandler);
router.post("/:id/pay", posPayHeldOrderHandler);
router.post("/:id/cancel-hold", posDeleteHeldOrderHandler);

// Legacy fallback routes (nếu còn component cũ gọi)
router.get("/issues", posListOrderIssues);
router.patch("/issues/:ticketId/status", posUpdateOrderIssueStatus);
router.get("/void-requests", posListVoidRequests);
router.get("/online-pending", posListOnlinePendingOrders);
router.post("/:id/confirm-online", posConfirmOnlineOrder);
router.post("/:id/void-request", posCreateVoidRequest);
router.post("/:id/refunds", posRefundOrder);

export default router;

