import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  revenueReport,
  revenueAnalysisReport,
  wasteReport,
  payrollReport,
  listHrRequests,
  listRequests,
  approveHrRequest,
  approveRequest,
  rejectHrRequest,
  rejectRequest,
  listComplaints,
  listProfileEditRequests,
  submitProfileEditRequest,
  storeDetail,
  listHrEmployeesHandler,
  getStoreStaffHandler,
  updateStaffWageHandler,
  getWasteDetailHandler,
  // New DM modules
  payrollReportV2,
  updatePtPct,
  inventoryWasteSummary,
  assignComplaintHandler,
  getStoreManagersHandler,
  revenueTargetsHandler,
  setRevenueTargetHandler,
  // Phase 1: Trend + Alerts
  revenueTrendHandler,
  wasteTrendHandler,
  complaintAlertsHandler,
  // Task 1 & 2
  revenueStatsHandler,
  dashboardInsightsHandler,
  // Task 3 — per-store granular
  storeFinanceHandler,
  storeStockPagedHandler,
  storeProductsPagedHandler,
} from "./head-officer.controller";

const router = Router();

// Tất cả route cần đăng nhập OFFICE portal + role district_manager (hoặc admin có thể xem)
router.use(authGuard, portalGuard(["OFFICE"]), roleGuard(["district_manager", "hr_manager", "admin"]));

// Báo cáo
router.get("/reports/revenue", revenueReport);
router.get("/reports/revenue/analysis", revenueAnalysisReport);
router.get("/reports/waste", wasteReport);
router.get("/reports/payroll", payrollReport);

// Request tuyển dụng / sa thải
router.get("/hr/requests", roleGuard(["hr_manager", "admin"]), listHrRequests);
router.get("/hr/employees", roleGuard(["hr_manager", "admin"]), listHrEmployeesHandler);
router.patch("/hr/requests/:id/approve", roleGuard(["hr_manager", "admin"]), approveHrRequest);
router.patch("/hr/requests/:id/reject", roleGuard(["hr_manager", "admin"]), rejectHrRequest);
router.get("/requests", roleGuard(["district_manager", "admin"]), listRequests);
router.patch("/requests/:id/approve", roleGuard(["district_manager", "admin"]), approveRequest);
router.patch("/requests/:id/reject", roleGuard(["district_manager", "admin"]), rejectRequest);

// Complaints (customer_tickets)
router.get("/complaints", listComplaints);

// Profile edit requests (schedule_requests + request_type='profile_update')
router.get("/profile-edit-requests", listProfileEditRequests);
router.post("/profile-edit-requests", submitProfileEditRequest);
// approve/reject shared with schedule_requests above (/requests/:id/approve|reject)

// Chi tiết cơ sở
router.get("/stores/:storeId/detail", storeDetail);
router.get("/stores/:storeId/staff", getStoreStaffHandler);
router.patch("/staff/:userId/wage", updateStaffWageHandler);

// Hủy hàng chi tiết — chỉ xem, không được tạo từ portal OFFICE
router.get("/stores/:storeId/waste", getWasteDetailHandler);

// ── Module 1: Quỹ lương PT/FT ──
router.get("/reports/payroll-v2",           payrollReportV2);
router.patch("/stores/:storeId/pt-pct",    updatePtPct);

// ── Module 2: Tồn kho & Hủy hàng ──
router.get("/inventory-waste",              inventoryWasteSummary);

// ── Module 3: Assign complaint ──
router.patch("/complaints/:id/assign",      assignComplaintHandler);
router.get("/stores/:storeId/managers",    getStoreManagersHandler);

// ── Module 4: Target doanh thu ──
router.get("/revenue-targets",             revenueTargetsHandler);
router.patch("/stores/:storeId/revenue-target", setRevenueTargetHandler);

// ── Phase 1: Trend APIs (MoM comparison) ──
router.get("/reports/revenue-trend",       revenueTrendHandler);
router.get("/reports/waste-trend",         wasteTrendHandler);
router.get("/complaints/alerts",           complaintAlertsHandler);

// ── Task 1: Revenue Stats MoM ──
router.get("/revenue-stats",               revenueStatsHandler);
// ── Task 2: Dashboard Insights ──
router.get("/dashboard-insights",          dashboardInsightsHandler);

// ── Task 3: Per-store granular (finance, stock paged, products paged) ──
router.get("/stores/:storeId/finance",   storeFinanceHandler);
router.get("/stores/:storeId/stock",     storeStockPagedHandler);
router.get("/stores/:storeId/products",  storeProductsPagedHandler);

export default router;
