import { ChatIntent, IntentHandler, IntentHandlerContext, ChatResponse } from "../../types";

/**
 * Base handler cho tất cả intent handlers
 */
export abstract class BaseIntentHandler implements IntentHandler {
  abstract canHandle(intent: ChatIntent): boolean;
  abstract handle(context: IntentHandlerContext): Promise<ChatResponse>;

  /**
   * Helper: Chuẩn hóa text
   */
  protected normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
}
