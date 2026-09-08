import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { getPosMenu } from "../modules/menu/menu.service";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import headOfficerRoutes from "./head-officer.routes";
import marketingRoutes from "../modules/marketing/marketing.routes";
import auditRoutes from "../modules/audit/audit.routes";
import posOrdersRoutes from "../modules/orders/orders.routes";
import kdsRoutes from "../modules/kds/kds.routes";
import posMenuRoutes from "../modules/menu/menu.routes";
import membersRoutes from "../modules/members/members.routes";
import chatRoutes from "./chat.routes";
import paymentsRoutes from "../modules/payments/payments.routes";
import inventoryAuditRoutes from "../modules/inventory-audit/inventoryAudit.routes";
import storesRoutes from "../modules/stores/stores.routes";
import storeReportRoutes from "../modules/store-report/storeReport.routes";
import comboRuleRoutes from "../modules/combo-rules/comboRule.routes";
import promotionsRoutes from "../modules/promotions/promotions.routes";
import shiftReconciliationRoutes from "../modules/shift-reconciliation/shiftReconciliation.routes";
import storeReviewsRoutes from "../modules/store-reviews/storeReviews.routes";
import staffAttendanceRoutes from "../modules/staff-attendance/staffAttendance.routes";
import payrollRoutes from "../modules/payroll/payroll.routes";
import posActionLogRoutes from "../modules/pos-action-log/posActionLog.routes";
import memberOrdersRoutes from "../modules/member-orders/memberOrders.routes";
import notificationsRoutes from "../modules/notifications/notifications.routes";
import opsNotificationsRoutes from "../modules/ops-notifications/opsNotifications.routes";
import rewardsRoutes from "../modules/rewards/rewards.routes";
import inventoryReceiptRoutes from "../modules/inventory-receipts/inventoryReceipt.routes";
import inventoryDisposalRoutes from "../modules/inventory-disposals/inventoryDisposals.routes";

import userDocumentsRoutes from "../modules/user-documents/userDocuments.routes";
import profileUpdateRequestRoutes from "../modules/profile-update-request/profileUpdateRequest.routes";
import storeManagerStaffRoutes from "../modules/store-manager-staff/storeManagerStaff.routes";


const router = Router();

router.get(
  "/menu",
  asyncHandler(async (_req, res) => {
    const data = await getPosMenu();
    res.json(data);
  })
);

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/head-officer", headOfficerRoutes);
router.use("/marketing", marketingRoutes);
router.use("/audit", auditRoutes);
router.use("/pos/orders", posOrdersRoutes);
router.use("/kds", kdsRoutes);
router.use("/pos/menu", posMenuRoutes);
router.use("/pos/members", membersRoutes);
router.use("/pos/action-logs", posActionLogRoutes);
router.use("/chat", chatRoutes);
router.use("/payments", paymentsRoutes);
router.use("/inventory-audit", inventoryAuditRoutes);
router.use("/stores", storesRoutes);
router.use("/store-reports", storeReportRoutes);
router.use("/pos/combo-rules", comboRuleRoutes);
router.use("/promotions", promotionsRoutes);
router.use("/pos/shift-reconciliations", shiftReconciliationRoutes);
router.use("/store-reviews", storeReviewsRoutes);
router.use("/staff-attendance", staffAttendanceRoutes);
router.use("/payroll", payrollRoutes);
router.use("/member-orders", memberOrdersRoutes);
router.use("/store-manager", storeManagerStaffRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/ops-notifications", opsNotificationsRoutes);
router.use("/rewards", rewardsRoutes);
router.use("/inventory-receipts", inventoryReceiptRoutes);
router.use("/inventory-disposals", inventoryDisposalRoutes);
router.use("/user-documents", userDocumentsRoutes);
router.use("/profile-update-request", profileUpdateRequestRoutes);


export default router;

