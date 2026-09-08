import { ApiError } from "../../utils/apiError";
import {
  formatShiftTypeForApi,
  parseEmploymentTypeLoose,
} from "../../utils/employmentShiftTypes";
import * as repo from "./staffAttendance.repo";
import * as notificationService from "../ops-notifications/opsNotifications.service";

type ReqUser = {
  sub?: number | string;
  id?: number | string;
  roles?: string[];
  storeId?: number | string;
  storeIds?: Array<number | string>;
};

function getActorUserId(reqUser: ReqUser | undefined): number {
  const raw = reqUser?.sub ?? reqUser?.id;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(401, "Unauthorized");
  return n;
}

function getActorRoles(reqUser: ReqUser | undefined): string[] {
  return Array.isArray(reqUser?.roles) ? reqUser!.roles! : [];
}

function getActorStoreIds(reqUser: ReqUser | undefined): number[] {
  const fromArray = Array.isArray(reqUser?.storeIds)
    ? reqUser!.storeIds!.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : [];

  const single = Number(reqUser?.storeId);
  if (Number.isFinite(single)) fromArray.push(single);

  return [...new Set(fromArray)];
}

function hasGlobalStoreAccess(reqUser: ReqUser | undefined) {
  const roles = getActorRoles(reqUser);
  return roles.some((r) =>
    ["admin", "district_manager", "auditor", "marketing_sale", "hr_manager"].includes(r),
  );
}

function assertCanAccessStore(reqUser: ReqUser | undefined, storeId: number) {
  if (hasGlobalStoreAccess(reqUser)) return;

  const storeIds = getActorStoreIds(reqUser);
  if (!storeIds.includes(storeId)) {
    throw new ApiError(403, "Không có quyền truy cập cửa hàng này");
  }
}

function normalizeDate(input?: string | null) {
  if (!input) return undefined;
  const v = String(input).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, "Ngày không hợp lệ, dùng định dạng YYYY-MM-DD");
  }
  return v;
}

function normalizeTime(input?: string | null) {
  if (!input) return undefined;
  const v = String(input).trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) {
    throw new ApiError(400, "Giờ không hợp lệ, dùng định dạng HH:mm");
  }
  return v;
}

/** Combine date + time as Asia/Ho_Chi_Minh (UTC+7) for storage. Dùng ISO 8601 để parse đúng timezone. */
function normalizeLooseText(input?: string | null) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function combineDateTime(workDate: string, hhmm: string) {
  return `${workDate}T${hhmm}:00+07:00`;
}

function deriveScheduleTime(params: {
  workDate: string;
  shiftType: "SM" | "FULL_TIME" | "PART_TIME";
  startTime?: string;
  endTime?: string;
  shiftRow?: any;
}) {
  if (params.shiftRow) {
    return {
      shiftLabel: params.shiftRow.name ?? null,
      scheduledStartAt: combineDateTime(
        params.workDate,
        params.shiftRow.start_time.slice(0, 5),
      ),
      scheduledEndAt: combineDateTime(
        params.workDate,
        params.shiftRow.end_time.slice(0, 5),
      ),
    };
  }

  if (params.shiftType === "SM") {
    return {
      // UI sẽ hiển thị theo shiftType (SM -> "Quản lý")
      shiftLabel: null,
      scheduledStartAt: combineDateTime(params.workDate, "07:00"),
      scheduledEndAt: combineDateTime(params.workDate, "23:00"),
    };
  }

  const startTime = normalizeTime(params.startTime);
  const endTime = normalizeTime(params.endTime);

  if (!startTime || !endTime) {
    throw new ApiError(400, "Cần startTime và endTime khi không dùng shiftId");
  }

  if (startTime >= endTime) {
    throw new ApiError(400, "Giờ bắt đầu phải nhỏ hơn giờ kết thúc");
  }

  return {
    // UI sẽ hiển thị theo shiftType (PART_TIME -> "Bán thời gian")
    shiftLabel: null,
    scheduledStartAt: combineDateTime(params.workDate, startTime),
    scheduledEndAt: combineDateTime(params.workDate, endTime),
  };
}

/** Luôn trả workDate dạng YYYY-MM-DD để frontend map đúng theo ngày tuần. Dùng timezone VN để tránh lệch Chủ nhật/ngày. */
function toWorkDateYMD(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const s = String(value).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  }
  const d = value instanceof Date ? value : new Date(value as Date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function mapScheduleRow(row: any) {
  const employmentRaw = row.employment_type ?? null;
  return {
    id: Number(row.id),
    storeId: Number(row.store_id),
    userId: Number(row.user_id),
    workDate:
      toWorkDateYMD(row.work_date) || String(row.work_date ?? "").slice(0, 10),
    shiftId: row.shift_id != null ? Number(row.shift_id) : null,
    shiftType: formatShiftTypeForApi(row.shift_type),
    shiftLabel: row.shift_label ?? row.shift_name ?? null,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    status: String(row.status),
    note: row.note ?? null,
    storeName: row.store_name ?? null,
    fullName: row.full_name ?? null,
    employmentType: parseEmploymentTypeLoose(employmentRaw) ?? employmentRaw,
    lateGraceMinutes:
      row.late_grace_minutes != null ? Number(row.late_grace_minutes) : 5,
    checkInAt: row.check_in_at ?? null,
    checkOutAt: row.check_out_at ?? null,
    attendanceStatus: row.attendance_status ?? null,
  };
}

function mapScheduleRowWithClassification(row: any) {
  const base = mapScheduleRow(row);
  return {
    ...base,
    classification: buildAttendanceClassification({
      scheduledStartAt: row.scheduled_start_at,
      scheduledEndAt: row.scheduled_end_at,
      checkInAt: row.check_in_at ?? null,
      checkOutAt: row.check_out_at ?? null,
      lateGraceMinutes: Number(row.late_grace_minutes ?? 5),
      referenceTime: referenceTimeForListedShiftClassification(
        row.scheduled_end_at,
      ),
    }),
  };
}

function mapAttendanceRow(row: any) {
  return {
    id: Number(row.id),
    scheduleId: row.schedule_id != null ? Number(row.schedule_id) : null,
    storeId: Number(row.store_id),
    userId: Number(row.user_id),
    attendanceDate: String(row.attendance_date),
    checkInAt: row.check_in_at ?? null,
    checkOutAt: row.check_out_at ?? null,
    status: String(row.status),
    checkInNote: row.check_in_note ?? null,
    checkOutNote: row.check_out_note ?? null,
    fullName: row.full_name ?? null,
    shiftType:
      row.shift_type != null ? formatShiftTypeForApi(row.shift_type) : null,
    shiftLabel: row.shift_label ?? row.shift_name ?? null,
    scheduledStartAt: row.scheduled_start_at ?? null,
    scheduledEndAt: row.scheduled_end_at ?? null,
    lateGraceMinutes:
      row.late_grace_minutes != null ? Number(row.late_grace_minutes) : 5,
  };
}

function diffMinutes(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / 60000);
}

/** Haversine: khoảng cách (mét) giữa 2 điểm. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Kiểm tra vị trí có trong phạm vi cửa hàng không. */
function isWithinStoreRadius(params: {
  userLat: number;
  userLng: number;
  storeLat: number | null;
  storeLng: number | null;
  radiusMeters: number;
}): boolean {
  if (
    params.storeLat == null ||
    params.storeLng == null ||
    !Number.isFinite(params.storeLat) ||
    !Number.isFinite(params.storeLng)
  ) {
    return true;
  }
  if (!Number.isFinite(params.userLat) || !Number.isFinite(params.userLng)) {
    return false;
  }
  const radius = Number(params.radiusMeters) || 200;
  const dist = haversineMeters(
    params.userLat,
    params.userLng,
    params.storeLat,
    params.storeLng,
  );
  return dist <= radius;
}

/** Lấy thời điểm hiện tại (instant, dùng cho check-in/check-out). */
function now(): Date {
  return new Date();
}

/** Ngày hôm nay theo timezone Asia/Ho_Chi_Minh (YYYY-MM-DD). */
function todayHCM(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatPartsInHcm(value: unknown): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (!year || !month || !day || !hour || !minute) return null;
  return { year, month, day, hour, minute };
}

function getScheduleRequestExpiredNote(schedule: any): string | null {
  if (!schedule) {
    return "Ca hiện tại không còn khả dụng trên lịch làm việc nên yêu cầu tự hết hạn.";
  }

  if (String(schedule.status || "").toLowerCase() !== "assigned") {
    return "Ca hiện tại không còn ở trạng thái được phân công nên yêu cầu tự hết hạn.";
  }

  const startMs = schedule.scheduled_start_at
    ? new Date(schedule.scheduled_start_at).getTime()
    : NaN;
  if (Number.isFinite(startMs) && startMs <= Date.now()) {
    return "Đã quá giờ vào ca hiện tại nên yêu cầu tự hết hạn.";
  }

  return null;
}

async function autoExpirePendingScheduleChangeRow(row: any) {
  if (String(row?.status || "").toLowerCase() !== "pending") {
    return row;
  }

  let detail: any = null;
  try {
    detail = row?.note ? JSON.parse(String(row.note)) : null;
  } catch {
    detail = null;
  }

  const scheduleId = Number(detail?.scheduleId);
  if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
    return row;
  }

  const schedule = await repo.findScheduleById(scheduleId);
  const expiredNote = getScheduleRequestExpiredNote(schedule);
  if (!expiredNote) {
    return row;
  }

  const mergedDetail = {
    ...(detail && typeof detail === "object" ? detail : {}),
    decision: {
      status: "expired",
      note: expiredNote,
      processedAt: new Date().toISOString(),
      autoExpired: true,
    },
  };

  const updated = await repo.updateScheduleRequestStatus({
    requestId: Number(row.id),
    status: "expired",
    note: JSON.stringify(mergedDetail),
  });

  return (
    updated || {
      ...row,
      status: "expired",
      note: JSON.stringify(mergedDetail),
      updated_at: new Date().toISOString(),
    }
  );
}

