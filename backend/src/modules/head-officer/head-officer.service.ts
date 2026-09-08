import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { notifyTicketClosed } from "../notifications/notifications.service";
import * as notificationService from "../notifications/notifications.service";

/* --- helpers --- */
function getStoreFilter(storeIds: number[] | undefined) {
  if (!storeIds || storeIds.length === 0) return { clause: "", params: [] as number[] };
  const placeholders = storeIds.map((_, i) => `$${i + 1}`).join(",");
  return { clause: `WHERE s.id IN (${placeholders})`, params: storeIds };
}

function computePrevPeriod(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to   = new Date(`${dateTo}T00:00:00`);
  const durationMs = to.getTime() - from.getTime();
  const prevTo  = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { prevFrom: fmt(prevFrom), prevTo: fmt(prevTo) };
}

function parseScheduleRequestNote(note: unknown): Record<string, any> | null {
  if (typeof note !== "string" || !note.trim()) return null;
  try {
    const parsed = JSON.parse(note);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeScheduleRequestNote(value: Record<string, any> | null, fallback: unknown): string {
  if (value && typeof value === "object") return JSON.stringify(value);
  return typeof fallback === "string" ? fallback : "";
}

/* -----------------------------------------------
   1a. Bao cao doanh thu / chi phi / loi nhuan
   ----------------------------------------------- */
export async function getRevenueReport(storeIds?: number[], dateFrom?: string, dateTo?: string) {
  const storeFilter = getStoreFilter(storeIds);
  const allParams: any[] = [...storeFilter.params];
  // Build dynamic date conditions (shared param indices for orders, waste, payroll)
  const orderConds = ["status = 'completed'"];
  const wasteConds: string[] = [];
  const payrollConds: string[] = [];
  if (dateFrom) {
    allParams.push(dateFrom);
    const idx = allParams.length;
    orderConds.push(`completed_at >= $${idx}::date`);
    wasteConds.push(`wr.created_at >= $${idx}::date`);
    payrollConds.push(`aa.work_date >= $${idx}::date`);
  }
  if (dateTo) {
    allParams.push(dateTo);
    const idx = allParams.length;
    orderConds.push(`completed_at < ($${idx}::date + interval '1 day')`);
    wasteConds.push(`wr.created_at < ($${idx}::date + interval '1 day')`);
    payrollConds.push(`aa.work_date < ($${idx}::date + interval '1 day')`);
  }
  const orderWhere = `WHERE ${orderConds.join(' AND ')}`;
  const wasteWhere = wasteConds.length ? `WHERE ${wasteConds.join(' AND ')}` : '';
  const payrollWhere = payrollConds.length ? `WHERE ${payrollConds.join(' AND ')}` : '';

  // Pro-rate monthly fixed expense rules based on how many days of the month are in the query range.
  // Full month -> scale = 1.0; single day -> scale = 1/days_in_month; etc.
  let expenseScale = 1.0;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom + 'T00:00:00');
    const to   = new Date(dateTo   + 'T00:00:00');
    const daysInRange  = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const daysInMonth  = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    expenseScale = Math.min(daysInRange / daysInMonth, 1.0);
  }
  allParams.push(expenseScale);
  const scaleIdx = allParams.length;

  const q = `
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      COALESCE(rev.revenue, 0)::numeric             AS revenue,
      COALESCE(exp.operating_expense, 0)::numeric   AS operating_expense,
      COALESCE(exp.maintenance_expense, 0)::numeric AS maintenance_expense,
      COALESCE(exp.other_expense, 0)::numeric       AS other_expense,
      COALESCE(pay.payroll_cost, 0)::numeric        AS payroll_cost,
      COALESCE(wst.waste_expense, 0)::numeric       AS waste_expense,
      (
        COALESCE(exp.operating_expense, 0) +
        COALESCE(exp.maintenance_expense, 0) +
        COALESCE(exp.other_expense, 0) +
        COALESCE(pay.payroll_cost, 0) +
        COALESCE(wst.waste_expense, 0)
      )::numeric AS total_expense,
      (
        COALESCE(rev.revenue, 0) -
        COALESCE(exp.operating_expense, 0) -
        COALESCE(exp.maintenance_expense, 0) -
        COALESCE(exp.other_expense, 0) -
        COALESCE(pay.payroll_cost, 0) -
        COALESCE(wst.waste_expense, 0)
      )::numeric AS profit
    FROM stores s
    LEFT JOIN (
      -- Revenue from completed orders, filtered by the selected range
      SELECT store_id, SUM(final_amount)::numeric AS revenue
      FROM orders ${orderWhere}
      GROUP BY store_id
    ) rev ON rev.store_id = s.id
    LEFT JOIN (
      -- Monthly fixed expenses, pro-rated by days covered in the report
      SELECT
        ser.store_id,
        SUM(CASE WHEN ec.code ILIKE '%operating%' OR ec.name ILIKE '%tiêu hao%' OR ec.name ILIKE '%vận hành%'
                 THEN ROUND(ser.amount * $${scaleIdx}) ELSE 0 END)::numeric AS operating_expense,
        SUM(CASE WHEN ec.code ILIKE '%maintain%' OR ec.name ILIKE '%duy trì%'
                 THEN ROUND(ser.amount * $${scaleIdx}) ELSE 0 END)::numeric AS maintenance_expense,
        SUM(CASE WHEN (ec.code NOT ILIKE '%operating%' AND ec.code NOT ILIKE '%maintain%')
                  AND (ec.name NOT ILIKE '%tiêu hao%' AND ec.name NOT ILIKE '%vận hành%' AND ec.name NOT ILIKE '%duy trì%')
                  OR ec.id IS NULL
                 THEN ROUND(ser.amount * $${scaleIdx}) ELSE 0 END)::numeric AS other_expense
      FROM store_expense_rules ser
      LEFT JOIN expense_categories ec ON ec.id = ser.category_id
      GROUP BY ser.store_id
    ) exp ON exp.store_id = s.id
    LEFT JOIN (
      -- Chi phí nhân sự:
      --   PT = tổng (giờ thực tế trong kỳ × đơn giá/giờ)  — lọc theo work_date
      --   FT = lương tháng × expenseScale  — pro-rate theo số ngày được lọc
      SELECT COALESCE(pt.store_id, ft.store_id) AS store_id,
             COALESCE(pt.pt_payroll, 0) + COALESCE(ft.ft_payroll, 0) AS payroll_cost
      FROM (
        SELECT aa.store_id,
               COALESCE(SUM(aa.work_hours * u.hourly_wage), 0) AS pt_payroll
        FROM att_attendance aa
        JOIN users u ON u.id = aa.user_id AND u.employment_type = 'part_time'
        JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
        ${payrollWhere}
        GROUP BY aa.store_id
      ) pt
      FULL OUTER JOIN (
        SELECT us.store_id,
               COALESCE(ROUND(SUM(u.monthly_salary) * $${scaleIdx}), 0) AS ft_payroll
        FROM user_stores us
        JOIN users u ON u.id = us.user_id
          AND u.employment_type = 'full_time'
          AND u.is_active = TRUE
        JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
        GROUP BY us.store_id
      ) ft ON ft.store_id = pt.store_id
    ) pay ON pay.store_id = s.id
    LEFT JOIN (
      -- Waste cost from waste reports in the selected range
      SELECT store_id, SUM(waste_expense)::numeric AS waste_expense
      FROM (
        SELECT wr.store_id,
               COALESCE(SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0)), 0) AS waste_expense
        FROM waste_reports wr
        JOIN waste_items wi ON wi.waste_report_id = wr.id
        LEFT JOIN ingredients i ON i.id = wi.ingredient_id
        ${wasteWhere}
        GROUP BY wr.store_id
      ) combined_waste
      GROUP BY store_id
    ) wst ON wst.store_id = s.id
    ${storeFilter.clause}
    ORDER BY s.name
  `;
  const r = await pool.query(q, allParams);
  return r.rows;
}

/* -------------------------------------------------------
   1b. Phan tich doanh thu va goi y cai thien
   ------------------------------------------------------- */
export async function getRevenueAnalysis(storeIds?: number[], dateFrom?: string, dateTo?: string) {
  const rows = await getRevenueReport(storeIds, dateFrom, dateTo);

  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.revenue), 0);
  const totalExpense = rows.reduce((s: number, r: any) => s + Number(r.total_expense), 0);
  const totalProfit  = rows.reduce((s: number, r: any) => s + Number(r.profit), 0);
  const chainMargin  = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const storeAnalysis = rows.map((r: any) => {
    const revenue       = Number(r.revenue);
    const totalExp      = Number(r.total_expense);
    const profit        = Number(r.profit);
    const payroll       = Number(r.payroll_cost);
    const margin        = revenue > 0 ? (profit / revenue) * 100 : 0;
    const payrollRatio  = revenue > 0 ? (payroll / revenue) * 100 : 0;
    const expenseRatio  = revenue > 0 ? (totalExp / revenue) * 100 : 0;

    const warnings: string[] = [];
    const suggestions: string[] = [];
    const action_insights: { priority: "high" | "medium" | "low"; status_text: string; main_issue: string; root_cause: string; next_action: string }[] = [];

    if (revenue === 0) {
      warnings.push("Chưa có doanh thu ghi nhận — kiểm tra kết nối dữ liệu POS");
      action_insights.push({
        priority: "high",
        status_text: "Không có doanh thu",
        main_issue: "Chưa có doanh thu ghi nhận trong kỳ",
        root_cause: "Mất kết nối POS hoặc quán chưa hoạt động",
        next_action: "Liên hệ IT kiểm tra kết nối POS ngay",
      });
    } else {
      if (margin < 0) {
        warnings.push(`Lỗ ${(-margin).toFixed(1)}% — chi phí vượt doanh thu`);
        suggestions.push("Cần rà soát ngay các khoản chi phí và tăng doanh thu");
        action_insights.push({
          priority: "high",
          status_text: "Báo động lỗ",
          main_issue: `Lỗ ${(-margin).toFixed(1)}% — chi phí vượt doanh thu`,
          root_cause: "Tổng chi phí vận hành vượt mức doanh thu",
          next_action: "Yêu cầu SM báo cáo giải trình cơ cấu chi phí toàn diện",
        });
      } else if (margin < 20) {
        warnings.push(`Tỉ lệ lợi nhuận thấp (${margin.toFixed(1)}%) — dưới ngưỡng 20%`);
        suggestions.push("Xem xét tối ưu chi phí vận hành hoặc tăng giá bán sản phẩm");
        action_insights.push({
          priority: "medium",
          status_text: "Biên lợi nhuận thấp",
          main_issue: `Tỉ lệ lợi nhuận chỉ đạt ${margin.toFixed(1)}% — dưới ngưỡng 20%`,
          root_cause: "Cơ cấu chi phí chưa tối ưu so với doanh thu",
          next_action: "Xem xét tối ưu chi phí vận hành hoặc điều chỉnh giá bán",
        });
      }
      if (payrollRatio > 40) {
        warnings.push(`Chi phí nhân sự cao (${payrollRatio.toFixed(1)}% doanh thu)`);
        suggestions.push("Xem xét điều chỉnh lịch làm việc hoặc tối ưu số lượng nhân viên");
        action_insights.push({
          priority: "medium",
          status_text: "Chi phí nhân sự cao",
          main_issue: `Chi phí nhân sự chiếm ${payrollRatio.toFixed(1)}% doanh thu`,
          root_cause: "Bố trí thừa nhân sự ca Part-time",
          next_action: "Yêu cầu SM cắt giảm ca Part-time không hiệu quả",
        });
      }
      if (expenseRatio > 70) {
        warnings.push(`Tổng chi phí chiếm ${expenseRatio.toFixed(1)}% doanh thu — rủi ro cao`);
        suggestions.push("Ưu tiên giảm chi phí duy trì và chi phí tiêu hao");
        action_insights.push({
          priority: "high",
          status_text: "Rủi ro chi phí",
          main_issue: `Tổng chi phí chiếm ${expenseRatio.toFixed(1)}% doanh thu`,
          root_cause: "Chi phí duy trì và tiêu hao vượt ngưỡng an toàn",
          next_action: "Ưu tiên cắt giảm chi phí duy trì và tiêu hao ngay",
        });
      }
      const wasteRatio = revenue > 0 ? (Number(r.waste_expense) / revenue) * 100 : 0;
      if (wasteRatio > 5) {
        action_insights.push({
          priority: "medium",
          status_text: "Hủy hàng cao",
          main_issue: `Tỉ lệ hủy hàng ${wasteRatio.toFixed(1)}% — vượt ngưỡng 5%`,
          root_cause: "Quản lý tồn kho hoặc dự báo đơn hàng chưa chính xác",
          next_action: "Yêu cầu SM rà soát quy trình nhập hàng và dự báo nhu cầu",
        });
      }
    }

    if (warnings.length === 0 && margin >= 20) {
      suggestions.push("Quán đang hoạt động hiệu quả - nên duy trì và nhân rộng mô hình.");
    }
    if (action_insights.length === 0 && margin >= 20) {
      action_insights.push({
        priority: "low",
        status_text: "Hoạt động hiệu quả",
        main_issue: "Không phát hiện vấn đề — quán đang vận hành tốt",
        root_cause: "—",
        next_action: "Duy trì mô hình hiện tại và xem xét nhân rộng",
      });
    }

    return {
      store_id:      r.store_id,
      store_name:    r.store_name,
      margin_pct:    parseFloat(margin.toFixed(2)),
      payroll_ratio: parseFloat(payrollRatio.toFixed(2)),
      expense_ratio: parseFloat(expenseRatio.toFixed(2)),
      warnings,
      suggestions,
      action_insights,
    };
  });

  // Sort by profit
  const sorted = [...rows].sort((a: any, b: any) => Number(b.profit) - Number(a.profit));
  const bestStore  = sorted[0]  ? { store_id: sorted[0].store_id,  store_name: sorted[0].store_name,  profit: Number(sorted[0].profit)  } : null;
  const worstStore = sorted[sorted.length - 1] ? { store_id: sorted[sorted.length - 1].store_id, store_name: sorted[sorted.length - 1].store_name, profit: Number(sorted[sorted.length - 1].profit) } : null;

  return {
    chain: {
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      total_profit:  totalProfit,
      chain_margin_pct: parseFloat(chainMargin.toFixed(2)),
      store_count: rows.length,
      best_store:  bestStore,
      worst_store: worstStore,
    },
    stores: storeAnalysis,
  };
}

