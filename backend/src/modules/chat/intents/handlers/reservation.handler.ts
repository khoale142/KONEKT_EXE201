import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho reservation (câu hỏi động)
 * Query từ bảng reservations để lấy thông tin đặt bàn
 */
export class ReservationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "reservation" && intent.handlerType === "dynamic";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    const { customerId } = context;

    try {
      // Lấy các reservation của customer
      // Note: Bảng reservations có thể chưa tồn tại, cần check
      const result = await pool.query(`
        SELECT id, store_id, reservation_date, reservation_time, 
               number_of_guests, status, created_at
        FROM reservations
        WHERE customer_id = $1
        ORDER BY reservation_date DESC NULLS LAST, reservation_time DESC NULLS LAST
        LIMIT 5
      `, [customerId]);

      if (result.rows.length === 0) {
        return {
          answer: "Bạn chưa có đặt bàn nào. Hãy đặt bàn qua ứng dụng hoặc gọi hotline để được hỗ trợ!",
          intentCode: "reservation",
        };
      }

      // Format danh sách reservation
      let answer = "Các đặt bàn của bạn:\n\n";
      
      for (const resv of result.rows) {
        const date = new Date(resv.reservation_date).toLocaleDateString("vi-VN");
        const time = resv.reservation_time;
        const statusMap: Record<string, string> = {
          pending: "đang chờ xác nhận",
          confirmed: "đã xác nhận",
          cancelled: "đã hủy",
          completed: "đã hoàn thành",
        };
        const statusText = statusMap[resv.status] || resv.status;

        answer += `📅 Ngày: ${date} lúc ${time}\n`;
        answer += `👥 Số người: ${resv.number_of_guests}\n`;
        answer += `📊 Trạng thái: ${statusText}\n`;
        answer += `🆔 Mã đặt bàn: #${resv.id}\n\n`;
      }

      return {
        answer: answer.trim(),
        intentCode: "reservation",
        metadata: {
          reservationCount: result.rows.length,
        },
      };
    } catch (error: any) {
      console.error("[Reservation Handler] Error:", error);
      
      // Nếu bảng reservations chưa tồn tại, trả về message thân thiện
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return {
          answer: "Bạn chưa có đặt bàn nào. Hãy đặt bàn qua ứng dụng hoặc gọi hotline để được hỗ trợ!",
          intentCode: "reservation",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi lấy thông tin đặt bàn. Vui lòng thử lại sau.",
        intentCode: "reservation",
      };
    }
  }
}
