import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho topping_recommendation
 * Gợi ý topping (thạch, trân châu, topping thêm...)
 */
export class ToppingRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "topping_recommendation" && intent.handlerType === "dynamic";
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
            UPPER(COALESCE(c.name, '')) = 'TOPPING'
            OR LOWER(p.name) LIKE '%topping%'
            OR LOWER(p.name) LIKE '%thạch%'
            OR LOWER(p.name) LIKE '%thach%'
            OR LOWER(p.name) LIKE '%trân châu%'
            OR LOWER(p.name) LIKE '%tran chau%'
            OR LOWER(p.name) LIKE '%pearl%'
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
          answer: "Hiện tại chúng tôi chưa có topping nào trong menu. Vui lòng xem menu trên website để biết thêm chi tiết!",
          intentCode: "topping_recommendation",
        };
      }

      const product = result.rows[0];
      const productName = product.name || "Topping";
      const minPrice = Number(product.min_price || 0);
      const maxPrice = Number(product.max_price || 0);

      let answer = `Dạ mình gợi ý bạn thử ${productName} nhé.\n\n`;
      answer += `Giá: ${minPrice === maxPrice ? `${minPrice.toLocaleString("vi-VN")}đ` : `Từ ${minPrice.toLocaleString("vi-VN")}đ - ${maxPrice.toLocaleString("vi-VN")}đ`}`;
      if (sizes) answer += `\nCác size: ${sizes}`;
      answer += `\n\nBạn muốn thêm topping này hay mình gợi ý món khác?`;

      return {
        answer,
        intentCode: "topping_recommendation",
        metadata: { productId: product.id, productName },
      };
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err.message?.includes("does not exist") || err.message?.includes("relation") || err.code === "42P01") {
        return { answer: "Hiện tại menu đang được cập nhật. Vui lòng xem menu trên website hoặc đến cửa hàng để xem trực tiếp!", intentCode: "topping_recommendation" };
      }
      return { answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm topping. Vui lòng thử lại sau hoặc xem menu trên website.", intentCode: "topping_recommendation" };
    }
  }
}
