/**
 * HR Attendance API — gọi backend endpoint dành cho hr_manager.
 * Read-only: xem chấm công, lịch ca, yêu cầu đổi ca toàn chuỗi.
 *
 * Backend trả camelCase (mapScheduleRow / mapAttendanceRow).
 */
import api from "../../../../lib/http/axios";
import type { ScheduleRequestDetail } from "../../../shared/utils/scheduleRequestDetails";

/* ── Schedule types (from mapScheduleRowWithClassification) ── */
export type ScheduleRecord = {
  id: number;
  storeId: number;
  userId: number;
  workDate: string;
  shiftId?: number | null;
  shiftType?: string;
  shiftLabel?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  status?: string;
  note?: string | null;
  storeName?: string | null;
  fullName?: string | null;
  employmentType?: string | null;
  lateGraceMinutes?: number;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  attendanceStatus?: string | null;
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

/* ── Attendance types (from listStoreAttendance → mapAttendanceRow) ── */
export type AttendanceRecord = {
  id: number;
  scheduleId?: number | null;
  storeId: number;
  userId: number;
  attendanceDate?: string;
  workDate?: string;
  fullName?: string | null;
  storeName?: string | null;
  shiftType?: string | null;
  shiftLabel?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status?: string;
  checkInNote?: string | null;
  checkOutNote?: string | null;
  lateGraceMinutes?: number;
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

/* ── Schedule Change Request ── */
export type ScheduleChangeRequest = {
  id: number;
  userId?: number;
  storeId?: number;
  requestDate?: string;
  requestType?: string | null;
  status?: string;
  createdAt?: string | null;
  detail?: ScheduleRequestDetail | null;
  requesterName?: string;
  shiftName?: string;
  note?: string;
};

/* ── API calls ── */

export async function fetchHrAttendance(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<AttendanceRecord[]> {
  const r = await api.get("/staff-attendance/hr/attendance", { params });
  const data = r.data as { attendances?: AttendanceRecord[]; records?: AttendanceRecord[]; data?: AttendanceRecord[] };
  return data.attendances ?? data.records ?? data.data ?? (Array.isArray(r.data) ? r.data : []);
}

export async function fetchHrSchedules(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<ScheduleRecord[]> {
  const r = await api.get("/staff-attendance/hr/schedules", { params });
  const data = r.data as { schedules?: ScheduleRecord[]; data?: ScheduleRecord[] };
  return data.schedules ?? data.data ?? (Array.isArray(r.data) ? r.data : []);
}

export async function fetchHrScheduleRequests(params: {
  storeId: number;
  status?: string;
}): Promise<ScheduleChangeRequest[]> {
  const r = await api.get("/staff-attendance/hr/schedule-requests", { params });
  const data = r.data as { requests?: ScheduleChangeRequest[]; data?: ScheduleChangeRequest[] };
  return data.requests ?? data.data ?? (Array.isArray(r.data) ? r.data : []);
}