/* -------------------------------------------------------
   2. Bao cao huy hang
   ------------------------------------------------------- */
export async function getWasteReport(storeIds?: number[], dateFrom?: string, dateTo?: string) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];
  const wasteDateConds: string[] = [];
  if (dateFrom) {
    allParams.push(dateFrom);
    wasteDateConds.push(`wr.created_at >= $${allParams.length}::date`);
  }
  if (dateTo) {
    allParams.push(dateTo);
    wasteDateConds.push(`wr.created_at < ($${allParams.length}::date + interval '1 day')`);
  }
  const wasteDateWhere = wasteDateConds.length ? `AND ${wasteDateConds.join(' AND ')}` : '';
  const q = `
    SELECT s.id AS store_id, s.name AS store_name,
           COALESCE(waste.waste_count, 0)::int AS waste_count,
           COALESCE(waste.waste_cost, 0)::numeric AS waste_cost,
           ROUND(
             CASE WHEN COALESCE(stock.total_stock, 0) = 0 THEN 0
                  ELSE COALESCE(waste.waste_qty, 0) * 100.0 / NULLIF(stock.total_stock, 0)
             END, 2
           ) AS waste_rate_pct
    FROM stores s
    LEFT JOIN (
      SELECT store_id, 
             SUM(waste_count)::int AS waste_count,
             SUM(waste_qty) AS waste_qty,
             SUM(waste_cost) AS waste_cost
      FROM (
        SELECT wr.store_id,
               COUNT(wi.id) AS waste_count,
               SUM(wi.quantity) AS waste_qty,
               SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0)) AS waste_cost
        FROM waste_reports wr
        JOIN waste_items wi ON wi.waste_report_id = wr.id
        LEFT JOIN ingredients i ON i.id = wi.ingredient_id
        WHERE 1=1 ${wasteDateWhere}
        GROUP BY wr.store_id
      ) combined
      GROUP BY store_id
    ) waste ON waste.store_id = s.id
    LEFT JOIN (
      SELECT store_id, SUM(quantity) AS total_stock
      FROM stock_levels
      GROUP BY store_id
    ) stock ON stock.store_id = s.id
    ${clause}
    ORDER BY s.name
  `;
  const r = await pool.query(q, allParams);
  return r.rows;
}

/* -------------------------------------------------------
   3. Bao cao quy luong / nhan su
   ------------------------------------------------------- */
export async function getPayrollReport(storeIds?: number[], dateFrom?: string, dateTo?: string) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];
  const dateConds: string[] = [];
  if (dateFrom) {
    allParams.push(dateFrom);
    dateConds.push(`aa.work_date >= $${allParams.length}::date`);
  }
  if (dateTo) {
    allParams.push(dateTo);
    dateConds.push(`aa.work_date < ($${allParams.length}::date + interval '1 day')`);
  }
  const attWhere = dateConds.length ? `WHERE ${dateConds.join(' AND ')}` : '';
  // Nhân sự tại quán: staff, shift_leader, store_manager
  // Lương PT = work_hours × hourly_wage; Lương FT = monthly_salary cố định
  const q = `
    SELECT s.id AS store_id, s.name AS store_name,
           COALESCE(staff.staff_count, 0)::int AS staff_count,
           COALESCE(att.actual_payroll, 0)::numeric AS actual_payroll
    FROM stores s
    LEFT JOIN (
      SELECT us.store_id, COUNT(DISTINCT us.user_id) AS staff_count
      FROM user_stores us
      JOIN users u ON u.id = us.user_id AND u.is_active = TRUE
      JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
      GROUP BY us.store_id
    ) staff ON staff.store_id = s.id
    LEFT JOIN (
      SELECT COALESCE(pt.store_id, ft.store_id) AS store_id,
             COALESCE(pt.pt_payroll, 0) + COALESCE(ft.ft_payroll, 0) AS actual_payroll
      FROM (
        SELECT aa.store_id,
               COALESCE(SUM(aa.work_hours * u.hourly_wage), 0) AS pt_payroll
        FROM att_attendance aa
        JOIN users u ON u.id = aa.user_id AND u.employment_type = 'part_time'
        JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
        ${attWhere}
        GROUP BY aa.store_id
      ) pt
      FULL OUTER JOIN (
        SELECT us.store_id,
               COALESCE(SUM(u.monthly_salary), 0) AS ft_payroll
        FROM user_stores us
        JOIN users u ON u.id = us.user_id
          AND u.employment_type = 'full_time'
          AND u.is_active = TRUE
        JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
        GROUP BY us.store_id
      ) ft ON ft.store_id = pt.store_id
    ) att ON att.store_id = s.id
    ${clause}
    ORDER BY s.name
  `;
  const r = await pool.query(q, allParams);
  return r.rows;
}

/* -------------------------------------------------------
   4. Schedule requests
      request_type: leave | shift_swap | overtime | profile_update | ...
      status enum: pending | approved | rejected | cancelled
   ------------------------------------------------------- */
export async function getStaffRequests(storeIds?: number[], options?: { includeStaffUpdate?: boolean }) {
  const { clause, params } = getStoreFilter(storeIds);
  const requestTypes = options?.includeStaffUpdate
    ? "('hire','fire','staff_update')"
    : "('hire','fire')";
  const q = `
    SELECT
      sr.id, sr.store_id, s.name AS store_name,
      sr.user_id, u.full_name AS requester_name, u.phone AS requester_phone,
      u.employment_type,
      sr.request_date, sr.request_type, sr.note,
      sr.status, sr.approved_at,
      sh.name AS shift_name,
      sh.start_time::text AS shift_start, sh.end_time::text AS shift_end,
      ab.full_name AS approved_by_name,
      sr.created_at
    FROM schedule_requests sr
    JOIN users u ON u.id = sr.user_id
    JOIN stores s ON s.id = sr.store_id
    LEFT JOIN shifts sh ON sh.id = sr.shift_id
    LEFT JOIN users ab ON ab.id = sr.approved_by
    ${clause ? `${clause} AND sr.request_type IN ${requestTypes}` : `WHERE sr.request_type IN ${requestTypes}`}
    ORDER BY sr.created_at DESC
  `;
  const r = await pool.query(q, params);
  return r.rows.map((row: any) => {
    const request_type = String(row.request_type ?? "").toLowerCase();
    const status = String(row.status ?? "").toLowerCase();
    const noteObj = parseScheduleRequestNote(row.note);
    const processed = noteObj?.processed ?? {};
    const hirePayload = noteObj?.hirePayload ?? noteObj?.payload ?? null;
    const target = noteObj?.target ?? null;
    const staffSnapshot = noteObj?.staffSnapshot ?? null;
    const systemExperience = noteObj?.systemExperience ?? null;
    const managerExperienceNote = noteObj?.managerExperienceNote ?? null;

    const position =
      noteObj?.position ??
      hirePayload?.fullName ??
      target?.staffName ??
      row.shift_name ??
      "";

    const reason =
      noteObj?.reason ??
      (typeof row.note === "string" ? row.note : "") ??
      "";

    const requested_by = noteObj?.requested_by ?? row.requester_name ?? "";

    return {
      ...row,
      request_type,
      status,
      position,
      reason,
      requested_by,
      target: target && typeof target === "object" ? target : null,
      staff_snapshot: staffSnapshot && typeof staffSnapshot === "object" ? staffSnapshot : null,
      system_experience: systemExperience && typeof systemExperience === "object" ? systemExperience : null,
      manager_experience_note:
        typeof managerExperienceNote === "string" && managerExperienceNote.trim()
          ? managerExperienceNote.trim()
          : null,
      reject_reason: processed?.rejectReason ?? null,
      processed_account:
        processed?.account && typeof processed.account === "object" ? processed.account : null,
    };
  });
}
export async function approveStaffRequest(
  requestId: number,
  approvedBy: number,
  actorReqUser?: any,
  options?: { allowStaffUpdate?: boolean }
) {
  const rowRes = await pool.query(
    `SELECT id, store_id, user_id, request_type, note
     FROM schedule_requests
     WHERE id = $1`,
    [requestId]
  );
  if (rowRes.rows.length === 0) throw new ApiError(404, "Request không tồn tại");

  const row = rowRes.rows[0];
  const requestType = String(row.request_type ?? "").toLowerCase();
  if (requestType === "staff_update" && !options?.allowStaffUpdate) {
    throw new ApiError(403, "Yêu cầu cập nhật nhân sự chỉ được duyệt bởi HR");
  }
  const noteObj = parseScheduleRequestNote(row.note) ?? {};
  let account: { username?: string; tempPassword?: string; employeeId?: number } | null = null;
  let processedEmployeeId: number | null = null;

  if ((requestType === "hire" || requestType === "fire" || requestType === "staff_update") && actorReqUser) {
    console.log("[head-officer][approveStaffRequest] applying", {
      requestId,
      requestType,
      storeId: row.store_id,
      hasNoteJson: !!noteObj,
    });

    if (requestType === "hire") {
      const hirePayload = noteObj?.hirePayload ?? noteObj?.payload ?? null;
      if (!hirePayload) throw new ApiError(400, "Thiếu dữ liệu tuyển dụng trong note");

      const storeManagerStaffService = await import("../store-manager-staff/storeManagerStaff.service");
      const created = await storeManagerStaffService.createStoreManagerStaff({
        reqUser: actorReqUser,
        storeId: row.store_id,
        payload: {
          fullName: hirePayload.fullName,
          email: hirePayload.email,
          phone: hirePayload.phone,
          role: hirePayload.role,
          hireDate: hirePayload.hireDate,
          employmentType: hirePayload.employmentType,
          avatarUrl: hirePayload.avatarUrl ?? null,
          dateOfBirth: hirePayload.dateOfBirth,
          address: hirePayload.address ?? null,
          idCardNumber: hirePayload.idCardNumber,
          emergencyContactName: hirePayload.emergencyContactName,
          emergencyContactPhone: hirePayload.emergencyContactPhone,
        },
      });
      account = {
        username: created.username,
        tempPassword: created.tempPassword,
        employeeId: created.employeeId,
      };
      processedEmployeeId = Number(created.employeeId);
    }

    if (requestType === "fire") {
      const target = noteObj?.target ?? {};
      const staffId = Number(target.staffId);
      const reason = String(noteObj?.reason ?? "");
      if (!Number.isFinite(staffId) || staffId <= 0) throw new ApiError(400, "Thiếu staffId trong note sa thải");
      processedEmployeeId = staffId;

      const storeManagerStaffService = await import("../store-manager-staff/storeManagerStaff.service");
      await storeManagerStaffService.terminateStoreManagerStaff({
        reqUser: actorReqUser,
        storeId: row.store_id,
        staffId,
        payload: { reason: reason || undefined },
      });
    }

    if (requestType === "staff_update") {
      const target = noteObj?.target ?? {};
      const staffId = Number(target.staffId);
      if (!Number.isFinite(staffId) || staffId <= 0) {
        throw new ApiError(400, "Thiếu staffId trong note cập nhật nhân sự");
      }
      processedEmployeeId = staffId;

      const storeManagerStaffService = await import("../store-manager-staff/storeManagerStaff.service");
      await storeManagerStaffService.applyApprovedStaffUpdateRequest({
        reqUser: actorReqUser,
        storeId: row.store_id,
        staffId,
        payload: {
          targetRole: target.targetRole ?? null,
          targetEmploymentType: target.targetEmploymentType ?? null,
        },
      });
    }
  }

  const mergedNote = {
    ...noteObj,
    processed: {
      ...(noteObj?.processed ?? {}),
      status: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
      rejectReason: null,
      account,
    },
  };

  const r = await pool.query(
    `UPDATE schedule_requests
     SET status = 'approved', approved_by = $1, approved_at = NOW(), note = $3
     WHERE id = $2 RETURNING *`,
    [approvedBy, requestId, serializeScheduleRequestNote(mergedNote, row.note)]
  );
  if (r.rows.length === 0) throw new ApiError(404, "Request không tồn tại");

  try {
    await notificationService.notifyStaffRequestProcessed({
      managerId: Number(row.user_id),
      requestId,
      requestType:
        requestType === "fire"
          ? "fire"
          : requestType === "staff_update"
            ? "staff_update"
            : "hire",
      status: "approved",
      storeId: Number(row.store_id),
      rejectReason: null,
      username: account?.username ?? null,
      tempPassword: account?.tempPassword ?? null,
      employeeId: account?.employeeId ?? null,
    });
  } catch (e) {
    console.warn("[approveStaffRequest] notification error (non-fatal):", e);
  }

  return {
    ...r.rows[0],
    processed_account: account,
  };
}
export async function rejectStaffRequest(
  requestId: number,
  approvedBy: number,
  reason?: string,
  _actorReqUser?: any,
  options?: { allowStaffUpdate?: boolean }
) {
  const rowRes = await pool.query(
    `SELECT id, store_id, user_id, request_type, note
     FROM schedule_requests
     WHERE id = $1`,
    [requestId]
  );
  if (rowRes.rows.length === 0) throw new ApiError(404, "Request không tồn tại");

  const row = rowRes.rows[0];
  const requestType = String(row.request_type ?? "").toLowerCase();
  if (requestType === "staff_update" && !options?.allowStaffUpdate) {
    throw new ApiError(403, "Yêu cầu cập nhật nhân sự chỉ được xử lý bởi HR");
  }
  const noteObj = parseScheduleRequestNote(row.note) ?? {};
  const target = noteObj?.target ?? {};
  const notificationEmployeeId =
    requestType === "fire" || requestType === "staff_update"
      ? (() => {
          const staffId = Number(target.staffId);
          return Number.isFinite(staffId) && staffId > 0 ? staffId : null;
        })()
      : null;
  const mergedNote = {
    ...noteObj,
    processed: {
      ...(noteObj?.processed ?? {}),
      status: "rejected",
      approvedBy,
      approvedAt: new Date().toISOString(),
      rejectReason: reason ?? null,
      account: null,
    },
  };

  const r = await pool.query(
    `UPDATE schedule_requests
     SET status = 'rejected', approved_by = $1, approved_at = NOW(), note = $3
     WHERE id = $2 RETURNING *`,
    [approvedBy, requestId, serializeScheduleRequestNote(mergedNote, row.note)]
  );
  if (r.rows.length === 0) throw new ApiError(404, "Request không tồn tại");

  try {
    await notificationService.notifyStaffRequestProcessed({
      managerId: Number(row.user_id),
      requestId,
      requestType:
        requestType === "fire"
          ? "fire"
          : requestType === "staff_update"
            ? "staff_update"
            : "hire",
      status: "rejected",
      storeId: Number(row.store_id),
      rejectReason: reason ?? null,
    });
  } catch (e) {
    console.warn("[rejectStaffRequest] notification error (non-fatal):", e);
  }

  return {
    ...r.rows[0],
    reject_reason: reason ?? null,
  };
}
/* -------------------------------------------------------
   5. Customer tickets
      Bang: customer_tickets (id, store_id, customer_id,
             channel, subject, content, status, created_at, closed_at)
   ═══════════════════════════════════════════════════════ */
