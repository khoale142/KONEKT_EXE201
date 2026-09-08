import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { notifyAuditReportSubmitted } from "../notifications/notifications.service";

/* ═══════════════════════════════════════════════════════════
   TYPES — chỉ giữ Financial + Inventory audit
   ═══════════════════════════════════════════════════════════ */
export type StoreAuditSummary = {
  store_id: number;
  store_name: string;
  total_revenue: number;
  total_expense: number;
  total_orders: number;
  waste_count: number;
  waste_cost: number;
  inventory_warnings: number;
  last_audit_date: string | null;
};

export type AuditFlag = {
  id: number;
  store_id: number;
  store_name: string;
  flag_type: "financial" | "inventory";
  flag_key: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  metric: Record<string, number>;
  detected_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
};

/* ── Checklist JSONB Model ── */
export type ChecklistRating = "HIGH" | "MEDIUM" | "LOW";

export type ChecklistItem = {
  criterion: string;            // Tên tiêu chí
  rating: ChecklistRating;      // Mức đánh giá
  note?: string;                // Ghi chú giải trình (bắt buộc nếu LOW)
  financial_loss?: number;      // Số tiền thất thoát (chỉ SALES)
};

export type AuditReportType = "QUALITY" | "SALES";
export type AuditReportStatus = "SUBMITTED" | "ACKNOWLEDGED_BY_SM";

export type AuditReport = {
  id: number;
  store_id: number;
  store_name: string;
  auditor_id: number;
  auditor_name: string;
  type: AuditReportType;
  checklist_data: ChecklistItem[];
  status: AuditReportStatus;
  discrepancy_note: string;
  attachment_url: string | null;
  created_at: string;
};

/* ── Tiêu chí cứng cho mỗi loại kiểm toán ── */
export const QUALITY_CRITERIA = [
  "Vệ sinh quầy pha chế",
  "Vệ sinh khu vực khách ngồi",
  "Thái độ nhân viên",
  "Đồng phục & tác phong",
  "Chất lượng đồ uống (pha chế chuẩn SOP)",
  "Bảo quản nguyên liệu",
];

export const SALES_CRITERIA = [
  "Khớp tiền mặt cuối ca",
  "Lệch kho nguyên liệu",
  "Đối chiếu đơn hàng / hệ thống POS",
  "Hàng hủy / Waste hợp lệ",
  "Chi phí vận hành trong ngưỡng",
];

/* ═══════════════════════════════════════════════════════════
   1. XEM DỮ LIỆU MỖI QUÁN — đối chiếu Doanh thu vs Chi tiêu
   ═══════════════════════════════════════════════════════════ */
