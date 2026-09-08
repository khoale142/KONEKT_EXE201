import { pool } from "../../config/db";
import type { OrderOutreachContext, OutreachEventType } from "./orderOutreach.types";

export async function loadOrderOutreachContext(orderId: number): Promise<OrderOutreachContext | null> {
  const r = await pool.query(
    `
      SELECT
        o.id AS order_id,
        o.order_code,
        o.status::text AS status,
        o.final_amount,
        o.completed_at,
        o.customer_id,
        o.store_id,
        c.full_name AS customer_name,
        c.email AS customer_email,
        COALESCE(c.points, 0)::int AS current_points,
        s.name AS store_name,
        s.address AS store_address
      FROM coffee_chain_db.orders o
      LEFT JOIN coffee_chain_db.customers c ON c.id = o.customer_id
      LEFT JOIN coffee_chain_db.stores s ON s.id = o.store_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [orderId]
  );

  const row = r.rows[0];
  if (!row) return null;

  const customerId = Number(row.customer_id);
  if (!Number.isFinite(customerId) || customerId <= 0) return null;

  return {
    orderId: Number(row.order_id),
    orderCode: String(row.order_code || ""),
    status: String(row.status || ""),
    finalAmount: Number(row.final_amount ?? 0),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    customerId,
    customerName: String(row.customer_name || "Quý khách").trim() || "Quý khách",
    customerEmail: row.customer_email ? String(row.customer_email).trim() : null,
    currentPointsBalance: Number(row.current_points ?? 0),
    storeName: String(row.store_name || "Cửa hàng").trim() || "Cửa hàng",
    storeAddress: row.store_address ? String(row.store_address).trim() : null,
    storeId: Number(row.store_id ?? 0),
  };
}

export async function sumPositivePointsForOrder(orderId: number): Promise<number> {
  const r = await pool.query(
    `
      SELECT COALESCE(SUM(points_change), 0)::int AS pts
      FROM coffee_chain_db.customer_point_transactions
      WHERE order_id = $1
        AND points_change > 0
    `,
    [orderId]
  );
  return Number(r.rows[0]?.pts ?? 0);
}

export async function hasOutreachDelivery(orderId: number, eventType: OutreachEventType): Promise<boolean> {
  const r = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.order_outreach_deliveries
      WHERE order_id = $1 AND event_type = $2
      LIMIT 1
    `,
    [orderId, eventType]
  );
  return Boolean(r.rows[0]);
}

/** Không ném lỗi — nếu bảng chưa migrate (003), trả về false và log một lần. */
export async function safeHasOutreachDelivery(
  orderId: number,
  eventType: OutreachEventType
): Promise<boolean> {
  try {
    return await hasOutreachDelivery(orderId, eventType);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `[order-outreach] safeHasOutreachDelivery: ${msg} — chạy migration backend/migrations/003_order_outreach_deliveries.sql nếu bảng chưa tồn tại`
    );
    return false;
  }
}

export async function hasAnyPostPurchaseEmail(orderId: number): Promise<boolean> {
  const r = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.order_outreach_deliveries
      WHERE order_id = $1
        AND event_type IN ('points_earned_email', 'review_invitation_email')
      LIMIT 1
    `,
    [orderId]
  );
  return Boolean(r.rows[0]);
}

export async function safeHasAnyPostPurchaseEmail(orderId: number): Promise<boolean> {
  try {
    return await hasAnyPostPurchaseEmail(orderId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[order-outreach] safeHasAnyPostPurchaseEmail: ${msg}`);
    return false;
  }
}

export async function recordOutreachDelivery(orderId: number, eventType: OutreachEventType): Promise<void> {
  await pool.query(
    `
      INSERT INTO coffee_chain_db.order_outreach_deliveries (order_id, event_type)
      VALUES ($1, $2)
      ON CONFLICT (order_id, event_type) DO NOTHING
    `,
    [orderId, eventType]
  );
}

export async function safeRecordOutreachDelivery(
  orderId: number,
  eventType: OutreachEventType
): Promise<boolean> {
  try {
    await recordOutreachDelivery(orderId, eventType);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[order-outreach] safeRecordOutreachDelivery: ${msg}`);
    return false;
  }
}
