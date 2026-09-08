import { parseEmploymentTypeLoose } from "../../utils/employmentShiftTypes";
import { normalizeStaffPayrollRecord, toFiniteNumber, toInt } from "./payroll.normalize";
import { payrollRepo } from "./payroll.repo";

const STANDARD_HOURLY_WAGE = 25_000;
const FULL_TIME_NET_MONTHLY_SALARY = 9_000_000;
const FUEL_ALLOWANCE = 100_000;
const UNIFORM_DEDUCTION = 50_000;
const TAX_RATE_PCT = 10;

type SalaryBreakdown = {
  hourlyWageSnapshot: number;
  baseSalarySnapshot: number;
  grossSalary: number;
  taxAmount: number;
  totalDeductions: number;
  netSalary: number;
  fuelAllowance: number;
  uniformDeduction: number;
  fullScheduleGrossSalary: number;
  fullScheduleNetSalary: number;
};

function roundCurrency(value: number) {
  return Math.round(value);
}

function buildPartTimeSalaryBreakdown(params: { workedHours: number; scheduledHours: number }): SalaryBreakdown {
  const grossSalary = roundCurrency(params.workedHours * STANDARD_HOURLY_WAGE);
  const taxAmount = roundCurrency(grossSalary * (TAX_RATE_PCT / 100));
  const totalDeductions = taxAmount + UNIFORM_DEDUCTION;
  const netSalary = Math.max(0, grossSalary + FUEL_ALLOWANCE - totalDeductions);

  const fullScheduleGrossSalary = roundCurrency(params.scheduledHours * STANDARD_HOURLY_WAGE);
  const fullScheduleTaxAmount = roundCurrency(fullScheduleGrossSalary * (TAX_RATE_PCT / 100));
  const fullScheduleNetSalary = Math.max(
    0,
    fullScheduleGrossSalary + FUEL_ALLOWANCE - fullScheduleTaxAmount - UNIFORM_DEDUCTION
  );

  return {
    hourlyWageSnapshot: STANDARD_HOURLY_WAGE,
    baseSalarySnapshot: 0,
    grossSalary,
    taxAmount,
    totalDeductions,
    netSalary,
    fuelAllowance: FUEL_ALLOWANCE,
    uniformDeduction: UNIFORM_DEDUCTION,
    fullScheduleGrossSalary,
    fullScheduleNetSalary,
  };
}

function buildFullTimeSalaryBreakdown(): SalaryBreakdown {
  return {
    hourlyWageSnapshot: 0,
    baseSalarySnapshot: FULL_TIME_NET_MONTHLY_SALARY,
    grossSalary: 0,
    taxAmount: 0,
    totalDeductions: 0,
    netSalary: FULL_TIME_NET_MONTHLY_SALARY,
    fuelAllowance: 0,
    uniformDeduction: 0,
    fullScheduleGrossSalary: 0,
    fullScheduleNetSalary: FULL_TIME_NET_MONTHLY_SALARY,
  };
}

function buildPolicyFields(raw: Record<string, unknown>, scheduledShifts: number, scheduledHours: number) {
  const employmentType = parseEmploymentTypeLoose(raw.employment_type);
  if (employmentType === "full_time") {
    const breakdown = buildFullTimeSalaryBreakdown();
    return {
      ...raw,
      hourly_wage_snapshot: breakdown.hourlyWageSnapshot,
      base_salary_snapshot: breakdown.baseSalarySnapshot,
      gross_salary: breakdown.grossSalary,
      total_deductions: breakdown.totalDeductions,
      net_salary: breakdown.netSalary,
      tax_rate_pct: 0,
      tax_amount: breakdown.taxAmount,
      uniform_deduction: breakdown.uniformDeduction,
      fuel_allowance: breakdown.fuelAllowance,
      scheduled_shifts: scheduledShifts,
      scheduled_hours: scheduledHours,
      full_schedule_gross_salary: breakdown.fullScheduleGrossSalary,
      full_schedule_net_salary: breakdown.fullScheduleNetSalary,
    };
  }

  const grossSalary = toFiniteNumber(raw.gross_salary, 0);
  const taxAmount = roundCurrency(grossSalary * (TAX_RATE_PCT / 100));
  const totalDeductions = taxAmount + UNIFORM_DEDUCTION;
  const netSalary = Math.max(0, grossSalary + FUEL_ALLOWANCE - totalDeductions);
  const fullScheduleGrossSalary = roundCurrency(scheduledHours * STANDARD_HOURLY_WAGE);
  const fullScheduleTaxAmount = roundCurrency(fullScheduleGrossSalary * (TAX_RATE_PCT / 100));
  const fullScheduleNetSalary = Math.max(
    0,
    fullScheduleGrossSalary + FUEL_ALLOWANCE - fullScheduleTaxAmount - UNIFORM_DEDUCTION
  );

  return {
    ...raw,
    hourly_wage_snapshot: STANDARD_HOURLY_WAGE,
    base_salary_snapshot: 0,
    gross_salary: roundCurrency(grossSalary),
    total_deductions: totalDeductions,
    net_salary: roundCurrency(netSalary),
    tax_rate_pct: TAX_RATE_PCT,
    tax_amount: taxAmount,
    uniform_deduction: UNIFORM_DEDUCTION,
    fuel_allowance: FUEL_ALLOWANCE,
    scheduled_shifts: scheduledShifts,
    scheduled_hours: scheduledHours,
    full_schedule_gross_salary: fullScheduleGrossSalary,
    full_schedule_net_salary: fullScheduleNetSalary,
  };
}

