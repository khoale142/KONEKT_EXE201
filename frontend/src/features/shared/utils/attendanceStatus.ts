import { normalizeShiftType } from "./employmentShiftTypes";

/**
 * Trạng thái chấm công hiển thị trên UI.
 * Map từ classification.status (backend) sang tiếng Việt và màu badge.
 */

/** Lấy phút trong ngày (0-1439) từ ISO/date string theo timezone VN, hoặc NaN nếu invalid */
export function timeToMinutesVN(value: string | Date | null | undefined): number {
  if (value == null || value === "") return NaN;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  const s = d.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type ComputedClassification = {
  status: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  earlyCheckInMinutes: number;
  lateCheckOutMinutes: number;
  anomalies?: {
    earlyCheckInMinutes: number;
    earlyCheckOutMinutes: number;
    issues: string[];
    hasAbnormalIssue: boolean;
  };
};

/**
 * Tính trạng thái và độ lệch từ dữ liệu (fallback khi API chưa có classification).
 * - actualCheckIn > scheduledStart => late
 * - actualCheckOut < scheduledEnd => early leave
 * - actualCheckIn < scheduledStart => early check-in
 * - actualCheckOut > scheduledEnd => late check-out
 */
export function computeClassificationFromTimes(params: {
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  classification?: {
    status?: string;
    lateMinutes?: number;
    earlyLeaveMinutes?: number;
    anomalies?: {
      earlyCheckInMinutes?: number;
      earlyCheckOutMinutes?: number;
      issues?: string[];
      hasAbnormalIssue?: boolean;
    };
  } | null;
}): ComputedClassification {
  const fallback: ComputedClassification = {
    status: "ON_TIME",
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    earlyCheckInMinutes: 0,
    lateCheckOutMinutes: 0,
  };
  const c0 = params.classification;
  const useApiClassification =
    Boolean(c0?.status) &&
    c0!.lateMinutes !== undefined &&
    c0!.earlyLeaveMinutes !== undefined;

  const sStart = timeToMinutesVN(params.scheduledStartAt);
  const sEnd = timeToMinutesVN(params.scheduledEndAt);
  const cIn = timeToMinutesVN(params.checkInAt);
  const cOut = timeToMinutesVN(params.checkOutAt);
  const hasSchedule = Number.isFinite(sStart) && Number.isFinite(sEnd);
  const late =
    Number.isFinite(cIn) && Number.isFinite(sStart) && cIn > sStart
      ? Math.round(cIn - sStart)
      : 0;
  const early =
    Number.isFinite(cOut) && Number.isFinite(sEnd) && cOut < sEnd
      ? Math.round(sEnd - cOut)
      : 0;
  const earlyIn =
    Number.isFinite(cIn) && Number.isFinite(sStart) && cIn < sStart
      ? Math.round(sStart - cIn)
      : 0;
  const lateOut =
    Number.isFinite(cOut) && Number.isFinite(sEnd) && cOut > sEnd
      ? Math.round(cOut - sEnd)
      : 0;

  /**
   * Khi API đã gửi classification (có grace đúng như backend), luôn ưu tiên status đó.
   * Tránh lệch: MISSING_CHECKOUT bị ép thành CHECKED_IN khi chưa checkout.
   */
  if (useApiClassification && c0) {
    if (!params.checkInAt) {
      return {
        ...fallback,
        status: c0.status ?? (hasSchedule ? "ABSENT" : "NO_SCHEDULE"),
        lateMinutes: c0.lateMinutes ?? 0,
        earlyLeaveMinutes: c0.earlyLeaveMinutes ?? 0,
        anomalies: c0.anomalies
          ? {
              earlyCheckInMinutes: c0.anomalies.earlyCheckInMinutes ?? 0,
              earlyCheckOutMinutes: c0.anomalies.earlyCheckOutMinutes ?? 0,
              issues: c0.anomalies.issues ?? [],
              hasAbnormalIssue: Boolean(c0.anomalies.hasAbnormalIssue),
            }
          : undefined,
      };
    }
    if (!params.checkOutAt) {
      return {
        ...fallback,
        status:
          c0.status ?? (late > 0 ? "MISSING_CHECKOUT_LATE" : "MISSING_CHECKOUT"),
        lateMinutes: c0.lateMinutes ?? late,
        earlyLeaveMinutes: c0.earlyLeaveMinutes ?? 0,
        anomalies: c0.anomalies
          ? {
              earlyCheckInMinutes: c0.anomalies.earlyCheckInMinutes ?? 0,
              earlyCheckOutMinutes: c0.anomalies.earlyCheckOutMinutes ?? 0,
              issues: c0.anomalies.issues ?? [],
              hasAbnormalIssue: Boolean(c0.anomalies.hasAbnormalIssue),
            }
          : undefined,
      };
    }
    if (!hasSchedule) {
      return {
        status: c0.status ?? "NO_SCHEDULE",
        lateMinutes: c0.lateMinutes ?? late,
        earlyLeaveMinutes: c0.earlyLeaveMinutes ?? early,
        earlyCheckInMinutes: earlyIn,
        lateCheckOutMinutes: lateOut,
        anomalies: c0.anomalies
          ? {
              earlyCheckInMinutes: c0.anomalies.earlyCheckInMinutes ?? 0,
              earlyCheckOutMinutes: c0.anomalies.earlyCheckOutMinutes ?? 0,
              issues: c0.anomalies.issues ?? [],
              hasAbnormalIssue: Boolean(c0.anomalies.hasAbnormalIssue),
            }
          : undefined,
      };
    }
    return {
      status: c0.status ?? "ON_TIME",
      lateMinutes: c0.lateMinutes ?? late,
      earlyLeaveMinutes: c0.earlyLeaveMinutes ?? early,
      earlyCheckInMinutes: earlyIn,
      lateCheckOutMinutes: lateOut,
      anomalies: c0.anomalies
        ? {
            earlyCheckInMinutes: c0.anomalies.earlyCheckInMinutes ?? 0,
            earlyCheckOutMinutes: c0.anomalies.earlyCheckOutMinutes ?? 0,
            issues: c0.anomalies.issues ?? [],
            hasAbnormalIssue: Boolean(c0.anomalies.hasAbnormalIssue),
          }
        : undefined,
    };
  }

  if (!params.checkInAt) {
    return { ...fallback, status: hasSchedule ? "ABSENT" : "NO_SCHEDULE" };
  }
  if (!params.checkOutAt) {
    return {
      ...fallback,
      status: "WORKING",
      lateMinutes: late,
    };
  }
  if (!hasSchedule) {
    return { ...fallback, status: "NO_SCHEDULE" };
  }

  let status = "ON_TIME";
  if (late > 0 && early > 0) status = "LATE_AND_EARLY";
  else if (late > 0) status = "LATE";
  else if (early > 0) status = "EARLY_LEAVE";
  return {
    status,
    lateMinutes: late,
    earlyLeaveMinutes: early,
    earlyCheckInMinutes: earlyIn,
    lateCheckOutMinutes: lateOut,
  };
}

export type AttendanceStatusKey =
  | "ON_TIME"
  | "LATE"
  | "EARLY_LEAVE"
  | "LATE_AND_EARLY"
  | "ABSENT"
  | "NO_SHOW"
  | "UPCOMING"
  | "AWAITING_CHECKIN"
  | "CHECKIN_OVERDUE"
  | "WORKING"
  | "OVERDUE_CHECKOUT"
  | "MISSING_CHECKOUT"
  | "MISSING_CHECKOUT_LATE"
  | "OUTSIDE_SCHEDULE"
  | "CHECKED_IN"; // Đang làm việc (có check-in, chưa check-out)

/** Giờ hiển thị (VN) từ ISO — dùng trong copy realtime, tránh import vòng. */
function formatClockVNFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Card “Chấm công hôm nay”: trạng thái tức thời + có được bấm check-in hay không
 * (khớp nghiệp vụ BE: check-in từ đầu ca đến hết giờ kết thúc ca).
 */
export type TodayCheckInRealtimeUi = {
  headline: string;
  detail: string;
  checkInAllowed: boolean;
};

export function getTodayCheckInRealtimeUi(params: {
  classificationStatus: string | undefined;
  scheduledStartAt: string;
  scheduledEndAt: string;
  lateGraceMinutes?: number;
  now: Date;
}): TodayCheckInRealtimeUi {
  const {
    classificationStatus,
    scheduledStartAt,
    scheduledEndAt,
    lateGraceMinutes = 5,
    now,
  } = params;
  const startMs = new Date(scheduledStartAt).getTime();
  const endMs = new Date(scheduledEndAt).getTime();
  const t = now.getTime();
  const st = classificationStatus;
  const startClock = formatClockVNFromIso(scheduledStartAt);
  const endClock = formatClockVNFromIso(scheduledEndAt);

  const fallbackNoClassification = (): TodayCheckInRealtimeUi => {
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return {
        headline: "Không xác định khung giờ ca",
        detail: "Vui lòng tải lại trang hoặc liên hệ quản lý.",
        checkInAllowed: false,
      };
    }
    if (t > endMs) {
      return {
        headline: "Đã hết ca, không thể check-in",
        detail: "Đã qua thời điểm được phép check-in cho ca này. Liên hệ quản lý nếu bạn đã làm việc.",
        checkInAllowed: false,
      };
    }
    if (t < startMs) {
      return {
        headline: "Chưa tới giờ ca",
        detail: startClock
          ? `Check-in chỉ mở từ ${startClock} đến hết ca (${endClock || "—"}).`
          : "Check-in chỉ trong khung giờ ca (từ giờ bắt đầu đến hết ca).",
        checkInAllowed: false,
      };
    }
    const graceMs = lateGraceMinutes * 60_000;
    const pastGrace = t > startMs + graceMs;
    if (pastGrace) {
      return {
        headline: "Quá giờ check-in",
        detail:
          "Bạn vào ca trễ so với quy định, nhưng vẫn trong thời gian ca — hãy check-in ngay khi có mặt tại cửa hàng.",
        checkInAllowed: true,
      };
    }
    return {
      headline: "Trong giờ ca — được phép check-in",
      detail: "Hãy check-in khi đã có mặt tại cửa hàng.",
      checkInAllowed: true,
    };
  };

  if (!st) return fallbackNoClassification();

  if (st === "NO_SHOW") {
    return {
      headline: "Đã hết ca, không thể check-in",
      detail:
        "Đã qua thời điểm được phép check-in (hết giờ kết thúc ca). Liên hệ quản lý nếu bạn đã làm việc.",
      checkInAllowed: false,
    };
  }

  if (st === "UPCOMING") {
    return {
      headline: "Chưa tới giờ ca",
      detail: startClock
        ? `Check-in mở từ ${startClock} đến hết ca (${endClock || "—"}).`
        : "Check-in chỉ được phép trong khung giờ ca.",
      checkInAllowed: false,
    };
  }

  if (st === "AWAITING_CHECKIN") {
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return fallbackNoClassification();
    const graceMs = lateGraceMinutes * 60_000;
    const pastGrace = t > startMs + graceMs;
    if (pastGrace) {
      return {
        headline: "Quá giờ check-in",
        detail:
          "Bạn vào ca trễ so với quy định, nhưng ca vẫn đang diễn ra — hãy check-in ngay khi có mặt tại cửa hàng.",
        checkInAllowed: true,
      };
    }
    return {
      headline: "Trong giờ ca — được phép check-in",
      detail: "Hãy check-in khi đã có mặt tại cửa hàng.",
      checkInAllowed: true,
    };
  }

  if (st === "CHECKIN_OVERDUE") {
    return {
      headline: "Quá giờ check-in",
      detail:
        "Bạn đã quá giờ vào ca theo quy định, nhưng ca vẫn đang diễn ra — hãy check-in ngay khi có mặt tại cửa hàng.",
      checkInAllowed: true,
    };
  }

  return fallbackNoClassification();
}