export async function getComplaints(storeIds?: number[], dateFrom?: string, dateTo?: string) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];

  const whereParts: string[] = [];
  if (clause) {
    whereParts.push(clause.replace(/^WHERE\s+/i, ""));
  }
  if (dateFrom) {
    allParams.push(dateFrom);
    whereParts.push(`ct.created_at >= $${allParams.length}::date`);
  }
  if (dateTo) {
    allParams.push(dateTo);
    whereParts.push(`ct.created_at < ($${allParams.length}::date + interval '1 day')`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const q = `
    SELECT ct.id, ct.store_id, s.name AS store_name,
           COALESCE(c.full_name, 'Khách vãng lai') AS customer_name,
           COALESCE(c.phone, '') AS customer_phone,
           ct.subject, ct.content AS description,
           ct.status, ct.priority, ct.channel,
           ct.feedback_type, ct.incident_time,
           ct.assigned_to, ct.assigned_at,
           u.full_name AS assigned_to_name,
           ct.internal_note, ct.customer_reply,
           ct.created_at, ct.closed_at AS resolved_at
    FROM customer_tickets ct
    JOIN stores s ON s.id = ct.store_id
    LEFT JOIN customers c ON c.id = ct.customer_id
    LEFT JOIN users u ON u.id = ct.assigned_to
    ${whereClause}
    ORDER BY ct.created_at DESC
  `;
  const r = await pool.query(q, allParams);
  return r.rows;
}

/* ─── Marketing: cập nhật priority / customer_reply / assign ─── */
export async function updateComplaintForMarketing(
  ticketId: number,
  data: { priority?: string; customer_reply?: string; assigned_to?: number },
  actorId: number,
  allowedStoreIds?: number[],
) {
  const check = await pool.query(
    `SELECT id, store_id, status FROM customer_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");
  const ticket = check.rows[0];
  if (ticket.status === "closed") throw new ApiError(400, "Ticket đã đóng, không thể chỉnh sửa");
  if (allowedStoreIds?.length && !allowedStoreIds.includes(ticket.store_id))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");

  const setClauses: string[] = [];
  const values: any[] = [];

  if (data.priority !== undefined) {
    values.push(data.priority);
    setClauses.push(`priority = $${values.length}`);
  }
  if (data.customer_reply !== undefined) {
    values.push(data.customer_reply);
    setClauses.push(`customer_reply = $${values.length}`);
  }
  if (data.assigned_to !== undefined) {
    values.push(data.assigned_to);
    setClauses.push(`assigned_to = $${values.length}`);
    values.push(actorId);
    setClauses.push(`assigned_by = $${values.length}`);
    setClauses.push(`assigned_at = NOW()`);
    setClauses.push(`status = 'in_progress'`);
  }

  if (setClauses.length === 0) return ticket;

  values.push(ticketId);
  const r = await pool.query(
    `UPDATE customer_tickets SET ${setClauses.join(", ")} WHERE id = $${values.length}
     RETURNING id, status, priority, customer_reply, assigned_to, assigned_at`,
    values,
  );

  if (data.priority !== undefined) {
    await pool.query(
      `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description) VALUES ($1, $2, 'priority_changed', $3)`,
      [ticketId, actorId, `Đổi ưu tiên thành ${data.priority}`],
    );
  }

  return r.rows[0];
}

/* ─── Store Manager: giải trình → resolved ─── */
export async function resolveComplaintBySM(
  ticketId: number,
  internalNote: string,
  smUserId: number,
) {
  const check = await pool.query(
    `SELECT id, status, assigned_to FROM customer_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");
  const ticket = check.rows[0];
  if (Number(ticket.assigned_to) !== smUserId)
    throw new ApiError(403, "Ticket này không được giao cho bạn");
  if (ticket.status === "closed") throw new ApiError(400, "Ticket đã đóng");

  const r = await pool.query(
    `UPDATE customer_tickets
     SET internal_note = $1, status = 'resolved'
     WHERE id = $2
     RETURNING id, status, internal_note`,
    [internalNote, ticketId],
  );
  return r.rows[0];
}

/* ─── Marketing: đóng ticket ─── */
export async function closeComplaintByMarketing(
  ticketId: number,
  actorId: number,
  resolutionReason?: string,
  internalNote?: string,
  allowedStoreIds?: number[],
) {
  const check = await pool.query(
    `SELECT id, store_id, status FROM customer_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");
  const ticket = check.rows[0];
  if (ticket.status === "closed") throw new ApiError(400, "Ticket đã đóng rồi");
  if (allowedStoreIds?.length && !allowedStoreIds.includes(ticket.store_id))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");

  const REASON_LABELS: Record<string, string> = {
    refunded:       "Đã hoàn tiền/Đền bù",
    explained:      "Đã giải thích cho khách",
    no_response:    "Khách không phản hồi",
    spam:           "Ticket rác/Spam",
  };
  const reasonLabel = REASON_LABELS[resolutionReason ?? ""] ?? resolutionReason ?? "Không rõ";

  const r = await pool.query(
    `UPDATE customer_tickets
     SET status = 'closed', closed_at = NOW()
     WHERE id = $1
     RETURNING id, status, closed_at`,
    [ticketId],
  );

  // Ghi chú nội bộ (nếu có) — append vào ticket_logs description
  const logDesc = [
    `Ticket đã được đóng bởi Marketing. Lý do: ${reasonLabel}`,
    internalNote ? `Ghi chú: ${internalNote}` : null,
  ].filter(Boolean).join(" — ");

  await pool.query(
    `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description)
     VALUES ($1, $2, 'closed', $3)`,
    [ticketId, actorId, logDesc],
  );

  // Chèn system message vào chat — dùng sender_type='staff', sender_id=NULL
  // để tương thích với CHECK constraint DB (chỉ có 'staff' | 'customer')
  const systemMsg = `Phiếu hỗ trợ đã được đóng với lý do: ${reasonLabel}. Cảm ơn bạn đã phản hồi.`;
  await pool.query(
    `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, is_internal)
     VALUES ($1, 'staff', NULL, $2, FALSE)`,
    [ticketId, systemMsg],
  );

  return r.rows[0];
}

/* ─── Marketing: chi tiết ticket (messages + timeline) ─── */
export async function getComplaintDetail(ticketId: number) {
  const ticketR = await pool.query(
    `SELECT ct.id, ct.store_id, s.name AS store_name,
            COALESCE(c.full_name, 'Khách vãng lai') AS customer_name,
            COALESCE(c.phone, '') AS customer_phone,
            COALESCE(c.email, '') AS customer_email,
            ct.subject, ct.content AS description,
            ct.status, ct.priority, ct.channel,
            ct.feedback_type, ct.incident_time,
            ct.assigned_to, ct.assigned_at, ct.assign_intent,
            u.full_name AS assigned_to_name,
            ct.internal_note, ct.customer_reply,
            ct.attachment_url,
            ct.created_at, ct.closed_at AS resolved_at
     FROM customer_tickets ct
     JOIN stores s ON s.id = ct.store_id
     LEFT JOIN customers c ON c.id = ct.customer_id
     LEFT JOIN users u ON u.id = ct.assigned_to
     WHERE ct.id = $1`,
    [ticketId],
  );
  if (!ticketR.rows.length) throw new ApiError(404, "Ticket không tồn tại");

  const messagesR = await pool.query(
    `SELECT tm.id, tm.sender_type, tm.sender_id, tm.message, tm.is_internal, tm.created_at,
            COALESCE(
              u.full_name,
              c.full_name,
              CASE WHEN tm.sender_id IS NULL THEN 'Hệ thống' ELSE 'Ẩn danh' END
            ) AS sender_name
     FROM ticket_messages tm
     LEFT JOIN users u ON tm.sender_type = 'staff' AND u.id = tm.sender_id
     LEFT JOIN customers c ON tm.sender_type = 'customer' AND c.id = tm.sender_id
     WHERE tm.ticket_id = $1
     ORDER BY tm.created_at ASC`,
    [ticketId],
  );

  const logsR = await pool.query(
    `SELECT tl.id, tl.actor_id, tl.action_type, tl.description, tl.created_at,
            COALESCE(u.full_name, 'Hệ thống') AS actor_name
     FROM ticket_logs tl
     LEFT JOIN users u ON u.id = tl.actor_id
     WHERE tl.ticket_id = $1
     ORDER BY tl.created_at ASC`,
    [ticketId],
  );

  return {
    ...ticketR.rows[0],
    messages: messagesR.rows,
    timeline: logsR.rows,
  };
}

/* ─── Marketing: giao ticket cho SM (có intent + log) ─── */
export async function assignComplaintByMarketing(
  ticketId: number,
  smUserId: number,
  actorId: number,
  assignIntent?: string,
  note?: string,
) {
  const check = await pool.query(
    `SELECT id, store_id, status FROM customer_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");
  const ticket = check.rows[0];
  if (ticket.status === "closed") throw new ApiError(400, "Ticket đã đóng, không thể assign");

  const r = await pool.query(
    `UPDATE customer_tickets
     SET assigned_to = $1, assigned_by = $2, assigned_at = NOW(),
         assign_intent = $3, status = 'in_progress'
     WHERE id = $4
     RETURNING id, status, assigned_to, assigned_at, assign_intent`,
    [smUserId, actorId, assignIntent || null, ticketId],
  );

  const smR = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [smUserId]);
  const smName = smR.rows[0]?.full_name || "SM";

  const intentLabels: Record<string, string> = {
    investigate: "Điều tra",
    resolve: "Giải quyết",
    follow_up: "Theo dõi",
    escalate: "Báo cáo cấp trên",
  };
  const intentLabel = assignIntent ? intentLabels[assignIntent] || assignIntent : "";
  const logDesc = `Giao cho ${smName}${intentLabel ? ` — ${intentLabel}` : ""}${note ? `: ${note}` : ""}`;

  await pool.query(
    `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description) VALUES ($1, $2, 'assigned', $3)`,
    [ticketId, actorId, logDesc],
  );

  if (note) {
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, is_internal) VALUES ($1, 'staff', $2, $3, TRUE)`,
      [ticketId, actorId, note],
    );
  }

  return { ...r.rows[0], assigned_to_name: smName };
}

/* ─── TASK 3: Hàm thuần xác định trạng thái chờ dựa trên tin nhắn cuối cùng ─── */
/*
 * Logic: Không cần thêm cột `waiting_for` vào database.
 * Kiểm tra record mới nhất trong ticket_messages:
 *   - Nếu sender_type cuối = 'staff'  → đang chờ khách hàng phản hồi
 *   - Nếu sender_type cuối = 'customer' → đang chờ CSKH rep
 *   - Nếu chưa có tin nhắn nào          → chờ CSKH mở đầu
 */
export function getWaitingFor(
  messages: Array<{ sender_type: string; is_internal: boolean }>,
): "customer" | "staff" | "none" {
  // Chỉ xét tin nhắn không phải internal (tin nội bộ không ảnh hưởng SLA)
  const publicMsgs = messages.filter((m) => !m.is_internal);
  if (publicMsgs.length === 0) return "staff"; // chưa có tin → đang chờ CSKH mở đầu
  const lastSender = publicMsgs[publicMsgs.length - 1].sender_type;
  return lastSender === "staff" ? "customer" : "staff";
}

/* ─── Marketing/CSKH: gửi tin nhắn Chat (đa chiều, nhiều lần) ─── */
/*
 * Logic thay thế mô hình Email cũ:
 *   - Bỏ one-reply guard (cho phép chat nhiều lần)
 *   - Tin nhắn đầu tiên từ CSKH (non-internal) → tự động chuyển ticket sang in_progress
 *     và MỞ KHÓA chat hai chiều cho khách hàng
 */
export async function replyToTicket(
  ticketId: number,
  actorId: number,
  message: string,
  isInternal: boolean,
) {
  const check = await pool.query(
    `SELECT ct.id, ct.status, ct.customer_id, COALESCE(c.email, '') AS customer_email
     FROM customer_tickets ct
     LEFT JOIN customers c ON c.id = ct.customer_id
     WHERE ct.id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");

  const ticket = check.rows[0];
  if (ticket.status === "closed" || ticket.status === "resolved")
    throw new ApiError(400, "Ticket đã đóng, không thể gửi thêm tin nhắn");

  // Nếu là tin CSKH đầu tiên (non-internal) và ticket đang 'open'
  // → tự động chuyển sang 'in_progress' để unlock chat hai chiều
  let autoActivated = false;
  if (!isInternal && ticket.status === "open") {
    const firstStaffMsg = await pool.query(
      `SELECT id FROM ticket_messages WHERE ticket_id = $1 AND sender_type = 'staff' AND is_internal = false LIMIT 1`,
      [ticketId],
    );
    if (firstStaffMsg.rows.length === 0) {
      // Đây là tin nhắn CSKH đầu tiên → kích hoạt in_progress
      await pool.query(
        `UPDATE customer_tickets SET status = 'in_progress' WHERE id = $1`,
        [ticketId],
      );
      await pool.query(
        `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description) VALUES ($1, $2, 'status_changed', 'Ticket chuyển sang Đang xử lý — CSKH đã tiếp nhận')`,
        [ticketId, actorId],
      );
      autoActivated = true;
    }
  }

  const r = await pool.query(
    `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, is_internal)
     VALUES ($1, 'staff', $2, $3, $4)
     RETURNING id, ticket_id, sender_type, sender_id, message, is_internal, created_at`,
    [ticketId, actorId, message, isInternal],
  );

  const actionType = isInternal ? "note_added" : "replied";
  const logDesc = isInternal ? "Thêm ghi chú nội bộ" : "CSKH gửi tin nhắn chat cho khách hàng";
  await pool.query(
    `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description) VALUES ($1, $2, $3, $4)`,
    [ticketId, actorId, actionType, logDesc],
  );

  const userR = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [actorId]);
  return {
    ...r.rows[0],
    sender_name: userR.rows[0]?.full_name || "CSKH",
    auto_activated: autoActivated,
  };
}

