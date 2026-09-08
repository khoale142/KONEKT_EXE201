import api from "../../../lib/http/axios";

export interface PaymentStatusResponse {
  orderId: number;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  paidAt: string | null;
  providerOrderId: string | null;
  expiredAt?: string | null;
}

export async function getPaymentStatus(orderId: number): Promise<PaymentStatusResponse> {
  const { data } = await api.get<PaymentStatusResponse>(`/payments/${orderId}/status`);
  return data;
}

export interface InitVietqrPaymentResponse {
  paymentId: number | null;
  orderId: number;
  provider: "vietqr";
  orderRef: string | null;
  content: string | null;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  providerOrderId: string | null;
  qrImageUrl: string | null;
  qrPayload: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

export async function initVietqrPayment(orderId: number): Promise<InitVietqrPaymentResponse> {
  const { data } = await api.post<InitVietqrPaymentResponse>("/payments/vietqr/init", { orderId });
  return data;
}

export async function manualConfirmVietqrPayment(orderId: number): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(`/payments/vietqr/${orderId}/manual-confirm`);
  return data;
}
