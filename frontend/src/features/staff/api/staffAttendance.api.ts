import api from "../../../lib/http/axios";

export const staffAttendanceApi = {

  getMySchedules: (dateFrom: string, dateTo: string, _cacheBust?: number) =>
    api
      .get("/staff-attendance/me/schedules", {
        params: { dateFrom, dateTo, _: _cacheBust ?? Date.now() },
      })
      .then((r) => r.data),

  getTodayStatus: () =>
    api.get("/staff-attendance/today").then((r) => r.data),

  checkIn: (params?: { note?: string; latitude?: number; longitude?: number }) =>
    api.post("/staff-attendance/check-in", params ?? {}).then((r) => r.data),

  checkOut: (params?: { note?: string; latitude?: number; longitude?: number }) =>
    api.post("/staff-attendance/check-out", params ?? {}).then((r) => r.data),

  getMyScheduleChangeRequests: (dateFrom: string, dateTo: string) =>
    api.get("/staff-attendance/me/schedule-change-requests", { params: { dateFrom, dateTo } }).then((r) => r.data),

  createMyScheduleChangeRequest: (data: {
    storeId: number;
    scheduleId: number;
    requestType: "DROP_SHIFT" | "CHANGE_TIME" | "CHANGE_SHIFT";
    reason: string;
    desiredWorkDate?: string;
    desiredShiftId?: number;
    desiredShiftLabel?: string;
    desiredStartTime?: string;
    desiredEndTime?: string;
  }) =>
    api.post("/staff-attendance/me/schedule-change-requests", data).then((r) => r.data),
};