export async function getStoreAuditData(
  storeId?: number,
  startDate?: string,
  endDate?: string,
) {
  // Fallback: if no dates given, default to the current month (UTC+7)
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 10);

  const sd = startDate || defaultStart;
  const ed = endDate   || defaultEnd;

  // sd / ed come as YYYY-MM-DD; convert to UTC timestamps
  // We interpret them as Asia/Ho_Chi_Minh local midnight → convert to UTC by subtracting 7h
  const sdTs = `${sd}T00:00:00+07:00`;
  const edTs = `${ed}T23:59:59+07:00`;

  const params: (string | number)[] = [sdTs, edTs];
  let storeCondition = "";
  if (storeId) {
    params.push(storeId);
    storeCondition = `WHERE s.id = $${params.length}`;
  }

  const q = `
    SELECT s.id AS store_id, s.name AS store_name,
           COALESCE(rev.revenue, 0)::numeric AS total_revenue,
           COALESCE(exp.total_expense, 0)::numeric AS total_expense,
           COALESCE(rev.order_count, 0)::int AS total_orders,
           COALESCE(waste.waste_count, 0)::int AS waste_count,
           COALESCE(waste.waste_cost, 0)::numeric AS waste_cost,
           COALESCE(inv_warn.warning_count, 0)::int AS inventory_warnings,
           ar_last.last_audit_date
    FROM stores s
    LEFT JOIN (
      SELECT store_id,
             SUM(final_amount)::numeric AS revenue,
             COUNT(*)::int AS order_count
      FROM orders
      WHERE status = 'completed'
        AND created_at >= $1::timestamptz
        AND created_at <= $2::timestamptz
      GROUP BY store_id
    ) rev ON rev.store_id = s.id
    LEFT JOIN (
      SELECT store_id, SUM(amount)::numeric AS total_expense
      FROM store_expense_rules
      WHERE effective_from_month <= $2::timestamptz::date
      GROUP BY store_id
    ) exp ON exp.store_id = s.id
    LEFT JOIN (
      SELECT wr.store_id,
             COUNT(wi.id) AS waste_count,
             SUM(wi.quantity * COALESCE(i.cost_per_storage_unit, 0)) AS waste_cost
      FROM waste_reports wr
      JOIN waste_items wi ON wi.waste_report_id = wr.id
      LEFT JOIN ingredients i ON i.id = wi.ingredient_id
      WHERE wr.created_at >= $1::timestamptz
        AND wr.created_at <= $2::timestamptz
      GROUP BY wr.store_id
    ) waste ON waste.store_id = s.id
    LEFT JOIN (
      SELECT store_id, COUNT(*)::int AS warning_count
      FROM stock_levels
      WHERE quantity < 10
      GROUP BY store_id
    ) inv_warn ON inv_warn.store_id = s.id
    LEFT JOIN LATERAL (
      SELECT store_id, MAX(created_at)::date AS last_audit_date
      FROM audit_reports
      WHERE store_id = s.id
        AND created_at >= $1::timestamptz
        AND created_at <= $2::timestamptz
      GROUP BY store_id
    ) ar_last ON TRUE
    ${storeCondition}
    ORDER BY s.name
  `;
  console.log('[getStoreAuditData] SQL:\n', q);
  console.log('[getStoreAuditData] params:', params);
  const r = await pool.query(q, params);
  return r.rows as StoreAuditSummary[];
}


/* ═══════════════════════════════════════════════════════════
   2. AUDIT FLAGS — sinh cờ cảnh báo TỰ ĐỘNG từ DB
   Cờ Tài chính: Chi > Thu trong tháng hiện tại → HIGH
   Cờ Tồn kho:  Nguyên liệu quantity < 10       → MEDIUM
   ═══════════════════════════════════════════════════════════ */
