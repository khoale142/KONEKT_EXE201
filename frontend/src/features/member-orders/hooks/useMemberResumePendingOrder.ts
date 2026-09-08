import { useEffect, useState } from "react";
import { memberOrdersApi, type MemberResumePendingOrder } from "../api/memberOrders.api";

/**
 * Đơn pending mới nhất của khách (đã đặt, chưa thanh toán xong).
 * Luôn trả về khi API có pendingOrder — không lọc theo canResumePayment để vẫn nhắc khi QR hết hạn.
 */
export function useMemberResumePendingOrder(enabled: boolean) {
  const [pending, setPending] = useState<MemberResumePendingOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setPending(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    memberOrdersApi
      .getResumeSummary()
      .then((res) => {
        if (cancelled) return;
        setPending(res.pendingOrder ?? null);
      })
      .catch(() => {
        if (!cancelled) setPending(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { pending, loading };
}
