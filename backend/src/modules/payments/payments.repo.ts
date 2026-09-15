import { db } from "../../db";
import { gatewayPayments, orders, payments, customers } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { GatewayPaymentStatus } from "./payments.types";

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
  shift_session_id: number | null;
  raw_request: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  expired_at: Date | null;
}

export async function insertPayment(params: InsertPaymentParams) {
  const [created] = await db
    .insert(gatewayPayments)
    .values({
      orderId: params.order_id,
      provider: params.provider,
      providerOrderId: params.provider_order_id,
      requestId: params.request_id,
      amount: String(params.amount),
      status: params.status,
      payUrl: params.pay_url,
      deeplink: params.deeplink,
      qrCodeUrl: params.qr_code_url,
      shiftSessionId: params.shift_session_id,
      rawRequest: params.raw_request,
      rawResponse: params.raw_response,
      expiredAt: params.expired_at,
    })
    .returning({
      id: gatewayPayments.id,
      order_id: gatewayPayments.orderId,
      provider: gatewayPayments.provider,
      request_id: gatewayPayments.requestId,
      amount: gatewayPayments.amount,
      status: gatewayPayments.status,
      pay_url: gatewayPayments.payUrl,
      shift_session_id: gatewayPayments.shiftSessionId,
      created_at: gatewayPayments.createdAt,
    });
  return created;
}