export async function getAuditFlags(storeId?: number): Promise<AuditFlag[]> {
  const flags: AuditFlag[] = [];
  let flagId = 1;

  // --- CỜ TÀI CHÍNH: Chi vượt Thu theo từng store trong tháng hiện tại ---
  const financialCondition = storeId ? "AND s.id = $1" : "";
  const financialParams: any[] = storeId ? [storeId] : [];
  const financialQ = `
    SELECT
      s.id   AS store_id,
      s.name AS store_name,
      COALESCE(rev.revenue, 0)::numeric  AS revenue,
      COALESCE(exp.expense, 0)::numeric  AS expense
    FROM stores s
    LEFT JOIN (
      SELECT store_id, SUM(final_amount)::numeric AS revenue
      FROM orders
      WHERE status = 'completed'
        AND created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY store_id
    ) rev ON rev.store_id = s.id
    LEFT JOIN (
      SELECT store_id, SUM(amount)::numeric AS expense
      FROM store_expense_rules
      GROUP BY store_id
    ) exp ON exp.store_id = s.id
    WHERE 1=1 ${financialCondition}
    ORDER BY s.id
  `;
  const fRows = await pool.query(financialQ, financialParams);
  for (const row of fRows.rows) {
    const revenue = Number(row.revenue);
    const expense = Number(row.expense);
    if (expense > revenue) {
      flags.push({
        id: flagId++,
        store_id: row.store_id,
        store_name: row.store_name,
        flag_type: "financial",
        flag_key: "overspend",
        severity: "high",
        title: "Lỗ — Chi vượt Thu",
        description: `Tháng này: Doanh thu ${revenue.toLocaleString("vi-VN")}₫, Chi phí ${expense.toLocaleString("vi-VN")}₫. Chênh lệch: -${(expense - revenue).toLocaleString("vi-VN")}₫`,
        metric: { revenue, expense, gap: expense - revenue },
        detected_at: new Date().toISOString(),
        is_resolved: false,
        resolved_at: null,
        resolved_by: null,
      });
    }
  }

  // --- CỜ TỒN KHO: Nguyên liệu tồn kho < 10 (mức an toàn) ---
  const invCondition = storeId ? "AND sl.store_id = $1" : "";
  const invParams: any[] = storeId ? [storeId] : [];
  const inventoryQ = `
    SELECT
      sl.store_id,
      s.name AS store_name,
      i.id   AS ingredient_id,
      i.name AS ingredient_name,
      i.usage_unit,
      sl.quantity::numeric AS current_qty
    FROM stock_levels sl
    JOIN stores s      ON s.id = sl.store_id
    JOIN ingredients i ON i.id = sl.ingredient_id
    WHERE sl.quantity < 10
      ${invCondition}
    ORDER BY sl.quantity ASC
  `;
  const iRows = await pool.query(inventoryQ, invParams);
  for (const row of iRows.rows) {
    flags.push({
      id: flagId++,
      store_id: row.store_id,
      store_name: row.store_name,
      flag_type: "inventory",
      flag_key: `low_stock_${row.ingredient_id}`,
      severity: Number(row.current_qty) <= 0 ? "high" : "medium",
      title: `Tồn kho thấp: ${row.ingredient_name}`,
      description: `${row.ingredient_name} tại ${row.store_name} còn ${Number(row.current_qty)} ${row.usage_unit || "đơn vị"} (< 10 — mức an toàn)`,
      metric: { current_qty: Number(row.current_qty), ingredient_id: row.ingredient_id },
      detected_at: new Date().toISOString(),
      is_resolved: false,
      resolved_at: null,
      resolved_by: null,
    });
  }

  // ── Cross-ref với audit_flags_resolved để đánh dấu đã xử lý ──
  const resolvedQ = `SELECT store_id, flag_type, flag_key, resolved_by, resolved_at FROM audit_flags_resolved`;
  const resolvedRows = await pool.query(resolvedQ);
  const resolvedMap = new Map(
    resolvedRows.rows.map((r: any) => [`${r.store_id}|${r.flag_type}|${r.flag_key}`, r]),
  );
  for (const flag of flags) {
    const resolved = resolvedMap.get(`${flag.store_id}|${flag.flag_type}|${flag.flag_key}`);
    if (resolved) {
      flag.is_resolved = true;
      flag.resolved_by = resolved.resolved_by;
      flag.resolved_at = resolved.resolved_at;
    }
  }

  return flags;
}

/** Resolve dynamic flag — UPSERT vào audit_flags_resolved */
export async function resolveFlag(
  storeId: number,
  flagType: string,
  flagKey: string,
  resolvedBy: string,
) {
  const q = `
    INSERT INTO audit_flags_resolved (store_id, flag_type, flag_key, resolved_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (store_id, flag_type, flag_key) DO NOTHING
    RETURNING *
  `;
  await pool.query(q, [storeId, flagType, flagKey, resolvedBy]);
  return { store_id: storeId, flag_type: flagType, flag_key: flagKey, resolved_by: resolvedBy, resolved_at: new Date().toISOString() };
}

/* ═══════════════════════════════════════════════════════════
   3. AUDIT REPORTS — Báo cáo kiểm toán (FINANCIAL / INVENTORY)
   ═══════════════════════════════════════════════════════════ */