export const payrollService = {
  async calculateRealtimePayrolls(userIds: number[], storeId: number | null, month: number, year: number) {
    if (userIds.length === 0) return [];

    const users = await payrollRepo.getUserConfigs(userIds);
    const stats = await payrollRepo.getAttendanceStats(userIds, month, year);
    const scheduledStats = await payrollRepo.getScheduledStats(userIds, month, year);
    const finalizedRecords = await payrollRepo.getPayrollRecords(userIds, month, year);

    const statsMap = new Map();
    for (const s of stats) {
      const sid = toInt(s.user_id, -1);
      if (sid >= 0) statsMap.set(sid, s);
    }

    const scheduledStatsMap = new Map();
    for (const s of scheduledStats) {
      const sid = toInt(s.user_id, -1);
      if (sid >= 0) scheduledStatsMap.set(sid, s);
    }

    const finalizedMap = new Map();
    for (const f of finalizedRecords) {
      if (f.status === "FINALIZED" || f.status === "PAID") {
        const fid = toInt(f.user_id, -1);
        if (fid >= 0) finalizedMap.set(fid, f);
      }
    }

    const results: Record<string, unknown>[] = [];

    for (const u of users) {
      const uid = toInt(u.id, -1);
      if (uid < 0) continue;

      const scheduled = scheduledStatsMap.get(uid) || { scheduled_shifts: 0, scheduled_hours: 0 };
      const scheduledShifts = toInt(scheduled.scheduled_shifts, 0);
      const scheduledHours = toFiniteNumber(scheduled.scheduled_hours, 0);

      if (finalizedMap.has(uid)) {
        results.push(
          buildPolicyFields(
            finalizedMap.get(uid) as Record<string, unknown>,
            scheduledShifts,
            scheduledHours
          )
        );
        continue;
      }

      const st = statsMap.get(uid) || { total_shifts: 0, total_hours: 0, late_shifts: 0, missed_checkouts: 0 };
      const totalShifts = toInt(st.total_shifts, 0);
      const totalHours = toFiniteNumber(st.total_hours, 0);
      const lateShifts = toInt(st.late_shifts, 0);
      const missedCheckouts = toInt(st.missed_checkouts, 0);
      const etNorm = parseEmploymentTypeLoose(u.employment_type);
      const isFullTime = etNorm === "full_time";
      const breakdown = isFullTime
        ? buildFullTimeSalaryBreakdown()
        : buildPartTimeSalaryBreakdown({
            workedHours: totalHours,
            scheduledHours,
          });

      results.push({
        user_id: uid,
        store_id: storeId,
        month,
        year,
        employment_type: etNorm ?? (String(u.employment_type || "").trim() || "part_time"),
        total_shifts: totalShifts,
        total_hours: totalHours,
        hourly_wage_snapshot: breakdown.hourlyWageSnapshot ?? STANDARD_HOURLY_WAGE,
        base_salary_snapshot: breakdown.baseSalarySnapshot ?? 0,
        gross_salary: breakdown.grossSalary,
        total_deductions: breakdown.totalDeductions,
        net_salary: breakdown.netSalary,
        status: "DRAFT",
        tax_rate_pct: isFullTime ? 0 : TAX_RATE_PCT,
        tax_amount: breakdown.taxAmount,
        uniform_deduction: breakdown.uniformDeduction ?? UNIFORM_DEDUCTION,
        fuel_allowance: breakdown.fuelAllowance ?? FUEL_ALLOWANCE,
        scheduled_shifts: scheduledShifts,
        scheduled_hours: scheduledHours,
        full_schedule_gross_salary: breakdown.fullScheduleGrossSalary,
        full_schedule_net_salary: breakdown.fullScheduleNetSalary,
        _late_shifts: lateShifts,
        _missed_checkouts: missedCheckouts,
      } as Record<string, unknown>);
    }

    return results.map((r) => normalizeStaffPayrollRecord(r as Record<string, unknown>));
  },

  async getMyPayroll(userId: number, month: number, year: number) {
    const list = await this.calculateRealtimePayrolls([userId], null, month, year);
    return list[0] || null;
  },

  async getStorePayrolls(storeId: number, month: number, year: number) {
    const budget = await payrollRepo.getStorePayrollBudget(storeId, month, year);
    const userIds = await payrollRepo.getStoreUsers(storeId);

    if (userIds.length === 0) {
      const ptFundTarget = Number(budget?.pt_fund_target ?? 0);
      return {
        rows: [],
        summary: {
          store_id: storeId,
          store_name: budget?.store_name ?? null,
          revenue: Number(budget?.revenue ?? 0),
          current_month_revenue: Number(budget?.current_month_revenue ?? 0),
          revenue_source_month: Number(budget?.revenue_source_month ?? month),
          revenue_source_year: Number(budget?.revenue_source_year ?? year),
          pt_payroll_pct: Number(budget?.pt_payroll_pct ?? 10),
          pt_fund_target: ptFundTarget,
          pt_projected_gross: 0,
          pt_projected_full_schedule_gross: 0,
          pt_remaining_budget: ptFundTarget,
          pt_remaining_budget_if_full_schedule: ptFundTarget,
        },
      };
    }

    const results = await this.calculateRealtimePayrolls(userIds, storeId, month, year);
    const users = await payrollRepo.getUserConfigs(userIds);
    const userMap = new Map();
    for (const u of users) userMap.set(Number(u.id), u);

    const rows = results.map((r) => ({
      ...r,
      _user: userMap.get(r.user_id),
    }));

    const ptRows = rows.filter((r) => parseEmploymentTypeLoose(r.employment_type) === "part_time");
    const ptProjectedGross = ptRows.reduce((sum, r) => sum + Number(r.gross_salary || 0), 0);
    const ptProjectedFullScheduleGross = ptRows.reduce(
      (sum, r) => sum + Number((r as Record<string, unknown>).full_schedule_gross_salary || 0),
      0
    );
    const ptFundTarget = Number(budget?.pt_fund_target ?? 0);

    return {
      rows,
      summary: {
        store_id: storeId,
        store_name: budget?.store_name ?? null,
        revenue: Number(budget?.revenue ?? 0),
        current_month_revenue: Number(budget?.current_month_revenue ?? 0),
        revenue_source_month: Number(budget?.revenue_source_month ?? month),
        revenue_source_year: Number(budget?.revenue_source_year ?? year),
        pt_payroll_pct: Number(budget?.pt_payroll_pct ?? 10),
        pt_fund_target: ptFundTarget,
        pt_projected_gross: ptProjectedGross,
        pt_projected_full_schedule_gross: ptProjectedFullScheduleGross,
        pt_remaining_budget: ptFundTarget - ptProjectedGross,
        pt_remaining_budget_if_full_schedule: ptFundTarget - ptProjectedFullScheduleGross,
      },
    };
  },

  async finalizeStorePayroll(storeId: number, month: number, year: number) {
    const userIds = await payrollRepo.getStoreUsers(storeId);
    if (userIds.length === 0) return { success: true, count: 0 };

    const drafts = await this.calculateRealtimePayrolls(userIds, storeId, month, year);
    let count = 0;

    for (const record of drafts) {
      if (record.status === "DRAFT") {
        record.status = "FINALIZED";
        await payrollRepo.upsertPayrollRecord({
          ...record,
          store_id: storeId,
        });
        count++;
      }
    }

    return { success: true, count };
  },
};
