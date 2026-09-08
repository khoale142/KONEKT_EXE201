import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho bakery_sweet_recommendation
 * Gợi ý bánh ngọt (cake, cheesecake, bánh ngọt...)
 */
export class BakerySweetRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "bakery_sweet_recommendation" && intent.handlerType === "dynamic";
  }

  async handle(_context: IntentHandlerContext): Promise<ChatResponse> {
    try {
      const result = await pool.query(`
        SELECT p.id, p.name, MIN(pv.price) as min_price, MAX(pv.price) as max_price
        FROM coffee_chain_db.products p
        JOIN coffee_chain_db.product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
        LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
        WHERE p.is_active = TRUE
          AND (
            UPPER(COALESCE(c.name, '')) IN ('BAKERY_SWEET', 'BAKERY SWEET', 'BÁNH NGỌT', 'BANH NGOT', 'BAKERY', 'CAKE', 'CAKES')
            OR LOWER(p.name) LIKE '%cake%'
            OR LOWER(p.name) LIKE '%cheesecake%'
            OR LOWER(p.name) LIKE '%bánh ngọt%'
            OR LOWER(p.name) LIKE '%banh ngot%'
            OR LOWER(p.name) LIKE '%bánh%'
            OR LOWER(p.name) LIKE '%banh%'
            OR LOWER(p.name) LIKE '%pastry%'
          )
          AND (
            LOWER(p.name) NOT LIKE '%topping%'
            AND UPPER(COALESCE(c.name, '')) NOT IN ('TOPPING')
          )
        GROUP BY p.id, p.name
        ORDER BY RANDOM()
        LIMIT 1
      `);

      let sizes = "";
      if (result.rows.length > 0) {
        try {
          const sizesRes = await pool.query(`SELECT DISTINCT size FROM coffee_chain_db.product_variants WHERE product_id = $1 AND is_active = TRUE ORDER BY size`, [result.rows[0].id]);
          sizes = sizesRes.rows.map((r: { size: string }) => r.size).join(", ");
        } catch {
          // ignore
        }
      }

      if (result.rows.length === 0) {
        return {
          answer: "Hiện tại chúng tôi chưa có bánh ngọt nào trong menu. Vui lòng xem menu trên website để biết thêm chi tiết!",
          intentCode: "bakery_sweet_recommendation",
        };
      }

      const product = result.rows[0];
      const productName = product.name || "Bánh ngọt";
      const minPrice = Number(product.min_price || 0);
      const maxPrice = Number(product.max_price || 0);

      let answer = `Dạ mình gợi ý bạn thử ${productName} nhé.\n\n`;
      answer += `Giá: ${minPrice === maxPrice ? `${minPrice.toLocaleString("vi-VN")}đ` : `Từ ${minPrice.toLocaleString("vi-VN")}đ - ${maxPrice.toLocaleString("vi-VN")}đ`}`;
      if (sizes) answer += `\nCác size: ${sizes}`;
      answer += `\n\nBạn muốn đặt món này hay mình gợi ý bánh ngọt khác?`;

      return {
        answer,
        intentCode: "bakery_sweet_recommendation",
        metadata: { productId: product.id, productName },
      };
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err.message?.includes("does not exist") || err.message?.includes("relation") || err.code === "42P01") {
        return { answer: "Hiện tại menu đang được cập nhật. Vui lòng xem menu trên website hoặc đến cửa hàng để xem trực tiếp!", intentCode: "bakery_sweet_recommendation" };
      }
      return { answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm bánh ngọt. Vui lòng thử lại sau hoặc xem menu trên website.", intentCode: "bakery_sweet_recommendation" };
    }
  }
}
