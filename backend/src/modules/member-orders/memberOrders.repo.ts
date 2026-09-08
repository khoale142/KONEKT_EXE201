import { pool } from "../../config/db";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  gateway: "Thanh toán online",
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
};

export async function listOrdersByCustomer(params: {
  customerId: number;
  statuses?: string[];
  storeId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const { customerId, statuses = [], storeId, dateFrom, dateTo, limit = 50, offset = 0 } = params;

  const values: unknown[] = [customerId];
  const whereParts: string[] = ["o.customer_id = $1"];

  if (statuses.length > 0) {
    values.push(statuses);
    whereParts.push(`o.status = ANY($${values.length}::order_status_enum[])`);
  }
  if (storeId != null) {
    values.push(storeId);
    whereParts.push(`o.store_id = $${values.length}`);
  }
  if (dateFrom) {
    values.push(dateFrom);
    whereParts.push(`o.created_at::date >= $${values.length}::date`);
  }
  if (dateTo) {
    values.push(dateTo);
    whereParts.push(`o.created_at::date <= $${values.length}::date`);
  }

  values.push(limit, offset);
  const limitParam = values.length - 1;
  const offsetParam = values.length;

  const sql = `
    SELECT
      o.id,
      o.store_id,
      o.order_code,
      o.status,
      o.created_at::text AS created_at,
      o.completed_at::text AS completed_at,
      o.pickup_number,
      o.final_amount,
      s.name AS store_name,
      (SELECT op.method FROM coffee_chain_db.order_payments op WHERE op.order_id = o.id ORDER BY op.id LIMIT 1) AS payment_method
    FROM coffee_chain_db.orders o
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE ${whereParts.join(" AND ")}
    ORDER BY o.created_at DESC
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
  `;

  const r = await pool.query(sql, values);
  return r.rows.map((row: any) => ({
    ...row,
    payment_method_label:
      PAYMENT_METHOD_LABEL[String(row.payment_method || "").toLowerCase()] || String(row.payment_method || "—"),
  }));
}

export async function getOrderByIdForCustomer(params: {
  orderId: number;
  customerId: number;
}) {
  const { orderId, customerId } = params;

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
        o.created_at::text AS created_at,
        o.completed_at::text AS completed_at,
        o.pickup_number,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.order_payments op
          WHERE op.order_id = o.id
            AND op.method = 'gateway'
        ) AS has_gateway_payment,
        s.name AS store_name,
        s.address AS store_address
      FROM coffee_chain_db.orders o
      LEFT JOIN stores s ON s.id = o.store_id
      WHERE o.id = $1 AND o.customer_id = $2
    `,
    [orderId, customerId]
  );

  if (r.rows.length === 0) return null;
  return r.rows[0];
}

export async function getOrderDetails(orderId: number) {
  const r = await pool.query(
    `
      SELECT
        od.id,
        od.product_variant_id,
        od.quantity,
        od.unit_price,
        od.note,
        p.name AS product_name,
        pv.size AS variant_size
      FROM coffee_chain_db.order_details od
      LEFT JOIN coffee_chain_db.product_variants pv ON pv.id = od.product_variant_id
      LEFT JOIN coffee_chain_db.products p ON p.id = pv.product_id
      WHERE od.order_id = $1
      ORDER BY od.id
    `,
    [orderId]
  );
  return r.rows;
}

export async function getOrderPayments(orderId: number) {
  const r = await pool.query(
    `
      SELECT
        method,
        amount,
        reference_code,
        paid_at::text AS paid_at
      FROM coffee_chain_db.order_payments
      WHERE order_id = $1
      ORDER BY id
    `,
    [orderId]
  );
  return r.rows;
}

export async function getOrderRewardSummary(orderId: number, customerId: number) {
  const r = await pool.query(
    `
      SELECT
        COALESCE(
          (
            SELECT SUM(points_change)::int
            FROM coffee_chain_db.customer_point_transactions
            WHERE order_id = $1
              AND customer_id = $2
              AND points_change > 0
          ),
          0
        ) AS earned_points,
        COALESCE(
          (
            SELECT points::int
            FROM coffee_chain_db.customers
            WHERE id = $2
          ),
          0
        ) AS points_balance
    `,
    [orderId, customerId]
  );
  return r.rows[0] ?? { earned_points: 0, points_balance: 0 };
}

export async function getOrderDiscountApplications(orderId: number) {
  const r = await pool.query(
    `
      SELECT source_type, source_code, source_name, discount_amount_applied
      FROM coffee_chain_db.order_discount_applications
      WHERE order_id = $1
      ORDER BY id
    `,
    [orderId]
  );
  return r.rows;
}

export async function getOrderReviewByCustomer(orderId: number, customerId: number) {
  const params = [orderId, customerId];
  const extendedSql = `
    SELECT id, order_id, customer_id, rating, comment,
           service_rating, food_rating, created_at, updated_at
    FROM coffee_chain_db.order_reviews
    WHERE order_id = $1 AND customer_id = $2
    LIMIT 1
  `;
  const legacySql = `
    SELECT id, order_id, customer_id, rating, comment, created_at
    FROM coffee_chain_db.order_reviews
    WHERE order_id = $1 AND customer_id = $2
    LIMIT 1
  `;

  try {
    const r = await pool.query(extendedSql, params);
    return r.rows[0] ?? null;
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : "";
    if (code !== "42703") throw e;
    const r = await pool.query(legacySql, params);
    return r.rows[0] ?? null;
  }
}

export async function upsertOrderReview(params: {
  orderId: number;
  customerId: number;
  rating: number;
  comment: string;
  serviceRating: number;
  foodRating: number;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.order_reviews (
        order_id, customer_id, rating, comment, service_rating, food_rating
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (order_id, customer_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        service_rating = EXCLUDED.service_rating,
        food_rating = EXCLUDED.food_rating,
        updated_at = NOW()
      RETURNING id, order_id, customer_id, rating, comment, service_rating, food_rating, created_at, updated_at
    `,
    [
      params.orderId,
      params.customerId,
      params.rating,
      (params.comment || "").trim(),
      params.serviceRating,
      params.foodRating,
    ]
  );
  return r.rows[0];
}