export async function findPaymentByRequestId(requestId: string) {
  const r = await db.query.gatewayPayments.findFirst({
    where: eq(gatewayPayments.requestId, requestId),
  });
  if (!r) return null;
  return {
    id: r.id,
    order_id: r.orderId,
    provider: r.provider,
    provider_order_id: r.providerOrderId,
    request_id: r.requestId,
    amount: Number(r.amount),
    status: r.status as GatewayPaymentStatus,
    pay_url: r.payUrl,
    raw_response: r.rawResponse,
    paid_at: r.paidAt,
    expired_at: r.expiredAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function findLatestPaymentByOrderId(orderId: number) {
  const r = await db.query.gatewayPayments.findFirst({
    where: eq(gatewayPayments.orderId, orderId),
    orderBy: [desc(gatewayPayments.createdAt)],
  });
  if (!r) return null;
  return {
    id: r.id,
    order_id: r.orderId,
    provider: r.provider,
    provider_order_id: r.providerOrderId,
    request_id: r.requestId,
    amount: Number(r.amount),
    status: r.status as GatewayPaymentStatus,
    pay_url: r.payUrl,
    paid_at: r.paidAt,
    expired_at: r.expiredAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

/** Latest PENDING payment by order_id (for Payment Kit webhook mapping by orderCode). */
export async function findLatestPendingPaymentByOrderId(orderId: number) {
  const r = await db.query.gatewayPayments.findFirst({
    where: and(eq(gatewayPayments.orderId, orderId), eq(gatewayPayments.status, "PENDING")),
    orderBy: [desc(gatewayPayments.createdAt)],
  });
  if (!r) return null;
  return {
    id: r.id,
    order_id: r.orderId,
    provider: r.provider,
    provider_order_id: r.providerOrderId,
    request_id: r.requestId,
    amount: Number(r.amount),
    status: r.status as GatewayPaymentStatus,
  };
}

export async function countPendingGatewayPayments(): Promise<number> {
  const res = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gatewayPayments)
    .where(eq(gatewayPayments.status, "PENDING"));
  return Number(res[0]?.count || 0);
}

/** Idempotent: chỉ update khi status khác PAID. Trả về số dòng bị update (0 hoặc 1). */
export async function updatePaymentStatusToPaid(params: {
  requestId: string;
  providerOrderId: string;
  rawResponse: Record<string, unknown>;
}) {
  const now = new Date();
  const res = await db
    .update(gatewayPayments)
    .set({
      status: "PAID",
      providerOrderId: params.providerOrderId,
      rawResponse: params.rawResponse,
      paidAt: now,
      updatedAt: now,
    })
    .where(and(eq(gatewayPayments.requestId, params.requestId), sql`${gatewayPayments.status} <> 'PAID'`))
    .returning({ id: gatewayPayments.id, order_id: gatewayPayments.orderId });
  return res.length;
}

export async function updatePaymentStatusToFailed(params: {
  requestId: string;
  rawResponse: Record<string, unknown>;
}) {
  const now = new Date();
  await db
    .update(gatewayPayments)
    .set({
      status: "FAILED",
      rawResponse: params.rawResponse,
      updatedAt: now,
    })
    .where(and(eq(gatewayPayments.requestId, params.requestId), eq(gatewayPayments.status, "PENDING")));
}

export async function settleGatewayPayment(params: {
  requestId: string;
  providerOrderId: string;
  rawResponse: Record<string, unknown>;
  expectedAmount?: number | null;
}) {
  return await db.transaction(async (tx) => {
    const payment = await tx.query.gatewayPayments.findFirst({
      where: eq(gatewayPayments.requestId, params.requestId),
    });
    if (!payment) {
      return { ok: false as const, reason: "payment_not_found" as const };
    }

    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, payment.orderId),
    });
    if (!order) {
      return { ok: false as const, reason: "order_not_found" as const };
    }

    const orderStatus = String(order.status || "").toLowerCase();
    if (orderStatus === "voided" || orderStatus === "cancelled" || orderStatus === "refunded") {
      return { ok: false as const, reason: "order_not_payable" as const };
    }

    const paymentStatus = String(payment.status || "").toUpperCase();
    if (
      paymentStatus === "PAID" ||
      orderStatus === "paid" ||
      orderStatus === "completed"
    ) {
      return { ok: false as const, reason: "already_processed" as const };
    }

    const expectedAmount =
      params.expectedAmount == null ? null : Number(params.expectedAmount);
    if (
      expectedAmount != null &&
      Number.isFinite(expectedAmount) &&
      Number(payment.amount) !== expectedAmount
    ) {
      return { ok: false as const, reason: "amount_mismatch" as const };
    }

    const now = new Date();

    await tx
      .update(gatewayPayments)
      .set({
        status: "PAID",
        providerOrderId: params.providerOrderId,
        rawResponse: params.rawResponse,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(gatewayPayments.id, payment.id));

    await tx
      .update(orders)
      .set({
        status: "completed",
        isHold: false,
        updatedAt: now,
      })
      .where(eq(orders.id, payment.orderId));

    await tx.insert(payments).values({
      orderId: payment.orderId,
      method: "vietqr",
      status: "paid",
      amount: String(payment.amount),
      transactionRef: params.providerOrderId,
      shiftSessionId: payment.shiftSessionId,
      paidAt: now,
    });

    const customerId = order.customerId != null ? Number(order.customerId) : null;
    const earnedPoints = Math.floor(Math.max(0, Number(payment.amount)) / 1000);

    if (customerId && earnedPoints > 0) {
      try {
        await tx
          .update(customers)
          .set({
            points: sql`COALESCE(${customers.points}, 0) + ${earnedPoints}`,
            updatedAt: now,
          })
          .where(eq(customers.id, customerId));
      } catch (err) {
        console.warn("[payments.repo] customer points update skipped:", err);
      }
    }

    return {
      ok: true as const,
      orderId: Number(payment.orderId),
      amount: Number(payment.amount),
    };
  });
}

/** Lấy order để validate: id, final_amount, status. */
export async function getOrderForPayment(orderId: number) {
  const o = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!o) return null;
  return {
    id: o.id,
    final_amount: Number(o.totalAmount || 0),
    status: o.status,
    tenant_id: o.tenantId,
    store_id: o.storeId,
  };
}

/** Kiểm tra order đã có payment PAID chưa (qua gateway_payments hoặc order.status). */
export async function isOrderAlreadyPaid(orderId: number): Promise<boolean> {
  const byGateway = await db.query.gatewayPayments.findFirst({
    where: and(eq(gatewayPayments.orderId, orderId), eq(gatewayPayments.status, "PAID")),
  });
  if (byGateway) return true;

  const o = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  const status = o?.status;
  return (status as string) === "paid" || status === "completed";
}

/** Cập nhật order sang paid và ghi order_payments (gateway). */
export async function markOrderAsPaidByGateway(params: {
  orderId: number;
  amount: number;
  referenceCode: string;
}) {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "completed",
        isHold: false,
        updatedAt: now,
      })
      .where(and(eq(orders.id, params.orderId), sql`${orders.status} NOT IN ('completed', 'cancelled', 'refunded')`));

    await tx.insert(payments).values({
      orderId: params.orderId,
      method: "vietqr",
      status: "paid",
      amount: String(params.amount),
      transactionRef: params.referenceCode,
      paidAt: now,
    });
  });
}