async function autoExpirePendingScheduleChangeRows(rows: any[]) {
  return Promise.all((rows ?? []).map((row) => autoExpirePendingScheduleChangeRow(row)));
}

const MSG_SCHEDULE_LOCKED =
  "Không thể sửa/xóa trực tiếp lịch đã qua hoặc đã có chấm công. Vui lòng gửi yêu cầu chỉnh sửa lịch và chờ duyệt.";

function isPastWorkDate(workDate: string): boolean {
  return workDate < todayHCM();
}

function scheduleAuditSnapshot(row: any) {
  return {
    id: Number(row.id),
    storeId: Number(row.store_id),
    userId: Number(row.user_id),
    workDate: workDateYmdFromScheduleRow(row),
    shiftId: row.shift_id != null ? Number(row.shift_id) : null,
    shiftType: formatShiftTypeForApi(row.shift_type),
    shiftLabel: row.shift_label ?? null,
    scheduledStartAt: row.scheduled_start_at ?? null,
    scheduledEndAt: row.scheduled_end_at ?? null,
    status: row.status ?? null,
    note: row.note ?? null,
  };
}

function hhmmFromDateTime(value: unknown): string | undefined {
  const parts = formatPartsInHcm(value);
  if (!parts) return undefined;
  return `${parts.hour}:${parts.minute}`;
}

function workDateYmdFromScheduleRow(row: any): string {
  return (
    toWorkDateYMD(row.work_date) || String(row.work_date ?? "").slice(0, 10)
  );
}

/** Khóa sửa/xóa trực tiếp: ngày làm &lt; hôm nay VN, hoặc ca đã kết thúc trong hôm nay, hoặc đã có check-in. */
function isScheduleLockedForDirectMutation(
  row: any,
  attendanceCheckIn: Date | string | null | undefined,
): boolean {
  const workDate = workDateYmdFromScheduleRow(row);
  const today = todayHCM();
  if (workDate < today) return true;
  if (attendanceCheckIn != null) return true;
  const endMs = row.scheduled_end_at
    ? new Date(row.scheduled_end_at).getTime()
    : NaN;
  if (workDate === today && Number.isFinite(endMs) && Date.now() > endMs)
    return true;
  return false;
}

/** Cộng trừ ngày trên chuỗi YYYY-MM-DD (lịch dương). */
function addDaysYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]) + deltaDays;
  const dt = new Date(y, mo, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Kiểm tra current time có vượt quá scheduledEndAt chưa (theo so sánh timestamp). */
function isPastScheduleEnd(
  nowMs: number,
  scheduledEndAt: string | null | undefined,
): boolean {
  if (!scheduledEndAt) return false;
  const endMs = new Date(scheduledEndAt).getTime();
  return nowMs > endMs;
}

/**
 * Trên danh sách (lịch / đối soát / chấm công cửa hàng): ca đã kết thúc theo đồng hồ hệ thống
 * thì phân loại theo mốc ngay sau giờ kết thúc → trạng thái kết quả cuối (NO_SHOW, OVERDUE_CHECKOUT…),
 * không còn AWAITING/UPCOMING cho quá khứ.
 */
function referenceTimeForListedShiftClassification(
  scheduledEndAt: string | null | undefined,
  asOf: Date = now(),
): Date {
  if (!scheduledEndAt) return asOf;
  const endMs = new Date(scheduledEndAt).getTime();
  if (Number.isNaN(endMs)) return asOf;
  if (asOf.getTime() > endMs) return new Date(endMs + 1000);
  return asOf;
}

const ABNORMAL_EARLY_CHECKIN_MINUTES = 120;
const ABNORMAL_EARLY_CHECKOUT_MINUTES = 120;

function buildAnomalySignals(params: {
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}) {
  const start = params.scheduledStartAt
    ? new Date(params.scheduledStartAt)
    : null;
  const end = params.scheduledEndAt ? new Date(params.scheduledEndAt) : null;
  const checkIn = params.checkInAt ? new Date(params.checkInAt) : null;
  const checkOut = params.checkOutAt ? new Date(params.checkOutAt) : null;

  const earlyCheckInMinutes =
    start &&
    checkIn &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(checkIn.getTime()) &&
    checkIn < start
      ? Math.max(diffMinutes(start, checkIn), 0)
      : 0;
  const earlyCheckOutMinutes =
    end &&
    checkOut &&
    !Number.isNaN(end.getTime()) &&
    !Number.isNaN(checkOut.getTime()) &&
    checkOut < end
      ? Math.max(diffMinutes(end, checkOut), 0)
      : 0;

  const issues: string[] = [];
  if (earlyCheckInMinutes >= ABNORMAL_EARLY_CHECKIN_MINUTES) {
    issues.push(`CHECK_IN_TOO_EARLY_${earlyCheckInMinutes}M`);
  }
  if (earlyCheckOutMinutes >= ABNORMAL_EARLY_CHECKOUT_MINUTES) {
    issues.push(`CHECK_OUT_TOO_EARLY_${earlyCheckOutMinutes}M`);
  }

  return {
    earlyCheckInMinutes,
    earlyCheckOutMinutes,
    issues,
    hasAbnormalIssue: issues.length > 0,
  };
}

/**
 * Phân loại ca so với thời điểm tham chiếu (mặc định: hiện tại).
 * - Chưa check-in: UPCOMING / AWAITING_CHECKIN / NO_SHOW (hết ca = vắng mặt, không đổi mã API)
 * - Có check-in, chưa check-out: MISSING_CHECKOUT* hoặc OVERDUE_CHECKOUT sau khi hết ca
 */
function buildAttendanceClassification(params: {
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  lateGraceMinutes?: number;
  referenceTime?: Date;
}) {
  const lateGrace = params.lateGraceMinutes ?? 5;
  const ref = params.referenceTime ?? now();

  if (!params.scheduledStartAt && (params.checkInAt || params.checkOutAt)) {
    const anomalies = buildAnomalySignals(params);
    return {
      status: "OUTSIDE_SCHEDULE",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      anomalies,
    };
  }

  const start = params.scheduledStartAt
    ? new Date(params.scheduledStartAt)
    : null;
  const endRaw = params.scheduledEndAt ? new Date(params.scheduledEndAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return {
      status: "NO_SCHEDULE",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      anomalies: buildAnomalySignals(params),
    };
  }
  const end = endRaw && !Number.isNaN(endRaw.getTime()) ? endRaw : start;
  const refMs = ref.getTime();

  if (!params.checkInAt) {
    const checkInGraceLimitMs = start.getTime() + lateGrace * 60000;
    if (refMs < start.getTime()) {
      return {
        status: "UPCOMING",
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        anomalies: buildAnomalySignals(params),
      };
    }
    if (refMs <= end.getTime()) {
      return {
        status:
          refMs > checkInGraceLimitMs ? "CHECKIN_OVERDUE" : "AWAITING_CHECKIN",
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        anomalies: buildAnomalySignals(params),
      };
    }
    return {
      status: "NO_SHOW",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      anomalies: buildAnomalySignals(params),
    };
  }

  const checkIn = new Date(params.checkInAt);
  if (Number.isNaN(checkIn.getTime())) {
    return {
      status: "NO_SHOW",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      anomalies: buildAnomalySignals(params),
    };
  }

  if (!params.checkOutAt) {
    const lateMinutes = Math.max(diffMinutes(checkIn, start), 0);
    const anomalies = buildAnomalySignals(params);
    if (refMs <= end.getTime()) {
      return {
        status: "WORKING",
        lateMinutes,
        earlyLeaveMinutes: 0,
        anomalies,
      };
    }
    return {
      status: "MISSING_CHECKOUT",
      lateMinutes,
      earlyLeaveMinutes: 0,
      anomalies,
    };
  }

  const checkOut = new Date(params.checkOutAt);
  const lateMinutes = Math.max(diffMinutes(checkIn, start), 0);
  const earlyLeaveMinutes = Math.max(diffMinutes(end, checkOut), 0);
  const anomalies = buildAnomalySignals(params);

  if (lateMinutes > lateGrace && earlyLeaveMinutes > 0) {
    return {
      status: "LATE_AND_EARLY",
      lateMinutes,
      earlyLeaveMinutes,
      anomalies,
    };
  }

  if (lateMinutes > lateGrace) {
    return { status: "LATE", lateMinutes, earlyLeaveMinutes, anomalies };
  }

  if (earlyLeaveMinutes > 0) {
    return { status: "EARLY_LEAVE", lateMinutes, earlyLeaveMinutes, anomalies };
  }

  return { status: "ON_TIME", lateMinutes, earlyLeaveMinutes, anomalies };
}

export async function listMyStores(params: { reqUser: ReqUser | undefined }) {
  const storeIds = getActorStoreIds(params.reqUser);
  if (storeIds.length === 0) return { stores: [] };
  const rows = await repo.listStoresByIds(storeIds);
  return {
    stores: rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? `Cửa hàng #${r.id}`,
    })),
  };
}

export async function listStoreStaff(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const rows = await repo.listStaffByStore(params.storeId);
  return {
    users: rows.map((r: any) => {
      const etRaw = r.employment_type ?? null;
      const hw = Number(r.hourly_wage);
      const bs = Number(r.base_salary);
      return {
        id: Number(r.id),
        fullName: r.full_name ?? "—",
        roleName: r.role_name ?? null,
        employmentType: parseEmploymentTypeLoose(etRaw) ?? etRaw,
        hourlyWage: Number.isFinite(hw) ? hw : 0,
        baseSalary: Number.isFinite(bs) ? bs : 0,
      };
    }),
  };
}

