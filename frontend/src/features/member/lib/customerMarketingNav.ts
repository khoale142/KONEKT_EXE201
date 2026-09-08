/** State chuẩn khi điều hướng tới voucher / khuyến mãi — dùng chung cho back và link chéo. */
export type CustomerMarketingNavState = {
  returnTo?: string;
};

const DEFAULT_FALLBACK = "/customer/profile";

export function resolveCustomerMarketingBack(
  state: CustomerMarketingNavState | null | undefined,
  fallback: string = DEFAULT_FALLBACK
): string {
  const raw = state?.returnTo?.trim();
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}
