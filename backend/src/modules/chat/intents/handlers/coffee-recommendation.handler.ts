import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho coffee_recommendation (câu hỏi động)
 * Gợi ý một món coffee ngẫu nhiên từ database
 */
export class CoffeeRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "coffee_recommendation" && intent.handlerType === "dynamic";
  }

  async handle(_context: IntentHandlerContext): Promise<ChatResponse> {
    console.log("[Coffee Recommendation Handler] Starting handler...");
    
    try {
      // Thử query đơn giản trước để kiểm tra bảng có tồn tại không
      const testQuery = await pool.query(`
        SELECT COUNT(*) as total
        FROM coffee_chain_db.products
        WHERE is_active = TRUE
      `);
      
      console.log("[Coffee Recommendation Handler] Products count:", testQuery.rows[0]?.total);
      
      // Lấy danh sách các sản phẩm coffee (category COFFEE, ESPRESSO, PHINDI)
      // Hoặc bất kỳ sản phẩm nào nếu không có category
      // Lưu ý: Bảng products không có cột description
      // Đơn giản hóa query để tránh lỗi - bỏ sizes để test trước
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
            UPPER(TRIM(COALESCE(c.name, ''))) IN ('COFFEE', 'ESPRESSO', 'PHINDI')
            OR c.name IS NULL
            OR LOWER(p.name) LIKE '%cà phê%'
            OR LOWER(p.name) LIKE '%ca phe%'
            OR LOWER(p.name) LIKE '%coffee%'
            OR LOWER(p.name) LIKE '%espresso%'
            OR LOWER(p.name) LIKE '%latte%'
            OR LOWER(p.name) LIKE '%cappuccino%'
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
          console.warn("[Coffee Recommendation Handler] Error getting sizes:", sizesError.message);
          // Bỏ qua lỗi sizes, tiếp tục với product info
        }
      }
      
      console.log("[Coffee Recommendation Handler] Query result:", {
        rowCount: result.rows.length,
        hasData: result.rows.length > 0,
        firstRow: result.rows[0] ? {
          id: result.rows[0].id,
          name: result.rows[0].name,
        } : null,
      });

      if (result.rows.length === 0) {
        return {
          answer: "Hiện tại chúng tôi chưa có món coffee nào trong menu. Vui lòng xem menu trên website để biết thêm chi tiết!",
          intentCode: "coffee_recommendation",
        };
      }

      const product = result.rows[0];
      const productName = product.name || "Món coffee";
      const minPrice = Number(product.min_price || 0);
      const maxPrice = Number(product.max_price || 0);

      let answer = `Dạ mình gợi ý bạn thử ${productName} nhé.\n\n`;
      answer += `Giá: ${minPrice === maxPrice ? `${minPrice.toLocaleString("vi-VN")}đ` : `Từ ${minPrice.toLocaleString("vi-VN")}đ - ${maxPrice.toLocaleString("vi-VN")}đ`}`;
      if (sizes) answer += `\nCác size: ${sizes}`;
      answer += `\n\nBạn muốn đặt món này hay mình gợi ý thêm món khác?`;

      return {
        answer,
        intentCode: "coffee_recommendation",
        metadata: {
          productId: product.id,
          productName: productName,
        },
      };
    } catch (error: any) {
      console.error("[Coffee Recommendation Handler] Error:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack,
      });
      
      // Nếu bảng products chưa tồn tại, trả về message thân thiện
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        console.warn("[Coffee Recommendation Handler] Database table not found");
        return {
          answer: "Hiện tại menu đang được cập nhật. Vui lòng xem menu trên website hoặc đến cửa hàng để xem trực tiếp!",
          intentCode: "coffee_recommendation",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm món coffee. Vui lòng thử lại sau hoặc xem menu trên website.",
        intentCode: "coffee_recommendation",
      };
    }
  }
}
