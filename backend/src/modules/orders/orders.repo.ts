import { pool } from "../../config/db";

export async function listOrdersByStore(params: {
  storeId: number;
  statuses?: string[];
  orderType?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  requireAssignedPickup?: boolean;
}) {
  const {
    storeId,
    statuses = [],
    orderType,
    limit = 50,
    offset = 0,
    dateFrom,
    dateTo,
    requireAssignedPickup = false,
  } = params;

  const values: any[] = [storeId];
  const whereParts: string[] = [`o.store_id = $1`];

  if (statuses.length) {
    values.push(statuses);
    whereParts.push(`o.status = ANY($${values.length}::order_status_enum[])`);
  }

  if (orderType) {
    values.push(orderType);
    whereParts.push(`o.order_type = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    whereParts.push(`o.created_at >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    whereParts.push(`o.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  if (requireAssignedPickup) {
    whereParts.push(`o.pickup_number IS NOT NULL`);
  }

  values.push(limit);
  const limitParam = values.length;

  values.push(offset);
  const offsetParam = values.length;

  const sql = `
    SELECT
      o.id,
      o.store_id,
      o.order_code,
      o.status,
      o.order_type,
      o.service_mode,
      o.special_note,
      o.created_at,
      o.completed_at,
      o.pickup_number,
      o.total_amount,
      o.discount_amount,
      o.final_amount,
      o.customer_id,
      o.pos_snapshot,
      o.refunded_amount,
      o.refund_status,
      o.last_refunded_at,
      c.full_name AS customer_name,
      c.phone AS customer_phone,

      od.id AS detail_id,
      od.product_variant_id,
      od.quantity,
      od.unit_price,
      od.note AS item_note,

      pv.size AS variant_size,
      p.name AS product_name
    FROM coffee_chain_db.orders o
    LEFT JOIN coffee_chain_db.customers c
      ON c.id = o.customer_id
    LEFT JOIN coffee_chain_db.order_details od
      ON od.order_id = o.id
    LEFT JOIN coffee_chain_db.product_variants pv
      ON pv.id = od.product_variant_id
    LEFT JOIN coffee_chain_db.products p
      ON p.id = pv.product_id
    WHERE ${whereParts.join(" AND ")}
    ORDER BY o.created_at DESC, od.id ASC
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
  `;

  const r = await pool.query(sql, values);
  return r.rows;
}

export async function getOrderById(params: {
  orderId: number;
  storeId: number;
}) {
  const { orderId, storeId } = params;

  const r = await pool.query(
    `
      SELECT
        o.id,
        o.store_id,
        o.order_code,
        o.staff_id,
        o.customer_id,
        o.total_amount,
        o.discount_amount,
        o.final_amount,
        o.status,
        o.order_type,
        o.special_note,
        o.created_at,
        o.completed_at,
        o.pickup_number,
        o.notified_at,
        o.applied_customer_voucher_id,
        o.pos_snapshot,
        o.refunded_amount,
        o.refund_status,
        o.last_refunded_at,
        c.full_name AS customer_name,
        c.phone AS customer_phone,

        od.id AS detail_id,
        od.product_variant_id,
        od.quantity,
        od.unit_price,
        od.note AS item_note,

        pv.size AS variant_size,
        p.name AS product_name
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.customers c
        ON c.id = o.customer_id
      LEFT JOIN coffee_chain_db.order_details od
        ON od.order_id = o.id
      LEFT JOIN coffee_chain_db.product_variants pv
        ON pv.id = od.product_variant_id
      LEFT JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      WHERE o.id = $1
        AND o.store_id = $2
      ORDER BY od.id ASC
    `,
    [orderId, storeId]
  );

  return r.rows;
}

export async function getOrderPayments(params: {
  orderId: number;
}) {
  const { orderId } = params;

  const r = await pool.query(
    `
      SELECT
        id,
        order_id,
        method,
        amount,
        reference_code,
        paid_at
      FROM coffee_chain_db.order_payments
      WHERE order_id = $1
      ORDER BY id ASC
    `,
    [orderId]
  );

  return r.rows;
}

export async function searchPaidOrdersByStore(params: {
  storeId: number;
  orderCode?: string;
  pickupNumber?: number;
  memberPhone?: string;
  refundStatus?: "none" | "partial" | "full";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [params.storeId];
  const whereParts: string[] = [
    `o.store_id = $1`,
    `o.status = ANY(ARRAY['paid','completed']::order_status_enum[])`,
  ];

  if (params.orderCode) {
    values.push(params.orderCode.trim());
    whereParts.push(`o.order_code ILIKE '%' || $${values.length} || '%'`);
  }

  if (params.pickupNumber != null) {
    values.push(params.pickupNumber);
    whereParts.push(`o.pickup_number = $${values.length}`);
  }

  if (params.memberPhone) {
    values.push(params.memberPhone.trim());
    whereParts.push(`COALESCE(c.phone, '') ILIKE '%' || $${values.length} || '%'`);
  }

  if (params.refundStatus) {
    values.push(params.refundStatus);
    whereParts.push(`COALESCE(o.refund_status, 'none') = $${values.length}`);
  }

  if (params.dateFrom) {
    values.push(params.dateFrom);
    whereParts.push(`o.created_at >= $${values.length}::date`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    whereParts.push(`o.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        o.id,
        o.store_id,
        o.order_code,
        o.status,
        o.created_at,
        o.completed_at,
        o.pickup_number,
        o.final_amount,
        o.customer_id,
        o.refunded_amount,
        o.refund_status,
        o.last_refunded_at,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        p.paid_at AS latest_paid_at
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.customers c
        ON c.id = o.customer_id
      LEFT JOIN LATERAL (
        SELECT op.paid_at
        FROM coffee_chain_db.order_payments op
        WHERE op.order_id = o.id
        ORDER BY op.paid_at DESC, op.id DESC
        LIMIT 1
      ) p ON TRUE
      WHERE ${whereParts.join(" AND ")}
      ORDER BY COALESCE(p.paid_at, o.created_at) DESC, o.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return r.rows;
}

export async function getNextPickupNumberForStore(storeId: number): Promise<number> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const r = await pool.query(
    `
      SELECT COALESCE(MAX(pickup_number), 0) + 1 AS next_num
      FROM coffee_chain_db.orders
      WHERE store_id = $1
        AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $2::date
    `,
    [storeId, today]
  );
  const next = Number(r.rows[0]?.next_num ?? 1);
  return Math.min(next, 999);
}

export async function getOrderRefundRows(params: { orderId: number }) {
  const r = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.store_id,
        r.refund_type,
        r.refund_status,
        r.reason,
        r.refund_amount,
        r.processed_by_user_id,
        r.created_at,
        ri.id AS refund_item_id,
        ri.order_detail_id,
        ri.quantity,
        ri.line_refund_amount
      FROM coffee_chain_db.order_refunds r
      LEFT JOIN coffee_chain_db.order_refund_items ri
        ON ri.refund_id = r.id
      WHERE r.order_id = $1
      ORDER BY r.id ASC, ri.id ASC
    `,
    [params.orderId],
  );

  return r.rows;
}

export async function listOnlinePendingOrdersForPos(params: {
  storeId: number;
  orderCode?: string;
  memberPhone?: string;
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [params.storeId];
  const whereParts: string[] = [
    `o.store_id = $1`,
    `o.status = 'paid'::order_status_enum`,
    `o.pickup_number IS NULL`,
    `o.staff_id IS NULL`,
    `EXISTS (
      SELECT 1
      FROM coffee_chain_db.order_payments opx
      WHERE opx.order_id = o.id
        AND opx.method = 'gateway'
    )`,
  ];

  if (params.orderCode) {
    values.push(params.orderCode.trim());
    whereParts.push(`o.order_code ILIKE '%' || $${values.length} || '%'`);
  }

  if (params.memberPhone) {
    values.push(params.memberPhone.trim());
    whereParts.push(`COALESCE(c.phone, '') ILIKE '%' || $${values.length} || '%'`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        o.id,
        o.store_id,
        o.order_code,
        o.status,
        o.created_at,
        o.completed_at,
        o.pickup_number,
        o.final_amount,
        o.customer_id,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        p.paid_at AS latest_paid_at,
        notice.id AS pickup_delay_notice_id,
        notice.requested_pickup_time::text AS pickup_delay_expected_arrival_at,
        notice.reason AS pickup_delay_reason,
        notice.created_at::text AS pickup_delay_created_at
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.customers c
        ON c.id = o.customer_id
      LEFT JOIN LATERAL (
        SELECT op.paid_at
        FROM coffee_chain_db.order_payments op
        WHERE op.order_id = o.id
          AND op.method = 'gateway'
        ORDER BY op.paid_at DESC NULLS LAST, op.id DESC
        LIMIT 1
      ) p ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          r.id,
          r.requested_pickup_time,
          r.reason,
          r.created_at
        FROM coffee_chain_db.order_pickup_postpone_requests r
        WHERE r.order_id = o.id
        ORDER BY
          CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
          r.created_at DESC,
          r.id DESC
        LIMIT 1
      ) notice ON TRUE
      WHERE ${whereParts.join(" AND ")}
      ORDER BY COALESCE(p.paid_at, o.created_at) DESC, o.id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return r.rows;
}

export async function listPickupBoardOrdersByStore(params: {
  storeId: number;
  limit?: number;
}) {
  const r = await pool.query(
    `
      SELECT
        o.id,
        o.order_code,
        o.pickup_number,
        o.status,
        o.created_at,
        o.completed_at
      FROM coffee_chain_db.orders o
      WHERE o.store_id = $1
        AND o.pickup_number IS NOT NULL
        AND o.status IN ('paid', 'completed')
        AND COALESCE(o.completed_at, o.created_at) >= ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - INTERVAL '1 day')
      ORDER BY
        CASE WHEN o.status = 'completed' THEN 0 ELSE 1 END,
        COALESCE(o.completed_at, o.created_at) DESC,
        o.pickup_number ASC
      LIMIT $2
    `,
    [params.storeId, params.limit ?? 80],
  );

  return r.rows;
}
