import { useQuery } from "@tanstack/react-query";
import { getPaymentStatus } from "../api/payment.api";

export function usePaymentStatus(
  orderId: number | null,
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  const enabled = Boolean(orderId && orderId > 0 && (options?.enabled ?? true));

  return useQuery({
    queryKey: ["paymentStatus", orderId],
    queryFn: () => getPaymentStatus(orderId!),
    enabled,
    refetchInterval: enabled ? (options?.refetchInterval ?? 2000) : false,
  });
}
