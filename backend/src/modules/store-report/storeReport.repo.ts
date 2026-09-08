import { pool } from "../../config/db";

export async function getStoreMeta(storeId: number) {
  const r = await pool.query(
    `
      SELECT id, code, name, address
      FROM stores
      WHERE id = $1
      LIMIT 1
    `,
    [storeId]
  );

  return r.rows[0] || null;
}

export async function getSummaryRow(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        COUNT(*)::int AS total_orders_all,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
        )::int AS recognized_orders_all,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS recognized_orders_normal,

        COUNT(*) FILTER (
          WHERE o.status::text = 'paid'
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS paid_orders_normal,

        COUNT(*) FILTER (
          WHERE o.status::text = 'completed'
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS completed_orders_normal,

        COUNT(*) FILTER (
          WHERE o.status::text = 'voided'
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS voided_orders_normal,

        COUNT(*) FILTER (
          WHERE o.status::text = 'refunded'
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS refunded_orders_normal,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        )::int AS special_orders,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'TEST'
        )::int AS special_test_orders,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'FREE'
        )::int AS special_free_orders,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'INTERNAL'
        )::int AS special_internal_orders,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'GUEST'
        )::int AS special_guest_orders,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'COMPENSATION'
        )::int AS special_compensation_orders,

        COALESCE(SUM(o.total_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        ), 0)::numeric AS gross_sales_normal,

        COALESCE(SUM(o.discount_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        ), 0)::numeric AS discount_total_normal,

        COALESCE(SUM(o.final_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        ), 0)::numeric AS net_sales_normal,

        COALESCE(SUM(o.subtotal_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        ), 0)::numeric AS special_value,

        COALESCE(SUM(o.total_discount_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        ), 0)::numeric AS special_discount_total,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NOT NULL
        )::int AS member_orders_normal,

        COALESCE(SUM(o.final_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NOT NULL
        ), 0)::numeric AS member_sales_normal,

        AVG(
          EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60.0
        ) FILTER (
          WHERE o.status::text = 'completed'
            AND o.completed_at IS NOT NULL
        )::numeric AS avg_completed_minutes_all
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
    `,
    [storeId, dateFrom, dateTo]
  );

  return r.rows[0];
}

export async function getItemsSold(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        COALESCE(SUM(od.quantity) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        ), 0)::int AS items_sold_normal,

        COALESCE(SUM(od.quantity) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        ), 0)::int AS items_sold_special,

        COALESCE(SUM(od.quantity), 0)::int AS items_sold_total
      FROM orders o
      JOIN order_details od
        ON od.order_id = o.id
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
    `,
    [storeId, dateFrom, dateTo]
  );

  return {
    itemsSoldNormal: Number(r.rows[0]?.items_sold_normal || 0),
    itemsSoldSpecial: Number(r.rows[0]?.items_sold_special || 0),
    itemsSoldTotal: Number(r.rows[0]?.items_sold_total || 0),
  };
}

export async function getStatusBreakdown(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        o.status::text AS status,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(o.final_amount), 0)::numeric AS amount
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
      GROUP BY o.status::text
      ORDER BY COUNT(*) DESC, o.status::text
    `,
    [storeId, dateFrom, dateTo]
  );

  return r.rows.map((row) => ({
    status: String(row.status),
    orderCount: Number(row.order_count),
    amount: Number(row.amount),
  }));
}

export async function getOrderTypeBreakdown(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        COALESCE(o.order_type, 'NORMAL')::text AS order_type,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(o.subtotal_amount), 0)::numeric AS subtotal_value,
        COALESCE(SUM(o.final_amount), 0)::numeric AS final_amount
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
      GROUP BY COALESCE(o.order_type, 'NORMAL')::text
      ORDER BY order_count DESC, order_type
    `,
    [storeId, dateFrom, dateTo]
  );

  return r.rows.map((row) => ({
    orderType: String(row.order_type),
    orderCount: Number(row.order_count),
    subtotalValue: Number(row.subtotal_value || 0),
    finalAmount: Number(row.final_amount || 0),
  }));
}

