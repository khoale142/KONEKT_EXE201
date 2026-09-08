/** Chuẩn hóa ngày từ DB (ISO) hoặc input date về YYYY-MM-DD để so sánh. */
export function ymdOnly(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}
