export type MemberCheckoutResultState = {
  success: boolean;
  orderCode: string;
  finalAmount: number;
  orderId?: number;
  earnedPoints?: number;
};

export type MemberCheckoutResultStateInput = {
  success?: boolean;
  orderCode?: string;
  finalAmount?: number;
  orderId?: number;
  earnedPoints?: number;
} | null | undefined;

const KEY = "kohi_member_checkout_result_v1";
const TTL_MS = 10 * 60 * 1000;

/**
 * Ưu tiên location.state; nếu mất (redirect / refresh), đọc bản sao sessionStorage.
 */
export function resolveCheckoutResultState(
  locationState: MemberCheckoutResultStateInput
): MemberCheckoutResultState | null {
  if (locationState?.success) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return {
      success: true,
      orderCode: String(locationState.orderCode ?? ""),
      finalAmount: Number(locationState.finalAmount ?? 0),
      orderId: locationState.orderId != null ? Number(locationState.orderId) : undefined,
      earnedPoints:
        locationState.earnedPoints != null ? Number(locationState.earnedPoints) : undefined,
    };
  }

  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const ts = Number(o.ts);
    if (!o.success || !Number.isFinite(ts) || Date.now() - ts > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    sessionStorage.removeItem(KEY);
    return {
      success: true,
      orderCode: String(o.orderCode ?? ""),
      finalAmount: Number(o.finalAmount ?? 0),
      orderId: o.orderId != null ? Number(o.orderId) : undefined,
      earnedPoints: o.earnedPoints != null ? Number(o.earnedPoints) : undefined,
    };
  } catch {
    return null;
  }
}
