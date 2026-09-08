import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  posConfirmOnlineOrder,
  posCreateOrder,
  posCreateOrderForGateway,
  posCreateVoidRequest,
  posGetHeldOrderSnapshot,
  posGetOrderDetail,
  posHoldOrder,
  posListAvailablePromotions,
  posListHeldOrders,
  posListOnlinePendingOrders,
  posListOrders,
  posListPaidOrders,
  posListVoidRequests,
  posPayHeldOrder,
  posPreviewOrderPricing,
  posRefundOrder,
  posVoidHeldOrder,
  posListOrderIssues,
  posUpdateOrderIssueStatus,
  publicGetPickupBoard,
} from "./orders.controller";

const router = Router();

router.get("/pickup-board/:storeId", publicGetPickupBoard);
router.use(authGuard, portalGuard(["POS"]));

router.get("/issues", posListOrderIssues);
router.patch("/issues/:ticketId/status", posUpdateOrderIssueStatus);

router.get("/", posListOrders);
router.get("/held", posListHeldOrders);
router.get("/void-requests", posListVoidRequests);
router.get("/paid-search", posListPaidOrders);
router.get("/online-pending", posListOnlinePendingOrders);

router.post("/preview-pricing", posPreviewOrderPricing);
router.post("/available-promotions", posListAvailablePromotions);
router.post("/hold", posHoldOrder);
router.post("/create-for-gateway", posCreateOrderForGateway);
router.post("/", posCreateOrder);

router.post("/:id/confirm-online", posConfirmOnlineOrder);
router.get("/:id", posGetOrderDetail);
router.get("/:id/hold-snapshot", posGetHeldOrderSnapshot);
router.post("/:id/pay", posPayHeldOrder);
router.post("/:id/cancel-hold", posVoidHeldOrder);
router.post("/:id/void-request", posCreateVoidRequest);
router.post("/:id/refunds", posRefundOrder);

export default router;
