/** Số hữu hạn để format / tính toán — tránh NaN trên UI. */
export function asFiniteNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "" || s.toLowerCase() === "nan") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}