export async function getAuditReports(opts?: { storeId?: number; storeIds?: number[] }) {
  const clauses: string[] = [];
  const params: any[] = [];
  let idx = 1;

  // Single store filter (query param)
  if (opts?.storeId) {
    clauses.push(`ar.store_id = $${idx++}`);
    params.push(opts.storeId);
  }
  // Multi-store filter (SM data isolation — from JWT storeIds)
  else if (opts?.storeIds?.length) {
    // Dùng placeholder riêng cho từng storeId để tránh vấn đề array casting
    const placeholders = opts.storeIds.map((id) => {
      params.push(Number(id));
      return `$${idx++}`;
    });
    clauses.push(`ar.store_id IN (${placeholders.join(", ")})`);
  }

  const condition = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const q = `
    SELECT ar.id, ar.store_id, s.name AS store_name,
           ar.auditor_id,
           COALESCE(u.full_name, 'Auditor') AS auditor_name,
           ar.type, ar.checklist_data, ar.status,
           ar.discrepancy_note,
           ar.attachment_url,
           ar.created_at
    FROM audit_reports ar
    JOIN stores s ON s.id = ar.store_id
    LEFT JOIN users u ON u.id = ar.auditor_id
    ${condition}
    ORDER BY ar.created_at DESC
  `;
  const r = await pool.query(q, params);
  return r.rows as AuditReport[];
}

export async function createAuditReport(data: {
  store_id: number;
  auditor_id: number;
  auditorName?: string;
  type: AuditReportType;
  checklist_data: ChecklistItem[];
  discrepancy_note: string;
  attachment_url?: string | null;
}) {
  const q = `
    INSERT INTO audit_reports (store_id, auditor_id, type, checklist_data, discrepancy_note, attachment_url)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    RETURNING *
  `;
  const r = await pool.query(q, [
    data.store_id,
    data.auditor_id,
    data.type,
    JSON.stringify(data.checklist_data),
    data.discrepancy_note,
    data.attachment_url || null,
  ]);
  const report = r.rows[0] as AuditReport;

  // Gửi thông báo cho Store Manager của cửa hàng (non-blocking)
  if (data.auditorName) {
    (async () => {
      try {
        const [mgrRes, storeRes] = await Promise.all([
          pool.query(
            `SELECT u.id FROM user_stores us
             JOIN users u ON u.id = us.user_id AND u.is_active = TRUE
             JOIN roles r ON r.id = u.role_id AND r.name = 'store_manager'
             WHERE us.store_id = $1`,
            [data.store_id],
          ),
          pool.query(`SELECT name FROM stores WHERE id = $1`, [data.store_id]),
        ]);
        const storeName: string = storeRes.rows[0]?.name || String(data.store_id);
        await Promise.all(
          mgrRes.rows.map((m: { id: number }) =>
            notifyAuditReportSubmitted({
              managerUserId: m.id,
              auditorName: data.auditorName!,
              storeId: data.store_id,
              storeName,
              reportId: report.id,
              reportType: data.type,
            }),
          ),
        );
      } catch {
        // Thông báo thất bại không ảnh hưởng response chính
      }
    })();
  }

  return report;
}

/* ═══════════════════════════════════════════════════════════
   4. ACKNOWLEDGE — SM xác nhận tiếp nhận báo cáo Audit
   ═══════════════════════════════════════════════════════════ */
export async function acknowledgeReport(reportId: number, smUserId: number, smStoreIds: number[]) {
  // Lấy report + kiểm tra ownership (store_id phải nằm trong storeIds của SM)
  const check = await pool.query(
    `SELECT id, store_id, status FROM audit_reports WHERE id = $1`,
    [reportId],
  );
  if (check.rowCount === 0) throw new ApiError(404, "Báo cáo không tồn tại");

  const report = check.rows[0];
  const reportStoreId = Number(report.store_id);

  // Data isolation: SM chỉ acknowledge report thuộc store mình quản lý
  // So sánh bằng Number() để tránh lỗi strict equality string vs number
  if (!smStoreIds.map(Number).includes(reportStoreId)) {
    throw new ApiError(403, "Bạn không có quyền thao tác với báo cáo của quán khác");
  }

  // Idempotent guard: chỉ acknowledge khi đang SUBMITTED
  if (report.status !== "SUBMITTED") {
    throw new ApiError(400, "Báo cáo này đã được xác nhận trước đó");
  }

  const q = `
    UPDATE audit_reports
    SET status = 'ACKNOWLEDGED_BY_SM'
    WHERE id = $1
    RETURNING *
  `;
  const r = await pool.query(q, [reportId]);
  return r.rows[0] as AuditReport;
}
