import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho tea_recommendation (câu hỏi động)
 * Gợi ý một món trà ngẫu nhiên từ database
 */
export class TeaRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "tea_recommendation" && intent.handlerType === "dynamic";
  }

  async handle(_context: IntentHandlerContext): Promise<ChatResponse> {
    console.log("[Tea Recommendation Handler] Starting handler...");
    
    try {
      // Query các sản phẩm trà (category TEA hoặc tên có chứa trà/tea)
      const result = await pool.query(`
        SELECT 
          p.id,
          p.name,
          MIN(pv.price) as min_price,
          MAX(pv.price) as max_price
        FROM coffee_chain_db.products p
        JOIN coffee_chain_db.product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
        LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
        WHERE p.is_active = TRUE
          AND (
            UPPER(TRIM(COALESCE(c.name, ''))) IN ('TEA', 'TRA', 'TRÀ', 'TEA_COLD', 'TEA_HOT')
            OR LOWER(p.name) LIKE '%trà%'
            OR LOWER(p.name) LIKE '%tra%'
            OR LOWER(p.name) LIKE '%tea%'
            OR LOWER(p.name) LIKE '%chè%'
            OR LOWER(p.name) LIKE '%che%'
          )
        GROUP BY p.id, p.name
        ORDER BY RANDOM()
        LIMIT 1
      `);
      
      // Lấy sizes riêng nếu cần
      let sizes = "";
      if (result.rows.length > 0) {
        try {
          const sizesResult = await pool.query(`
            SELECT DISTINCT size
            FROM coffee_chain_db.product_variants
            WHERE product_id = $1 AND is_active = TRUE
            ORDER BY size
          `, [result.rows[0].id]);
          sizes = sizesResult.rows.map(r => r.size).join(", ");
        } catch (sizesError: any) {
          console.warn("[Tea Recommendation Handler] Error getting sizes:", sizesError.message);
        }
      }
      
      console.log("[Tea Recommendation Handler] Query result:", {
        rowCount: result.rows.length,
        hasData: result.rows.length > 0,
      });

      if (result.rows.length === 0) {
        return {
          answer: "Hiện tại chúng tôi chưa có món trà nào trong menu. Vui lòng xem menu trên website để biết thêm chi tiết!",
          intentCode: "tea_recommendation",
        };
      }

      const product = result.rows[0];
      const productName = product.name || "Món trà";
      const minPrice = Number(product.min_price || 0);
      const maxPrice = Number(product.max_price || 0);

      let answer = `Dạ mình gợi ý bạn thử ${productName} nhé.\n\n`;
      answer += `Giá: ${minPrice === maxPrice ? `${minPrice.toLocaleString("vi-VN")}đ` : `Từ ${minPrice.toLocaleString("vi-VN")}đ - ${maxPrice.toLocaleString("vi-VN")}đ`}`;
      if (sizes) answer += `\nCác size: ${sizes}`;
      answer += `\n\nBạn muốn đặt món này hay mình gợi ý thêm món khác?`;

      return {
        answer,
        intentCode: "tea_recommendation",
        metadata: {
          productId: product.id,
          productName: productName,
        },
      };
    } catch (error: any) {
      console.error("[Tea Recommendation Handler] Error:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
      });
      
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return {
          answer: "Hiện tại menu đang được cập nhật. Vui lòng xem menu trên website hoặc đến cửa hàng để xem trực tiếp!",
          intentCode: "tea_recommendation",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm món trà. Vui lòng thử lại sau hoặc xem menu trên website.",
        intentCode: "tea_recommendation",
      };
    }
  }
}