/* ─── TASK 1: Khách hàng gửi tin nhắn chat (chỉ khi ticket đang in_progress) ─── */
/*
 * Ràng buộc:
 *   - Ticket phải ở trạng thái 'in_progress' (CSKH đã tiếp nhận)
 *   - Customer phải là chủ sở hữu ticket
 *   - Ticket 'open': hiện thông báo chờ, không cho nhắn
 *   - Ticket 'closed'/'resolved': chỉ xem lịch sử
 */
export async function customerReplyToTicket(
  ticketId: number,
  customerId: number,
  message: string,
) {
  const check = await pool.query(
    `SELECT id, status, customer_id FROM customer_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!check.rows.length) throw new ApiError(404, "Ticket không tồn tại");

  const ticket = check.rows[0];
  if (Number(ticket.customer_id) !== customerId)
    throw new ApiError(403, "Bạn không có quyền truy cập ticket này");
  if (ticket.status === "open")
    throw new ApiError(400, "CSKH chưa tiếp nhận phiếu, vui lòng chờ xác nhận");
  if (ticket.status === "closed" || ticket.status === "resolved")
    throw new ApiError(400, "Phiếu hỗ trợ đã đóng, không thể gửi thêm tin nhắn");

  const r = await pool.query(
    `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, is_internal)
     VALUES ($1, 'customer', $2, $3, false)
     RETURNING id, ticket_id, sender_type, sender_id, message, is_internal, created_at`,
    [ticketId, customerId, message],
  );

  await pool.query(
    `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description) VALUES ($1, $2, 'customer_replied', 'Khách hàng gửi tin nhắn')`,
    [ticketId, customerId],
  );

  const custR = await pool.query(`SELECT full_name FROM customers WHERE id = $1`, [customerId]);
  return { ...r.rows[0], sender_name: custR.rows[0]?.full_name || "Khách hàng" };
}

/* ─── TASK 1: Khách hàng xem chi tiết ticket + lịch sử chat ─── */
export async function getCustomerTicketDetail(ticketId: number, customerId: number) {
  const ticketR = await pool.query(
    `SELECT ct.id, ct.store_id, s.name AS store_name,
            ct.subject, ct.content AS description,
            ct.status, ct.priority, ct.channel,
            ct.feedback_type, ct.incident_time,
            ct.attachment_url,
            ct.created_at, ct.closed_at AS resolved_at
     FROM customer_tickets ct
     JOIN stores s ON s.id = ct.store_id
     WHERE ct.id = $1 AND ct.customer_id = $2`,
    [ticketId, customerId],
  );
  if (!ticketR.rows.length) throw new ApiError(404, "Ticket không tồn tại hoặc không thuộc về bạn");

  // Chỉ trả về tin nhắn public (is_internal = false) cho khách hàng
  const messagesR = await pool.query(
    `SELECT tm.id, tm.sender_type, tm.message, tm.created_at,
            CASE
              WHEN tm.sender_type = 'customer' THEN COALESCE(c.full_name, 'Bạn')
              WHEN tm.sender_type = 'system'   THEN 'Hệ thống'
              ELSE 'CSKH kōhī coffee'
            END AS sender_name
     FROM ticket_messages tm
     LEFT JOIN customers c ON tm.sender_type = 'customer' AND c.id = tm.sender_id
     WHERE tm.ticket_id = $1 AND tm.is_internal = false
     ORDER BY tm.created_at ASC`,
    [ticketId],
  );

  const messages = messagesR.rows;
  const waitingFor = getWaitingFor(messages);

  return {
    ...ticketR.rows[0],
    messages,
    waiting_for: waitingFor,
  };
}

/* ─── TASK 4: Cronjob tự động đóng ticket stale (không phản hồi sau 24h) ─── */
/*
 * Logic tự động đóng dựa trên nguyên tắc:
 *   1. Ticket phải đang ở trạng thái 'in_progress' (đã có CSKH tiếp nhận)
 *   2. Tin nhắn PUBLIC cuối cùng là từ 'staff' (CSKH đã rep nhưng KH im lặng)
 *   3. Tin nhắn cuối đó đã quá 24 giờ
 *   → Thêm 1 hệ thống message thông báo KH + update status → 'resolved'
 */
export async function autoCloseStaleTickets(): Promise<number> {
  // LATERAL JOIN: lấy tin nhắn public cuối cùng cho mỗi ticket in_progress
  const candidates = await pool.query<{ id: number; customer_id: number; last_msg_at: string; last_sender: string }>(
    `SELECT ct.id,
            ct.customer_id,
            tm.created_at::text AS last_msg_at,
            tm.sender_type     AS last_sender
     FROM customer_tickets ct
     INNER JOIN LATERAL (
       SELECT sender_type, created_at
       FROM ticket_messages
       WHERE ticket_id = ct.id AND is_internal = false
       ORDER BY created_at DESC
       LIMIT 1
     ) tm ON true
     WHERE ct.status = 'in_progress'
       AND tm.sender_type = 'staff'
       AND tm.created_at < NOW() - INTERVAL '24 hours'`,
  );

  let closedCount = 0;
  for (const row of candidates.rows) {
    // 1. Tin nhắn hệ thống thông báo khép phiếu
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, is_internal)
       VALUES ($1, 'staff', NULL,
               'Do không nhận được phản hồi từ bạn trong 24 giờ, hệ thống đã tự động đóng phiếu hỗ trợ này. Nếu cần trợ giúp thêm, vui lòng gửi phiếu mới.',
               false)`,
      [row.id],
    );
    // 2. Chuyển status → closed, ghi closed_at (auto-close thực sự, không cần CSKH confirm)
    await pool.query(
      `UPDATE customer_tickets SET status = 'closed', closed_at = NOW() WHERE id = $1`,
      [row.id],
    );
    // 3. Audit log
    await pool.query(
      `INSERT INTO ticket_logs (ticket_id, actor_id, action_type, description)
       VALUES ($1, NULL, 'auto_closed', 'Hệ thống tự động đóng do khách hàng không phản hồi sau 24 giờ')`,
      [row.id],
    );
    // 4. Trạm 3 — TICKET_CLOSED notification (fire-and-forget)
    notifyTicketClosed({
      customerId: Number(row.customer_id),
      ticketId: row.id,
      reason: "Tự động đóng do không phản hồi sau 24h",
    }).catch((err) => {
      console.error(`[autoCloseStaleTickets] Lỗi TICKET_CLOSED notification cho ticket #${row.id}:`, err);
    });

    closedCount++;
  }
  if (closedCount > 0) {
    console.log(`[AutoClose] Đã tự động đóng ${closedCount} ticket stale.`);
  }
  return closedCount;
}

/* ─── Store Manager: danh sách ticket được giao ─── */
export async function getAssignedComplaints(smUserId: number) {
  const r = await pool.query(
    `SELECT ct.id, ct.store_id, s.name AS store_name,
            COALESCE(c.full_name, 'Khách vãng lai') AS customer_name,
            COALESCE(c.phone, '') AS customer_phone,
            ct.subject, ct.content AS description,
            ct.status, ct.priority, ct.channel,
            ct.assigned_to, ct.assigned_at,
            ct.internal_note, ct.customer_reply,
            ct.attachment_url,
            ct.created_at,
            (SELECT tm.message
               FROM ticket_messages tm
               WHERE tm.ticket_id = ct.id
                 AND tm.is_internal = TRUE
                 AND tm.sender_type = 'staff'
               ORDER BY tm.created_at ASC
               LIMIT 1) AS assign_note
     FROM customer_tickets ct
     JOIN stores s ON s.id = ct.store_id
     LEFT JOIN customers c ON c.id = ct.customer_id
     WHERE ct.assigned_to = $1 AND ct.status = 'in_progress'
     ORDER BY ct.priority DESC, ct.created_at ASC`,
    [smUserId],
  );
  return r.rows;
}

/* -------------------------------------------------------
   6. Profile edit requests
      Dung bang schedule_requests voi request_type = 'profile_update'
      note chua JSON: { full_name, phone, email, ... }
   ------------------------------------------------------- */
export async function getProfileEditRequests(storeIds?: number[]) {
  const { clause, params } = getStoreFilter(storeIds);
  const typeParam = params.length + 1;
  const whereClause = clause
    ? `${clause} AND sr.request_type = $${typeParam}`
    : `WHERE sr.request_type = $${typeParam}`;
  const q = `
    SELECT
      sr.id, sr.store_id, s.name AS store_name,
      sr.user_id,
      u.full_name AS requester_name, u.phone AS requester_phone,
      u.email, u.employment_type,
      sr.request_date, sr.note,
      sr.status, sr.approved_at,
      ab.full_name AS approved_by_name,
      sr.created_at
    FROM schedule_requests sr
    JOIN users u ON u.id = sr.user_id
    JOIN stores s ON s.id = sr.store_id
    LEFT JOIN users ab ON ab.id = sr.approved_by
    ${whereClause}
    ORDER BY sr.created_at DESC
  `;
  const r = await pool.query(q, [...params, "profile_update"]);
  return r.rows;
}

export async function createProfileEditRequest(data: {
  user_id: number;
  store_id: number;
  note: string;
}) {
  const r = await pool.query(
    `INSERT INTO schedule_requests (user_id, store_id, request_date, request_type, note, status)
     VALUES ($1, $2, CURRENT_DATE, 'profile_update', $3, 'pending')
     RETURNING *`,
    [data.user_id, data.store_id, data.note]
  );
  return r.rows[0];
}

/* ═══════════════════════════════════════════════════════
   7. CHI TIẾT TỪNG CƠ SỞ
      Tổng hợp: doanh thu, nhân sự, tồn kho, ca làm việc,
                top sản phẩm bán chạy từ các bảng hiện có
   ═══════════════════════════════════════════════════════ */