export function getAttendanceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ON_TIME: "Hoàn thành — đúng giờ",
    LATE: "Hoàn thành — đi muộn",
    EARLY_LEAVE: "Hoàn thành — về sớm",
    LATE_AND_EARLY: "Hoàn thành — đi muộn và về sớm",
    ABSENT: "Vắng mặt (không check-in)",
    /** Hết giờ ca, không có check-in — cùng nghĩa vắng mặt với quản lý. */
    NO_SHOW: "Vắng mặt (không check-in sau khi hết ca)",
    UPCOMING: "Sắp tới — chưa vào ca",
    AWAITING_CHECKIN: "Trong thời gian được check-in",
    CHECKIN_OVERDUE: "Quá giờ check-in",
    MISSING_CHECKIN: "Thiếu check-in",
    WORKING: "Đang làm",
    MISSING_CHECKOUT: "Thiếu check-out",
    MISSING_CHECKOUT_LATE: "Đi muộn — chưa check-out",
    OVERDUE_CHECKOUT: "Thiếu check-out",
    OUTSIDE_SCHEDULE: "Ngoài lịch",
    CHECKED_IN: "Đang làm việc",
    NO_SCHEDULE: "Chưa có lịch",
  };
  return map[status] ?? status;
}

/**
 * Lịch sử / ca đã qua: nhãn kết quả cuối (không dùng copy “quá giờ check-in” tức thời).
 */
