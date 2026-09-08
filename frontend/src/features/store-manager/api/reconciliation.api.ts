import api from "../../../lib/http/axios";

export type ReconciliationRow = {
  id: string;
  source: "SCHEDULE" | "OUTSIDE_SCHEDULE";
  scheduleId: number | null;
  attendanceId: number | null;
  storeId: number;
  userId: number;
  fullName: string | null;
  employmentType: string | null;
  workDate: string;
  shiftType: string | null;
  shiftLabel: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceStatus: string | null;
  classification: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    anomalies?: {
      earlyCheckInMinutes: number;
      earlyCheckOutMinutes: number;
      issues: string[];
      hasAbnormalIssue: boolean;
    };
  };
  mismatch: {
    status: "MATCH" | "MISMATCH";
    impactLevel: "high" | "medium" | "low";
    mismatchTypes: string[];
    detail: string;
  };
};

export type ReconciliationResponse = {
  summary: {
    totalRows: number;
    mismatchRows: number;
    highImpact: number;
    mediumImpact: number;
    noAttendance: number;
    outsideSchedule: number;
  };
  reconciliations: ReconciliationRow[];
};

export const reconciliationApi = {
  getStoreReconciliation: (
    storeId: number,
    dateFrom: string,
    dateTo: string
  ) =>
    api
      .get<ReconciliationResponse>("/staff-attendance/store/reconciliation", {
        params: { storeId, dateFrom, dateTo },
      })
      .then((r) => r.data),
};