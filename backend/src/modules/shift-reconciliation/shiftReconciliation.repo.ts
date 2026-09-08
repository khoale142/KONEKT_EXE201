import { pool } from "../../config/db";

export async function findOpenReconciliationByStore(storeId: number) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.pos_shift_reconciliations
      WHERE store_id = $1
        AND status = 'open'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [storeId]
  );

  return r.rows[0] || null;
}

export async function getReconciliationById(params: {
  id: number;
  storeId?: number;
}) {
  const values: any[] = [params.id];
  let sql = `
    SELECT *
    FROM coffee_chain_db.pos_shift_reconciliations
    WHERE id = $1
  `;

  if (params.storeId != null) {
    values.push(params.storeId);
    sql += ` AND store_id = $2`;
  }

  sql += ` LIMIT 1`;

  const r = await pool.query(sql, values);
  return r.rows[0] || null;
}

export async function createReconciliation(params: {
  storeId: number;
  shiftSessionId?: number | null;
  workDate: string;
  shiftCode: "A" | "B";
  scheduledStartAt: string;
  scheduledEndAt: string;
  openingCashAmount: number;
  openedBy?: number | null;
  note?: string | null;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.pos_shift_reconciliations(
        store_id,
        shift_session_id,
        work_date,
        shift_code,
        scheduled_start_at,
        scheduled_end_at,
        opening_cash_amount,
        opened_by,
        note
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      params.storeId,
      params.shiftSessionId ?? null,
      params.workDate,
      params.shiftCode,
      params.scheduledStartAt,
      params.scheduledEndAt,
      params.openingCashAmount,
      params.openedBy ?? null,
      params.note ?? null,
    ]
  );

  return r.rows[0];
}

export async function closeReconciliation(params: {
  id: number;
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
      UPDATE coffee_chain_db.pos_shift_reconciliations
      SET
        closed_by = $2,
        actual_cash_amount = $3,
        expected_cash_amount = $4,
        expected_transfer_amount = $5,
        expected_total_amount = $6,
        variance_cash_amount = $7,
        total_orders = $8,
        cash_order_count = $9,
        transfer_order_count = $10,
        note = COALESCE($11, note),
        closed_at = NOW(),
        status = 'closed',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      params.id,
      params.closedBy ?? null,
      params.actualCashAmount,
      params.expectedCashAmount,
      params.expectedTransferAmount,
      params.expectedTotalAmount,
      params.varianceCashAmount,
      params.totalOrders,
      params.cashOrderCount,
      params.transferOrderCount,
      params.note ?? null,
    ]
  );

  return r.rows[0] || null;
}

