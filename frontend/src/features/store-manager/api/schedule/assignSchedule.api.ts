import api from "../../../../lib/http/axios";

type ScheduleItemPayload = {
  workDate: string;
  startTime?: string;
  endTime?: string;
  shiftId?: number;
};

export const assignScheduleApi = {
  deleteSchedule: (scheduleId: number) =>
    api.delete(`/staff-attendance/schedules/${scheduleId}`).then((r) => r.data),

  createSchedule: (data: {
    storeId: number;
    userId: number;
    workDate: string;
    shiftType: "SM" | "FULL_TIME" | "PART_TIME";
    shiftId?: number;
    startTime?: string;
    endTime?: string;
    note?: string;
  }) =>
    api.post("/staff-attendance/schedules", data).then((r) => r.data),

  updateSchedule: (
    scheduleId: number,
    data: {
      shiftId?: number;
      startTime?: string;
      endTime?: string;
      note?: string;
    }
  ) => api.put(`/staff-attendance/schedules/${scheduleId}`, data).then((r) => r.data),

  createSchedulesBatch: (data: {
    storeId: number;
    userId: number;
    shiftType: "SM" | "FULL_TIME" | "PART_TIME";
    schedules: ScheduleItemPayload[];
    note?: string;
  }) =>
    api.post("/staff-attendance/schedules/batch", data).then((r) => r.data),

  listScheduleAuditLogs: (params: { storeId: number; userId: number; workDate: string }) =>
    api.get("/staff-attendance/store/schedules/audit-logs", { params }).then((r) => r.data),

  submitScheduleChangeRequest: (data: {
    storeId: number;
    scheduleIds: number[];
    reason?: string;
    detail?: unknown;
  }) =>
    api.post("/staff-attendance/schedules/change-request", data).then((r) => r.data),
};