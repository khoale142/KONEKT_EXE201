export type GatewayPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface GatewayPaymentRow {
  id: number;
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
  paid_at: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