export async function getStoreDetail(storeId: number, allowedStoreIds?: number[]) {
  // Check access permission
  if (allowedStoreIds && allowedStoreIds.length > 0 && !allowedStoreIds.includes(storeId)) {
    throw new ApiError(403, "Không có quyền xem cơ sở này");
  }

  // 1. Basic store info
  const storeRes = await pool.query(
    `SELECT id, name, address FROM stores WHERE id = $1`,
    [storeId]
  );
  if (storeRes.rows.length === 0) throw new ApiError(404, "Không tìm thấy cơ sở");
  const store = storeRes.rows[0];

  // 2. Revenue from orders
  const revRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders,
       COUNT(*) FILTER (WHERE status = 'pending' OR status = 'paid')::int AS pending_orders,
       COALESCE(SUM(final_amount) FILTER (WHERE status = 'completed'), 0)::numeric AS total_revenue,
       COALESCE(AVG(final_amount) FILTER (WHERE status = 'completed'), 0)::numeric AS avg_order_value,
       COALESCE(MAX(final_amount) FILTER (WHERE status = 'completed'), 0)::numeric AS max_order_value,
       COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days')::int AS orders_last_7d,
       COALESCE(SUM(final_amount) FILTER (WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS revenue_last_7d,
       COUNT(*) FILTER (WHERE status = 'completed' AND discount_amount > 0)::int AS voucher_orders,
       COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0)::numeric AS total_discount
     FROM orders WHERE store_id = $1`,
    [storeId]
  );
  const rev = revRes.rows[0];

  // 3. In-store staff only: staff, shift_leader, store_manager
  //    Exclude POS, auditor, DM, marketing office accounts
  const staffRes = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.employment_type,
            u.hourly_wage::numeric, u.monthly_salary::numeric, u.is_active,
            r.name AS role_name
     FROM user_stores us
     JOIN users u ON u.id = us.user_id
     JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
     WHERE us.store_id = $1 AND u.is_active = TRUE
     ORDER BY r.name, u.full_name`,
    [storeId]
  );
  const staff = staffRes.rows;

  // 4. Inventory (stock_levels + ingredients)
  //    Sort deficit items first for easier warning display
  const stockRes = await pool.query(
    `SELECT i.name, i.category, i.storage_unit,
            sl.quantity::numeric,
            i.cost_per_storage_unit::numeric,
            (sl.quantity * COALESCE(i.cost_per_storage_unit, 0))::numeric AS stock_value
     FROM stock_levels sl
     JOIN ingredients i ON i.id = sl.ingredient_id
     WHERE sl.store_id = $1
     ORDER BY sl.quantity ASC, i.name ASC`,
    [storeId]
  );
  const stockItems = stockRes.rows;
  // Split positive stock value vs deficit value (negative quantity = oversold)
  const positiveStockValue = stockItems.reduce((s: number, it: any) => {
    const v = Number(it.stock_value);
    return s + (v > 0 ? v : 0);
  }, 0);
  const deficitValue = stockItems.reduce((s: number, it: any) => {
    const v = Number(it.stock_value);
    return s + (v < 0 ? Math.abs(v) : 0);
  }, 0);
  const netStockValue = positiveStockValue - deficitValue;
  const deficitItems = stockItems.filter((it: any) => Number(it.quantity) < 0).length;

  // 5. Shift templates
  const shiftsRes = await pool.query(
    `SELECT id, name, start_time::text, end_time::text, late_grace_minutes
     FROM shifts WHERE store_id = $1 ORDER BY start_time`,
    [storeId]
  );

  // 5b. Attendance stats in the current month (att_attendance)
  const attStatsRes = await pool.query(
    `SELECT
       COUNT(*)::int                                          AS total_sessions,
       COUNT(*) FILTER (WHERE status = 'on_time')::int       AS on_time_count,
       COUNT(*) FILTER (WHERE status = 'late')::int         AS late_count,
       COUNT(*) FILTER (WHERE status = 'absent')::int       AS absent_count,
       COALESCE(SUM(work_hours), 0)::numeric                AS total_hours,
       COUNT(DISTINCT user_id)::int                         AS active_staff
     FROM att_attendance
     WHERE store_id = $1
       AND work_date >= date_trunc('month', CURRENT_DATE)::date
       AND work_date <  (date_trunc('month', CURRENT_DATE) + interval '1 month')::date`,
    [storeId]
  );
  const attStats = attStatsRes.rows[0];

  // 5c. Pending schedule requests (leave, swap, overtime, explanation, etc.)
  //     Ignore request_type = 'profile_update' because it is unrelated to shifts
  const shiftRequestsRes = await pool.query(
    `SELECT sr.id,
            u.full_name AS requester_name,
            sr.request_type,
            sr.request_date::text,
            COALESCE(sr.note, '') AS note,
            sr.status,
            COALESCE(sh.name, '') AS shift_name,
            sr.created_at
     FROM schedule_requests sr
     JOIN users u ON u.id = sr.user_id
     LEFT JOIN shifts sh ON sh.id = sr.shift_id
     WHERE sr.store_id = $1
       AND sr.request_type != 'profile_update'
       AND sr.status = 'pending'
     ORDER BY sr.created_at DESC
     LIMIT 30`,
    [storeId]
  );

  // 6. All products, including items without sales yet (LEFT JOIN)
  const allProductsRes = await pool.query(
    `SELECT p.name AS product_name,
            COALESCE(SUM(od.quantity), 0)::int AS qty_sold,
            COALESCE(SUM(od.quantity * od.unit_price), 0)::numeric AS revenue
     FROM products p
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     LEFT JOIN order_details od ON od.product_variant_id = pv.id
     LEFT JOIN orders o ON o.id = od.order_id
       AND o.store_id = $1 AND o.status = 'completed'
     GROUP BY p.id, p.name
     ORDER BY qty_sold DESC, p.name ASC`,
    [storeId]
  );

  return {
    store: {
      id: store.id,
      name: store.name,
      address: store.address ?? "",
    },
    revenue: {
      completed_orders: Number(rev.completed_orders),
      pending_orders: Number(rev.pending_orders),
      total_revenue: Number(rev.total_revenue),
      avg_order_value: Number(rev.avg_order_value),
      max_order_value: Number(rev.max_order_value),
      orders_last_7d: Number(rev.orders_last_7d),
      revenue_last_7d: Number(rev.revenue_last_7d),
      voucher_orders: Number(rev.voucher_orders),
      total_discount: Number(rev.total_discount),
    },
    staff: {
      total: staff.length,
      list: staff.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        role_name: u.role_name ?? "",
        employment_type: u.employment_type ?? "",
        hourly_wage: Number(u.hourly_wage),
        monthly_salary: Number(u.monthly_salary),
      })),
    },
    stock: {
      total_items: stockItems.length,
      total_value: netStockValue,
      positive_value: positiveStockValue,
      deficit_value: deficitValue,
      deficit_items: deficitItems,
      items: stockItems.map((it: any) => ({
        name: it.name,
        category: it.category ?? "",
        storage_unit: it.storage_unit ?? "",
        quantity: Number(it.quantity),
        cost_per_unit: Number(it.cost_per_storage_unit),
        stock_value: Number(it.stock_value),
      })),
    },
    shifts: {
      attendance: {
        total_sessions: Number(attStats.total_sessions),
        on_time_count:  Number(attStats.on_time_count),
        late_count:     Number(attStats.late_count),
        absent_count:   Number(attStats.absent_count),
        total_hours:    Number(attStats.total_hours),
        active_staff:   Number(attStats.active_staff),
        on_time_pct: Number(attStats.total_sessions) > 0
          ? parseFloat(((Number(attStats.on_time_count) / Number(attStats.total_sessions)) * 100).toFixed(1))
          : 0,
      },
      configs: shiftsRes.rows.map((sh: any) => ({
        id: sh.id,
        name: sh.name,
        start_time: sh.start_time,
        end_time: sh.end_time,
        late_grace_minutes: Number(sh.late_grace_minutes),
      })),
      pending_requests: shiftRequestsRes.rows.map((r: any) => ({
        id: r.id,
        requester_name: r.requester_name,
        request_type: r.request_type,
        request_date: r.request_date,
        note: r.note,
        shift_name: r.shift_name,
        status: r.status,
        created_at: r.created_at,
      })),
    },
    all_products: allProductsRes.rows.map((p: any) => ({
      product_name: p.product_name,
      qty_sold: Number(p.qty_sold),
      revenue: Number(p.revenue),
    })),
  };
}

/* -----------------------------------------------
   7b-i. Tai chinh co so (loc theo ngay)
   ----------------------------------------------- */
