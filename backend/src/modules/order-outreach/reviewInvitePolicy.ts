/** Chuẩn hóa trạng thái đơn (so sánh không phân biệt hoa thường). */
export function normalizeOrderStatus(status: string): string {
  return String(status || "").trim().toLowerCase();
}

export function shouldSendReviewInvite(status: string): boolean {
  return normalizeOrderStatus(status) === "completed";
}
