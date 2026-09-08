/**
 * Global Date Utility — Zero-dependency, Native JS.
 * Ép cứng múi giờ Asia/Ho_Chi_Minh (UTC+7) cho toàn bộ frontend.
 * KHÔNG import dayjs hay bất kỳ thư viện bên ngoài nào.
 */

const LOCALE = "vi-VN";
const TIMEZONE = "Asia/Ho_Chi_Minh";

/* ── Parser an toàn ── */

/**
 * Chuẩn hóa chuỗi ISO từ backend: nếu KHÔNG có suffix timezone
 * (chữ 'Z' hoặc '+/-HH:MM'), tự động nối thêm 'Z' để ép trình duyệt
 * hiểu đây là giờ UTC gốc → toLocaleString sẽ +7h đúng.
 *
 * VD: "2026-04-07T04:09:00" → "2026-04-07T04:09:00Z" → UTC
 *     "2026-04-07T04:09:00Z"          → giữ nguyên
 *     "2026-04-07T04:09:00+07:00"     → giữ nguyên
 */
function ensureUtc(raw: string): string {
  const trimmed = raw.trim();
  // Đã có 'Z' hoặc offset (+/-) → không cần sửa
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed + "Z";
}

function parse(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(ensureUtc(String(value)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ────────────────────────────────────────────────────────────────────────
   PUBLIC API
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Format ngày + giờ: dd/MM/yyyy HH:mm (24 h)
 * VD: 06/04/2026 10:54
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parse(value);
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

/**
 * Format giờ: HH:mm (24 h)
 * VD: 10:54
 */
export function formatTime(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d) return "--";
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format ngày: dd/MM/yyyy
 * VD: 06/04/2026
 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d) return "--";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Ngày hôm nay theo UTC+7, format YYYY-MM-DD (cho input[type=date], query API).
 */
export function getTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Chuyển Date / ISO string → YYYY-MM-DD theo UTC+7.
 * Thay thế cho `d.toISOString().slice(0,10)` (vốn trả UTC).
 */
export function toYmd(value: Date | string): string {
  const d = parse(value);
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Start-of-month (YYYY-MM-DD) của tháng chứa `ref` theo UTC+7.
 */
export function startOfMonth(ref?: Date | string): string {
  const d = ref ? (parse(ref) ?? new Date()) : new Date();
  const parts = d.toLocaleDateString("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).split("-");                       // ["2026","04"]
  return `${parts[0]}-${parts[1]}-01`;
}

/**
 * End-of-month (YYYY-MM-DD) của tháng chứa `ref` theo UTC+7.
 */
export function endOfMonth(ref?: Date | string): string {
  const somStr = startOfMonth(ref);               // "2026-04-01"
  const [y, m] = somStr.split("-").map(Number);   // [2026, 4]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 30
  return `${somStr.slice(0, 8)}${String(lastDay).padStart(2, "0")}`;
}

/**
 * Số giờ chênh lệch giữa now và 1 thời điểm (theo UTC+7).
 */
export function hoursSince(iso: string): number {
  const d = parse(iso);
  if (!d) return 0;
  return Math.floor((Date.now() - d.getTime()) / 3_600_000);
}

/**
 * Năm hiện tại theo UTC+7.
 */
export function currentYear(): number {
  return Number(
    new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE, year: "numeric" })
  );
}

/**
 * Tháng hiện tại (1-based) theo UTC+7.
 */
export function currentMonth(): number {
  return Number(
    new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE, month: "numeric" })
  );
}
