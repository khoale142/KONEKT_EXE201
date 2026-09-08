/**
 * Chuẩn nội bộ:
 * - employment_type (users): full_time | part_time (snake_case)
 * - shift_type (staff_schedules): FULL_TIME | PART_TIME | SM (uppercase)
 */

export type EmploymentTypeCanonical = "full_time" | "part_time";
export type ShiftTypeCanonical = "SM" | "FULL_TIME" | "PART_TIME";

/** Parse employment_type từ DB/API — không dùng nhãn tiếng Việt làm logic. */
export function parseEmploymentTypeLoose(raw: unknown): EmploymentTypeCanonical | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const lower = s.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (lower === "full_time" || lower === "fulltime") return "full_time";
  if (lower === "part_time" || lower === "parttime") return "part_time";
  const u = s.toUpperCase().replace(/-/g, "_");
  if (u === "FULL_TIME") return "full_time";
  if (u === "PART_TIME") return "part_time";
  return null;
}

/** Parse shift_type từ DB/body — chấp nhận cả full_time/part_time nếu client gửi nhầm. */
export function parseShiftTypeLoose(raw: unknown): ShiftTypeCanonical | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const u = s.toUpperCase().replace(/-/g, "_");
  if (u === "SM") return "SM";
  if (u === "FULL_TIME" || u === "FULLTIME") return "FULL_TIME";
  if (u === "PART_TIME" || u === "PARTTIME") return "PART_TIME";
  const lower = s.toLowerCase().replace(/-/g, "_");
  if (lower === "full_time") return "FULL_TIME";
  if (lower === "part_time") return "PART_TIME";
  return null;
}

export function formatShiftTypeForApi(raw: unknown): string {
  const p = parseShiftTypeLoose(raw);
  if (p) return p;
  return String(raw ?? "").trim();
}