export async function getPaymentMix(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        op.method::text AS method,
        COUNT(*)::int AS tx_count,
        COALESCE(SUM(op.amount), 0)::numeric AS amount
      FROM order_payments op
      JOIN orders o
        ON o.id = op.order_id
      WHERE o.store_id = $1
        AND op.paid_at >= $2::date
        AND op.paid_at < ($3::date + INTERVAL '1 day')
        AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        AND o.status::text IN ('paid', 'completed')
      GROUP BY op.method::text
      ORDER BY amount DESC, op.method::text
    `,
    [storeId, dateFrom, dateTo]
  );

  return r.rows.map((row) => ({
    method: String(row.method),
    transactionCount: Number(row.tx_count),
    amount: Number(row.amount),
  }));
}

export async function getTopProducts(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
  limit?: number;
}) {
  const { storeId, dateFrom, dateTo, limit = 10 } = params;

  const r = await pool.query(
    `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COUNT(DISTINCT o.id)::int AS order_count,
        COALESCE(SUM(od.quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(od.quantity * od.unit_price), 0)::numeric AS revenue
      FROM orders o
      JOIN order_details od
        ON od.order_id = o.id
      JOIN product_variants pv
        ON pv.id = od.product_variant_id
      JOIN products p
        ON p.id = pv.product_id
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
        AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC, quantity_sold DESC, p.name
      LIMIT $4
    `,
    [storeId, dateFrom, dateTo, limit]
  );

  return r.rows.map((row) => ({
    productId: Number(row.product_id),
    productName: String(row.product_name),
    orderCount: Number(row.order_count),
    quantitySold: Number(row.quantity_sold),
    revenue: Number(row.revenue),
  }));
}

export async function getTopSpecialProducts(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
  limit?: number;
}) {
  const { storeId, dateFrom, dateTo, limit = 10 } = params;

  const r = await pool.query(
    `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COUNT(DISTINCT o.id)::int AS order_count,
        COALESCE(SUM(od.quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(od.quantity * od.unit_price), 0)::numeric AS value_amount
      FROM orders o
      JOIN order_details od
        ON od.order_id = o.id
      JOIN product_variants pv
        ON pv.id = od.product_variant_id
      JOIN products p
        ON p.id = pv.product_id
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
        AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
      GROUP BY p.id, p.name
      ORDER BY value_amount DESC, quantity_sold DESC, p.name
      LIMIT $4
    `,
    [storeId, dateFrom, dateTo, limit]
  );

  return r.rows.map((row) => ({
    productId: Number(row.product_id),
    productName: String(row.product_name),
    orderCount: Number(row.order_count),
    quantitySold: Number(row.quantity_sold),
    valueAmount: Number(row.value_amount),
  }));
}

export async function getHourlySales(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      WITH item_per_order AS (
        SELECT
          od.order_id,
          COALESCE(SUM(od.quantity), 0)::int AS item_count
        FROM order_details od
        GROUP BY od.order_id
      )
      SELECT
        EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int AS hour_of_day,

        COUNT(*) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        )::int AS normal_order_count,

        COUNT(*) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        )::int AS special_order_count,

        COUNT(*)::int AS order_count,

        COALESCE(SUM(o.final_amount) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
        ), 0)::numeric AS revenue,

        COALESCE(SUM(o.subtotal_amount) FILTER (
          WHERE COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
        ), 0)::numeric AS special_value,

        COALESCE(SUM(COALESCE(ipo.item_count, 0)), 0)::int AS total_items,

        AVG(
          EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60.0
        ) FILTER (
          WHERE o.status::text = 'completed'
            AND o.completed_at IS NOT NULL
        )::numeric AS avg_process_minutes
      FROM orders o
      LEFT JOIN item_per_order ipo
        ON ipo.order_id = o.id
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
      GROUP BY EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      ORDER BY hour_of_day
    `,
    [storeId, dateFrom, dateTo]
  );

  return r.rows.map((row) => ({
    hour: Number(row.hour_of_day),
    orderCount: Number(row.order_count),
    normalOrderCount: Number(row.normal_order_count || 0),
    specialOrderCount: Number(row.special_order_count || 0),
    revenue: Number(row.revenue),
    specialValue: Number(row.special_value || 0),
    totalItems: Number(row.total_items),
    avgProcessMinutes:
      row.avg_process_minutes != null
        ? Number(Number(row.avg_process_minutes).toFixed(2))
        : null,
  }));
}

export async function getPreparingAging(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE o.status::text = 'paid'
            AND o.created_at <= NOW() - INTERVAL '15 minutes'
        )::int AS paid_over_15m,

        COUNT(*) FILTER (
          WHERE o.status::text = 'paid'
            AND o.created_at <= NOW() - INTERVAL '30 minutes'
        )::int AS paid_over_30m
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
    `,
    [storeId, dateFrom, dateTo]
  );

  return {
    paidOver15m: Number(r.rows[0]?.paid_over_15m || 0),
    paidOver30m: Number(r.rows[0]?.paid_over_30m || 0),
  };
}

export async function getMemberSplit(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
}) {
  const { storeId, dateFrom, dateTo } = params;

  const r = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NOT NULL
        )::int AS member_orders,

        COALESCE(SUM(o.final_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NOT NULL
        ), 0)::numeric AS member_sales,

        COUNT(*) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NULL
        )::int AS guest_orders,

        COALESCE(SUM(o.final_amount) FILTER (
          WHERE o.status::text IN ('paid', 'completed')
            AND COALESCE(o.order_type, 'NORMAL') = 'NORMAL'
            AND o.customer_id IS NULL
        ), 0)::numeric AS guest_sales
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
    `,
    [storeId, dateFrom, dateTo]
  );

  return {
    memberOrders: Number(r.rows[0]?.member_orders || 0),
    memberSales: Number(r.rows[0]?.member_sales || 0),
    guestOrders: Number(r.rows[0]?.guest_orders || 0),
    guestSales: Number(r.rows[0]?.guest_sales || 0),
  };
}