export function getScheduleHistoryOutcomeLabel(status: string): string {
  if (status === "NO_SHOW" || status === "ABSENT") {
    return "Vắng mặt";
  }
  return getAttendanceStatusLabel(status);
}

/** Gợi ý ngắn trên màn chấm công nhân viên (khi chưa có bản ghi attendance). */
export function getStaffChamCongHint(status: string | undefined): string {
  if (!status) return "Chưa có ghi nhận chấm công. Check-in khi đến cửa hàng.";
  const map: Record<string, string> = {
    UPCOMING: "Ca chưa bắt đầu. Khi đến cửa hàng, hãy check-in theo giờ ca.",
    AWAITING_CHECKIN: "Đang trong khung giờ ca — vui lòng check-in nếu bạn đã có mặt.",
    CHECKIN_OVERDUE: "Đã quá giờ check-in. Vui lòng check-in ngay và báo quản lý nếu có sự cố.",
    WORKING: "Đang trong ca. Hãy check-out khi kết thúc ca.",
    MISSING_CHECKOUT: "Ca đã kết thúc nhưng chưa check-out. Cần xử lý ngay.",
    MISSING_CHECKOUT_LATE: "Đã check-in trễ — vẫn cần check-out theo quy định.",
    NO_SHOW:
      "Bạn được xếp vắng mặt ca này (không có check-in trước khi hết ca). Nếu đã làm việc, liên hệ quản lý để xử lý.",
    OVERDUE_CHECKOUT:
      "Ca đã hết giờ — vui lòng check-out ngay hoặc liên hệ quản lý nếu quên chấm công.",
    NO_SCHEDULE: "Không có lịch ca cho thời điểm này.",
  };
  return map[status] ?? getStaffChamCongHint(undefined);
}

