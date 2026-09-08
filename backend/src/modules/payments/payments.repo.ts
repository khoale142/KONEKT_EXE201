import { pool } from "../../config/db";
import type { GatewayPaymentStatus } from "./payments.types";
import { applyCustomerPointsDelta } from "../../utils/membershipLevel";

export interface InsertPaymentParams {
  order_id: number;
  provider: string;
  provider_order_id: string | null;
  request_id: string;
  amount: number;
  status: GatewayPaymentStatus;
  pay_url: string | null;
  deeplink: string | null;
  qr_code_url: string | null;
  raw_request: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  expired_at: Date | null;
}

export async function insertPayment(params: InsertPaymentParams) {
  const r = await pool.query(
    `
    INSERT INTO coffee_chain_db.gateway_payments (
      order_id, provider, provider_order_id, request_id, amount, status,
      pay_url, deeplink, qr_code_url, raw_request, raw_response, expired_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
    RETURNING id, order_id, provider, request_id, amount, status, pay_url, created_at
    `,
    [
      params.order_id,
      params.provider,
      params.provider_order_id,
      params.request_id,
      params.amount,
      params.status,
      params.pay_url,
      params.deeplink,
      params.qr_code_url,
      params.raw_request ? JSON.stringify(params.raw_request) : null,
      params.raw_response ? JSON.stringify(params.raw_response) : null,
      params.expired_at,
    ]
  );
  return r.rows[0];
}

export async function findPaymentByRequestId(requestId: string) {
  const r = await pool.query(
    `
    SELECT id, order_id, provider, provider_order_id, request_id, amount, status,
           pay_url, raw_response, paid_at, expired_at, created_at, updated_at
    FROM coffee_chain_db.gateway_payments
    WHERE request_id = $1
    LIMIT 1
    `,
    [requestId]
  );
  return r.rows[0] ?? null;
}

export async function findLatestPaymentByOrderId(orderId: number) {
  const r = await pool.query(
    `
    SELECT id, order_id, provider, provider_order_id, request_id, amount, status,
           pay_url, paid_at, expired_at, created_at, updated_at
    FROM coffee_chain_db.gateway_payments
    WHERE order_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [orderId]
  );
  return r.rows[0] ?? null;
}

/** Latest PENDING payment by order_id (for Payment Kit webhook mapping by orderCode). */
export async function findLatestPendingPaymentByOrderId(orderId: number) {
  const r = await pool.query(
    `
    SELECT id, order_id, provider, provider_order_id, request_id, amount, status
    FROM coffee_chain_db.gateway_payments
    WHERE order_id = $1 AND status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [orderId]
  );
  return r.rows[0] ?? null;
}

