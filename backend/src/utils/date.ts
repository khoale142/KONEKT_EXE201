/**
 * Chuyển Date | string | null sang chuỗi YYYY-MM-DD
 */
export function toDateOnly(input: Date | string | null | undefined): string {
  if (input == null) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
