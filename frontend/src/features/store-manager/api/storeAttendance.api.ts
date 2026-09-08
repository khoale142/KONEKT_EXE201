import api from "../../../lib/http/axios";

export const storeAttendanceApi = {
  getStoreAttendance: (
    storeId: number,
    dateFrom: string,
    dateTo: string
  ) =>
    api
      .get("/staff-attendance/store/attendance", {
        params: { storeId, dateFrom, dateTo },
      })
      .then((r) => r.data),
};