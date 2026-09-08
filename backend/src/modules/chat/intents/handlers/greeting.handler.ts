import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Handler cho greeting (câu chào hỏi)
 * Trả về câu trả lời cố định, KHÔNG query database
 */
export class GreetingHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "greeting";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    // Câu trả lời cố định cho greeting
    const greetingMessages = [
      "Xin chào! 👋 Tôi là trợ lý AI của KOHI. Tôi có thể giúp bạn:\n\n📋 Xem menu và giá cả\n📦 Kiểm tra trạng thái đơn hàng\n🎉 Xem khuyến mãi hiện tại\n📅 Đặt bàn\n\nBạn cần tôi giúp gì hôm nay? 😊",
      "Chào bạn! 😊 Tôi là trợ lý AI của KOHI. Bạn muốn biết gì về:\n\n• Menu và giá cả\n• Trạng thái đơn hàng\n• Khuyến mãi\n• Đặt bàn\n\nHãy cho tôi biết bạn cần gì nhé!",
      "Xin chào! Tôi là trợ lý AI của KOHI. Tôi sẵn sàng giúp bạn với:\n\n☕ Menu và giá cả\n📦 Đơn hàng\n🎁 Khuyến mãi\n🪑 Đặt bàn\n\nBạn muốn hỏi gì? 😊",
    ];

    // Chọn ngẫu nhiên một trong các greeting messages
    const randomIndex = Math.floor(Math.random() * greetingMessages.length);
    const answer = greetingMessages[randomIndex];

    return {
      answer,
      intentCode: "greeting",
    };
  }
}