export function getAttendanceStatusBadgeColor(status: string): string {
  const map: Record<string, string> = {
    ON_TIME: "#2f855a", // xanh lá
    LATE: "#d69e2e", // cam
    EARLY_LEAVE: "#d69e2e", // cam
    LATE_AND_EARLY: "#c53030", // đỏ
    ABSENT: "#c53030", // đỏ
    NO_SHOW: "#c53030",
    UPCOMING: "#3182ce",
    AWAITING_CHECKIN: "#d97706",
    CHECKIN_OVERDUE: "#c53030",
    WORKING: "#3182ce",
    MISSING_CHECKIN: "#718096", // xám
    MISSING_CHECKOUT: "#c53030",
    MISSING_CHECKOUT_LATE: "#c53030", // đỏ
    OVERDUE_CHECKOUT: "#c53030",
    OUTSIDE_SCHEDULE: "#718096", // xám
    CHECKED_IN: "#3182ce", // xanh dương
    NO_SCHEDULE: "#718096", // xám
  };
  return map[status] ?? "#718096";
}

/**
 * Format cột "Đi muộn / Về sớm"
 */
export function formatLateEarlyDisplay(
  lateMinutes: number,
  earlyLeaveMinutes: number
): string {
  const parts: string[] = [];
  if (lateMinutes > 0) parts.push(`Đi muộn ${lateMinutes} phút`);
  if (earlyLeaveMinutes > 0) parts.push(`Về sớm ${earlyLeaveMinutes} phút`);
  return parts.length > 0 ? parts.join("; ") : "--";
}

/**
 * Format chi tiết độ lệch: trễ, về sớm, check-in sớm, check-out muộn
 */
export function formatDetailedLateEarlyDisplay(params: {
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  earlyCheckInMinutes?: number;
  lateCheckOutMinutes?: number;
}): string {
  const parts: string[] = [];
  if ((params.lateMinutes ?? 0) > 0) parts.push(`Trễ ${params.lateMinutes} phút`);
  if ((params.earlyLeaveMinutes ?? 0) > 0) parts.push(`Về sớm ${params.earlyLeaveMinutes} phút`);
  if ((params.earlyCheckInMinutes ?? 0) > 0) parts.push(`Check-in sớm ${params.earlyCheckInMinutes} phút`);
  if ((params.lateCheckOutMinutes ?? 0) > 0) parts.push(`Check-out muộn ${params.lateCheckOutMinutes} phút`);
  return parts.length > 0 ? parts.join(" • ") : "--";
}

/**
 * Format cột "Ca làm":
 * - FULL_TIME: tên ca (Ca A, Ca B, Ca Open)
 * - PART_TIME: khoảng giờ 08:00 - 17:00
 */
export function formatShiftDisplay(params: {
  shiftLabel?: string | null;
  shiftType?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  formatTime: (v: string | null | undefined) => string;
}): string {
  const { shiftLabel, shiftType, scheduledStartAt, scheduledEndAt, formatTime } =
    params;
  if (shiftLabel) return shiftLabel;
  const st = normalizeShiftType(shiftType);
  if (st === "PART_TIME" && scheduledStartAt && scheduledEndAt) {
    return `${formatTime(scheduledStartAt)} - ${formatTime(scheduledEndAt)}`;
  }
  if (st === "FULL_TIME" && shiftLabel) return shiftLabel;
  if (scheduledStartAt && scheduledEndAt) {
    return `${formatTime(scheduledStartAt)} - ${formatTime(scheduledEndAt)}`;
  }
  return "--";
}
