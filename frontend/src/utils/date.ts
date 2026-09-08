/**
 * Chuyển ngày sang định dạng DD/MM/YYYY để hiển thị
 */
export function formatDateOnly(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

/**
 * Chuyển ngày sang YYYY-MM-DD cho input type="date"
 */
export function toDateInputValue(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
