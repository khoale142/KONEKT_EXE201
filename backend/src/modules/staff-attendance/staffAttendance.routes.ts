import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { requirePermission, requireStoreAccess } from '../../middlewares/canonicalAuthorizationGuard';
import {
  checkInHandler,
  checkOutHandler,
  createMyShiftChangeRequestHandler,
  deleteScheduleHandler,
  submitScheduleChangeRequestHandler,
  getStoreDashboardInsightsHandler,
  getStoreReconciliationHandler,
  getTodayAttendanceStatusHandler,
  listMySchedulesHandler,
  listMyScheduleChangeRequestsHandler,
  listMyStoresHandler,
  listStoreAttendanceHandler,
  listScheduleAuditLogsHandler,
  listStoreSchedulesHandler,
  listStoreScheduleChangeRequestsHandler,
  listStoreShiftsHandler,
  listStoreStaffHandler,
  processScheduleChangeRequestHandler,
  updateScheduleHandler,
  upsertStaffScheduleHandler,
  upsertSchedulesBatchHandler,
  createHireFireRequestHandler,
  listMyHireFireRequestsHandler,
} from "./staffAttendance.controller";
import {
  smListComplaintsHandler,
  resolveComplaintHandler,
} from "../head-officer/head-officer.controller";

const router = Router();

router.use(authGuard);
router.use(requirePermission('pos.access'), requireStoreAccess((req) => req.user?.storeId));

/**
 * STORE MANAGER
 */
router.get("/store/my-stores", roleGuard(["store_manager"]), listMyStoresHandler);
router.get("/store/staff", roleGuard(["store_manager"]), listStoreStaffHandler);
router.get("/store/shifts", roleGuard(["store_manager"]), listStoreShiftsHandler);
router.post("/schedules", roleGuard(["store_manager"]), upsertStaffScheduleHandler);
router.post("/schedules/batch", roleGuard(["store_manager"]), upsertSchedulesBatchHandler);
router.put("/schedules/:id", roleGuard(["store_manager"]), updateScheduleHandler);
router.get("/store/schedules", roleGuard(["store_manager"]), listStoreSchedulesHandler);
router.get("/store/schedules/audit-logs", roleGuard(["store_manager"]), listScheduleAuditLogsHandler);
router.delete("/schedules/:id", roleGuard(["store_manager"]), deleteScheduleHandler);
router.post(
  "/schedules/change-request",
  roleGuard(["store_manager"]),
  submitScheduleChangeRequestHandler
);

router.get("/store/attendance", roleGuard(["store_manager"]), listStoreAttendanceHandler);
router.get("/store/reconciliation", roleGuard(["store_manager"]), getStoreReconciliationHandler);
router.get(
  "/store/dashboard-insights",
  roleGuard(["store_manager"]),
  getStoreDashboardInsightsHandler
);
router.get(
  "/store/schedule-requests",
  roleGuard(["store_manager"]),
  listStoreScheduleChangeRequestsHandler
);
router.patch(
  "/schedule-requests/:id/process",
  roleGuard(["store_manager"]),
  processScheduleChangeRequestHandler
);

// Hire / fire requests (Store Manager → District Manager)
router.post("/store/hire-fire-requests", roleGuard(["store_manager"]), createHireFireRequestHandler);
router.get("/store/hire-fire-requests", roleGuard(["store_manager"]), listMyHireFireRequestsHandler);

// ── Complaint management for Store Manager ──
router.get("/complaints", roleGuard(["store_manager"]), smListComplaintsHandler);
router.patch("/complaints/:id/resolve", roleGuard(["store_manager"]), resolveComplaintHandler);

/**
 * STAFF / SHIFT LEADER (xem lịch cá nhân, chấm công)
 */
router.get("/me/schedules", roleGuard(["staff", "shift_leader"]), listMySchedulesHandler);
router.get("/me/schedule-change-requests", roleGuard(["staff", "shift_leader"]), listMyScheduleChangeRequestsHandler);
router.post("/me/schedule-change-requests", roleGuard(["staff", "shift_leader"]), createMyShiftChangeRequestHandler);
router.get("/today", roleGuard(["staff", "shift_leader"]), getTodayAttendanceStatusHandler);
router.post("/check-in", roleGuard(["staff", "shift_leader"]), checkInHandler);
router.post("/check-out", roleGuard(["staff", "shift_leader"]), checkOutHandler);

/**
 * HR MANAGER (read-only oversight — xem chấm công & lịch toàn chuỗi)
 */
router.get("/hr/attendance", roleGuard(["hr_manager", "admin"]), listStoreAttendanceHandler);
router.get("/hr/schedules", roleGuard(["hr_manager", "admin"]), listStoreSchedulesHandler);
router.get("/hr/schedule-requests", roleGuard(["hr_manager", "admin"]), listStoreScheduleChangeRequestsHandler);
router.get("/hr/reconciliation", roleGuard(["hr_manager", "admin"]), getStoreReconciliationHandler);

export default router;
