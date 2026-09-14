import { pool } from "../../config/db";

/**
 * 1. Tìm phiên ca đang mở của Store thuộc Tenant (Multi-tenant isolated)
 */
export async function findOpenReconciliationByStore(tenantId: number, storeId: number) {
  const r = await pool.query(
    `
      SELECT 
        s.id,
        s.tenant_id,
        s.store_id,
        s.membership_id AS opened_membership_id,
        s.id AS shift_session_id,
        TO_CHAR(s.opened_at, 'YYYY-MM-DD') AS work_date,
        COALESCE(s.shift_code, 'A') AS shift_code,
        s.opened_at AS scheduled_start_at,
        s.opened_at + INTERVAL '16 hours' AS scheduled_end_at,
        COALESCE(s.opening_cash, 0)::numeric AS opening_cash_amount,
        COALESCE(s.expected_cash, 0)::numeric AS expected_cash_amount,
        0::numeric AS expected_transfer_amount,
        COALESCE(s.total_sales, 0)::numeric AS expected_total_amount,
        s.closing_cash AS actual_cash_amount,
        COALESCE(s.cash_difference, 0)::numeric AS variance_cash_amount,
        COALESCE(s.total_orders, 0)::int AS total_orders,
        0::int AS cash_order_count,
        0::int AS transfer_order_count,
        s.opened_at AS started_at,
        s.closed_at,
        s.user_id AS opened_by,
        s.user_id AS closed_by,
        s.status,
        s.notes AS note,
        s.opened_at AS created_at,
        s.opened_at AS updated_at
      FROM public.shift_sessions s
      WHERE s.tenant_id = $1
        AND s.store_id = $2
        AND s.status = 'open'
      ORDER BY s.opened_at DESC
      LIMIT 1
    `,
    [tenantId, storeId]
  );

  return r.rows[0] || null;
}

/**
 * 2. Lấy thông tin chi tiết của 1 phiên ca theo ID
 */
export async function getReconciliationById(params: {
  id: number;
  tenantId: number;
  storeId?: number;
}) {
  const values: any[] = [params.id, params.tenantId];
  let sql = `
    SELECT 
      s.id,
      s.tenant_id,
      s.store_id,
      s.membership_id AS opened_membership_id,
      s.id AS shift_session_id,
      TO_CHAR(s.opened_at, 'YYYY-MM-DD') AS work_date,
      COALESCE(s.shift_code, 'A') AS shift_code,
      s.opened_at AS scheduled_start_at,
      s.opened_at + INTERVAL '16 hours' AS scheduled_end_at,
      COALESCE(s.opening_cash, 0)::numeric AS opening_cash_amount,
      COALESCE(s.expected_cash, 0)::numeric AS expected_cash_amount,
      0::numeric AS expected_transfer_amount,
      COALESCE(s.total_sales, 0)::numeric AS expected_total_amount,
      s.closing_cash AS actual_cash_amount,
      COALESCE(s.cash_difference, 0)::numeric AS variance_cash_amount,
      COALESCE(s.total_orders, 0)::int AS total_orders,
      0::int AS cash_order_count,
      0::int AS transfer_order_count,
      s.opened_at AS started_at,
      s.closed_at,
      s.user_id AS opened_by,
      s.user_id AS closed_by,
      s.status,
      s.notes AS note,
      s.opened_at AS created_at,
      s.opened_at AS updated_at
    FROM public.shift_sessions s
    WHERE s.id = $1
      AND s.tenant_id = $2
  `;

  if (params.storeId != null) {
    values.push(params.storeId);
    sql += ` AND s.store_id = $3`;
  }

  sql += ` LIMIT 1`;

  const r = await pool.query(sql, values);
  return r.rows[0] || null;
}

/**
 * 3. Tạo mới một phiên mở ca bán hàng (Strictly Multi-Tenant)
 */
