import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho drink_recommendation (câu hỏi động)
 * Gợi ý một món đồ uống ngẫu nhiên từ database (tất cả đồ uống, không chỉ coffee)
 */
export class DrinkRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "drink_recommendation" && intent.handlerType === "dynamic";
  }

  async handle(_context: IntentHandlerContext): Promise<ChatResponse> {
    console.log("[Drink Recommendation Handler] Starting handler...");
    
    try {
      // Thử query đơn giản trước để kiểm tra bảng có tồn tại không
      const testQuery = await pool.query(`
        SELECT COUNT(*) as total
        FROM coffee_chain_db.products
        WHERE is_active = TRUE
      `);
      
      console.log("[Drink Recommendation Handler] Products count:", testQuery.rows[0]?.total);
      
      // Lấy danh sách chỉ đồ uống - LOẠI TRỪ bánh, topping
      // Chỉ gồm: coffee, tea, freeze, phindi, và các đồ uống khác
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
            UPPER(COALESCE(c.name, '')) IN ('COFFEE', 'ESPRESSO', 'PHINDI', 'TEA', 'FREEZE', 'JUICE', 'OTHERS', 'OTHER')
            OR LOWER(p.name) LIKE '%cà phê%'
            OR LOWER(p.name) LIKE '%ca phe%'
            OR LOWER(p.name) LIKE '%coffee%'
            OR LOWER(p.name) LIKE '%trà%'
            OR LOWER(p.name) LIKE '%tra%'
            OR LOWER(p.name) LIKE '%tea%'
            OR LOWER(p.name) LIKE '%freeze%'
            OR LOWER(p.name) LIKE '%đá xay%'
            OR LOWER(p.name) LIKE '%da xay%'
            OR LOWER(p.name) LIKE '%phindi%'
            OR LOWER(p.name) LIKE '%latte%'
            OR LOWER(p.name) LIKE '%cappuccino%'
            OR LOWER(p.name) LIKE '%espresso%'
            OR LOWER(p.name) LIKE '%nước ép%'
            OR LOWER(p.name) LIKE '%nuoc ep%'
            OR LOWER(p.name) LIKE '%juice%'
          )
          AND UPPER(COALESCE(c.name, '')) NOT IN ('TOPPING', 'BÁNH', 'BANH', 'BAKERY', 'CAKE', 'CAKES')
          AND (
            LOWER(p.name) NOT LIKE '%topping%'
            AND LOWER(p.name) NOT LIKE '%bánh%'
            AND LOWER(p.name) NOT LIKE '%banh%'
          )
        GROUP BY p.id, p.name
        ORDER BY RANDOM()
        LIMIT 1
      `);
      
      // Lấy sizes riêng nếu cần (bọc trong try-catch để tránh lỗi)
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
          console.warn("[Drink Recommendation Handler] Error getting sizes:", sizesError.message);
          // Bỏ qua lỗi sizes, tiếp tục với product info
        }
      }
      
      console.log("[Drink Recommendation Handler] Query result:", {
        rowCount: result.rows.length,
        hasData: result.rows.length > 0,
        firstRow: result.rows[0] ? {
          id: result.rows[0].id,
          name: result.rows[0].name,
        } : null,
      });

      if (result.rows.length === 0) {
        return {
          answer: "Hiện tại chúng tôi chưa có món đồ uống nào trong menu. Vui lòng xem menu trên website để biết thêm chi tiết!",
          intentCode: "drink_recommendation",
        };
      }

      const product = result.rows[0];
      const productName = product.name || "Món đồ uống";
      const minPrice = Number(product.min_price || 0);
      const maxPrice = Number(product.max_price || 0);

      let answer = `Dạ mình gợi ý bạn thử ${productName} nhé.\n\n`;
      answer += `Giá: ${minPrice === maxPrice ? `${minPrice.toLocaleString("vi-VN")}đ` : `Từ ${minPrice.toLocaleString("vi-VN")}đ - ${maxPrice.toLocaleString("vi-VN")}đ`}`;
      if (sizes) answer += `\nCác size: ${sizes}`;
      answer += `\n\nBạn muốn đặt món này hay mình gợi ý thêm món khác?`;

      return {
        answer,
        intentCode: "drink_recommendation",
        metadata: {
          productId: product.id,
          productName: productName,
        },
      };
    } catch (error: any) {
      console.error("[Drink Recommendation Handler] Error:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack,
      });
      
      // Nếu bảng products chưa tồn tại, trả về message thân thiện
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        console.warn("[Drink Recommendation Handler] Database table not found");
        return {
          answer: "Hiện tại menu đang được cập nhật. Vui lòng xem menu trên website hoặc đến cửa hàng để xem trực tiếp!",
          intentCode: "drink_recommendation",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm món đồ uống. Vui lòng thử lại sau hoặc xem menu trên website.",
        intentCode: "drink_recommendation",
      };
    }
  }
}
