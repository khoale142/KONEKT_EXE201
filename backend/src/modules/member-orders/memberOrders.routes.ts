import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  memberCreateOrder,
  memberGetOrderDetail,
  memberListOrders,
  memberPreviewPricing,
  memberPreviewComboRules,
  memberCreateOrderReview,
  memberListOrderIssues,
  memberCreateIssueForOrder,
  memberResumeOrderSummary,
  memberResumeOrderPayment,
  memberCreatePickupPostponeRequest,
} from "./memberOrders.controller";

const router = Router();

router.use(authGuard, portalGuard(["CUSTOMER"]));

router.post("/preview-pricing", memberPreviewPricing);
router.post("/preview-combo-rules", memberPreviewComboRules);
router.post("/", memberCreateOrder);
router.get("/", memberListOrders);
router.get("/issues", memberListOrderIssues);
router.get("/resume-summary", memberResumeOrderSummary);
router.post("/:id/resume-payment", memberResumeOrderPayment);
router.post("/:id/review", memberCreateOrderReview);
router.post("/:id/issues", memberCreateIssueForOrder);
router.post("/:id/pickup-postpone", memberCreatePickupPostponeRequest);
router.get("/:id", memberGetOrderDetail);

export default router;