export async function listReconciliations(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  status?: "open" | "closed";
  shiftCode?: "A" | "B";
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [params.storeId];
  const where: string[] = [`store_id = $1`];

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`work_date >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`work_date <= $${values.length}::date`);
  }

  if (params.status) {
    values.push(params.status);
    where.push(`status = $${values.length}`);
  }

  if (params.shiftCode) {
    values.push(params.shiftCode);
    where.push(`shift_code = $${values.length}`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;

  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.pos_shift_reconciliations
      WHERE ${where.join(" AND ")}
      ORDER BY started_at DESC, id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  return r.rows;
}

export async function findOpenInventoryShiftSession(params: {
  storeId: number;
  workDate: string;
}) {
  const r = await pool.query(
    `
      SELECT *
      FROM coffee_chain_db.inventory_shift_sessions
      WHERE store_id = $1
        AND work_date = $2::date
        AND status = 'open'
      ORDER BY opened_at DESC, id DESC
      LIMIT 1
    `,
    [params.storeId, params.workDate]
  );

  return r.rows[0] || null;
}

export async function getStoreMeta(storeId: number) {
  const r = await pool.query(
    `
      SELECT id, code, name, address
      FROM coffee_chain_db.stores
      WHERE id = $1
      LIMIT 1
    `,
    [storeId]
  );

  return r.rows[0] || null;
}

export async function getReconciliationSummary(params: {
  reconciliationId: number;
  storeId?: number;
}) {
  const values: any[] = [params.reconciliationId];
  let storeFilter = "";

  if (params.storeId != null) {
    values.push(params.storeId);
    storeFilter = ` AND pr.store_id = $2`;
  }

  const r = await pool.query(
    `
      WITH base AS (
        SELECT
          pr.id,
          pr.store_id,
          pr.work_date,
          pr.opening_cash_amount,
          pr.started_at,
          COALESCE(pr.closed_at, NOW()) AS end_at
        FROM coffee_chain_db.pos_shift_reconciliations pr
        WHERE pr.id = $1
        ${storeFilter}
      ),

      payments_agg AS (
        SELECT
          COALESCE(COUNT(DISTINCT o.id) FILTER (
            WHERE op.method::text = 'cash'
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::int AS cash_order_count,

          COALESCE(COUNT(DISTINCT o.id) FILTER (
            WHERE op.method::text = 'transfer'
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::int AS transfer_order_count,

          COALESCE(SUM(op.amount) FILTER (
            WHERE op.method::text = 'cash'
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::numeric AS cash_amount,

          COALESCE(SUM(op.amount) FILTER (
            WHERE op.method::text = 'transfer'
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::numeric AS transfer_amount,

          COALESCE(SUM(op.amount) FILTER (
            WHERE op.method::text NOT IN ('cash', 'transfer')
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::numeric AS other_amount,

          COALESCE(COUNT(op.id) FILTER (
            WHERE op.method::text NOT IN ('cash', 'transfer')
              AND o.id IS NOT NULL
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::int AS other_payment_count
        FROM base
        LEFT JOIN coffee_chain_db.order_payments op
          ON op.paid_at >= base.started_at
         AND op.paid_at <= base.end_at
        LEFT JOIN coffee_chain_db.orders o
          ON o.id = op.order_id
         AND o.store_id = base.store_id
         AND o.status::text IN ('paid', 'completed')
      ),

      orders_agg AS (
        SELECT
          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
          ), 0)::int AS total_orders,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
          ), 0)::int AS normal_order_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
          ), 0)::int AS special_order_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'TEST'
          ), 0)::int AS special_test_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'FREE'
          ), 0)::int AS special_free_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'INTERNAL'
          ), 0)::int AS special_internal_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'GUEST'
          ), 0)::int AS special_guest_count,

          COALESCE(COUNT(*) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') = 'COMPENSATION'
          ), 0)::int AS special_compensation_count,

          COALESCE(SUM(o.subtotal_amount) FILTER (
            WHERE o.status::text IN ('paid', 'completed')
              AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
          ), 0)::numeric AS special_value
        FROM base
        LEFT JOIN coffee_chain_db.orders o
          ON o.store_id = base.store_id
         AND o.created_at >= base.started_at
         AND o.created_at <= base.end_at
      ),

      item_agg AS (
        SELECT
          COALESCE(SUM(od.quantity) FILTER (
            WHERE COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
          ), 0)::int AS special_item_count
        FROM base
        LEFT JOIN coffee_chain_db.orders o
          ON o.store_id = base.store_id
         AND o.created_at >= base.started_at
         AND o.created_at <= base.end_at
         AND o.status::text IN ('paid', 'completed')
        LEFT JOIN coffee_chain_db.order_details od
          ON od.order_id = o.id
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

        item_agg.special_item_count
      FROM base
      CROSS JOIN payments_agg
      CROSS JOIN orders_agg
      CROSS JOIN item_agg
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
        orders_agg.special_value,
        item_agg.special_item_count
    `,
    values
  );

  return r.rows[0] || null;
}

export async function getReconciliationPayments(params: {
  reconciliationId: number;
  storeId?: number;
}) {
  const values: any[] = [params.reconciliationId];
  let storeFilter = "";

  if (params.storeId != null) {
    values.push(params.storeId);
    storeFilter = ` AND pr.store_id = $2`;
  }

  const r = await pool.query(
    `
      WITH base AS (
        SELECT
          pr.id,
          pr.store_id,
          pr.started_at,
          COALESCE(pr.closed_at, NOW()) AS end_at
        FROM coffee_chain_db.pos_shift_reconciliations pr
        WHERE pr.id = $1
        ${storeFilter}
      )
      SELECT
        op.id,
        op.order_id,
        op.method::text AS method,
        op.amount,
        op.reference_code,
        op.paid_at,

        o.order_code,
        o.status::text AS order_status,
        o.pickup_number,
        o.final_amount,
        o.staff_id
      FROM base
      JOIN coffee_chain_db.order_payments op
        ON op.paid_at >= base.started_at
       AND op.paid_at <= base.end_at
      JOIN coffee_chain_db.orders o
        ON o.id = op.order_id
       AND o.store_id = base.store_id
       AND o.status::text IN ('paid', 'completed')
      ORDER BY op.paid_at DESC, op.id DESC
    `,
    values
  );

  return r.rows;
}

export async function getReconciliationSpecialOrders(params: {
  reconciliationId: number;
  storeId?: number;
}) {
  const values: any[] = [params.reconciliationId];
  let storeFilter = "";

  if (params.storeId != null) {
    values.push(params.storeId);
    storeFilter = ` AND pr.store_id = $2`;
  }

  const r = await pool.query(
    `
      WITH base AS (
        SELECT
          pr.id,
          pr.store_id,
          pr.started_at,
          COALESCE(pr.closed_at, NOW()) AS end_at
        FROM coffee_chain_db.pos_shift_reconciliations pr
        WHERE pr.id = $1
        ${storeFilter}
      )
      SELECT
        o.id,
        o.order_code,
        o.status::text AS order_status,
        o.pickup_number,
        o.staff_id,
        o.created_at,
        o.completed_at,
        o.subtotal_amount,
        o.final_amount,
        COALESCE(o.order_type, 'NORMAL')::text AS order_type,
        o.special_note
      FROM base
      JOIN coffee_chain_db.orders o
        ON o.store_id = base.store_id
       AND o.created_at >= base.started_at
       AND o.created_at <= base.end_at
       AND o.status::text IN ('paid', 'completed')
       AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
      ORDER BY o.created_at DESC, o.id DESC
    `,
    values
  );

  return r.rows;
}