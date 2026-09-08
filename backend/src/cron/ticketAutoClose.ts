/**
 * TASK 4 — Auto-close stale tickets cronjob
 *
 * Chạy định kỳ mỗi 15 phút:
 *   Tìm ticket đang ở trạng thái 'in_progress' mà tin nhắn PUBLIC cuối cùng
 *   là từ CSKH (staff) và đã quá 24 giờ không có phản hồi từ khách hàng.
 *   → Gửi 1 tin nhắn hệ thống thông báo KH → cập nhật status = 'closed' trực tiếp.
 *   CSKH không cần xác nhận thêm — phiếu nhảy thẳng vào tab "Đã đóng".
 */
import { autoCloseStaleTickets } from "../modules/head-officer/head-officer.service";

const INTERVAL_MS = 15 * 60 * 1000; // 15 phút

export function startTicketAutoCloseCron(): void {
  console.log("[Cron] Khởi động auto-close ticket cron (chu kỳ: 15 phút)");

  // Chạy ngay lần đầu khi server khởi động
  autoCloseStaleTickets().catch((err) => {
    console.error("[Cron] autoCloseStaleTickets lần đầu lỗi:", err);
  });

  setInterval(() => {
    autoCloseStaleTickets().catch((err) => {
      console.error("[Cron] autoCloseStaleTickets lỗi:", err);
    });
  }, INTERVAL_MS);
}