export async function countCompletedOrdersForCustomerAtStore(customerId: number, storeId: number): Promise<number> {
  const r = await pool.query(
    `
      SELECT COUNT(*)::int AS n
      FROM coffee_chain_db.orders o
      WHERE o.customer_id = $1
        AND o.store_id = $2
        AND o.status = 'completed'
    `,
    [customerId, storeId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function getLatestPendingOrderForCustomer(customerId: number) {
  const r = await pool.query(
    `
      SELECT
        o.id,
        o.store_id,
        o.order_code,
        o.status,
        o.final_amount,
        o.created_at::text AS created_at,
        s.name AS store_name,
        (
          SELECT gp.status
          FROM coffee_chain_db.gateway_payments gp
          WHERE gp.order_id = o.id
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS gateway_status,
        (
          SELECT gp.expired_at::text
          FROM coffee_chain_db.gateway_payments gp
          WHERE gp.order_id = o.id
          ORDER BY gp.created_at DESC
          LIMIT 1
        ) AS gateway_expired_at
      FROM coffee_chain_db.orders o
      LEFT JOIN stores s ON s.id = o.store_id
      WHERE o.customer_id = $1 AND o.status = 'pending'
      ORDER BY o.created_at DESC
      LIMIT 1
    `,
    [customerId]
  );
  return r.rows[0] ?? null;
}

export async function hasPendingPickupPostponeRequest(orderId: number): Promise<boolean> {
  const r = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.order_pickup_postpone_requests
      WHERE order_id = $1 AND status = 'pending'
      LIMIT 1
    `,
    [orderId]
  );
  return Boolean(r.rows[0]);
}

export async function getLatestPickupPostponeNotice(orderId: number) {
  const r = await pool.query(
    `
      SELECT
        id,
        order_id,
        customer_id,
        requested_pickup_time,
        reason,
        status,
        created_at
      FROM coffee_chain_db.order_pickup_postpone_requests
      WHERE order_id = $1
      ORDER BY
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        created_at DESC,
        id DESC
      LIMIT 1
    `,
    [orderId]
  );
  return r.rows[0] ?? null;
}

export async function insertPickupPostponeRequest(params: {
  orderId: number;
  customerId: number;
  requestedPickupTime: Date | null;
  reason: string;
}) {
  const r = await pool.query(
    `
      INSERT INTO coffee_chain_db.order_pickup_postpone_requests (
        order_id, customer_id, requested_pickup_time, reason, status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, order_id, status, requested_pickup_time, reason, created_at
    `,
    [params.orderId, params.customerId, params.requestedPickupTime, (params.reason || "").trim()]
  );
  return r.rows[0];
}

export async function listPickupPostponeRequestsForStore(storeId: number, limit: number) {
  const r = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.customer_id,
        r.requested_pickup_time,
        r.reason,
        r.status,
        r.staff_note,
        r.created_at,
        o.order_code,
        c.full_name AS customer_name
      FROM coffee_chain_db.order_pickup_postpone_requests r
      INNER JOIN coffee_chain_db.orders o ON o.id = r.order_id AND o.store_id = $1
      LEFT JOIN coffee_chain_db.customers c ON c.id = r.customer_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
      LIMIT $2
    `,
    [storeId, limit]
  );
  return r.rows;
}

export async function getPickupPostponeRequestByIdForStore(
  requestId: number,
  storeId: number
): Promise<{ id: number; order_id: number; customer_id: number; status: string } | null> {
  const r = await pool.query(
    `
      SELECT r.id, r.order_id, r.customer_id, r.status
      FROM coffee_chain_db.order_pickup_postpone_requests r
      INNER JOIN coffee_chain_db.orders o ON o.id = r.order_id AND o.store_id = $2
      WHERE r.id = $1
      LIMIT 1
    `,
    [requestId, storeId]
  );
  return r.rows[0] ?? null;
}

export async function updatePickupPostponeRequestStatus(params: {
  requestId: number;
  status: "approved" | "rejected";
  staffNote: string;
}) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.order_pickup_postpone_requests
      SET status = $2,
          staff_note = $3,
          updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING id, order_id, customer_id, status, staff_note
    `,
    [params.requestId, params.status, (params.staffNote || "").trim()]
  );
  return r.rows[0] ?? null;
}
