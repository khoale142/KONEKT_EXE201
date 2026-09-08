import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho promotion (câu hỏi động)
 * Query từ bảng promotions để lấy thông tin khuyến mãi hiện tại
 */
export class PromotionHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "promotion" && intent.handlerType === "dynamic";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    try {
      // Lấy các promotion đang active
      // Note: Bảng promotions có thể chưa tồn tại, cần check
      const now = new Date();
      const result = await pool.query(`
        SELECT id, name, description, discount_percent, discount_amount, 
               start_date, end_date, min_order_amount, max_discount_amount
        FROM promotions
        WHERE is_active = TRUE
          AND start_date <= $1
          AND end_date >= $1
        ORDER BY discount_percent DESC NULLS LAST, discount_amount DESC NULLS LAST
        LIMIT 5
      `, [now]);

      if (result.rows.length === 0) {
        return {
          answer: "Hiện tại không có chương trình khuyến mãi nào đang diễn ra. Hãy theo dõi để không bỏ lỡ các ưu đãi sắp tới!",
          intentCode: "promotion",
        };
      }

      // Format danh sách promotion
      let answer = "Hiện tại có các chương trình khuyến mãi sau:\n\n";
      
      for (const promo of result.rows) {
        answer += `🎉 ${promo.name}\n`;
        if (promo.description) {
          answer += `${promo.description}\n`;
        }
        
        if (promo.discount_percent) {
          answer += `Giảm ${promo.discount_percent}%`;
        } else if (promo.discount_amount) {
          answer += `Giảm ${promo.discount_amount.toLocaleString("vi-VN")}đ`;
        }
        
        if (promo.min_order_amount) {
          answer += ` (áp dụng cho đơn từ ${promo.min_order_amount.toLocaleString("vi-VN")}đ)`;
        }
        
        if (promo.max_discount_amount) {
          answer += ` (tối đa ${promo.max_discount_amount.toLocaleString("vi-VN")}đ)`;
        }
        
        const endDate = new Date(promo.end_date).toLocaleDateString("vi-VN");
        answer += `\n⏰ Hết hạn: ${endDate}\n\n`;
      }

      return {
        answer: answer.trim(),
        intentCode: "promotion",
        metadata: {
          promotionCount: result.rows.length,
        },
      };
    } catch (error: any) {
      console.error("[Promotion Handler] Error:", error);
      
      // Nếu bảng promotions chưa tồn tại, trả về message thân thiện
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return {
          answer: "Hiện tại không có chương trình khuyến mãi nào. Hãy theo dõi để không bỏ lỡ các ưu đãi sắp tới!",
          intentCode: "promotion",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi lấy thông tin khuyến mãi. Vui lòng thử lại sau.",
        intentCode: "promotion",
      };
    }
  }
}
