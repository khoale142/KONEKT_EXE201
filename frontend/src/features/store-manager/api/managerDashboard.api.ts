import api from "../../../lib/http/axios";

export type StoreDashboardInsights = {
  generatedAt: string;
  today: string;
  windowDays: number;
  dateFrom: string;
  dateTo: string;
  summaryToday: {
    scheduledShifts: number;
    checkedIn: number;
    late: number;
    absent: number;
    awaitingCheckIn: number;
    overdueCheckout: number;
    missingCheckoutOpen: number;
  };
  absentDetails: Array<{
    userId: number;
    fullName: string | null;
    workDate: string;
    shiftLabel: string | null;
    shiftType: string | null;
    scheduledStartAt: string;
    scheduledEndAt: string;
    status: string;
    priority: string;
    priorityLabel: string;
    reason: string;
  }>;
  actionQueue: Array<{
    score: number;
    type: string;
    userId: number;
    fullName: string | null;
    workDate: string;
    headline: string;
    detail: string;
    priorityLabel: string;
  }>;
  lateLeaders: Array<{
    userId: number;
    fullName: string | null;
    count: number;
    lastWorkDate: string;
  }>;
  missingCheckoutLeaders: Array<{
    userId: number;
    fullName: string | null;
    count: number;
  }>;
  hotDays: Array<{
    workDate: string;
    issueCount: number;
    absent: number;
    late: number;
    checkoutIssues: number;
  }>;
  shiftsWithAbsence: Array<{
    workDate: string;
    shiftLabel: string | null;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    absent: number;
    assigned: number;
    note: string;
  }>;
  alerts: string[];
};

export const managerDashboardApi = {
  getTodayReconciliation: (
    storeId: number,
    dateFrom: string,
    dateTo: string
  ) =>
    api
      .get("/staff-attendance/store/reconciliation", {
        params: { storeId, dateFrom, dateTo },
      })
      .then((r) => r.data),

  getDashboardInsights: (storeId: number, windowDays = 7) =>
    api
      .get<StoreDashboardInsights>("/staff-attendance/store/dashboard-insights", {
        params: { storeId, windowDays },
      })
      .then((r) => r.data),
};