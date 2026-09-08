/**
 * TASK 2 — Email fallback 1 giờ cho ticket chưa được khách hàng phản hồi
 *
 * Chạy định kỳ mỗi 15 phút.
 * Logic "cửa sổ thời gian" (Time Window):
 *
 *   Điều kiện lọc ticket cần gửi email:
 *     1. Ticket đang ở trạng thái 'in_progress'
 *     2. Tin nhắn PUBLIC cuối cùng là từ CSKH (sender_type = 'staff')
 *     3. Tin nhắn đó được tạo TRONG KHOẢNG: (NOW - 75 phút) < created_at <= (NOW - 60 phút)
 *
 *   Vì sao dùng cửa sổ 60-75 phút thay vì chỉ "> 60 phút"?
 *     → Cron chạy mỗi 15 phút. Ticket từng ở "60 phút trước" sẽ KHÔNG bao giờ
 *       lọt lại vào cửa sổ lần sau (lần sau cửa sổ là 75-90 phút).
 *     → Đảm bảo mỗi tin nhắn bị lãng quên chỉ được xử lý ĐÚNG 1 LẦN,
 *       không spam email nhiều lần — không cần thêm cột `is_emailed` vào DB.
 */

import { pool } from "../config/db";
import { sendNewMessageNotificationEmail } from "../utils/mail.service";

const INTERVAL_MS = 15 * 60 * 1000; // 15 phút

interface FallbackRow {
  id: number;
  customer_email: string;
  last_message: string;
}

async function sendEmailFallbackForUnrepliedTickets(): Promise<void> {
  /**
   * LATERAL JOIN: lấy tin nhắn public cuối cùng cho mỗi ticket in_progress.
   * Cửa sổ thời gian: tạo lúc > (NOW - 75 phút) VÀ <= (NOW - 60 phút).
   *   - Giới hạn trên  (NOW - 60 phút): đã đủ 1 giờ không phản hồi → cần nhắc.
   *   - Giới hạn dưới  (NOW - 75 phút): chưa rơi vào lần chạy tiếp theo → không spam.
   */
  const candidates = await pool.query<FallbackRow>(
    `SELECT ct.id,
            c.email AS customer_email,
            tm.message AS last_message
     FROM customer_tickets ct
     INNER JOIN LATERAL (
       SELECT message, created_at, sender_type
       FROM ticket_messages
       WHERE ticket_id = ct.id AND is_internal = false
       ORDER BY created_at DESC
       LIMIT 1
     ) tm ON true
     JOIN customers c ON c.id = ct.customer_id
     WHERE ct.status = 'in_progress'
       AND tm.sender_type = 'staff'
       AND tm.created_at >  NOW() - INTERVAL '75 minutes'
       AND tm.created_at <= NOW() - INTERVAL '60 minutes'
       AND c.email IS NOT NULL
       AND c.email <> ''`,
  );

  if (candidates.rows.length === 0) return;

  console.log(`[EmailFallback] Tìm thấy ${candidates.rows.length} ticket cần gửi email nhắc nhở.`);

  for (const row of candidates.rows) {
    await sendNewMessageNotificationEmail(row.customer_email, row.id, row.last_message);
    console.log(`[EmailFallback] Đã gửi email nhắc nhở cho ticket #${row.id} → ${row.customer_email}`);
  }
}

export function startTicketEmailFallbackCron(): void {
  console.log("[Cron] Khởi động email-fallback ticket cron (chu kỳ: 15 phút, cửa sổ: 60-75 phút)");

  // Chạy ngay lần đầu khi server khởi động
  sendEmailFallbackForUnrepliedTickets().catch((err) => {
    console.error("[Cron] ticketEmailFallback lần đầu lỗi:", err);
  });

  setInterval(() => {
    sendEmailFallbackForUnrepliedTickets().catch((err) => {
      console.error("[Cron] ticketEmailFallback lỗi:", err);
    });
  }, INTERVAL_MS);
}