export async function getStoreFinance(
  storeId: number,
  dateFrom?: string,
  dateTo?: string,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");

  /* -- Revenue -- */
  const revParams: any[] = [storeId];
  const orderConds = ["store_id = $1", "status = 'completed'"];
  if (dateFrom) { revParams.push(dateFrom); orderConds.push(`completed_at >= $${revParams.length}::date`); }
  if (dateTo)   { revParams.push(dateTo);   orderConds.push(`completed_at < ($${revParams.length}::date + interval '1 day')`); }
  const revRes = await pool.query(
    `SELECT COALESCE(SUM(final_amount), 0)::numeric AS revenue,
            COUNT(*)::int AS completed_orders
     FROM orders WHERE ${orderConds.join(' AND ')}`,
    revParams,
  );

  /* -- Fixed expenses (pro-rated) -- */
  let expenseScale = 1.0;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom + 'T00:00:00');
    const to   = new Date(dateTo   + 'T00:00:00');
    const daysInRange = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    expenseScale = Math.min(daysInRange / daysInMonth, 1.0);
  }
  const expRes = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN ec.code ILIKE '%operating%' OR ec.name ILIKE '%tiêu hao%' OR ec.name ILIKE '%vận hành%'
                    THEN ROUND(ser.amount * $2) ELSE 0 END), 0)::numeric AS operating_expense,
       COALESCE(SUM(CASE WHEN ec.code ILIKE '%maintain%' OR ec.name ILIKE '%duy trì%'
                    THEN ROUND(ser.amount * $2) ELSE 0 END), 0)::numeric AS maintenance_expense,
       COALESCE(SUM(CASE WHEN (ec.code NOT ILIKE '%operating%' AND ec.code NOT ILIKE '%maintain%'
                              AND ec.name NOT ILIKE '%tiêu hao%' AND ec.name NOT ILIKE '%vận hành%'
                              AND ec.name NOT ILIKE '%duy trì%') OR ec.id IS NULL
                    THEN ROUND(ser.amount * $2) ELSE 0 END), 0)::numeric AS other_expense
     FROM store_expense_rules ser
     LEFT JOIN expense_categories ec ON ec.id = ser.category_id
     WHERE ser.store_id = $1`,
    [storeId, expenseScale],
  );

  /* -- Payroll -- */
  const payParams: any[] = [storeId];
  const payConds = ["aa.store_id = $1"];
  if (dateFrom) { payParams.push(dateFrom); payConds.push(`aa.work_date >= $${payParams.length}::date`); }
  if (dateTo)   { payParams.push(dateTo);   payConds.push(`aa.work_date < ($${payParams.length}::date + interval '1 day')`); }
  const ptPayRes = await pool.query(
    `SELECT COALESCE(SUM(aa.work_hours * u.hourly_wage), 0)::numeric AS pt_cost
     FROM att_attendance aa
     JOIN users u ON u.id = aa.user_id AND u.employment_type = 'part_time'
     JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
     WHERE ${payConds.join(' AND ')}`,
    payParams,
  );
  const ftPayRes = await pool.query(
    `SELECT COALESCE(SUM(u.monthly_salary), 0)::numeric AS ft_cost
     FROM user_stores us
     JOIN users u ON u.id = us.user_id
       AND u.employment_type = 'full_time'
       AND u.is_active = TRUE
     JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
     WHERE us.store_id = $1`,
    [storeId],
  );

  /* -- Waste -- */
  const wasteParams: any[] = [storeId];
  const wasteConds = ["wr.store_id = $1"];
  if (dateFrom) { wasteParams.push(dateFrom); wasteConds.push(`wr.created_at >= $${wasteParams.length}::date`); }
  if (dateTo)   { wasteParams.push(dateTo);   wasteConds.push(`wr.created_at < ($${wasteParams.length}::date + interval '1 day')`); }
  const wasteRes = await pool.query(
    `SELECT COALESCE(SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0)), 0)::numeric AS waste_expense
     FROM waste_reports wr
     JOIN waste_items wi ON wi.waste_report_id = wr.id
     LEFT JOIN ingredients i ON i.id = wi.ingredient_id
     WHERE ${wasteConds.join(' AND ')}`,
    wasteParams,
  );

  const revenue    = Number(revRes.rows[0].revenue);
  const operating  = Number(expRes.rows[0].operating_expense);
  const maintenance= Number(expRes.rows[0].maintenance_expense);
  const other      = Number(expRes.rows[0].other_expense);
  const payroll    = Number(ptPayRes.rows[0].pt_cost) + Number(ftPayRes.rows[0].ft_cost);
  const waste      = Number(wasteRes.rows[0].waste_expense);
  const total_expense = operating + maintenance + other + payroll + waste;
  const profit     = revenue - total_expense;

  return {
    revenue,
    operating_expense: operating,
    maintenance_expense: maintenance,
    other_expense: other,
    payroll_cost: payroll,
    waste_expense: waste,
    total_expense,
    profit,
    margin_pct: revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(2)) : 0,
    completed_orders: Number(revRes.rows[0].completed_orders),
  };
}

/* -----------------------------------------------
   7b-ii. Ton kho co phan trang
   ----------------------------------------------- */
export async function getStoreStockPaged(
  storeId: number,
  page: number,
  limit: number,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");

  const offset = (page - 1) * limit;
  const [itemsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT i.name, i.category, i.storage_unit,
              sl.quantity::numeric,
              i.cost_per_storage_unit::numeric,
              (sl.quantity * COALESCE(i.cost_per_storage_unit, 0))::numeric AS stock_value
       FROM stock_levels sl
       JOIN ingredients i ON i.id = sl.ingredient_id
       WHERE sl.store_id = $1
       ORDER BY sl.quantity ASC, i.name ASC
       LIMIT $2 OFFSET $3`,
      [storeId, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM stock_levels WHERE store_id = $1`,
      [storeId],
    ),
  ]);

  return {
    items: itemsRes.rows.map((it: any) => ({
      name: it.name,
      category: it.category ?? "",
      storage_unit: it.storage_unit ?? "",
      quantity: Number(it.quantity),
      cost_per_unit: Number(it.cost_per_storage_unit),
      stock_value: Number(it.stock_value),
    })),
    total: Number(countRes.rows[0].total),
    page,
    limit,
  };
}

/* -----------------------------------------------
   7b-iii. San pham ban chay co phan trang
   ----------------------------------------------- */
export async function getStoreProductsPaged(
  storeId: number,
  page: number,
  limit: number,
  dateFrom?: string,
  dateTo?: string,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");

  const offset = (page - 1) * limit;
  const orderConds = ["o.store_id = $1", "o.status = 'completed'"];
  const baseParams: any[] = [storeId];
  if (dateFrom) { baseParams.push(dateFrom); orderConds.push(`o.completed_at >= $${baseParams.length}::date`); }
  if (dateTo)   { baseParams.push(dateTo);   orderConds.push(`o.completed_at < ($${baseParams.length}::date + interval '1 day')`); }

  const itemParams = [...baseParams, limit, offset];
  const limitIdx  = itemParams.length - 1;
  const offsetIdx = itemParams.length;

  const [itemsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT p.name AS product_name,
              COALESCE(SUM(od.quantity), 0)::int AS qty_sold,
              COALESCE(SUM(od.quantity * od.unit_price), 0)::numeric AS revenue
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       LEFT JOIN order_details od ON od.product_variant_id = pv.id
       LEFT JOIN orders o ON o.id = od.order_id
         AND ${orderConds.join(' AND ')}
       GROUP BY p.id, p.name
       ORDER BY qty_sold DESC, p.name ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      itemParams,
    ),
    pool.query(`SELECT COUNT(DISTINCT id)::int AS total FROM products`, []),
  ]);

  return {
    items: itemsRes.rows.map((p: any) => ({
      product_name: p.product_name,
      qty_sold: Number(p.qty_sold),
      revenue: Number(p.revenue),
    })),
    total: Number(countRes.rows[0].total),
    page,
    limit,
  };
}

/* -----------------------------------------------
   7b. Danh sach nhan vien cua mot co so
   ----------------------------------------------- */
export async function getStoreStaff(storeId: number, allowedStoreIds?: number[]) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");
  const r = await pool.query(
    `SELECT u.id, u.full_name, u.employment_type,
            u.hourly_wage::numeric,
            u.monthly_salary::numeric,
            ro.name AS role_name
     FROM user_stores us
     JOIN users u ON u.id = us.user_id
     JOIN roles ro ON ro.id = u.role_id
       AND ro.name IN ('staff', 'shift_leader', 'store_manager')
     WHERE us.store_id = $1 AND u.is_active = TRUE
     ORDER BY ro.name, u.full_name`,
    [storeId]
  );
  return r.rows.map((u: any) => ({
    id: u.id,
    full_name: u.full_name,
    role_name: u.role_name ?? "",
    employment_type: u.employment_type ?? "",
    hourly_wage: Number(u.hourly_wage),
    monthly_salary: Number(u.monthly_salary),
  }));
}

export async function getHrEmployees(allowedStoreIds?: number[]) {
  const { clause, params } = getStoreFilter(allowedStoreIds);
  const r = await pool.query(
    `SELECT
       u.id AS user_id,
       us.store_id,
       s.name AS store_name,
       u.full_name,
       ro.name AS role_name,
       u.employment_type,
       COALESCE(u.hourly_wage, 0)::numeric AS hourly_wage,
       COALESCE(u.monthly_salary, 0)::numeric AS monthly_salary
     FROM user_stores us
     JOIN stores s ON s.id = us.store_id
     JOIN users u ON u.id = us.user_id AND u.is_active = TRUE
     JOIN roles ro ON ro.id = u.role_id
       AND ro.name IN ('staff', 'shift_leader', 'store_manager')
     ${clause}
     ORDER BY s.name, ro.name, u.full_name`,
    params,
  );

  return r.rows.map((row: any) => ({
    user_id: Number(row.user_id),
    store_id: Number(row.store_id),
    store_name: String(row.store_name ?? ""),
    full_name: String(row.full_name ?? ""),
    role_name: String(row.role_name ?? ""),
    employment_type: String(row.employment_type ?? ""),
    hourly_wage: Number(row.hourly_wage ?? 0),
    monthly_salary: Number(row.monthly_salary ?? 0),
  }));
}

/* -----------------------------------------------
   8. Cap nhat luong nhan vien
   ----------------------------------------------- */
export async function updateStaffWage(userId: number, storeId: number, wage: number, allowedStoreIds?: number[]) {
  if (wage < 0) throw new ApiError(400, "Mức lương không hợp lệ");
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền chỉnh lương tại cơ sở này");
  const check = await pool.query(
    `SELECT u.employment_type FROM user_stores us
     JOIN users u ON u.id = us.user_id
     WHERE us.user_id = $1 AND us.store_id = $2`,
    [userId, storeId]
  );
  if (check.rows.length === 0) throw new ApiError(404, "Nhân viên không thuộc cơ sở này");
  const empType = check.rows[0].employment_type;
  if (empType === 'full_time') {
    const r = await pool.query(
      `UPDATE users SET monthly_salary = $1 WHERE id = $2
       RETURNING id, full_name, employment_type, monthly_salary::numeric`,
      [wage, userId]
    );
    return r.rows[0];
  } else {
    const r = await pool.query(
      `UPDATE users SET hourly_wage = $1 WHERE id = $2
       RETURNING id, full_name, employment_type, hourly_wage::numeric`,
      [wage, userId]
    );
    return r.rows[0];
  }
}

/* -------------------------------------------------------
   9. Bao cao huy hang - chi tiet theo co so + tao moi
   ------------------------------------------------------- */
export async function getWasteDetail(storeId: number, allowedStoreIds?: number[]) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");
  const r = await pool.query(
    `SELECT wr.id,
            wr.created_at,
            COALESCE(u.full_name, 'Không rõ') AS reported_by,
            COUNT(wi.id)::int AS item_count,
            COALESCE(SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0)), 0)::numeric AS total_cost,
            json_agg(
              json_build_object(
                'ingredient_id', wi.ingredient_id,
                'ingredient_name', i.name,
                'storage_unit', COALESCE(i.storage_unit, ''),
                'quantity', wi.quantity,
                'cost_per_unit', COALESCE(i.cost_per_storage_unit, 0),
                'item_cost', wi.quantity * COALESCE(i.cost_per_storage_unit, 0)
              ) ORDER BY i.name
            ) AS items
     FROM waste_reports wr
     JOIN waste_items wi ON wi.waste_report_id = wr.id
     LEFT JOIN ingredients i ON i.id = wi.ingredient_id
     LEFT JOIN users u ON u.id = wr.reported_by
     WHERE wr.store_id = $1
     GROUP BY wr.id, wr.created_at, u.full_name
     ORDER BY wr.created_at DESC
     LIMIT 20`,
    [storeId]
  );
  return r.rows;
}

export async function getStoreIngredients(storeId: number, allowedStoreIds?: number[]) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền xem cơ sở này");
  const r = await pool.query(
    `SELECT i.id, i.name, COALESCE(i.category, '') AS category,
            COALESCE(i.storage_unit, '') AS storage_unit,
            COALESCE(i.cost_per_storage_unit, 0)::numeric AS cost_per_unit,
            COALESCE(sl.quantity, 0)::numeric AS current_stock
     FROM ingredients i
     LEFT JOIN stock_levels sl ON sl.ingredient_id = i.id AND sl.store_id = $1
     ORDER BY i.category, i.name`,
    [storeId]
  );
  return r.rows;
}

export async function createWasteReport(
  storeId: number,
  items: { ingredient_id: number; quantity: number }[],
  reportedBy: number,
  allowedStoreIds?: number[]
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền chỉnh sửa cơ sở này");
  const validItems = items.filter((it) => it.quantity > 0);
  if (validItems.length === 0)
    throw new ApiError(400, "Cần ít nhất 1 nguyên liệu với số lượng > 0");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reportRes = await client.query(
      `INSERT INTO waste_reports (store_id, reported_by) VALUES ($1, $2) RETURNING id`,
      [storeId, reportedBy]
    );
    const reportId = reportRes.rows[0].id;
    for (const item of validItems) {
      await client.query(
        `INSERT INTO waste_items (waste_report_id, ingredient_id, quantity) VALUES ($1, $2, $3)`,
        [reportId, item.ingredient_id, item.quantity]
      );
    }
    await client.query("COMMIT");
    return { id: reportId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------------------------------------------------------
   MODULE 1 - Bao cao quy luong PT/FT
   - Part-time: quy luong = pt_payroll_pct% x doanh thu
   - Full-time : lương cứng 9.000.000 net / nhân sự / tháng
   --------------------------------------------------------------- */
export async function getPayrollReportV2(
  storeIds?: number[],
  dateFrom?: string,
  dateTo?: string,
) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];
  const attConds: string[] = [];
  const ordConds: string[] = ["o.status = 'completed'"];

  if (dateFrom) {
    allParams.push(dateFrom);
    const idx = allParams.length;
    attConds.push(`aa.work_date >= $${idx}::date`);
    ordConds.push(`o.completed_at >= $${idx}::date`);
  }
  if (dateTo) {
    allParams.push(dateTo);
    const idx = allParams.length;
    attConds.push(`aa.work_date < ($${idx}::date + interval '1 day')`);
    ordConds.push(`o.completed_at < ($${idx}::date + interval '1 day')`);
  }
  const attWhere = attConds.length ? `WHERE ${attConds.join(" AND ")}` : "";
  const ordWhere = `WHERE ${ordConds.join(" AND ")}`;

  const q = `
    SELECT
      s.id          AS store_id,
      s.name        AS store_name,
      s.pt_payroll_pct,
      COALESCE(rev.revenue, 0)::numeric              AS revenue,
      ROUND(COALESCE(rev.revenue, 0) * COALESCE(s.pt_payroll_pct, 10) / 100)::numeric AS pt_fund_target,
      COALESCE(pt.pt_payroll,  0)::numeric           AS pt_payroll_actual,
      COALESCE(ft.ft_payroll,  0)::numeric           AS ft_payroll_actual,
      COALESCE(pt.pt_count,    0)::int               AS pt_count,
      COALESCE(ft.ft_count,    0)::int               AS ft_count
    FROM stores s
    LEFT JOIN (
      SELECT o.store_id, SUM(o.final_amount) AS revenue
      FROM orders o ${ordWhere}
      GROUP BY o.store_id
    ) rev ON rev.store_id = s.id
    LEFT JOIN (
      SELECT aa.store_id,
             SUM(aa.work_hours * u.hourly_wage) AS pt_payroll,
             COUNT(DISTINCT aa.user_id)          AS pt_count
      FROM att_attendance aa
      JOIN users u ON u.id = aa.user_id AND u.employment_type = 'part_time'
      JOIN roles r ON r.id = u.role_id AND r.name IN ('staff', 'shift_leader', 'store_manager')
      ${attWhere}
      GROUP BY aa.store_id
    ) pt ON pt.store_id = s.id
    LEFT JOIN (
      SELECT us.store_id,
             COUNT(DISTINCT us.user_id) * 9000000 AS ft_payroll,
             COUNT(DISTINCT us.user_id)           AS ft_count
      FROM user_stores us
      JOIN users u ON u.id = us.user_id
        AND u.employment_type = 'full_time'
        AND u.is_active = TRUE
      JOIN roles r ON r.id = u.role_id
        AND r.name IN ('staff', 'shift_leader', 'store_manager')
      GROUP BY us.store_id
    ) ft ON ft.store_id = s.id
    ${clause}
    ORDER BY s.name
  `;
  return (await pool.query(q, allParams)).rows;
}

export async function updatePtPayrollPct(
  storeId: number,
  pct: number,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");
  if (pct < 0 || pct > 50)
    throw new ApiError(400, "% quỹ lương PT phải trong khoảng 0-50");
  const r = await pool.query(
    `UPDATE stores SET pt_payroll_pct = $1 WHERE id = $2
     RETURNING id, name, pt_payroll_pct`,
    [pct, storeId],
  );
  if (!r.rows.length) throw new ApiError(404, "Không tìm thấy cơ sở");
  return r.rows[0];
}

/* ---------------------------------------------------------------
   MODULE 2 - Thong ke ton kho va huy hang (Read-only)
   --------------------------------------------------------------- */
export async function getInventoryWasteSummary(
  storeIds?: number[],
  dateFrom?: string,
  dateTo?: string,
) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];

  // Push date params once and reuse positional indices for both waste and revenue
  let dateFromPH = "";
  let dateToPH   = "";
  if (dateFrom) { allParams.push(dateFrom); dateFromPH = `$${allParams.length}::date`; }
  if (dateTo)   { allParams.push(dateTo);   dateToPH   = `$${allParams.length}::date`; }

  // Compute previous period params for trend_pct
  let prevFromPH = "";
  let prevToPH   = "";
  if (dateFrom && dateTo) {
    const { prevFrom, prevTo } = computePrevPeriod(dateFrom, dateTo);
    allParams.push(prevFrom); prevFromPH = `$${allParams.length}::date`;
    allParams.push(prevTo);   prevToPH   = `$${allParams.length}::date`;
  }

  const wasteConds = [
    dateFromPH ? `o.dm_reviewed_at >= ${dateFromPH}` : "",
    dateToPH   ? `o.dm_reviewed_at < (${dateToPH} + interval '1 day')` : "",
  ].filter(Boolean);
  const wasteAnd = wasteConds.length ? `AND ${wasteConds.join(" AND ")}` : "";

  const prevWasteConds = [
    prevFromPH ? `o.dm_reviewed_at >= ${prevFromPH}` : "",
    prevToPH   ? `o.dm_reviewed_at < (${prevToPH} + interval '1 day')` : "",
  ].filter(Boolean);
  const prevWasteAnd = prevWasteConds.length ? `AND ${prevWasteConds.join(" AND ")}` : "";

  const revConds = [
    dateFromPH ? `o.completed_at >= ${dateFromPH}` : "",
    dateToPH   ? `o.completed_at < (${dateToPH} + interval '1 day')` : "",
  ].filter(Boolean);
  const revDateAnd = revConds.length ? `AND ${revConds.join(" AND ")}` : "";

  // Conditionally build previous-period LEFT JOIN for trend
  const prevJoin = (prevFromPH && prevToPH) ? `
    LEFT JOIN (
      SELECT o.store_id,
             COALESCE(SUM(o.total_estimated_cost), 0) AS waste_cost_prev
      FROM coffee_chain_db.inventory_disposal_orders o
      WHERE o.status = 'approved'
        ${prevWasteAnd}
      GROUP BY o.store_id
    ) prev_wst ON prev_wst.store_id = s.id` : "";

  const trendCol = prevFromPH ? `
      CASE
        WHEN COALESCE(prev_wst.waste_cost_prev, 0) > 0
          THEN ROUND(((COALESCE(wst.waste_cost, 0) - prev_wst.waste_cost_prev) / prev_wst.waste_cost_prev * 100)::numeric, 1)
        ELSE NULL
      END AS trend_pct` : `
      NULL::numeric AS trend_pct`;

  const q = `
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      -- Current inventory
      COALESCE(inv.total_items,       0)::int     AS total_items,
      COALESCE(inv.total_stock_value, 0)::numeric AS total_stock_value,
      COALESCE(inv.deficit_items,     0)::int     AS deficit_items,
      COALESCE(inv.deficit_value,     0)::numeric AS deficit_value,
      -- Waste in range
      COALESCE(wst.waste_count,       0)::int     AS waste_reports_count,
      COALESCE(wst.waste_cost,        0)::numeric AS waste_cost,
      -- Revenue in range (to compute waste ratio)
      COALESCE(rev.revenue,           0)::numeric AS revenue,
      CASE
        WHEN COALESCE(rev.revenue, 0) > 0
          THEN ROUND((COALESCE(wst.waste_cost, 0) / rev.revenue * 100)::numeric, 2)
        ELSE 0
      END::numeric AS waste_rate_pct,
      ${trendCol}
    FROM stores s
    LEFT JOIN (
      SELECT sl.store_id,
             COUNT(*)                                                               AS total_items,
             SUM(CASE WHEN sl.quantity >= 0 THEN sl.quantity * COALESCE(i.cost_per_storage_unit, 0) ELSE 0 END) AS total_stock_value,
             COUNT(*) FILTER (WHERE sl.quantity < 0)                               AS deficit_items,
             SUM(CASE WHEN sl.quantity < 0  THEN ABS(sl.quantity) * COALESCE(i.cost_per_storage_unit, 0) ELSE 0 END) AS deficit_value
      FROM stock_levels sl
      JOIN ingredients i ON i.id = sl.ingredient_id
      GROUP BY sl.store_id
    ) inv ON inv.store_id = s.id
    LEFT JOIN (
      SELECT o.store_id,
             COUNT(DISTINCT o.id)                        AS waste_count,
             COALESCE(SUM(o.total_estimated_cost), 0)    AS waste_cost
      FROM coffee_chain_db.inventory_disposal_orders o
      WHERE o.status = 'approved'
        ${wasteAnd}
      GROUP BY o.store_id
    ) wst ON wst.store_id = s.id
    ${prevJoin}
    LEFT JOIN (
      SELECT o.store_id,
             COALESCE(SUM(o.final_amount), 0) AS revenue
      FROM orders o
      WHERE o.status = 'completed'
        ${revDateAnd}
      GROUP BY o.store_id
    ) rev ON rev.store_id = s.id
    ${clause}
    ORDER BY s.name
  `;
  const rows = (await pool.query(q, allParams)).rows;
  return rows.map((row: any) => ({
    ...row,
    trend_pct: row.trend_pct != null ? Number(row.trend_pct) : null,
  }));
}

/* ── getStoreWasteDetail ─────────────────────────────────────────────────────
   Trả về: (1) deficit_items - mặt hàng âm kho, (2) top_waste_items - top 5 nguyên liệu hủy nhiều nhất
   ───────────────────────────────────────────────────────────────────────── */
export async function getStoreWasteDetail(
  storeId: number,
  dateFrom?: string,
  dateTo?: string,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId)) {
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");
  }

  // 1. Mặt hàng âm kho (quantity < 0) — trạng thái hiện tại, không lọc theo ngày
  const deficitResult = await pool.query(
    `SELECT
       i.name                                                               AS ingredient_name,
       sl.quantity::numeric                                                 AS quantity,
       COALESCE(i.storage_unit, '')                                         AS unit,
       COALESCE(i.cost_per_storage_unit, 0)::numeric                       AS cost_per_unit,
       (ABS(sl.quantity) * COALESCE(i.cost_per_storage_unit, 0))::numeric  AS deficit_value
     FROM stock_levels sl
     JOIN ingredients i ON i.id = sl.ingredient_id
     WHERE sl.store_id = $1 AND sl.quantity < 0
     ORDER BY deficit_value DESC`,
    [storeId],
  );

  // 2. Top 5 nguyên liệu bị hủy nhiều nhất (tính theo tổng giá trị) trong kỳ
  const wasteParams: any[] = [storeId];
  let dateConds = "";
  if (dateFrom) { wasteParams.push(dateFrom); dateConds += ` AND wr.created_at >= $${wasteParams.length}::date`; }
  if (dateTo)   { wasteParams.push(dateTo);   dateConds += ` AND wr.created_at < ($${wasteParams.length}::date + interval '1 day')`; }

  const topWasteResult = await pool.query(
    `SELECT
       i.name                                                               AS ingredient_name,
       COALESCE(i.storage_unit, '')                                         AS unit,
       SUM(wi.quantity)::numeric                                            AS total_quantity,
       SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0))::numeric    AS total_cost
     FROM waste_reports wr
     JOIN waste_items wi ON wi.waste_report_id = wr.id
     JOIN ingredients i  ON i.id = wi.ingredient_id
     WHERE wr.store_id = $1 ${dateConds}
     GROUP BY i.name, i.storage_unit
     ORDER BY total_cost DESC
     LIMIT 5`,
    wasteParams,
  );

  return {
    deficit_items: deficitResult.rows.map((r: any) => ({
      ingredient_name: r.ingredient_name,
      quantity:        Number(r.quantity),
      unit:            r.unit,
      cost_per_unit:   Number(r.cost_per_unit),
      deficit_value:   Number(r.deficit_value),
    })),
    top_waste_items: topWasteResult.rows.map((r: any) => ({
      ingredient_name: r.ingredient_name,
      unit:            r.unit,
      total_quantity:  Number(r.total_quantity),
      total_cost:      Number(r.total_cost),
    })),
  };
}

/* ---------------------------------------------------------------
   MODULE 3 - Assign khieu nai cho store manager
   --------------------------------------------------------------- */
export async function assignComplaint(
  ticketId: number,
  smUserId: number,
  assignedBy: number,
  allowedStoreIds?: number[],
) {
  // Verify SM belongs to the same store as the ticket
  const check = await pool.query(
    `SELECT ct.id, ct.store_id, ct.status
     FROM customer_tickets ct
     JOIN user_stores us ON us.store_id = ct.store_id AND us.user_id = $2
     WHERE ct.id = $1`,
    [ticketId, smUserId],
  );
  if (!check.rows.length)
    throw new ApiError(400, "Store manager không thuộc cơ sở của ticket này");
  const ticket = check.rows[0];
  if (ticket.status === "closed")
    throw new ApiError(400, "Ticket đã đóng, không thể assign");
  if (allowedStoreIds?.length && !allowedStoreIds.includes(ticket.store_id))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");

  const r = await pool.query(
    `UPDATE customer_tickets
     SET assigned_to = $1, assigned_by = $2, assigned_at = NOW(), status = 'in_progress'
     WHERE id = $3
     RETURNING id, status, assigned_at`,
    [smUserId, assignedBy, ticketId],
  );
  return r.rows[0];
}

export async function getStoreManagers(storeId: number, allowedStoreIds?: number[]) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");
  const r = await pool.query(
    `SELECT u.id, u.full_name, u.phone, r.name AS role_name
     FROM user_stores us
     JOIN users u ON u.id = us.user_id AND u.is_active = TRUE
     JOIN roles  r ON r.id = u.role_id AND r.name = 'store_manager'
     WHERE us.store_id = $1
     ORDER BY r.name, u.full_name`,
    [storeId],
  );
  return r.rows;
}

export async function getAllStoreManagers() {
  const r = await pool.query(
    `SELECT u.id, u.full_name, u.phone, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'store_manager'
     WHERE u.is_active = TRUE
     ORDER BY u.full_name`,
  );
  return r.rows;
}

/* ═══════════════════════════════════════════════════════════════
   MODULE 4 — TARGET DOANH THU
   ═══════════════════════════════════════════════════════════════ */
export async function getRevenueTargets(
  storeIds?: number[],
  month?: string, // "2026-03"
) {
  const { clause, params } = getStoreFilter(storeIds);
  const allParams: any[] = [...params];
  const monthDate = month ? `${month}-01` : null;

  let monthCond = "DATE_TRUNC('month', o.completed_at) = DATE_TRUNC('month', NOW())";
  if (monthDate) {
    allParams.push(monthDate);
    monthCond = `DATE_TRUNC('month', o.completed_at) = DATE_TRUNC('month', $${allParams.length}::date)`;
  }

  const q = `
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      COALESCE(s.monthly_revenue_target, 0)::numeric AS target,
      COALESCE(SUM(o.final_amount), 0)::numeric       AS actual,
      CASE
        WHEN COALESCE(s.monthly_revenue_target, 0) = 0 THEN NULL
        ELSE ROUND(COALESCE(SUM(o.final_amount), 0) * 100.0 / s.monthly_revenue_target, 1)
      END AS progress_pct
    FROM stores s
    LEFT JOIN orders o
      ON o.store_id = s.id AND o.status = 'completed' AND ${monthCond}
    ${clause}
    GROUP BY s.id, s.name, s.monthly_revenue_target
    ORDER BY s.name
  `;
  return (await pool.query(q, allParams)).rows;
}

export async function setRevenueTarget(
  storeId: number,
  target: number,
  allowedStoreIds?: number[],
) {
  if (allowedStoreIds?.length && !allowedStoreIds.includes(storeId))
    throw new ApiError(403, "Không có quyền truy cập cơ sở này");
  if (target < 0)
    throw new ApiError(400, "Target doanh thu không được âm");
  const r = await pool.query(
    `UPDATE stores SET monthly_revenue_target = $1 WHERE id = $2
     RETURNING id, name, monthly_revenue_target AS target`,
    [target, storeId],
  );
  if (!r.rows.length) throw new ApiError(404, "Không tìm thấy cơ sở");
  return r.rows[0];
}

/* -------------------------------------------------------------------
   TASK 1 - REVENUE STATS MoM
   API: GET /revenue-stats?month=X&year=Y&storeId=Z
   Tra ve: current_month_revenue, previous_month_revenue, change_pct
   Revenue = SUM(final_amount) - SUM(refund_amount)
   ------------------------------------------------------------------- */
export async function getRevenueStats(
  month: number,
  year: number,
  storeId?: number,
) {
  const curFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const curLast = new Date(year, month, 0).getDate();
  const curTo   = `${year}-${String(month).padStart(2, "0")}-${String(curLast).padStart(2, "0")}`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFrom  = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevLast  = new Date(prevYear, prevMonth, 0).getDate();
  const prevTo    = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevLast).padStart(2, "0")}`;

  const params: any[] = [curFrom, curTo, prevFrom, prevTo];
  let storeCond = "";
  if (storeId) {
    params.push(storeId);
    storeCond = `AND o.store_id = $${params.length}`;
  }

  const q = `
    SELECT
      COALESCE(SUM(CASE
        WHEN o.completed_at >= $1::date
          AND o.completed_at <  ($2::date + interval '1 day')
        THEN o.final_amount ELSE 0
      END), 0)::numeric AS cur_revenue,
      COALESCE(SUM(CASE
        WHEN o.completed_at >= $1::date
          AND o.completed_at <  ($2::date + interval '1 day')
        THEN COALESCE(o.refunded_amount, 0) ELSE 0
      END), 0)::numeric AS cur_refunds,
      COALESCE(SUM(CASE
        WHEN o.completed_at >= $3::date
          AND o.completed_at <  ($4::date + interval '1 day')
        THEN o.final_amount ELSE 0
      END), 0)::numeric AS prev_revenue,
      COALESCE(SUM(CASE
        WHEN o.completed_at >= $3::date
          AND o.completed_at <  ($4::date + interval '1 day')
        THEN COALESCE(o.refunded_amount, 0) ELSE 0
      END), 0)::numeric AS prev_refunds
    FROM orders o
    WHERE o.status = 'completed' ${storeCond}
  `;

  const row = (await pool.query(q, params)).rows[0];
  const curNet  = Number(row.cur_revenue)  - Number(row.cur_refunds);
  const prevNet = Number(row.prev_revenue) - Number(row.prev_refunds);
  const changePct = prevNet > 0
    ? parseFloat(((curNet - prevNet) / prevNet * 100).toFixed(1))
    : null;

  return {
    current_month_revenue:  curNet,
    previous_month_revenue: prevNet,
    change_pct:             changePct,
    period: {
      current:  { from: curFrom,  to: curTo,  month, year },
      previous: { from: prevFrom, to: prevTo, month: prevMonth, year: prevYear },
    },
    store_id: storeId ?? null,
  };
}

