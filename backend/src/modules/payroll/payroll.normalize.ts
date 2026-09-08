/**
 * Chuẩn hóa số từ DB (NUMERIC → string), BigInt, null/undefined để JSON không sinh NaN.
 */

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "" || s.toLowerCase() === "nan") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toFiniteNumber(value, fallback));
}

export type StaffPayrollRecordJson = {
  user_id: number;
  store_id: number | null;
  month: number;
  year: number;
  employment_type: string;
  total_shifts: number;
  total_hours: number;
  hourly_wage_snapshot: number;
  base_salary_snapshot: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  _late_shifts: number;
  _missed_checkouts: number;
  tax_rate_pct?: number;
  tax_amount?: number;
  uniform_deduction?: number;
  fuel_allowance?: number;
  scheduled_shifts?: number;
  scheduled_hours?: number;
  full_schedule_gross_salary?: number;
  full_schedule_net_salary?: number;
};

/** Chuẩn hóa một dòng lương (DRAFT tính realtime hoặc dòng pr_payroll_records từ DB). */
export function normalizeStaffPayrollRecord(raw: Record<string, unknown>): StaffPayrollRecordJson {
  const monthRaw = toInt(raw.month, NaN);
  const yearRaw = toInt(raw.year, NaN);
  const now = new Date();
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1;
  const year = Number.isFinite(yearRaw) && yearRaw >= 1970 && yearRaw <= 2100 ? yearRaw : now.getFullYear();

  const sid = raw.store_id;
  return {
    user_id: toInt(raw.user_id, 0),
    store_id: sid === null || sid === undefined ? null : toInt(sid, 0),
    month,
    year,
    employment_type: String(raw.employment_type ?? "part_time").trim() || "part_time",
    total_shifts: toInt(raw.total_shifts, 0),
    total_hours: Math.round(toFiniteNumber(raw.total_hours, 0) * 100) / 100,
    hourly_wage_snapshot: Math.round(toFiniteNumber(raw.hourly_wage_snapshot, 0) * 100) / 100,
    base_salary_snapshot: Math.round(toFiniteNumber(raw.base_salary_snapshot, 0) * 100) / 100,
    gross_salary: Math.round(toFiniteNumber(raw.gross_salary, 0)),
    total_deductions: Math.round(toFiniteNumber(raw.total_deductions, 0)),
    net_salary: Math.round(toFiniteNumber(raw.net_salary, 0)),
    status: String(raw.status ?? "DRAFT"),
    _late_shifts: toInt(raw._late_shifts, 0),
    _missed_checkouts: toInt(raw._missed_checkouts, 0),
    tax_rate_pct: Math.round(toFiniteNumber(raw.tax_rate_pct, 0) * 100) / 100,
    tax_amount: Math.round(toFiniteNumber(raw.tax_amount, 0)),
    uniform_deduction: Math.round(toFiniteNumber(raw.uniform_deduction, 0)),
    fuel_allowance: Math.round(toFiniteNumber(raw.fuel_allowance, 0)),
    scheduled_shifts: toInt(raw.scheduled_shifts, 0),
    scheduled_hours: Math.round(toFiniteNumber(raw.scheduled_hours, 0) * 100) / 100,
    full_schedule_gross_salary: Math.round(toFiniteNumber(raw.full_schedule_gross_salary, 0)),
    full_schedule_net_salary: Math.round(toFiniteNumber(raw.full_schedule_net_salary, 0)),
  };
}