export async function createReconciliation(params: {
  tenantId: number;
  storeId: number;
  shiftSessionId?: number | null;
  workDate: string;
  shiftCode: "A" | "B";
  scheduledStartAt: string;
  scheduledEndAt: string;
  openingCashAmount: number;
  openedBy?: number | null;
  membershipId?: number | null;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      INSERT INTO public.shift_sessions (
        tenant_id,
        store_id,
        user_id,
        membership_id,
        status,
        shift_code,
        opening_cash,
        total_sales,
        total_orders,
        notes,
        opened_at
      )
      VALUES ($1, $2, $3, $4, 'open', $5, $6, 0, 0, $7, NOW())
      RETURNING
        id,
        tenant_id,
        store_id,
        membership_id AS opened_membership_id,
        id AS shift_session_id,
        TO_CHAR(opened_at, 'YYYY-MM-DD') AS work_date,
        shift_code,
        opened_at AS scheduled_start_at,
        opened_at + INTERVAL '16 hours' AS scheduled_end_at,
        opening_cash AS opening_cash_amount,
        0::numeric AS expected_cash_amount,
        0::numeric AS expected_transfer_amount,
        0::numeric AS expected_total_amount,
        NULL::numeric AS actual_cash_amount,
        0::numeric AS variance_cash_amount,
        0::int AS total_orders,
        0::int AS cash_order_count,
        0::int AS transfer_order_count,
        user_id AS opened_by,
        user_id AS closed_by,
        notes AS note,
        opened_at AS started_at,
        closed_at,
        status,
        opened_at AS created_at,
        opened_at AS updated_at
    `,
    [
      params.tenantId,
      params.storeId,
      params.openedBy ?? null,
      params.membershipId ?? null,
      params.shiftCode,
      params.openingCashAmount,
      params.note ?? null,
    ]
  );

  return r.rows[0];
}

/**
 * 4. Đóng phiên ca và cập nhật kết quả kiểm két
 */
export async function closeReconciliation(params: {
  id: number;
  tenantId: number;
  storeId: number;
  closedBy?: number | null;
  actualCashAmount: number;
  expectedCashAmount: number;
  expectedTransferAmount: number;
  expectedTotalAmount: number;
  varianceCashAmount: number;
  totalOrders: number;
  cashOrderCount: number;
  transferOrderCount: number;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      UPDATE public.shift_sessions
      SET
        closing_cash = $4,
        expected_cash = $5,
        cash_difference = $6,
        total_sales = $7,
        total_orders = $8,
        notes = COALESCE($9, notes),
        closed_at = NOW(),
        status = 'closed'
      WHERE id = $1
        AND tenant_id = $2
        AND store_id = $3
      RETURNING
        id,
        tenant_id,
        store_id,
        membership_id AS opened_membership_id,
        id AS shift_session_id,
        TO_CHAR(opened_at, 'YYYY-MM-DD') AS work_date,
        COALESCE(shift_code, 'A') AS shift_code,
        opened_at AS scheduled_start_at,
        opened_at + INTERVAL '16 hours' AS scheduled_end_at,
        COALESCE(opening_cash, 0)::numeric AS opening_cash_amount,
        COALESCE(expected_cash, 0)::numeric AS expected_cash_amount,
        0::numeric AS expected_transfer_amount,
        COALESCE(total_sales, 0)::numeric AS expected_total_amount,
        closing_cash AS actual_cash_amount,
        COALESCE(cash_difference, 0)::numeric AS variance_cash_amount,
        COALESCE(total_orders, 0)::int AS total_orders,
        0::int AS cash_order_count,
        0::int AS transfer_order_count,
        opened_at AS started_at,
        closed_at,
        user_id AS opened_by,
        user_id AS closed_by,
        status,
        notes AS note,
        opened_at AS created_at,
        closed_at AS updated_at
    `,
    [
      params.id,
      params.tenantId,
      params.storeId,
      params.actualCashAmount,
      params.expectedCashAmount,
      params.varianceCashAmount,
      params.expectedTotalAmount,
      params.totalOrders,
      params.note ?? null,
    ]
  );

  return r.rows[0] || null;
}

/**
 * 5. Danh sách lịch sử các phiên ca (lọc tenant_id + store_id)
 */
