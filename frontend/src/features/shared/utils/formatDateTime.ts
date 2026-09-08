/**
 * Chuẩn hóa format ngày/giờ cho module staff/attendance/schedule.
 * - Timezone: Asia/Ho_Chi_Minh
 * - Locale: vi-VN
 * - Giờ: 24h (HH:mm), không AM/PM
 */

const LOCALE = "vi-VN";
const TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Lấy ngày hôm nay theo timezone Asia/Ho_Chi_Minh (YYYY-MM-DD).
 */
export function getTodayVN(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: TIMEZONE,
  });
}

/**
 * Kiểm tra dateString có phải ngày đã qua (trước hôm nay) không.
 * So sánh theo YYYY-MM-DD, timezone Asia/Ho_Chi_Minh.
 * Ngày hôm nay trả về false (vẫn hợp lệ).
 */
export function isPastDateVN(dateString: string): boolean {
  const today = getTodayVN();
  return dateString < today;
}

function parseValue(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const normalized = normalizeServerDateInput(text);
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeServerDateInput(value: string): string {
  // Postgres timestamps often come back without timezone info.
  // Treat those datetime strings as UTC, then convert on display.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
    return value.replace(" ", "T") + "Z";
  }
  return value;
}

/**
 * Format ngày: dd/MM/yyyy
 * VD: 12/03/2026
 */
export function formatDateVN(value: string | Date | null | undefined): string {
  const d = parseValue(value);
  if (!d) return "--";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format ngày ngắn: dd/MM (dùng cho label gọn)
 * VD: 17/03
 */
export function formatDateShortVN(
  value: string | Date | null | undefined
): string {
  const d = parseValue(value);
  if (!d) return "--";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Format giờ: HH:mm (24h)
 * VD: 17:00, 08:30
 */
export function formatTimeVN(value: string | Date | null | undefined): string {
  const d = parseValue(value);
  if (!d) return "--";
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format ngày + giờ: dd/MM/yyyy HH:mm (24h)
 * VD: 12/03/2026 17:00
 */
export function formatDateTimeVN(
  value: string | Date | null | undefined
): string {
  const d = parseValue(value);
  if (!d) return "--";
  return d.toLocaleString(LOCALE, {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Parse YYYY-MM-DD theo lịch local (tránh lệch ngày so với UTC của `new Date("yyyy-mm-dd")`) */
function parseYMDLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Thêm số ngày vào YYYY-MM-DD (theo lịch local) */
export function addDaysYMD(ymd: string, days: number): string {
  const d = parseYMDLocal(ymd);
  if (!d) {
    const fallback = parseValue(ymd);
    if (!fallback) return ymd;
    fallback.setDate(fallback.getDate() + days);
    return formatYMDLocal(fallback);
  }
  d.setDate(d.getDate() + days);
  return formatYMDLocal(d);
}

/** Lấy thứ 2 đầu tuần chứa ngày đã cho (YYYY-MM-DD, tuần T2–CN) */
export function getWeekStartMonday(ymd: string): string {
  const d = parseYMDLocal(ymd) ?? parseValue(ymd);
  if (!d) return getWeekStartMonday(getTodayVN());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatYMDLocal(d);
}

/** Chủ nhật cuối tuần (Monday + 6 ngày) */
export function getWeekEndSunday(weekStart: string): string {
  return addDaysYMD(weekStart, 6);
}

/** 7 ngày trong tuần từ thứ 2 */
export function getWeekDays(weekStart: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDaysYMD(weekStart, i));
  }
  return dates;
}

/** Label ngày trong tuần */
export const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