export async function listStoreShifts(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  const rows = await repo.listShiftsByStore(params.storeId);
  return {
    shifts: rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      startTime: r.start_time?.slice(0, 5) ?? null,
      endTime: r.end_time?.slice(0, 5) ?? null,
    })),
  };
}

export async function upsertSchedule(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  userId: number;
  workDate: string;
  shiftType: "SM" | "FULL_TIME" | "PART_TIME";
  shiftId?: number;
  shiftLabel?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const user = await repo.findUserById(params.userId);
  if (!user) throw new ApiError(404, "Không tìm thấy nhân viên");
  if (!user.is_active) throw new ApiError(400, "Nhân viên đã ngừng hoạt động");

  const store = await repo.findStoreById(params.storeId);
  if (!store) throw new ApiError(404, "Không tìm thấy cửa hàng");

  const belongs = await repo.userBelongsToStore(params.userId, params.storeId);
  if (!belongs) {
    throw new ApiError(400, "Nhân viên không thuộc cửa hàng này");
  }

  const workDate = normalizeDate(params.workDate)!;
  let shiftRow: any = null;

  if (params.shiftType === "FULL_TIME" && !params.shiftId) {
    throw new ApiError(400, "Toàn thời gian phải chọn ca (Ca A, Ca B, ...)");
  }
  if (
    params.shiftType === "PART_TIME" &&
    (!params.startTime || !params.endTime)
  ) {
    throw new ApiError(400, "Bán thời gian phải nhập giờ bắt đầu và kết thúc");
  }

  if (params.shiftId) {
    shiftRow = await repo.findShiftById(params.shiftId, params.storeId);
    if (!shiftRow)
      throw new ApiError(404, "Không tìm thấy ca làm của cửa hàng");
  }

  const scheduleTime = deriveScheduleTime({
    workDate,
    shiftType: params.shiftType,
    startTime: params.startTime,
    endTime: params.endTime,
    shiftRow,
  });

  const result = await repo.upsertSchedule({
    storeId: params.storeId,
    userId: params.userId,
    shiftId: params.shiftId ?? null,
    workDate,
    shiftType: params.shiftType,
    shiftLabel: params.shiftLabel?.trim() || scheduleTime.shiftLabel,
    scheduledStartAt: scheduleTime.scheduledStartAt,
    scheduledEndAt: scheduleTime.scheduledEndAt,
    assignedBy: getActorUserId(params.reqUser),
    note: params.note?.trim() || null,
  });

  if (isPastWorkDate(workDate)) {
    await repo.insertSystemAuditLog({
      userId: getActorUserId(params.reqUser),
      actionType: "SCHEDULE_PAST_ADD",
      targetTable: "staff_schedules",
      targetId: Number(result.id),
      oldValue: null,
      newValue: {
        action: "add",
        changedAt: new Date().toISOString(),
        workDate,
        reason: params.note?.trim() || null,
        schedule: scheduleAuditSnapshot(result),
      },
      flagged: true,
    });
  }

  return {
    ok: true,
    schedule: mapScheduleRow(result),
  };
}

export async function updateSchedule(params: {
  reqUser: ReqUser | undefined;
  id: number;
  shiftId?: number;
  startTime?: string;
  endTime?: string;
  note?: string;
}) {
  const existing = await repo.findScheduleById(params.id);
  if (!existing) throw new ApiError(404, "Không tìm thấy lịch làm");
  assertCanAccessStore(params.reqUser, Number(existing.store_id));
  if (String(existing.status) !== "assigned") {
    throw new ApiError(400, "Chỉ cập nhật được ca đang assigned");
  }

  const workDate = workDateYmdFromScheduleRow(existing);
  const shiftType = formatShiftTypeForApi(existing.shift_type) as
    | "SM"
    | "FULL_TIME"
    | "PART_TIME";
  const actorId = getActorUserId(params.reqUser);
  let shiftRow: any = null;

  if (shiftType === "FULL_TIME") {
    const shiftId = params.shiftId ?? Number(existing.shift_id);
    if (!Number.isFinite(shiftId) || shiftId <= 0) {
      throw new ApiError(400, "Toàn thời gian phải chọn ca");
    }
    shiftRow = await repo.findShiftById(
      Number(shiftId),
      Number(existing.store_id),
    );
    if (!shiftRow)
      throw new ApiError(404, "Không tìm thấy ca làm của cửa hàng");
  } else if (shiftType === "PART_TIME") {
    if (!(params.startTime || params.endTime)) {
      throw new ApiError(400, "Bán thời gian cần chỉnh start/end");
    }
  }

  const startFromExisting = hhmmFromDateTime(existing.scheduled_start_at);
  const endFromExisting = hhmmFromDateTime(existing.scheduled_end_at);
  const scheduleTime = deriveScheduleTime({
    workDate,
    shiftType,
    startTime:
      shiftType === "PART_TIME"
        ? (params.startTime ?? startFromExisting)
        : undefined,
    endTime:
      shiftType === "PART_TIME"
        ? (params.endTime ?? endFromExisting)
        : undefined,
    shiftRow,
  });

  const siblings = await repo.listAssignedSchedulesForDay({
    userId: Number(existing.user_id),
    storeId: Number(existing.store_id),
    workDate,
    excludeScheduleId: Number(existing.id),
  });
  if (shiftType === "FULL_TIME" && siblings.length > 0) {
    throw new ApiError(
      409,
      `Nhân viên full-time chỉ được 1 ca/ngày (${workDate}). Hãy xóa ca còn lại trước khi cập nhật.`
    );
  }
  const startA = new Date(scheduleTime.scheduledStartAt).getTime();
  const endA = new Date(scheduleTime.scheduledEndAt).getTime();
  for (const row of siblings) {
    const startB = new Date(row.scheduled_start_at).getTime();
    const endB = new Date(row.scheduled_end_at).getTime();
    if (startA < endB && startB < endA) {
      throw new ApiError(409, "Khung giờ cập nhật bị chồng lấn với ca đã có.");
    }
  }
  if (shiftType === "FULL_TIME" && params.shiftId != null) {
    const dup = siblings.some(
      (r: any) => Number(r.shift_id) === Number(params.shiftId),
    );
    if (dup) throw new ApiError(409, "Ca đã tồn tại trong ngày.");
  }

  const updated = await repo.updateScheduleById({
    id: Number(existing.id),
    shiftId: shiftType === "FULL_TIME" ? Number(shiftRow.id) : null,
    shiftLabel: shiftType === "FULL_TIME" ? shiftRow.name : null,
    scheduledStartAt: scheduleTime.scheduledStartAt,
    scheduledEndAt: scheduleTime.scheduledEndAt,
    note: params.note?.trim() || existing.note || null,
  });
  if (!updated) throw new ApiError(500, "Không thể cập nhật lịch làm");

  if (isPastWorkDate(workDate)) {
    let action = "update";
    if (
      shiftType === "FULL_TIME" &&
      Number(existing.shift_id) !== Number(updated.shift_id)
    )
      action = "replace_shift";
    if (
      shiftType === "PART_TIME" &&
      (String(existing.scheduled_start_at) !==
        String(updated.scheduled_start_at) ||
        String(existing.scheduled_end_at) !== String(updated.scheduled_end_at))
    )
      action = "change_time";
    await repo.insertSystemAuditLog({
      userId: actorId,
      actionType: "SCHEDULE_PAST_UPDATE",
      targetTable: "staff_schedules",
      targetId: Number(updated.id),
      oldValue: {
        action,
        changedAt: new Date().toISOString(),
        workDate,
        reason: params.note?.trim() || null,
        schedule: scheduleAuditSnapshot(existing),
      },
      newValue: {
        action,
        changedAt: new Date().toISOString(),
        workDate,
        reason: params.note?.trim() || null,
        schedule: scheduleAuditSnapshot(updated),
      },
      flagged: true,
    });
  }

  return { ok: true, schedule: mapScheduleRow(updated) };
}

export async function upsertSchedulesBatch(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  userId: number;
  shiftType: "SM" | "FULL_TIME" | "PART_TIME";
  schedules: {
    workDate: string;
    shiftId?: number;
    startTime?: string;
    endTime?: string;
  }[];
  note?: string;
}) {
  if (params.shiftType === "FULL_TIME") {
    const workDates = params.schedules.map((item) => item.workDate);
    const duplicateDates = [...new Set(workDates.filter((workDate, index) => workDates.indexOf(workDate) !== index))];
    if (duplicateDates.length > 0) {
      throw new ApiError(
        400,
        `Nhân viên full-time chỉ được 1 ca/ngày. Bị trùng ngày: ${duplicateDates.join(", ")}.`
      );
    }
  }

  const schedules: any[] = [];
  for (const item of params.schedules) {
    const r = await upsertSchedule({
      reqUser: params.reqUser,
      storeId: params.storeId,
      userId: params.userId,
      workDate: item.workDate,
      shiftType: params.shiftType,
      shiftId: item.shiftId,
      startTime: item.startTime,
      endTime: item.endTime,
      note: params.note,
    });
    schedules.push(r.schedule);
  }
  return { ok: true, schedules, count: schedules.length };
}

export async function listMySchedules(params: {
  reqUser: ReqUser | undefined;
  dateFrom?: string;
  dateTo?: string;
}) {
  const userId = getActorUserId(params.reqUser);
  const dateFrom = normalizeDate(params.dateFrom);
  const dateTo = normalizeDate(params.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(
      400,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
    );
  }

  const rows = await repo.listSchedulesForUser({
    userId,
    dateFrom,
    dateTo,
  });

  return {
    schedules: rows.map(mapScheduleRowWithClassification),
  };
}

export async function listStoreSchedules(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const dateFrom = normalizeDate(params.dateFrom);
  const dateTo = normalizeDate(params.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(
      400,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
    );
  }

  const rows = await repo.listSchedulesForStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  return {
    schedules: rows.map(mapScheduleRowWithClassification),
  };
}