export async function listReconciliations(params: {
  tenantId: number;
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  status?: "open" | "closed";
  shiftCode?: "A" | "B";
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [params.tenantId, params.storeId];
  const where: string[] = [`s.tenant_id = $1`, `s.store_id = $2`];

  if (params.status) {
    values.push(params.status);
    where.push(`s.status = $${values.length}`);
  }

  if (params.shiftCode) {
    values.push(params.shiftCode);
    where.push(`s.shift_code = $${values.length}`);
  }

  if (params.dateFrom) {
    values.push(`${params.dateFrom} 00:00:00+07`);
    where.push(`s.opened_at >= $${values.length}::timestamptz`);
  }

  if (params.dateTo) {
    values.push(`${params.dateTo} 23:59:59+07`);
    where.push(`s.opened_at <= $${values.length}::timestamptz`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;

  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT 
        s.id,
        s.tenant_id,
        s.store_id,
        s.membership_id AS opened_membership_id,
        s.id AS shift_session_id,
        TO_CHAR(s.opened_at, 'YYYY-MM-DD') AS work_date,
        COALESCE(s.shift_code, 'A') AS shift_code,
        s.opened_at AS scheduled_start_at,
        s.opened_at + INTERVAL '16 hours' AS scheduled_end_at,
        COALESCE(s.opening_cash, 0)::numeric AS opening_cash_amount,
        COALESCE(s.expected_cash, 0)::numeric AS expected_cash_amount,
        0::numeric AS expected_transfer_amount,
        COALESCE(s.total_sales, 0)::numeric AS expected_total_amount,
        s.closing_cash AS actual_cash_amount,
        COALESCE(s.cash_difference, 0)::numeric AS variance_cash_amount,
        COALESCE(s.total_orders, 0)::int AS total_orders,
        0::int AS cash_order_count,
        0::int AS transfer_order_count,
        s.opened_at AS started_at,
        s.closed_at,
        s.user_id AS opened_by,
        s.user_id AS closed_by,
        s.status,
        s.notes AS note,
        s.opened_at AS created_at,
        COALESCE(s.closed_at, s.opened_at) AS updated_at
      FROM public.shift_sessions s
      WHERE ${where.join(" AND ")}
      ORDER BY s.opened_at DESC, s.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return r.rows;
}

export async function findOpenInventoryShiftSession(_params: {
  storeId: number;
  workDate: string;
}): Promise<any | null> {
  return null;
}

/**
 * 6. Lấy metadata của Store
 */
export async function getStoreMeta(tenantId: number, storeId: number) {
  const r = await pool.query(
    `
      SELECT id, COALESCE(invite_code, 'STORE-' || id) AS code, name, address
      FROM public.stores
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
    `,
    [storeId, tenantId]
  );

  return r.rows[0] || null;
}

/**
 * 7. Thống kê tổng hợp doanh thu trong phiên ca (Multi-Tenant)
 */
export async function getReconciliationSummary(params: {
  reconciliationId: number;
  tenantId: number;
  storeId?: number;
}) {
  const values: any[] = [params.reconciliationId, params.tenantId];
  let storeFilter = "";

  if (params.storeId != null) {
    values.push(params.storeId);
    storeFilter = ` AND s.store_id = $3`;
  }

  const r = await pool.query(
    `
      WITH base AS (
        SELECT
          s.id,
          s.tenant_id,
          s.store_id,
          TO_CHAR(s.opened_at, 'YYYY-MM-DD') AS work_date,
          COALESCE(s.opening_cash, 0)::numeric AS opening_cash_amount,
          s.opened_at AS started_at,
          COALESCE(s.closed_at, NOW()) AS end_at
        FROM public.shift_sessions s
        WHERE s.id = $1
          AND s.tenant_id = $2
          ${storeFilter}
      ),

      payments_agg AS (
        SELECT
          COALESCE(COUNT(DISTINCT o.id) FILTER (
            WHERE p.method::text = 'cash' AND o.id IS NOT NULL
          ), 0)::int AS cash_order_count,

          COALESCE(COUNT(DISTINCT o.id) FILTER (
            WHERE p.method::text IN ('transfer', 'vietqr') AND o.id IS NOT NULL
          ), 0)::int AS transfer_order_count,

          COALESCE(SUM(p.amount) FILTER (
            WHERE p.method::text = 'cash' AND o.id IS NOT NULL
          ), 0)::numeric AS cash_amount,

          COALESCE(SUM(p.amount) FILTER (
            WHERE p.method::text IN ('transfer', 'vietqr') AND o.id IS NOT NULL
          ), 0)::numeric AS transfer_amount,

          0::numeric AS other_amount,
          0::int AS other_payment_count
        FROM base
        LEFT JOIN public.orders o
          ON o.tenant_id = base.tenant_id
         AND o.store_id = base.store_id
         AND o.created_at >= base.started_at
         AND o.created_at <= base.end_at
         AND o.status::text IN ('completed', 'ready', 'confirmed')
        LEFT JOIN public.payments p
          ON p.order_id = o.id
         AND p.status::text = 'paid'
      ),

      orders_agg AS (
        SELECT
          COALESCE(COUNT(*), 0)::int AS total_orders,
          COALESCE(COUNT(*), 0)::int AS normal_order_count,
          0::int AS special_order_count,
          0::int AS special_test_count,
          0::int AS special_free_count,
          0::int AS special_internal_count,
          0::int AS special_guest_count,
          0::int AS special_compensation_count,
          0::numeric AS special_value
        FROM base
        LEFT JOIN public.orders o
          ON o.tenant_id = base.tenant_id
         AND o.store_id = base.store_id
         AND o.created_at >= base.started_at
         AND o.created_at <= base.end_at
         AND o.status::text IN ('completed', 'ready', 'confirmed')
      )

      SELECT
        COALESCE(MAX(base.opening_cash_amount), 0)::numeric AS opening_cash_amount,

        payments_agg.cash_order_count,
        payments_agg.transfer_order_count,
        payments_agg.cash_amount,
        payments_agg.transfer_amount,
        payments_agg.other_amount,
        payments_agg.other_payment_count,

        orders_agg.total_orders,
        orders_agg.normal_order_count,
        orders_agg.special_order_count,
        orders_agg.special_test_count,
        orders_agg.special_free_count,
        orders_agg.special_internal_count,
        orders_agg.special_guest_count,
        orders_agg.special_compensation_count,
        orders_agg.special_value,

        0::int AS special_item_count
      FROM base
      CROSS JOIN payments_agg
      CROSS JOIN orders_agg
      GROUP BY
        payments_agg.cash_order_count,
        payments_agg.transfer_order_count,
        payments_agg.cash_amount,
        payments_agg.transfer_amount,
        payments_agg.other_amount,
        payments_agg.other_payment_count,
        orders_agg.total_orders,
        orders_agg.normal_order_count,
        orders_agg.special_order_count,
        orders_agg.special_test_count,
        orders_agg.special_free_count,
        orders_agg.special_internal_count,
        orders_agg.special_guest_count,
        orders_agg.special_compensation_count,
        orders_agg.special_value
    `,
    values
  );

  return r.rows[0] || null;
}

/**
 * 8. Danh sách thanh toán chi tiết trong ca
 */
export async function getReconciliationPayments(params: {
  reconciliationId: number;
  tenantId: number;
  storeId?: number;
}) {
  const values: any[] = [params.reconciliationId, params.tenantId];
  let storeFilter = "";

  if (params.storeId != null) {
    values.push(params.storeId);
    storeFilter = ` AND s.store_id = $3`;
  }

  const r = await pool.query(
    `
      WITH base AS (
        SELECT
          s.id,
          s.tenant_id,
          s.store_id,
          s.opened_at AS started_at,
          COALESCE(s.closed_at, NOW()) AS end_at
        FROM public.shift_sessions s
        WHERE s.id = $1
          AND s.tenant_id = $2
          ${storeFilter}
      )
      SELECT
        p.id,
        p.order_id,
        p.method::text AS method,
        p.amount,
        p.transaction_ref AS reference_code,
        p.paid_at,

        o.order_code,
        o.status::text AS order_status,
        o.id AS pickup_number,
        o.total_amount AS final_amount,
        o.cashier_id AS staff_id
      FROM base
      JOIN public.orders o
        ON o.tenant_id = base.tenant_id
       AND o.store_id = base.store_id
       AND o.created_at >= base.started_at
       AND o.created_at <= base.end_at
      JOIN public.payments p
        ON p.order_id = o.id
      ORDER BY p.paid_at DESC, p.id DESC
    `,
    values
  );

  return r.rows;
}

export async function getReconciliationSpecialOrders(_params: {
  reconciliationId: number;
  tenantId: number;
  storeId?: number;
}): Promise<any[]> {
  return [];
}