/* -------------------------------------------------------------------
   TASK 2 - ACTIONABLE INSIGHTS (generateStoreInsights)
   Nhan data thuc te de sinh mang loi khuyen hanh dong.
   ------------------------------------------------------------------- */
export interface StoreInsightInput {
  revenue_mom_pct:   number | null;  // % thay doi doanh thu MoM
  waste_ratio:       number;          // % huy hang (waste_rate_pct)
  waste_cost:        number;          // chi phi huy hang
  profit_margin_pct: number;          // bien loi nhuan %
  high_complaints:   number;          // so khieu nai muc cao dang open
  medium_complaints: number;          // so khieu nai muc trung binh dang open
  total_open_tickets:number;          // tong ticket dang open
  store_name?:       string;
}

export interface Insight {
  type: string;   // 'Canh bao' | 'Cai thien' | 'Tich cuc' | 'Hanh dong'
  text: string;
}

export function generateStoreInsights(data: StoreInsightInput): Insight[] {
  const insights: Insight[] = [];
  const name = data.store_name ?? "Cơ sở";

  // -- Revenue MoM --
  if (data.revenue_mom_pct !== null) {
    if (data.revenue_mom_pct < -15) {
      insights.push({
        type: "Cảnh báo",
        text: `${name}: Doanh thu giảm mạnh ${Math.abs(data.revenue_mom_pct)}% so với tháng trước. Cần kiểm tra ngay nguồn khách, xem xét chạy khuyến mãi ca chiều.`,
      });
    } else if (data.revenue_mom_pct < 0) {
      insights.push({
        type: "Cảnh báo",
        text: `${name}: Doanh thu giảm ${Math.abs(data.revenue_mom_pct)}% so với tháng trước. Đề xuất đẩy mạnh voucher ca chiều hoặc combo mới.`,
      });
    } else if (data.revenue_mom_pct > 20) {
      insights.push({
        type: "Tích cực",
        text: `${name}: Doanh thu tăng trưởng tốt +${data.revenue_mom_pct}%. Duy trì chiến lược hiện tại.`,
      });
    }
  }

  // -- Waste ratio --
  if (data.waste_ratio > 10) {
    insights.push({
      type: "Cảnh báo",
      text: `${name}: Tỷ lệ hủy hàng rất cao ${data.waste_ratio}%. Yêu cầu SM kiểm tra ngay định mức tồn kho và quy trình bảo quản.`,
    });
  } else if (data.waste_ratio > 5) {
    insights.push({
      type: "Cải thiện",
      text: `${name}: Tỷ lệ hủy hàng cao ${data.waste_ratio}%. Yêu cầu kiểm tra lại định mức tồn kho.`,
    });
  }

  // -- Profit margin --
  if (data.profit_margin_pct < 0) {
    insights.push({
      type: "Cảnh báo",
      text: `${name}: Đang lỗ (biên LN ${data.profit_margin_pct.toFixed(1)}%). Cần rà soát chi phí vận hành ngay.`,
    });
  } else if (data.profit_margin_pct < 15) {
    insights.push({
      type: "Cải thiện",
      text: `${name}: Biên lợi nhuận thấp ${data.profit_margin_pct.toFixed(1)}%. Tối ưu chi phí hoặc tăng giá bán.`,
    });
  }

  // -- High complaints --
  if (data.high_complaints > 0) {
    insights.push({
      type: "Cảnh báo",
      text: `${name}: Có ${data.high_complaints} khiếu nại mức nghiêm trọng chưa xử lý. Assign cho SM xử lý trong 24h.`,
    });
  }

  // -- Medium complaints --
  if (data.medium_complaints >= 3) {
    insights.push({
      type: "Cải thiện",
      text: `${name}: ${data.medium_complaints} khiếu nại mức trung bình đang chờ. Cần phân công xử lý.`,
    });
  }

  // -- Total open tickets pile-up --
  if (data.total_open_tickets >= 5) {
    insights.push({
      type: "Hành động",
      text: `${name}: Tổng ${data.total_open_tickets} ticket đang mở. Nguy cơ tồn đọng, yêu cầu xử lý ưu tiên.`,
    });
  }

  // -- No issue found --
  if (insights.length === 0) {
    insights.push({
      type: "Tích cực",
      text: `${name}: Hoạt động ổn định, không có cảnh báo cần xử lý.`,
    });
  }

  return insights;
}