export async function listScheduleAuditLogs(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  userId: number;
  workDate: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  const workDate = normalizeDate(params.workDate)!;
  const rows = await repo.listScheduleAuditLogs({
    storeId: params.storeId,
    userId: params.userId,
    workDate,
  });
  return {
    logs: rows.map((r: any) => ({
      id: Number(r.id),
      actorUserId: r.user_id != null ? Number(r.user_id) : null,
      actionType: r.action_type ?? null,
      targetTable: r.target_table ?? null,
      targetId: r.target_id != null ? Number(r.target_id) : null,
      oldValue: r.old_value ?? null,
      newValue: r.new_value ?? null,
      flagged: Boolean(r.flagged),
      createdAt: r.created_at,
    })),
  };
}

export async function deleteSchedule(params: {
  reqUser: ReqUser | undefined;
  id: number;
}) {
  const schedule = await repo.findScheduleById(params.id);
  if (!schedule) throw new ApiError(404, "Không tìm thấy lịch làm");

  assertCanAccessStore(params.reqUser, Number(schedule.store_id));

  const actorId = getActorUserId(params.reqUser);
  const oldSnapshot = scheduleAuditSnapshot(schedule);
  const result = await repo.cancelSchedule(params.id);
  if (!result) throw new ApiError(500, "Không thể hủy lịch làm");

  const workDate = workDateYmdFromScheduleRow(schedule);
  if (isPastWorkDate(workDate)) {
    await repo.insertSystemAuditLog({
      userId: actorId,
      actionType: "SCHEDULE_PAST_DELETE",
      targetTable: "staff_schedules",
      targetId: Number(result.id),
      oldValue: {
        action: "delete",
        changedAt: new Date().toISOString(),
        workDate,
        schedule: oldSnapshot,
      },
      newValue: {
        action: "delete",
        changedAt: new Date().toISOString(),
        workDate,
        schedule: scheduleAuditSnapshot(result),
      },
      flagged: true,
    });
  }

  return {
    ok: true,
    schedule: mapScheduleRow(result),
  };
}

