import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";
import { ASSISTANT_CONFIG } from "../../assistant.config";

/**
 * Handler cho fallback (khi không detect được intent)
 * Dùng ASSISTANT_CONFIG: thân thiện, gợi ý scope trong phạm vi
 */
export class FallbackHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "fallback";
  }

  async handle(_context: IntentHandlerContext): Promise<ChatResponse> {
    return {
      answer: ASSISTANT_CONFIG.outOfScopeMessage,
      intentCode: "fallback",
    };
  }
}