export async function countPendingGatewayPayments(): Promise<number> {
  const r = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM coffee_chain_db.gateway_payments
    WHERE status = 'PENDING'
    `
  );
  return Number(r.rows[0]?.total || 0);
}

/** Idempotent: chỉ update khi status khác PAID. Trả về số dòng bị update (0 hoặc 1). */
export async function updatePaymentStatusToPaid(params: {
  requestId: string;
  providerOrderId: string;
  rawResponse: Record<string, unknown>;
}) {
  const r = await pool.query(
    `
    UPDATE coffee_chain_db.gateway_payments
    SET status = 'PAID', provider_order_id = $2, raw_response = COALESCE(raw_response, '{}'::jsonb) || $3::jsonb, paid_at = NOW(), updated_at = NOW()
    WHERE request_id = $1 AND status <> 'PAID'
    RETURNING id, order_id
    `,
    [params.requestId, params.providerOrderId, JSON.stringify(params.rawResponse)]
  );
  return r.rowCount ?? 0;
}

export async function updatePaymentStatusToFailed(params: {
  requestId: string;
  rawResponse: Record<string, unknown>;
}) {
  await pool.query(
    `
    UPDATE coffee_chain_db.gateway_payments
    SET status = 'FAILED', raw_response = raw_response || $2::jsonb, updated_at = NOW()
    WHERE request_id = $1 AND status = 'PENDING'
    `,
    [params.requestId, JSON.stringify(params.rawResponse)]
  );
}

export async function settleGatewayPayment(params: {
  requestId: string;
  providerOrderId: string;
  rawResponse: Record<string, unknown>;
  expectedAmount?: number | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `
      SELECT id, order_id, amount, status
      FROM coffee_chain_db.gateway_payments
      WHERE request_id = $1
      FOR UPDATE
      `,
      [params.requestId]
    );
    const payment = paymentResult.rows[0] ?? null;
    if (!payment) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "payment_not_found" as const };
    }

    const orderResult = await client.query(
      `
      SELECT id, status, customer_id, order_code
      FROM coffee_chain_db.orders
      WHERE id = $1
      FOR UPDATE
      `,
      [payment.order_id]
    );
    const order = orderResult.rows[0] ?? null;
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "order_not_found" as const };
    }

    const orderStatus = String(order.status || "").toLowerCase();
    if (orderStatus === "voided" || orderStatus === "refunded") {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "order_not_payable" as const };
    }

    const paymentStatus = String(payment.status || "").toUpperCase();
    if (
      paymentStatus === "PAID" ||
      orderStatus === "paid" ||
      orderStatus === "completed"
    ) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "already_processed" as const };
    }

    const expectedAmount =
      params.expectedAmount == null ? null : Number(params.expectedAmount);
    if (
      expectedAmount != null &&
      Number.isFinite(expectedAmount) &&
      Number(payment.amount) !== expectedAmount
    ) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "amount_mismatch" as const };
    }

    await client.query(
      `
      UPDATE coffee_chain_db.gateway_payments
      SET status = 'PAID',
          provider_order_id = $2,
          raw_response = COALESCE(raw_response, '{}'::jsonb) || $3::jsonb,
          paid_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [payment.id, params.providerOrderId, JSON.stringify(params.rawResponse)]
    );

    await client.query(
      `
      UPDATE coffee_chain_db.orders
      SET status = 'paid'
      WHERE id = $1
      `,
      [payment.order_id]
    );

    await client.query(
      `
      INSERT INTO coffee_chain_db.order_payments (order_id, method, amount, reference_code, paid_at)
      VALUES ($1, 'gateway', $2, $3, NOW())
      `,
      [payment.order_id, payment.amount, params.providerOrderId]
    );

    const customerId =
      order.customer_id != null ? Number(order.customer_id) : null;
    const earnedPoints = Math.floor(Math.max(0, Number(payment.amount)) / 1000);

    if (customerId && earnedPoints > 0) {
      await applyCustomerPointsDelta(client, customerId, earnedPoints);

      await client.query(
        `
        INSERT INTO coffee_chain_db.customer_point_transactions(
          customer_id,
          order_id,
          points_change,
          reason
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          customerId,
          payment.order_id,
          earnedPoints,
          `Earn from order ${String(order.order_code || payment.order_id)}`,
        ]
      );
    }

    await client.query("COMMIT");

    return {
      ok: true as const,
      orderId: Number(payment.order_id),
      amount: Number(payment.amount),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Lấy order để validate: id, final_amount, status. */
export async function getOrderForPayment(orderId: number) {
  const r = await pool.query(
    `
    SELECT id, final_amount, status
    FROM coffee_chain_db.orders
    WHERE id = $1
    LIMIT 1
    `,
    [orderId]
  );
  return r.rows[0] ?? null;
}

/** Kiểm tra order đã có payment PAID chưa (qua gateway_payments hoặc order.status). */
export async function isOrderAlreadyPaid(orderId: number): Promise<boolean> {
  const byGateway = await pool.query(
    `SELECT 1 FROM coffee_chain_db.gateway_payments WHERE order_id = $1 AND status = 'PAID' LIMIT 1`,
    [orderId]
  );
  if (byGateway.rows[0]) return true;

  const order = await pool.query(
    `SELECT status FROM coffee_chain_db.orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const status = order.rows[0]?.status;
  return status === "paid" || status === "completed";
}

/** Cập nhật order sang paid và ghi order_payments (gateway). */
export async function markOrderAsPaidByGateway(params: {
  orderId: number;
  amount: number;
  referenceCode: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE coffee_chain_db.orders
      SET status = 'paid'
      WHERE id = $1 AND status NOT IN ('paid', 'completed', 'voided', 'refunded')
      `,
      [params.orderId]
    );

    await client.query(
      `
      INSERT INTO coffee_chain_db.order_payments (order_id, method, amount, reference_code, paid_at)
      VALUES ($1, 'gateway', $2, $3, NOW())
      `,
      [params.orderId, params.amount, params.referenceCode]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