export async function submitScheduleChangeRequest(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  scheduleIds: number[];
  reason?: string;
  detail?: unknown;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  const actorId = getActorUserId(params.reqUser);
  const ids = (params.scheduleIds ?? [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    throw new ApiError(400, "Cần ít nhất một mã lịch (schedule id)");
  }
  const note = JSON.stringify({
    scheduleIds: ids,
    reason: params.reason?.trim() || "",
    detail: params.detail ?? null,
    requestedAt: new Date().toISOString(),
  });
  const row = await repo.insertScheduleChangeRequest({
    requesterUserId: actorId,
    storeId: params.storeId,
    note,
  });
  if (!row) throw new ApiError(500, "Không tạo được yêu cầu chỉnh sửa lịch");

  // Notify Managers
  const requester = await repo.findUserById(actorId);
  const managers = await repo.findManagersByStore(params.storeId);
  const store = await repo.findStoreById(params.storeId);

  console.log("[schedule-change] requesterId =", actorId);
  console.log("[schedule-change] storeId =", params.storeId);
  console.log("[schedule-change] requestId =", Number(row.id));
  console.log("[schedule-change] managers =", managers);

  for (const m of managers) {
    try {
      const out = await notificationService.notifyScheduleChangeRequested({
        managerId: Number(m.id),
        staffName: requester?.full_name || "Nhân viên",
        requestId: Number(row.id),
        requestType:
          "requestType" in params
            ? (params as any).requestType
            : "schedule_change",
        storeId: params.storeId,
        storeName: store?.name || null,
      });
      console.log("[schedule-change] notified manager =", m.id, out);
    } catch (err) {
      console.error("[schedule-change] Failed to notify manager =", m.id, err);
    }
  }

  return { ok: true, requestId: Number(row.id), status: row.status };
}

export async function createMyShiftChangeRequest(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  scheduleId: number;
  requestType: "DROP_SHIFT" | "CHANGE_TIME" | "CHANGE_SHIFT";
  reason: string;
  desiredWorkDate?: string;
  desiredShiftId?: number;
  desiredShiftLabel?: string;
  desiredStartTime?: string;
  desiredEndTime?: string;
}) {
  const actorId = getActorUserId(params.reqUser);
  const schedule = await repo.findScheduleById(params.scheduleId);
  if (!schedule) throw new ApiError(404, "Không tìm thấy ca làm");
  if (Number(schedule.user_id) !== actorId) {
    throw new ApiError(403, "Bạn chỉ có thể gửi yêu cầu cho ca của mình");
  }
  if (Number(schedule.store_id) !== params.storeId) {
    throw new ApiError(400, "storeId không khớp với ca hiện tại");
  }
  if (String(schedule.status) !== "assigned") {
    throw new ApiError(400, "Chỉ gửi yêu cầu cho ca đang được phân công");
  }
  const workDate = workDateYmdFromScheduleRow(schedule);
  const scheduleShiftType = formatShiftTypeForApi(schedule.shift_type) as
    | "SM"
    | "FULL_TIME"
    | "PART_TIME";
  const nowMs = Date.now();
  const startMs = schedule.scheduled_start_at
    ? new Date(schedule.scheduled_start_at).getTime()
    : NaN;
  const endMs = schedule.scheduled_end_at
    ? new Date(schedule.scheduled_end_at).getTime()
    : NaN;
  if (
    workDate < todayHCM() ||
    (Number.isFinite(startMs) && startMs <= nowMs) ||
    (Number.isFinite(endMs) && endMs <= nowMs)
  ) {
    throw new ApiError(400, "Đã quá giờ vào ca, không thể gửi yêu cầu đổi ca");
  }
  const att = await repo.findAttendanceByScheduleId(Number(schedule.id));
  if (att?.check_in_at || att?.check_out_at) {
    throw new ApiError(400, "Ca đã chấm công, không thể gửi yêu cầu đổi ca");
  }
  const existingRequest = await repo.existsScheduleChangeRequest({
    userId: actorId,
    scheduleId: Number(schedule.id),
  });
  if (existingRequest) {
    throw new ApiError(409, "Mỗi ca chỉ được gửi yêu cầu đổi ca một lần");
  }

  let desired: any = null;
  if (params.requestType === "CHANGE_TIME" && scheduleShiftType !== "PART_TIME") {
    throw new ApiError(400, "Yeu cau doi gio hien chi ap dung cho ca ban thoi gian");
  }
  if (params.requestType === "CHANGE_SHIFT") {
    const desiredShiftId = Number(params.desiredShiftId);
    const desiredShiftLabel = params.desiredShiftLabel?.trim();
    if ((!Number.isFinite(desiredShiftId) || desiredShiftId <= 0) && !desiredShiftLabel) {
      throw new ApiError(400, "Vui lòng nhập ca mong muốn");
    }
    const currentShiftId = Number(schedule.shift_id);
    const normalizedCurrentShiftLabel = normalizeLooseText(
      String(schedule.shift_label || ""),
    );
    const normalizedDesiredShiftLabel = normalizeLooseText(desiredShiftLabel || "");
    if (
      (Number.isFinite(desiredShiftId) &&
        desiredShiftId > 0 &&
        Number.isFinite(currentShiftId) &&
        currentShiftId > 0 &&
        desiredShiftId === currentShiftId) ||
      (normalizedDesiredShiftLabel &&
        normalizedCurrentShiftLabel &&
        normalizedDesiredShiftLabel === normalizedCurrentShiftLabel)
    ) {
      throw new ApiError(400, "Ca mong muốn phải khác ca hiện tại");
    }
    desired = {
      desiredShiftId:
        Number.isFinite(desiredShiftId) && desiredShiftId > 0 ? desiredShiftId : undefined,
      desiredShiftLabel: desiredShiftLabel || undefined,
    };
  }
  if (params.requestType === "CHANGE_TIME") {
    const desiredStart = normalizeTime(params.desiredStartTime);
    const desiredEnd = normalizeTime(params.desiredEndTime);
    if (!desiredStart || !desiredEnd) {
      throw new ApiError(400, "Vui lòng nhập giờ mong muốn");
    }
    if (
      desiredStart < "06:00" ||
      desiredStart > "23:00" ||
      desiredEnd < "06:00" ||
      desiredEnd > "23:00"
    ) {
      throw new ApiError(
        400,
        "Giờ mong muốn phải trong khoảng 06:00 đến 23:00",
      );
    }
    if (desiredStart >= desiredEnd) {
      throw new ApiError(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu");
    }
    desired = {
      desiredWorkDate: workDate,
      desiredStartTime: desiredStart,
      desiredEndTime: desiredEnd,
    };
  }

  const note = JSON.stringify({
    source: "staff_schedule_page",
    scheduleId: Number(schedule.id),
    requestType: params.requestType,
    reason: params.reason.trim(),
    current: {
      storeId: Number(schedule.store_id),
      userId: Number(schedule.user_id),
      workDate,
      shiftType: formatShiftTypeForApi(schedule.shift_type),
      shiftLabel: schedule.shift_label ?? null,
      scheduledStartAt: schedule.scheduled_start_at,
      scheduledEndAt: schedule.scheduled_end_at,
    },
    desired,
    requestedAt: new Date().toISOString(),
  });
  const row = await repo.insertScheduleChangeRequest({
    requesterUserId: actorId,
    storeId: params.storeId,
    note,
  });
  if (!row) throw new ApiError(500, "Không tạo được yêu cầu đổi ca");

  // Notify Managers
  const requester = await repo.findUserById(actorId);
  const managers = await repo.findManagersByStore(params.storeId);
  const store = await repo.findStoreById(params.storeId);

  for (const m of managers) {
    await notificationService
      .notifyScheduleChangeRequested({
        managerId: Number(m.id),
        staffName: requester?.full_name || "Nhân viên",
        requestId: Number(row.id),
        requestType: params.requestType,
        storeId: params.storeId,
        storeName: store?.name || null,
      })
      .catch((err: unknown) => console.error("Failed to notify manager", err));
  }

  return { ok: true, requestId: Number(row.id), status: row.status };
}

export async function listMyScheduleChangeRequests(params: {
  reqUser: ReqUser | undefined;
  dateFrom?: string;
  dateTo?: string;
}) {
  const userId = getActorUserId(params.reqUser);
  const rows = await repo.listScheduleChangeRequestsForUser({
    userId,
    dateFrom: normalizeDate(params.dateFrom),
    dateTo: normalizeDate(params.dateTo),
  });
  const refreshedRows = await autoExpirePendingScheduleChangeRows(rows);
  return {
    requests: refreshedRows.map((r: any) => {
      let detail: any = null;
      try {
        detail = r.note ? JSON.parse(String(r.note)) : null;
      } catch {
        detail = null;
      }
      return {
        id: Number(r.id),
        userId: Number(r.user_id),
        storeId: Number(r.store_id),
        requestDate:
          toWorkDateYMD(r.request_date) ||
          String(r.request_date ?? "").slice(0, 10),
        requestType: r.request_type ?? null,
        status: r.status ?? null,
        createdAt: r.created_at ?? null,
        detail,
      };
    }),
  };
}

export async function getTodayAttendanceStatus(params: {
  reqUser: ReqUser | undefined;
}) {
  const userId = getActorUserId(params.reqUser);
  const today = todayHCM();
  const schedule = await repo.findTodayScheduleForUser(userId, today);
  const openAttendance = await repo.findOpenAttendanceForToday(userId, today);

  const attendance = schedule
    ? await repo.findAttendanceByScheduleId(Number(schedule.id))
    : openAttendance;

  const classification = schedule
    ? buildAttendanceClassification({
        scheduledStartAt: schedule.scheduled_start_at,
        scheduledEndAt: schedule.scheduled_end_at,
        checkInAt: attendance?.check_in_at ?? null,
        checkOutAt: attendance?.check_out_at ?? null,
        lateGraceMinutes: Number(schedule.late_grace_minutes || 5),
      })
    : null;

  const attendanceStatus: "NOT_STARTED" | "CHECKED_IN" | "COMPLETED" =
    !attendance
      ? "NOT_STARTED"
      : attendance.check_out_at
        ? "COMPLETED"
        : "CHECKED_IN";

  return {
    schedule: schedule ? mapScheduleRow(schedule) : null,
    attendance: attendance ? mapAttendanceRow(attendance) : null,
    attendanceStatus,
    classification,
  };
}

export async function checkIn(params: {
  reqUser: ReqUser | undefined;
  note?: string;
  latitude?: number;
  longitude?: number;
}) {
  const userId = getActorUserId(params.reqUser);
  const actorUser = await repo.findUserById(userId);
  if (!actorUser || !actorUser.is_active) {
    throw new ApiError(400, "Nhân viên đã ngừng hoạt động");
  }
  const checkInAt = now();
  const today = todayHCM();

  const existingOpen = await repo.findOpenAttendanceForToday(userId, today);
  if (existingOpen) {
    throw new ApiError(400, "Bạn đã check-in và chưa check-out.");
  }

  const schedule = await repo.findTodayScheduleForUser(userId, today);
  if (!schedule) {
    throw new ApiError(400, "Hôm nay bạn không có ca được phân.");
  }

  const store = await repo.findStoreById(Number(schedule.store_id));
  const storeLat = store?.latitude != null ? Number(store.latitude) : null;
  const storeLng = store?.longitude != null ? Number(store.longitude) : null;
  const radiusMeters = Number(store?.allowed_radius_meters ?? 200) || 200;

  if (storeLat != null && storeLng != null) {
    const userLat = params.latitude;
    const userLng = params.longitude;
    if (
      userLat == null ||
      userLng == null ||
      !Number.isFinite(userLat) ||
      !Number.isFinite(userLng)
    ) {
      throw new ApiError(
        400,
        "Không lấy được vị trí. Vui lòng bật quyền truy cập vị trí để check-in.",
      );
    }
    if (
      !isWithinStoreRadius({
        userLat,
        userLng,
        storeLat,
        storeLng,
        radiusMeters,
      })
    ) {
      throw new ApiError(
        400,
        "Bạn không ở trong phạm vi cửa hàng, không thể check-in.",
      );
    }
  }

  const startDate = schedule.scheduled_start_at
    ? new Date(schedule.scheduled_start_at)
    : null;
  if (startDate && checkInAt < startDate) {
    throw new ApiError(400, "Chưa đến giờ vào ca, bạn chưa thể check-in.");
  }

  if (isPastScheduleEnd(checkInAt.getTime(), schedule.scheduled_end_at)) {
    throw new ApiError(400, "Đã qua giờ làm, không thể check-in.");
  }

  const existedAttendance = await repo.findAttendanceByScheduleId(
    Number(schedule.id),
  );
  if (existedAttendance?.check_in_at) {
    throw new ApiError(400, "Bạn đã check-in cho ca này.");
  }

  const lateGrace = Number(schedule.late_grace_minutes || 5);
  const lateMinutes = startDate
    ? Math.max(diffMinutes(checkInAt, startDate), 0)
    : 0;

  const parts: string[] = [];
  if (params.note?.trim()) parts.push(params.note.trim());
  if (lateMinutes > lateGrace) parts.push(`Đi muộn ${lateMinutes} phút`);
  if (parts.length === 0) parts.push("Đúng giờ");
  const checkInNote = parts.join("; ");

  const attendance = await repo.createAttendance({
    scheduleId: Number(schedule.id),
    storeId: Number(schedule.store_id),
    userId,
    attendanceDate: today,
    checkInAt,
    checkInNote,
  });

  const classification = buildAttendanceClassification({
    scheduledStartAt: schedule.scheduled_start_at,
    scheduledEndAt: schedule.scheduled_end_at,
    checkInAt: attendance.check_in_at,
    checkOutAt: attendance.check_out_at,
    lateGraceMinutes: lateGrace,
  });

  return {
    ok: true,
    schedule: mapScheduleRow(schedule),
    attendance: mapAttendanceRow(attendance),
    attendanceStatus: "CHECKED_IN" as const,
    classification,
  };
}

export async function checkOut(params: {
  reqUser: ReqUser | undefined;
  note?: string;
  latitude?: number;
  longitude?: number;
}) {
  const userId = getActorUserId(params.reqUser);
  const checkOutAt = now();
  const today = todayHCM();

  const openAttendance = await repo.findOpenAttendanceForToday(userId, today);
  if (!openAttendance) {
    throw new ApiError(400, "Bạn chưa check-in hoặc đã check-out.");
  }

  const checkInAt = openAttendance.check_in_at
    ? new Date(openAttendance.check_in_at)
    : null;
  const minutesSinceCheckIn = checkInAt
    ? diffMinutes(checkOutAt, checkInAt)
    : 0;
  if (minutesSinceCheckIn < 5) {
    throw new ApiError(400, "Bạn vừa check-in, chưa thể check-out ngay.");
  }

  let schedule: any = null;
  if (openAttendance.schedule_id) {
    schedule = await repo.findScheduleById(Number(openAttendance.schedule_id));
  }

  const store = await repo.findStoreById(Number(openAttendance.store_id));
  const storeLat = store?.latitude != null ? Number(store.latitude) : null;
  const storeLng = store?.longitude != null ? Number(store.longitude) : null;
  const radiusMeters = Number(store?.allowed_radius_meters ?? 200) || 200;

  if (storeLat != null && storeLng != null) {
    const userLat = params.latitude;
    const userLng = params.longitude;
    if (
      userLat == null ||
      userLng == null ||
      !Number.isFinite(userLat) ||
      !Number.isFinite(userLng)
    ) {
      throw new ApiError(
        400,
        "Không lấy được vị trí. Vui lòng bật quyền truy cập vị trí để check-out.",
      );
    }
    if (
      !isWithinStoreRadius({
        userLat,
        userLng,
        storeLat,
        storeLng,
        radiusMeters,
      })
    ) {
      throw new ApiError(
        400,
        "Bạn không ở trong phạm vi cửa hàng, không thể check-out.",
      );
    }
  }

  const scheduledEndAt = schedule?.scheduled_end_at
    ? new Date(schedule.scheduled_end_at)
    : null;
  const EARLY_CHECKOUT_GRACE_MINUTES = 5;
  if (scheduledEndAt) {
    const earliestCheckOut = new Date(
      scheduledEndAt.getTime() - EARLY_CHECKOUT_GRACE_MINUTES * 60000,
    );
    if (checkOutAt < earliestCheckOut) {
      throw new ApiError(
        400,
        "Bạn không thể check-out sớm quá 5 phút trước giờ tan ca.",
      );
    }
  }

  const earlyLeaveMinutes =
    scheduledEndAt && checkOutAt < scheduledEndAt
      ? Math.max(diffMinutes(scheduledEndAt, checkOutAt), 0)
      : 0;

  const parts: string[] = [];
  if (params.note?.trim()) parts.push(params.note.trim());
  if (earlyLeaveMinutes > 0) parts.push(`Về sớm ${earlyLeaveMinutes} phút`);
  if (parts.length === 0) parts.push("Đúng giờ");
  const checkOutNote = parts.join("; ");

  const closed = await repo.closeAttendance({
    attendanceId: Number(openAttendance.id),
    checkOutAt,
    checkOutNote,
  });

  if (!closed) throw new ApiError(500, "Check-out thất bại.");

  const classification = buildAttendanceClassification({
    scheduledStartAt: schedule?.scheduled_start_at ?? null,
    scheduledEndAt: schedule?.scheduled_end_at ?? null,
    checkInAt: closed.check_in_at,
    checkOutAt: closed.check_out_at,
    lateGraceMinutes: schedule?.late_grace_minutes ?? 5,
  });

  return {
    ok: true,
    schedule: schedule ? mapScheduleRow(schedule) : null,
    attendance: mapAttendanceRow(closed),
    attendanceStatus: "COMPLETED" as const,
    classification,
  };
}

export async function listStoreAttendance(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const dateFrom = normalizeDate(params.dateFrom);
  const dateTo = normalizeDate(params.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(
      400,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
    );
  }

  /* Lịch ca LEFT JOIN chấm công: có ca nhưng chưa check-in vẫn có 1 dòng → lọc ABSENT/MISSING_CHECKIN trên FE hoạt động.
     (Chỉ staff_attendance như cũ thì vắng mặt không có bản ghi.) */
  const rows = await repo.listSchedulesAndAttendanceForStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    sortWorkDateDesc: true,
  });

  return {
    attendances: rows.map((row) => {
      const hasAttendance = row.attendance_id != null;
      const attendanceDate =
        hasAttendance && row.attendance_date != null
          ? toWorkDateYMD(row.attendance_date) ||
            String(row.attendance_date).slice(0, 10)
          : toWorkDateYMD(row.work_date) || String(row.work_date).slice(0, 10);

      const classification = buildAttendanceClassification({
        scheduledStartAt: row.scheduled_start_at,
        scheduledEndAt: row.scheduled_end_at,
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
        lateGraceMinutes: Number(row.late_grace_minutes || 5),
        referenceTime: referenceTimeForListedShiftClassification(
          row.scheduled_end_at,
        ),
      });

      const id = hasAttendance
        ? Number(row.attendance_id)
        : -Number(row.schedule_id);

      return {
        id,
        scheduleId: Number(row.schedule_id),
        storeId: Number(row.store_id),
        userId: Number(row.user_id),
        attendanceDate,
        checkInAt: row.check_in_at ?? null,
        checkOutAt: row.check_out_at ?? null,
        status:
          row.attendance_status != null
            ? String(row.attendance_status)
            : "open",
        checkInNote: row.check_in_note ?? null,
        checkOutNote: row.check_out_note ?? null,
        fullName: row.full_name ?? null,
        shiftType:
          row.shift_type != null ? formatShiftTypeForApi(row.shift_type) : null,
        shiftLabel: row.shift_label ?? row.shift_name ?? null,
        scheduledStartAt: row.scheduled_start_at ?? null,
        scheduledEndAt: row.scheduled_end_at ?? null,
        lateGraceMinutes:
          row.late_grace_minutes != null ? Number(row.late_grace_minutes) : 5,
        classification,
      };
    }),
  };
}