export async function getSlowOrders(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
  limit?: number;
}) {
  const { storeId, dateFrom, dateTo, limit = 10 } = params;

  const r = await pool.query(
    `
      WITH item_per_order AS (
        SELECT
          od.order_id,
          COALESCE(SUM(od.quantity), 0)::int AS item_count
        FROM order_details od
        GROUP BY od.order_id
      )
      SELECT
        o.id,
        o.order_code,
        o.status::text AS status,
        o.created_at,
        o.completed_at,
        o.final_amount,
        COALESCE(o.order_type, 'NORMAL')::text AS order_type,
        o.special_note,
        COALESCE(ipo.item_count, 0)::int AS item_count,
        CASE
          WHEN o.completed_at IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (o.completed_at - o.created_at)) / 60.0, 2)
          ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60.0, 2)
        END AS process_minutes
      FROM orders o
      LEFT JOIN item_per_order ipo
        ON ipo.order_id = o.id
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
      ORDER BY process_minutes DESC, o.created_at DESC
      LIMIT $4
    `,
    [storeId, dateFrom, dateTo, limit]
  );

  return r.rows.map((row) => ({
    orderId: Number(row.id),
    orderCode: String(row.order_code),
    status: String(row.status),
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    processMinutes:
      row.process_minutes != null ? Number(row.process_minutes) : null,
    itemCount: Number(row.item_count || 0),
    finalAmount: Number(row.final_amount || 0),
    orderType: String(row.order_type || "NORMAL"),
    specialNote: row.special_note || null,
  }));
}

export async function getRecentSpecialOrders(params: {
  storeId: number;
  dateFrom: string;
  dateTo: string;
  limit?: number;
}) {
  const { storeId, dateFrom, dateTo, limit = 10 } = params;

  const r = await pool.query(
    `
      SELECT
        o.id,
        o.order_code,
        o.status::text AS status,
        o.created_at,
        o.completed_at,
        o.pickup_number,
        o.staff_id,
        COALESCE(o.order_type, 'NORMAL')::text AS order_type,
        o.special_note,
        o.subtotal_amount,
        o.final_amount
      FROM orders o
      WHERE o.store_id = $1
        AND o.created_at >= $2::date
        AND o.created_at < ($3::date + INTERVAL '1 day')
        AND o.status::text IN ('paid', 'completed')
        AND COALESCE(o.order_type, 'NORMAL') <> 'NORMAL'
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $4
    `,
    [storeId, dateFrom, dateTo, limit]
  );

  return r.rows.map((row) => ({
    orderId: Number(row.id),
    orderCode: String(row.order_code),
    status: String(row.status),
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    pickupNumber: row.pickup_number != null ? Number(row.pickup_number) : null,
    staffId: row.staff_id != null ? Number(row.staff_id) : null,
    orderType: String(row.order_type),
    specialNote: row.special_note || null,
    subtotalAmount: Number(row.subtotal_amount || 0),
    finalAmount: Number(row.final_amount || 0),
  }));
}