import api from "../../../../lib/http/axios";

export const managerScheduleApi = {
  getStoreSchedules: (
    storeId: number,
    dateFrom: string,
    dateTo: string
  ) =>
    api
      .get("/staff-attendance/store/schedules", {
        params: { storeId, dateFrom, dateTo },
      })
      .then((r) => r.data),

  getStoreScheduleRequests: (storeId: number, status?: string) =>
    api
      .get("/staff-attendance/store/schedule-requests", {
        params: { storeId, status },
      })
      .then((r) => r.data),

  processScheduleRequest: (requestId: number, status: "approved" | "rejected", note?: string) =>
    api
      .patch(`/staff-attendance/schedule-requests/${requestId}/process`, { status, note })
      .then((r) => r.data),
};