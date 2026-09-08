import { ApiError } from "../../utils/apiError";
import { vietqrConfig } from "../../config/vietqr";
import {
  insertPayment,
  findLatestPaymentByOrderId,
  findLatestPendingPaymentByOrderId,
  settleGatewayPayment,
  getOrderForPayment,
  isOrderAlreadyPaid,
} from "./payments.repo";
import { reconcileRecentCassoTransactions } from "./payments.reconcile.service";
import { scheduleOrderPurchaseOutreach } from "../order-outreach/orderOutreach.service";

function buildVietqrRequestId(orderId: number): string {
  const last6 = String(orderId % 1_000_000).padStart(6, "0");
  const ts4 = String(Math.floor(Date.now() / 1000) % 10_000).padStart(4, "0");
  return `VQR${last6}${ts4}`;
}

function toQuicklinkSafeText(input: string, maxLen: number): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function buildVietqrQuicklink(params: {
  bankCode: string;
  bankAccount: string;
  template: string;
  amount: number;
  addInfo: string;
  accountName: string;
}): string {
  const bankCode = params.bankCode.trim();
  const bankAccount = params.bankAccount.trim();
  const template = (params.template || "compact2").trim();

  const amount = Math.max(0, Math.floor(Number(params.amount || 0)));
  const addInfo = encodeURIComponent(toQuicklinkSafeText(params.addInfo, 50));
  const accountName = encodeURIComponent(toQuicklinkSafeText(params.accountName, 50).toUpperCase());

  return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-${template}.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}

export async function getPaymentStatus(orderId: number) {
  const order = await getOrderForPayment(orderId);
  if (!order) {
    return null;
  }

  const orderStatus = String(order.status || "").toLowerCase();
  if (orderStatus === "pending") {
    try {
      await reconcileRecentCassoTransactions({ includeSync: true, minPullIntervalMs: 5_000 });
    } catch (error) {
      console.error("[payment-status] reconcile pending payment failed:", error);
    }
  }

  const payment = await findLatestPaymentByOrderId(orderId);
  const status =
    order.status === "paid" || order.status === "completed"
      ? "PAID"
      : payment?.status ?? "PENDING";

  const expiredAt = payment?.expired_at ?? null;
  const computedStatus =
    status === "PENDING" && expiredAt && new Date(expiredAt).getTime() < Date.now()
      ? "EXPIRED"
      : status;

  return {
    orderId,
    status: computedStatus,
    paidAt: payment?.paid_at ?? null,
    providerOrderId: payment?.provider_order_id ?? null,
    expiredAt,
  };
}

export async function initVietqrPayment(orderId: number) {
  const order = await getOrderForPayment(orderId);
  if (!order) throw new ApiError(400, "Order not found or cannot be paid");

  if (await isOrderAlreadyPaid(orderId)) {
    const status = await getPaymentStatus(orderId);
    return {
      ...(status || { orderId, status: "PAID", paidAt: null, providerOrderId: null, expiredAt: null }),
      orderRef: null,
      qrImageUrl: null,
      qrPayload: null,
      checkoutUrl: null,
      paymentId: null,
      amount: Number(order.final_amount ?? 0),
      content: null,
    };
  }

  const amountVnd = Number(order.final_amount ?? 0);
  if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
    throw new ApiError(400, "Invalid order amount");
  }

  const expiredAtDate = new Date(Date.now() + 15 * 60 * 1000);
  const requestId = buildVietqrRequestId(orderId);
  const content = requestId;

  const minimal = [vietqrConfig.bankAccount, vietqrConfig.bankCode, vietqrConfig.userBankName];
  if (minimal.some((x) => !x || !String(x).trim())) {
    throw new ApiError(
      503,
      "VietQR not configured (missing bankAccount/bankCode/userBankName)"
    );
  }

  const qrImageUrl = buildVietqrQuicklink({
    bankCode: String(vietqrConfig.bankCode),
    bankAccount: String(vietqrConfig.bankAccount),
    template: String(vietqrConfig.quicklinkTemplate || "compact2"),
    amount: amountVnd,
    addInfo: content,
    accountName: String(vietqrConfig.userBankName),
  });

  const saved = await insertPayment({
    order_id: orderId,
    provider: "vietqr",
    provider_order_id: null,
    request_id: requestId,
    amount: amountVnd,
    status: "PENDING",
    pay_url: null,
    deeplink: null,
    qr_code_url: qrImageUrl,
    raw_request: { mode: "quicklink" },
    raw_response: { mode: "quicklink" },
    expired_at: expiredAtDate,
  });

  return {
    paymentId: saved.id,
    orderId,
    provider: "vietqr",
    orderRef: requestId,
    content,
    amount: amountVnd,
    status: "PENDING",
    providerOrderId: null,
    qrImageUrl,
    qrPayload: null,
    checkoutUrl: null,
    expiresAt: expiredAtDate.toISOString(),
  };
}

export async function confirmGatewayPaymentByRequestId(params: {
  requestId: string;
  providerOrderId: string;
  rawResponse: Record<string, unknown>;
  expectedAmount?: number | null;
}) {
  const result = await settleGatewayPayment(params);
  if (result.ok) {
    scheduleOrderPurchaseOutreach(result.orderId);
  }
  return result;
}

export async function manualConfirmVietqrPayment(orderId: number) {
  const payment = await findLatestPendingPaymentByOrderId(orderId);
  if (!payment) {
    throw new ApiError(404, "Không tìm thấy giao dịch PENDING cho đơn này");
  }

  const providerOrderId = `MANUAL-${Date.now()}`;
  await confirmGatewayPaymentByRequestId({
    requestId: payment.request_id,
    providerOrderId,
    rawResponse: { manual: true, confirmedAt: new Date().toISOString() },
    expectedAmount: Number(payment.amount),
  });

  return { ok: true, message: "Đã xác nhận thanh toán" };
}