/* -------------------------------------------------------------------
   DASHBOARD INSIGHTS - Tong hop insights cho toan bo stores
   Ket hop revenue-stats, waste, complaints de generateStoreInsights
   ------------------------------------------------------------------- */
export async function getDashboardInsights(
  storeIds?: number[],
  month?: number,
  year?: number,
) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year  ?? now.getFullYear();

  const dateFrom = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay  = new Date(y, m, 0).getDate();
  const dateTo   = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Parallel fetch all needed data
  const [revenueData, wasteData, trendData] = await Promise.all([
    getRevenueReport(storeIds, dateFrom, dateTo),
    getWasteReport(storeIds, dateFrom, dateTo),
    getRevenueTrend(storeIds, dateFrom, dateTo),
  ]);

  // Per-store complaint counts
  const { clause, params } = getStoreFilter(storeIds);
  const ticketQ = `
    SELECT ct.store_id,
      COUNT(*) FILTER (WHERE ct.status = 'open') AS total_open,
      COUNT(*) FILTER (WHERE ct.status = 'open' AND ct.priority = 'high') AS high_open,
      COUNT(*) FILTER (WHERE ct.status = 'open' AND ct.priority = 'medium') AS medium_open
    FROM customer_tickets ct
    JOIN stores s ON s.id = ct.store_id
    ${clause}
    GROUP BY ct.store_id
  `;
  const ticketRows = (await pool.query(ticketQ, params)).rows;
  const ticketMap = new Map(ticketRows.map((r: any) => [r.store_id, r]));

  // Build trend map (store_id -> change_pct)
  const trendMap = new Map(trendData.stores.map((s: any) => [s.store_id, s.change_pct]));

  // Build waste map (store_id -> { waste_rate_pct, waste_cost })
  const wasteMap = new Map(wasteData.map((w: any) => [w.store_id, w]));

  const allInsights: { store_id: number; store_name: string; insights: Insight[] }[] = [];

  for (const rev of revenueData) {
    const storeId   = rev.store_id;
    const revenue   = Number(rev.revenue);
    const expense   = Number(rev.total_expense);
    const profit    = Number(rev.profit);
    const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;
    const waste     = wasteMap.get(storeId);
    const tickets   = ticketMap.get(storeId);

    const input: StoreInsightInput = {
      revenue_mom_pct:    trendMap.get(storeId) ?? null,
      waste_ratio:        waste ? Number(waste.waste_rate_pct) : 0,
      waste_cost:         waste ? Number(waste.waste_cost) : 0,
      profit_margin_pct:  margin,
      high_complaints:    tickets ? Number(tickets.high_open) : 0,
      medium_complaints:  tickets ? Number(tickets.medium_open) : 0,
      total_open_tickets: tickets ? Number(tickets.total_open) : 0,
      store_name:         rev.store_name,
    };

    allInsights.push({
      store_id:   storeId,
      store_name: rev.store_name,
      insights:   generateStoreInsights(input),
    });
  }

  // Sort: stores with more issues first
  allInsights.sort((a, b) => b.insights.length - a.insights.length);

  return {
    stores: allInsights,
    summary: {
      stores_with_waste_warning: wasteData.filter((w: any) => Number(w.waste_rate_pct) > 5).length,
    },
    period: { month: m, year: y },
  };
}

/* -------------------------------------------------------------------
   REVENUE TREND - Doanh thu ky hien tai vs ky truoc (MoM/WoW)
   Dung conditional aggregation trong 1 query duy nhat.
   Tra ve: per-store + chain totals + % change + prev period dates.
   ------------------------------------------------------------------- */
export async function getRevenueTrend(
  storeIds?: number[],
  dateFrom?: string,
  dateTo?: string,
) {
  // Default: current month
  if (!dateFrom || !dateTo) {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    dateFrom = `${y}-${m}-01`;
    dateTo   = `${y}-${m}-${String(last).padStart(2, "0")}`;
  }
  const { prevFrom, prevTo } = computePrevPeriod(dateFrom, dateTo);
  const { clause: storeClause, params: storeParams } = getStoreFilter(storeIds);
  const periodStart = prevFrom < dateFrom ? prevFrom : dateFrom;
  const periodEnd = prevTo > dateTo ? prevTo : dateTo;

  const base = storeParams.length;
  const allParams: any[] = [
    ...storeParams,
    dateFrom,
    dateTo,
    prevFrom,
    prevTo,
    periodStart,
    periodEnd,
  ];
  // param indices (1-based)
  const [pF, pT, ppF, ppT, pMin, pMax] = [
    base + 1,
    base + 2,
    base + 3,
    base + 4,
    base + 5,
    base + 6,
  ];
  const orderStoreFilter =
    storeParams.length > 0
      ? `AND o.store_id IN (${storeParams.map((_, index) => `$${index + 1}`).join(",")})`
      : "";

  const q = `
    WITH filtered_orders AS (
      SELECT
        o.store_id,
        SUM(CASE
          WHEN o.completed_at >= $${pF}::date
            AND o.completed_at <  ($${pT}::date + interval '1 day')
          THEN o.final_amount ELSE 0
        END)::numeric AS revenue_cur,
        SUM(CASE
          WHEN o.completed_at >= $${ppF}::date
            AND o.completed_at <  ($${ppT}::date + interval '1 day')
          THEN o.final_amount ELSE 0
        END)::numeric AS revenue_prev
      FROM orders o
      WHERE o.status = 'completed'
        AND o.completed_at >= $${pMin}::date
        AND o.completed_at <  ($${pMax}::date + interval '1 day')
        ${orderStoreFilter}
      GROUP BY o.store_id
    )
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      COALESCE(fo.revenue_cur, 0)::numeric AS revenue_cur,
      COALESCE(fo.revenue_prev, 0)::numeric AS revenue_prev
    FROM stores s
    LEFT JOIN filtered_orders fo ON fo.store_id = s.id
    ${storeClause}
    ORDER BY s.name
  `;

  const rows = (await pool.query(q, allParams)).rows.map((row: any) => {
    const cur  = Number(row.revenue_cur);
    const prev = Number(row.revenue_prev);
    return {
      store_id:    row.store_id,
      store_name:  row.store_name,
      revenue_cur: cur,
      revenue_prev: prev,
      change_pct:  prev > 0 ? parseFloat(((cur - prev) / prev * 100).toFixed(1)) : null,
    };
  });

  const chainCur  = rows.reduce((s: number, r: any) => s + r.revenue_cur,  0);
  const chainPrev = rows.reduce((s: number, r: any) => s + r.revenue_prev, 0);

  return {
    stores: rows,
    chain: {
      revenue_cur:  chainCur,
      revenue_prev: chainPrev,
      change_pct:   chainPrev > 0 ? parseFloat(((chainCur - chainPrev) / chainPrev * 100).toFixed(1)) : null,
    },
    period: { dateFrom, dateTo, prevFrom, prevTo },
  };
}

/* -------------------------------------------------------------------
   WASTE TREND - Chi phi huy hang ky hien tai vs ky truoc (MoM/WoW)
   ------------------------------------------------------------------- */
export async function getWasteTrend(
  storeIds?: number[],
  dateFrom?: string,
  dateTo?: string,
) {
  if (!dateFrom || !dateTo) {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    dateFrom = `${y}-${m}-01`;
    dateTo   = `${y}-${m}-${String(last).padStart(2, "0")}`;
  }
  const { prevFrom, prevTo } = computePrevPeriod(dateFrom, dateTo);
  const { clause: storeClause, params: storeParams } = getStoreFilter(storeIds);
  const periodStart = prevFrom < dateFrom ? prevFrom : dateFrom;
  const periodEnd = prevTo > dateTo ? prevTo : dateTo;

  const base = storeParams.length;
  const allParams: any[] = [
    ...storeParams,
    dateFrom,
    dateTo,
    prevFrom,
    prevTo,
    periodStart,
    periodEnd,
  ];
  const [pF, pT, ppF, ppT, pMin, pMax] = [
    base + 1,
    base + 2,
    base + 3,
    base + 4,
    base + 5,
    base + 6,
  ];
  const wasteStoreFilter =
    storeParams.length > 0
      ? `AND wr.store_id IN (${storeParams.map((_, index) => `$${index + 1}`).join(",")})`
      : "";

  const q = `
    WITH filtered_waste AS (
      SELECT
        wr.store_id,
        SUM(CASE
          WHEN wr.created_at >= $${pF}::date
            AND wr.created_at <  ($${pT}::date + interval '1 day')
          THEN wi.quantity * COALESCE(i.cost_per_storage_unit, 0) ELSE 0
        END)::numeric AS waste_cost_cur,
        SUM(CASE
          WHEN wr.created_at >= $${ppF}::date
            AND wr.created_at <  ($${ppT}::date + interval '1 day')
          THEN wi.quantity * COALESCE(i.cost_per_storage_unit, 0) ELSE 0
        END)::numeric AS waste_cost_prev,
        COUNT(DISTINCT CASE
          WHEN wr.created_at >= $${pF}::date
            AND wr.created_at <  ($${pT}::date + interval '1 day')
          THEN wr.id
        END)::int AS waste_reports_cur
      FROM waste_reports wr
      JOIN waste_items wi ON wi.waste_report_id = wr.id
      LEFT JOIN ingredients i ON i.id = wi.ingredient_id
      WHERE wr.created_at >= $${pMin}::date
        AND wr.created_at <  ($${pMax}::date + interval '1 day')
        ${wasteStoreFilter}
      GROUP BY wr.store_id
    )
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      COALESCE(fw.waste_cost_cur, 0)::numeric AS waste_cost_cur,
      COALESCE(fw.waste_cost_prev, 0)::numeric AS waste_cost_prev,
      COALESCE(fw.waste_reports_cur, 0)::int AS waste_reports_cur
    FROM stores s
    LEFT JOIN filtered_waste fw ON fw.store_id = s.id
    ${storeClause}
    ORDER BY s.name
  `;

  const rows = (await pool.query(q, allParams)).rows.map((row: any) => {
    const cur  = Number(row.waste_cost_cur);
    const prev = Number(row.waste_cost_prev);
    return {
      store_id:        row.store_id,
      store_name:      row.store_name,
      waste_cost_cur:  cur,
      waste_cost_prev: prev,
      waste_reports_cur: Number(row.waste_reports_cur),
      change_pct:      prev > 0 ? parseFloat(((cur - prev) / prev * 100).toFixed(1)) : null,
    };
  });

  const chainCur  = rows.reduce((s: number, r: any) => s + r.waste_cost_cur,  0);
  const chainPrev = rows.reduce((s: number, r: any) => s + r.waste_cost_prev, 0);

  return {
    stores: rows,
    chain: {
      waste_cost_cur:  chainCur,
      waste_cost_prev: chainPrev,
      change_pct:      chainPrev > 0 ? parseFloat(((chainCur - chainPrev) / chainPrev * 100).toFixed(1)) : null,
    },
    period: { dateFrom, dateTo, prevFrom, prevTo },
  };
}

/* -------------------------------------------------------------------
   COMPLAINT ALERTS - Dem ticket open + phan cum priority
   Tra ve: tong open, high-priority, danh sach can xu ly.
   ------------------------------------------------------------------- */
export async function getComplaintAlerts(storeIds?: number[]) {
  const { clause, params } = getStoreFilter(storeIds);
  const q = `
    SELECT
      COUNT(*) FILTER (WHERE ct.status = 'open')                          AS total_open,
      COUNT(*) FILTER (WHERE ct.status = 'open' AND ct.priority = 'high') AS high_open,
      COUNT(*) FILTER (WHERE ct.status = 'open' AND ct.priority = 'medium') AS medium_open,
      COUNT(*) FILTER (WHERE ct.status != 'open')                         AS resolved
    FROM customer_tickets ct
    JOIN stores s ON s.id = ct.store_id
    ${clause}
  `;
  const row = (await pool.query(q, params)).rows[0];
  return {
    total_open:   Number(row.total_open),
    high_open:    Number(row.high_open),
    medium_open:  Number(row.medium_open),
    resolved:     Number(row.resolved),
  };
}