export async function getStoreReconciliation(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const dateFrom = normalizeDate(params.dateFrom);
  const dateTo = normalizeDate(params.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(
      400,
      "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
    );
  }

  const rows = await repo.listSchedulesAndAttendanceForStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });
  const outsideScheduleRows = await repo.listAttendanceWithoutScheduleForStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const WRONG_SHIFT_THRESHOLD_MINUTES = 90;
  const HEAVY_DEVIATION_THRESHOLD_MINUTES = 120;

  const reconciliations = rows.map((row) => {
    const etRaw = row.employment_type ?? null;
    const classification = buildAttendanceClassification({
      scheduledStartAt: row.scheduled_start_at,
      scheduledEndAt: row.scheduled_end_at,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      lateGraceMinutes: Number(row.late_grace_minutes || 5),
      referenceTime: referenceTimeForListedShiftClassification(
        row.scheduled_end_at,
      ),
    });
    const lateMinutes = Number(classification.lateMinutes || 0);
    const earlyLeaveMinutes = Number(classification.earlyLeaveMinutes || 0);
    const anomalies = classification.anomalies ?? {
      earlyCheckInMinutes: 0,
      earlyCheckOutMinutes: 0,
      issues: [],
      hasAbnormalIssue: false,
    };

    const mismatchTypes: string[] = [];
    if (!row.check_in_at) mismatchTypes.push("SCHEDULED_NO_CHECKIN");
    if (classification.status === "MISSING_CHECKOUT")
      mismatchTypes.push("MISSING_CHECKOUT");
    if (lateMinutes > 0 || earlyLeaveMinutes > 0)
      mismatchTypes.push("LATE_OR_EARLY");
    if (lateMinutes >= WRONG_SHIFT_THRESHOLD_MINUTES)
      mismatchTypes.push("CHECKIN_WRONG_SHIFT");
    if (
      lateMinutes >= HEAVY_DEVIATION_THRESHOLD_MINUTES ||
      earlyLeaveMinutes >= HEAVY_DEVIATION_THRESHOLD_MINUTES ||
      anomalies.hasAbnormalIssue
    ) {
      mismatchTypes.push("LARGE_TIME_DEVIATION");
    }
    if (
      lateMinutes >= WRONG_SHIFT_THRESHOLD_MINUTES ||
      earlyLeaveMinutes >= WRONG_SHIFT_THRESHOLD_MINUTES ||
      anomalies.earlyCheckInMinutes >= WRONG_SHIFT_THRESHOLD_MINUTES
    ) {
      mismatchTypes.push("ACTUAL_SHIFT_NOT_MATCH_ASSIGNED");
    }

    let mismatchStatus = "MATCH";
    let impactLevel: "high" | "medium" | "low" = "low";
    if (mismatchTypes.length > 0) {
      mismatchStatus = "MISMATCH";
      if (
        mismatchTypes.includes("SCHEDULED_NO_CHECKIN") ||
        mismatchTypes.includes("MISSING_CHECKOUT") ||
        mismatchTypes.includes("LARGE_TIME_DEVIATION") ||
        mismatchTypes.includes("CHECKIN_WRONG_SHIFT")
      ) {
        impactLevel = "high";
      } else if (mismatchTypes.includes("LATE_OR_EARLY")) {
        impactLevel = "medium";
      }
    }

    return {
      id: `schedule-${row.schedule_id}`,
      source: "SCHEDULE",
      scheduleId: Number(row.schedule_id),
      attendanceId:
        row.attendance_id != null ? Number(row.attendance_id) : null,
      storeId: Number(row.store_id),
      userId: Number(row.user_id),
      fullName: row.full_name,
      employmentType: parseEmploymentTypeLoose(etRaw) ?? etRaw,
      workDate: String(row.work_date),
      shiftType: formatShiftTypeForApi(row.shift_type),
      shiftLabel: row.shift_label ?? row.shift_name ?? null,
      scheduledStartAt: row.scheduled_start_at,
      scheduledEndAt: row.scheduled_end_at,
      checkInAt: row.check_in_at ?? null,
      checkOutAt: row.check_out_at ?? null,
      attendanceStatus: row.attendance_status ?? null,
      classification,
      mismatch: {
        status: mismatchStatus,
        impactLevel,
        mismatchTypes,
        detail: mismatchTypes.join(", "),
      },
    };
  });

  const outsideSchedule = outsideScheduleRows.map((row) => {
    const etRaw = row.employment_type ?? null;
    return {
      id: `outside-${row.attendance_id}`,
      source: "OUTSIDE_SCHEDULE",
      scheduleId: null,
      attendanceId: Number(row.attendance_id),
      storeId: Number(row.store_id),
      userId: Number(row.user_id),
      fullName: row.full_name ?? null,
      employmentType: parseEmploymentTypeLoose(etRaw) ?? etRaw,
      workDate:
        toWorkDateYMD(row.attendance_date) ||
        String(row.attendance_date ?? "").slice(0, 10),
      shiftType: null,
      shiftLabel: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      checkInAt: row.check_in_at ?? null,
      checkOutAt: row.check_out_at ?? null,
      attendanceStatus: row.attendance_status ?? null,
      classification: {
        status: "OUTSIDE_SCHEDULE",
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        anomalies: buildAnomalySignals({
          checkInAt: row.check_in_at ?? null,
          checkOutAt: row.check_out_at ?? null,
        }),
      },
      mismatch: {
        status: "MISMATCH",
        impactLevel: "high" as const,
        mismatchTypes: [
          "ATTENDANCE_WITHOUT_SCHEDULE",
          row.check_out_at ? null : "MISSING_CHECKOUT",
        ].filter(Boolean),
        detail: "Có chấm công nhưng không có lịch phân công",
      },
    };
  });

  const all = [...reconciliations, ...outsideSchedule].sort((a, b) => {
    if (a.workDate !== b.workDate)
      return String(b.workDate).localeCompare(String(a.workDate));
    const aStart = a.scheduledStartAt
      ? new Date(a.scheduledStartAt).getTime()
      : 0;
    const bStart = b.scheduledStartAt
      ? new Date(b.scheduledStartAt).getTime()
      : 0;
    return aStart - bStart;
  });

  const summary = {
    totalRows: all.length,
    mismatchRows: all.filter((x) => x.mismatch.status === "MISMATCH").length,
    highImpact: all.filter((x) => x.mismatch.impactLevel === "high").length,
    mediumImpact: all.filter((x) => x.mismatch.impactLevel === "medium").length,
    noAttendance: all.filter((x) =>
      x.mismatch.mismatchTypes.includes("SCHEDULED_NO_CHECKIN"),
    ).length,
    outsideSchedule: all.filter((x) =>
      x.mismatch.mismatchTypes.includes("ATTENDANCE_WITHOUT_SCHEDULE"),
    ).length,
  };
}

export async function createHireFireRequest(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  requestType: "hire" | "fire";
  position: string;
  reason: string;
}) {
  const userId = getActorUserId(params.reqUser);
  assertCanAccessStore(params.reqUser, params.storeId);

  if (!params.position?.trim()) throw new ApiError(400, "Vị trí tuyển dụng không được để trống");
  if (!params.reason?.trim())   throw new ApiError(400, "Lý do không được để trống");

  return repo.createHireFireRequest({
    userId,
    storeId: params.storeId,
    requestType: params.requestType,
    position: params.position.trim(),
    reason: params.reason.trim(),
  });
}

