import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho order_status (câu hỏi động)
 * Query từ bảng orders để lấy trạng thái đơn hàng
 */
export class OrderStatusHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "order_status" && intent.handlerType === "dynamic";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    const { customerId, message } = context;
    const normalizedMessage = this.normalizeText(message);

    try {
      // Extract order code từ message (VD: "đơn hàng #ORD123" hoặc "đơn ORD123")
      const orderCodeMatch = normalizedMessage.match(/(?:don|order|don hang|ma don)[\s#]*([a-z0-9]+)/i);
      const orderCode = orderCodeMatch ? orderCodeMatch[1].toUpperCase() : null;

      // Nếu message chứa "của tôi" hoặc "của em" → lấy tất cả đơn hàng gần đây
      const isMyOrders = normalizedMessage.includes("cua toi") || 
                        normalizedMessage.includes("cua em") ||
                        normalizedMessage.includes("của tôi") ||
                        normalizedMessage.includes("của em");

      if (!orderCode && isMyOrders) {
        // Lấy danh sách đơn hàng gần đây (tối đa 5 đơn)
        const ordersResult = await pool.query(`
          SELECT id, order_code, status, created_at, completed_at, pickup_number
          FROM orders
          WHERE customer_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `, [customerId]);

        if (ordersResult.rows.length === 0) {
          return {
            answer: "Bạn chưa có đơn hàng nào. Hãy đặt hàng để sử dụng dịch vụ của chúng tôi!",
            intentCode: "order_status",
          };
        }

        // Format danh sách đơn hàng
        let answer = `Bạn có ${ordersResult.rows.length} đơn hàng:\n\n`;
        for (const order of ordersResult.rows) {
          const statusMap: Record<string, string> = {
            pending: "đang chờ xử lý",
            paid: "đã thanh toán",
            completed: "đã hoàn thành",
            voided: "đã hủy",
            refunded: "đã hoàn tiền",
          };
          const statusText = statusMap[order.status] || order.status;
          const date = new Date(order.created_at).toLocaleDateString("vi-VN");
          
          answer += `📦 ${order.order_code}: ${statusText} (${date})\n`;
          if (order.pickup_number) {
            answer += `   Số thứ tự: ${order.pickup_number}\n`;
          }
          answer += "\n";
        }

        return {
          answer: answer.trim(),
          intentCode: "order_status",
          metadata: {
            orderCount: ordersResult.rows.length,
          },
        };
      }

      if (!orderCode) {
        // Nếu không tìm thấy order code và không phải "của tôi", lấy đơn hàng gần nhất
        const latestOrder = await pool.query(`
          SELECT id, order_code, status, created_at, completed_at, pickup_number
          FROM orders
          WHERE customer_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [customerId]);

        if (latestOrder.rows.length === 0) {
          return {
            answer: "Bạn chưa có đơn hàng nào. Hãy đặt hàng để sử dụng dịch vụ của chúng tôi!",
            intentCode: "order_status",
          };
        }

        const order = latestOrder.rows[0];
        return this.formatOrderStatus(order);
      }

      // Tìm đơn hàng theo order code
      const orderResult = await pool.query(`
        SELECT id, order_code, status, created_at, completed_at, pickup_number
        FROM orders
        WHERE order_code = $1 AND customer_id = $2
        LIMIT 1
      `, [orderCode, customerId]);

      if (orderResult.rows.length === 0) {
        return {
          answer: `Không tìm thấy đơn hàng với mã ${orderCode}. Vui lòng kiểm tra lại mã đơn hàng.`,
          intentCode: "order_status",
        };
      }

      const order = orderResult.rows[0];
      return this.formatOrderStatus(order);
    } catch (error: any) {
      console.error("[Order Status Handler] Error:", error);
      
      // Nếu bảng orders chưa tồn tại hoặc có lỗi, trả về message thân thiện
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        return {
          answer: "Bạn chưa có đơn hàng nào. Hãy đặt hàng để sử dụng dịch vụ của chúng tôi!",
          intentCode: "order_status",
        };
      }
      
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi kiểm tra trạng thái đơn hàng. Vui lòng thử lại sau.",
        intentCode: "order_status",
      };
    }
  }

  private formatOrderStatus(order: any): ChatResponse {
    const statusMap: Record<string, string> = {
      pending: "đang chờ xử lý",
      paid: "đã thanh toán",
      completed: "đã hoàn thành",
      voided: "đã hủy",
      refunded: "đã hoàn tiền",
    };

    const statusText = statusMap[order.status] || order.status;
    let answer = `Đơn hàng ${order.order_code} của bạn đang ở trạng thái: ${statusText}.`;

    if (order.pickup_number) {
      answer += ` Số thứ tự: ${order.pickup_number}.`;
    }

    if (order.completed_at) {
      const completedDate = new Date(order.completed_at).toLocaleString("vi-VN");
      answer += ` Hoàn thành lúc: ${completedDate}.`;
    } else if (order.status === "pending" || order.status === "paid") {
      answer += " Đơn hàng đang được xử lý, vui lòng chờ trong giây lát.";
    }

    return {
      answer,
      intentCode: "order_status",
      metadata: {
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
      },
    };
  }
}