export async function listMyHireFireRequests(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  return repo.listStoreHireFireRequests(params.storeId);
}

type DashboardPriority = "urgent" | "high" | "normal";

function priorityLabelVi(p: DashboardPriority): string {
  if (p === "urgent") return "Xử lý ngay";
  if (p === "high") return "Ưu tiên cao";
  return "Theo dõi";
}

export async function getStoreManagerDashboardInsights(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  windowDays?: number;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);

  const windowDays = Math.min(
    14,
    Math.max(1, Math.floor(params.windowDays ?? 7)),
  );
  const today = todayHCM();
  const dateTo = today;
  const dateFrom = addDaysYmd(today, -(windowDays - 1));

  const rows = await repo.listSchedulesAndAttendanceForStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const refNow = now();

  const enriched = rows.map((row) => {
    const workDate = toWorkDateYMD(row.work_date);
    const classification = buildAttendanceClassification({
      scheduledStartAt: row.scheduled_start_at,
      scheduledEndAt: row.scheduled_end_at,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      lateGraceMinutes: Number(row.late_grace_minutes || 5),
      referenceTime: referenceTimeForListedShiftClassification(
        row.scheduled_end_at,
      ),
    });
    return { row, workDate, classification };
  });

  const isAbsent = (st: string) => st === "NO_SHOW" || st === "ABSENT";
  const isLateFamily = (x: (typeof enriched)[0]) =>
    x.classification.status === "LATE" ||
    x.classification.status === "LATE_AND_EARLY" ||
    (x.classification.status === "WORKING" &&
      Number(x.classification.lateMinutes || 0) > 0);
  const isCheckoutIssue = (st: string) =>
    st === "MISSING_CHECKOUT" || st === "WORKING";

  const todayRows = enriched.filter((x) => x.workDate === today);
  const stToday = (x: (typeof enriched)[0]) => x.classification.status;

  const summaryToday = {
    scheduledShifts: todayRows.length,
    checkedIn: todayRows.filter((x) => Boolean(x.row.check_in_at)).length,
    late: todayRows.filter((x) => isLateFamily(x)).length,
    absent: todayRows.filter((x) => isAbsent(stToday(x))).length,
    awaitingCheckIn: todayRows.filter((x) =>
      ["AWAITING_CHECKIN", "CHECKIN_OVERDUE"].includes(stToday(x)),
    ).length,
    overdueCheckout: todayRows.filter((x) => stToday(x) === "MISSING_CHECKOUT")
      .length,
    missingCheckoutOpen: todayRows.filter((x) => stToday(x) === "WORKING")
      .length,
  };

  const absentDetails = enriched
    .filter((x) => isAbsent(x.classification.status))
    .map((x) => {
      const isToday = x.workDate === today;
      let priority: DashboardPriority = "normal";
      if (isToday && x.classification.status === "NO_SHOW") priority = "high";
      else if (isToday) priority = "high";
      const reason =
        x.classification.status === "NO_SHOW"
          ? "Hết ca, không có check-in"
          : "Không có mặt / không check-in";
      return {
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        shiftLabel: x.row.shift_label ?? x.row.shift_name ?? null,
        shiftType:
          x.row.shift_type != null
            ? formatShiftTypeForApi(x.row.shift_type)
            : null,
        scheduledStartAt: x.row.scheduled_start_at,
        scheduledEndAt: x.row.scheduled_end_at,
        status: x.classification.status,
        priority,
        priorityLabel: priorityLabelVi(priority),
        reason,
      };
    })
    .sort((a, b) => {
      const pr = { urgent: 0, high: 1, normal: 2 };
      if (pr[a.priority] !== pr[b.priority])
        return pr[a.priority] - pr[b.priority];
      if (a.workDate !== b.workDate)
        return b.workDate.localeCompare(a.workDate);
      return (a.fullName || "").localeCompare(b.fullName || "", "vi");
    });

  type ActionItem = {
    score: number;
    type: string;
    userId: number;
    fullName: string | null;
    workDate: string;
    headline: string;
    detail: string;
    priorityLabel: string;
  };

  const actions: ActionItem[] = [];

  const startMs = (iso: string | null | undefined) =>
    iso ? new Date(iso).getTime() : NaN;

  for (const x of todayRows) {
    const st = stToday(x);
    const name = x.row.full_name ?? `NV #${x.row.user_id}`;
    const slot =
      (x.row.shift_label || x.row.shift_name || "Ca") +
      (x.row.scheduled_start_at
        ? ` · ${String(x.row.scheduled_start_at).slice(11, 16)}`
        : "");

    if (st === "MISSING_CHECKOUT") {
      actions.push({
        score: 100,
        type: "overdue_checkout",
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        headline: "Hết ca — chưa check-out",
        detail: `${name} — ${slot}`,
        priorityLabel: priorityLabelVi("urgent"),
      });
    } else if (st === "NO_SHOW" || st === "ABSENT") {
      actions.push({
        score: 90,
        type: "absent",
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        headline: "Vắng mặt (không check-in)",
        detail: `${name} — ${slot}`,
        priorityLabel: priorityLabelVi("high"),
      });
    } else if (st === "CHECKIN_OVERDUE") {
      const t0 = startMs(x.row.scheduled_start_at);
      const lateByMins =
        Number.isFinite(t0) && refNow.getTime() > t0
          ? Math.floor((refNow.getTime() - t0) / 60000)
          : 0;
      actions.push({
        score: 85,
        type: "checkin_overdue",
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        headline: "Quá giờ check-in",
        detail: `${name} — đã qua giờ vào ca ~${lateByMins} phút · ${slot}`,
        priorityLabel: priorityLabelVi("high"),
      });
    } else if (st === "AWAITING_CHECKIN") {
      const t0 = startMs(x.row.scheduled_start_at);
      const lateByMins =
        Number.isFinite(t0) && refNow.getTime() > t0
          ? Math.floor((refNow.getTime() - t0) / 60000)
          : 0;
      if (lateByMins >= 30) {
        actions.push({
          score: 80,
          type: "awaiting_checkin",
          userId: Number(x.row.user_id),
          fullName: x.row.full_name ?? null,
          workDate: x.workDate,
          headline: "Trong ca nhưng chưa check-in",
          detail: `${name} — đã qua giờ vào ca ~${lateByMins} phút · ${slot}`,
          priorityLabel: priorityLabelVi("high"),
        });
      }
    } else if (st === "WORKING") {
      actions.push({
        score: 65,
        type: "working",
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        headline: "Đang làm — chưa check-out",
        detail: `${name} — ${slot}`,
        priorityLabel: priorityLabelVi("normal"),
      });
    } else if (st === "LATE" || st === "LATE_AND_EARLY") {
      actions.push({
        score: 50,
        type: "late",
        userId: Number(x.row.user_id),
        fullName: x.row.full_name ?? null,
        workDate: x.workDate,
        headline: "Đi trễ / về sớm",
        detail: `${name} — ${slot}`,
        priorityLabel: priorityLabelVi("normal"),
      });
    }
  }

  actions.sort((a, b) => b.score - a.score);

  const lateCountByUser = new Map<
    number,
    { fullName: string | null; count: number; lastDate: string }
  >();
  const checkoutIssueByUser = new Map<
    number,
    { fullName: string | null; count: number }
  >();

  for (const x of enriched) {
    const uid = Number(x.row.user_id);
    const fn = x.row.full_name ?? null;
    if (isLateFamily(x)) {
      const cur = lateCountByUser.get(uid) ?? {
        fullName: fn,
        count: 0,
        lastDate: x.workDate,
      };
      cur.count += 1;
      cur.fullName = fn ?? cur.fullName;
      if (x.workDate > cur.lastDate) cur.lastDate = x.workDate;
      lateCountByUser.set(uid, cur);
    }
    if (isCheckoutIssue(x.classification.status)) {
      const cur = checkoutIssueByUser.get(uid) ?? { fullName: fn, count: 0 };
      cur.count += 1;
      cur.fullName = fn ?? cur.fullName;
      checkoutIssueByUser.set(uid, cur);
    }
  }

  const lateLeaders = [...lateCountByUser.entries()]
    .map(([userId, v]) => ({
      userId,
      fullName: v.fullName,
      count: v.count,
      lastWorkDate: v.lastDate,
    }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const missingCheckoutLeaders = [...checkoutIssueByUser.entries()]
    .map(([userId, v]) => ({ userId, fullName: v.fullName, count: v.count }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const dayAgg = new Map<
    string,
    { absent: number; late: number; checkoutIssues: number }
  >();
  for (const x of enriched) {
    const st = x.classification.status;
    const d = x.workDate;
    const cur = dayAgg.get(d) ?? { absent: 0, late: 0, checkoutIssues: 0 };
    if (isAbsent(st)) cur.absent += 1;
    if (isLateFamily(x)) cur.late += 1;
    if (isCheckoutIssue(st)) cur.checkoutIssues += 1;
    dayAgg.set(d, cur);
  }

  const hotDays = [...dayAgg.entries()]
    .map(([workDate, v]) => ({
      workDate,
      issueCount: v.absent + v.late + v.checkoutIssues,
      absent: v.absent,
      late: v.late,
      checkoutIssues: v.checkoutIssues,
    }))
    .filter((x) => x.issueCount > 0)
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 7);

  const shiftStress = new Map<
    string,
    {
      workDate: string;
      shiftLabel: string | null;
      scheduledStartAt: string | null;
      scheduledEndAt: string | null;
      absent: number;
      assigned: number;
    }
  >();

  for (const x of enriched) {
    const key = `${x.workDate}|${x.row.scheduled_start_at ?? ""}|${x.row.scheduled_end_at ?? ""}|${x.row.shift_label ?? x.row.shift_name ?? ""}`;
    const cur = shiftStress.get(key) ?? {
      workDate: x.workDate,
      shiftLabel: x.row.shift_label ?? x.row.shift_name ?? null,
      scheduledStartAt: x.row.scheduled_start_at ?? null,
      scheduledEndAt: x.row.scheduled_end_at ?? null,
      absent: 0,
      assigned: 0,
    };
    cur.assigned += 1;
    if (isAbsent(x.classification.status)) cur.absent += 1;
    shiftStress.set(key, cur);
  }

  const shiftsWithAbsence = [...shiftStress.values()]
    .filter((s) => s.absent > 0)
    .sort((a, b) => b.absent - a.absent || b.assigned - a.assigned)
    .slice(0, 6)
    .map((s) => ({
      ...s,
      note:
        s.absent >= 2
          ? "Nhiều người vắng cùng khung ca — kiểm tra phân công / backup."
          : "Có vắng mặt trong khung ca.",
    }));

  const alerts: string[] = [];
  if (summaryToday.overdueCheckout > 0) {
    alerts.push(
      `Hôm nay có ${summaryToday.overdueCheckout} ca hết giờ nhưng chưa check-out — xử lý ngay.`,
    );
  }
  if (summaryToday.absent > 0) {
    alerts.push(
      `Hôm nay có ${summaryToday.absent} ca vắng mặt (không check-in).`,
    );
  }
  if (
    summaryToday.awaitingCheckIn > 0 &&
    actions.some((a) => a.type === "awaiting_checkin")
  ) {
    alerts.push("Có nhân viên trong giờ ca nhưng chưa check-in quá 30 phút.");
  }
  const abnormalEvents = enriched.filter(
    (x) => x.classification?.anomalies?.hasAbnormalIssue,
  );
  if (abnormalEvents.length > 0) {
    alerts.push(
      `Phát hiện ${abnormalEvents.length} bản ghi check-in/check-out bất thường (quá sớm nhiều) — cần kiểm tra và điều chỉnh.`,
    );
  }
  if (lateLeaders.length > 0) {
    alerts.push(
      `Trong ${windowDays} ngày qua có nhân viên đi trễ lặp lại — xem danh sách “Đi trễ nhiều”.`,
    );
  }
  if (missingCheckoutLeaders.length > 0) {
    alerts.push(
      `Có nhân viên thường xuyên thiếu check-out — xem “Thiếu check-out”.`,
    );
  }
  if (alerts.length === 0) {
    alerts.push(
      "Không có cảnh báo nổi bật trong cửa sổ dữ liệu — vẫn nên xem đối soát định kỳ.",
    );
  }

  return {
    generatedAt: refNow.toISOString(),
    today,
    windowDays,
    dateFrom,
    dateTo,
    summaryToday,
    absentDetails,
    actionQueue: actions.slice(0, 12),
    lateLeaders,
    missingCheckoutLeaders,
    hotDays,
    shiftsWithAbsence,
    alerts,
  };
}

export async function listStoreScheduleChangeRequests(params: {
  reqUser: ReqUser | undefined;
  storeId: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  assertCanAccessStore(params.reqUser, params.storeId);
  const rows = await repo.listScheduleChangeRequestsForStore(params);
  const refreshedRows = await autoExpirePendingScheduleChangeRows(rows);
  const visibleRows = params.status
    ? refreshedRows.filter(
        (row: any) => String(row.status || "").toLowerCase() === String(params.status).toLowerCase(),
      )
    : refreshedRows;
  return {
    requests: visibleRows.map((r: any) => {
      let detail: any = null;
      try {
        detail = r.note ? JSON.parse(String(r.note)) : null;
      } catch {
        detail = null;
      }
      return {
        id: Number(r.id),
        userId: Number(r.user_id),
        storeId: Number(r.store_id),
        requestDate:
          toWorkDateYMD(r.request_date) ||
          String(r.request_date ?? "").slice(0, 10),
        requestType: r.request_type ?? null,
        status: r.status ?? null,
        requesterName: r.requester_name ?? null,
        createdAt: r.created_at ?? null,
        detail,
      };
    }),
  };
}

export async function processScheduleChangeRequest(params: {
  reqUser: ReqUser | undefined;
  requestId: number;
  status: "approved" | "rejected";
  note?: string;
}) {
  const request = await repo.findScheduleRequestById(params.requestId);
  if (!request) throw new ApiError(404, "Khong tim thay yeu cau");
  const normalizedRequest = await autoExpirePendingScheduleChangeRow(request);
  assertCanAccessStore(params.reqUser, Number(normalizedRequest.store_id));
  if (String(normalizedRequest.status) !== "pending") {
    if (String(normalizedRequest.status) === "expired") {
      throw new ApiError(
        400,
        "Yeu cau da qua gio vao ca hien tai va duoc tu dong het han",
      );
    }
    throw new ApiError(400, "Yeu cau nay da duoc xu ly");
  }

  let requestDetail: any = null;
  try {
    requestDetail = JSON.parse(normalizedRequest.note);
  } catch {}

  const actorId = getActorUserId(params.reqUser);
  const managerNote = params.note?.trim() || "";
  const processedAt = new Date().toISOString();
  const requestType = String(requestDetail?.requestType || "");
  let appliedSchedule: any = null;

  if (params.status === "approved" && requestDetail?.scheduleId) {
    const scheduleId = Number(requestDetail.scheduleId);
    const liveSchedule = await repo.findScheduleById(scheduleId);
    if (!liveSchedule) throw new ApiError(404, "Khong tim thay ca lam de cap nhat");

    const storeId = Number(normalizedRequest.store_id);
    const workDate =
      requestDetail?.current?.workDate ||
      requestDetail?.desired?.desiredWorkDate ||
      workDateYmdFromScheduleRow(liveSchedule);
    const liveShiftType = formatShiftTypeForApi(liveSchedule.shift_type) as
      | "SM"
      | "FULL_TIME"
      | "PART_TIME";

    if (requestType === "CHANGE_TIME" && requestDetail?.desired) {
      if (liveShiftType !== "PART_TIME") {
        throw new ApiError(400, "Yeu cau doi gio chi ap dung cho ca ban thoi gian");
      }
      const desiredStartTime = requestDetail?.desired?.desiredStartTime;
      const desiredEndTime = requestDetail?.desired?.desiredEndTime;

      if (!workDate || !desiredStartTime || !desiredEndTime) {
        throw new ApiError(400, "Thieu du lieu thoi gian mong muon de cap nhat lich");
      }

      if (desiredStartTime >= desiredEndTime) {
        throw new ApiError(400, "Gio ket thuc phai lon hon gio bat dau");
      }

      const updatedResult = await updateSchedule({
        reqUser: params.reqUser,
        id: scheduleId,
        startTime: desiredStartTime,
        endTime: desiredEndTime,
        note: managerNote || liveSchedule.note || undefined,
      });
      appliedSchedule = updatedResult.schedule;
    }

    if (requestType === "CHANGE_SHIFT") {
      const desiredShiftId = Number(requestDetail?.desired?.desiredShiftId);
      const desiredShiftLabel = String(requestDetail?.desired?.desiredShiftLabel || "").trim();
      if ((!Number.isFinite(desiredShiftId) || desiredShiftId <= 0) && !desiredShiftLabel) {
        throw new ApiError(400, "Thieu thong tin ca mong muon");
      }

      let matchedShift: any = null;
      if (Number.isFinite(desiredShiftId) && desiredShiftId > 0) {
        matchedShift = await repo.findShiftById(desiredShiftId, storeId);
      }
      if (!matchedShift) {
        const shifts = await repo.listShiftsByStore(storeId);
        const normalizedDesiredShiftLabel = normalizeLooseText(desiredShiftLabel);
        matchedShift = shifts.find(
          (shift: any) => normalizeLooseText(String(shift.name || "")) === normalizedDesiredShiftLabel,
        );
      }

      if (!matchedShift) {
        throw new ApiError(400, "Khong tim thay ca mong muon trong cua hang");
      }

      if (liveShiftType === "FULL_TIME") {
        const updatedResult = await updateSchedule({
          reqUser: params.reqUser,
          id: scheduleId,
          shiftId: Number(matchedShift.id),
          note: managerNote || liveSchedule.note || undefined,
        });
        appliedSchedule = updatedResult.schedule;
      } else {
        const updatedResult = await updateSchedule({
          reqUser: params.reqUser,
          id: scheduleId,
          startTime: String(matchedShift.start_time).slice(0, 5),
          endTime: String(matchedShift.end_time).slice(0, 5),
          note: managerNote || liveSchedule.note || undefined,
        });
        appliedSchedule = updatedResult.schedule;
      }
    }

    if (requestType === "DROP_SHIFT") {
      const cancelledSchedule = await repo.cancelSchedule(scheduleId);
      appliedSchedule = cancelledSchedule ? scheduleAuditSnapshot(cancelledSchedule) : null;
    }
  }

  const mergedRequestDetail = {
    ...(requestDetail && typeof requestDetail === "object" ? requestDetail : {}),
    decision: {
      status: params.status,
      note: managerNote || null,
      processedAt,
      processedByUserId: actorId,
    },
    appliedSchedule,
  };

  const result = await repo.updateScheduleRequestStatus({
    requestId: params.requestId,
    status: params.status,
    note: JSON.stringify(mergedRequestDetail),
  });

  const store = await repo.findStoreById(Number(normalizedRequest.store_id));
  await notificationService
    .notifyScheduleChangeProcessed({
      userId: Number(normalizedRequest.user_id),
      status: params.status,
      requestId: params.requestId,
      requestType: requestType || "doi lich",
      storeName: store?.name || null,
      note: managerNote,
    })
    .catch((err: unknown) => console.error("Failed to notify staff", err));

  return { ok: true, request: result };
}
