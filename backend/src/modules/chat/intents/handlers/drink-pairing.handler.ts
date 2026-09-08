/**
 * Handler cho drink_pairing_combo | drink_pairing_cake | drink_pairing_combo_and_cake
 * Follow-up: combo/bánh theo món nước vừa gợi ý
 */

import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";
import { BaseIntentHandler } from "./base.handler";
import { resolveConversationContext } from "../drink-pairing/follow-up-context.resolver";
import { findCombosForDrink } from "../drink-pairing/combo-finder.service";
import { pickRandomCakes } from "../drink-pairing/cake-picker.service";
import {
  askWhichDrinkMessage,
  formatComboResponse,
  formatCakeResponse,
  noComboFallbackToCakeMessage,
  noComboNoCakeMessage,
  noCakeMessage,
} from "../drink-pairing/response-templates";

const PAIRING_INTENTS = ["drink_pairing_combo", "drink_pairing_cake", "drink_pairing_combo_and_cake"] as const;

export class DrinkPairingHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return PAIRING_INTENTS.includes(intent.code as (typeof PAIRING_INTENTS)[number]);
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    try {
      const intentCode = context.detectedIntent.intent.code as (typeof PAIRING_INTENTS)[number];
      const conversationId = context.conversationId;

      const ctx = await resolveConversationContext(conversationId);
      const drink = ctx.lastRecommendedDrink || ctx.lastMentionedDrink;

      switch (intentCode) {
        case "drink_pairing_combo":
          return this.handleComboOnly(context, drink);
        case "drink_pairing_cake":
          return this.handleCakeOnly(context, drink);
        case "drink_pairing_combo_and_cake":
          return this.handleComboAndCake(context, drink);
        default:
          return { answer: askWhichDrinkMessage(), intentCode: "drink_pairing_combo" };
      }
    } catch (error) {
      console.error("[DrinkPairingHandler] Error:", error);
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.",
        intentCode: "drink_pairing_combo",
      };
    }
  }

  /** Chỉ hỏi combo: cần drink context. Nếu không có combo → fallback bánh */
  private async handleComboOnly(
    _context: IntentHandlerContext,
    drink: { id: number; name: string; category: string | null } | null
  ): Promise<ChatResponse> {
    try {
      if (!drink) {
        return {
          answer: askWhichDrinkMessage(),
          intentCode: "drink_pairing_combo",
        };
      }

      const combos = await findCombosForDrink(drink);
      if (combos.length > 0) {
        return {
          answer: formatComboResponse(combos, drink.name),
          intentCode: "drink_pairing_combo",
          metadata: { drinkId: drink.id, drinkName: drink.name, comboCount: combos.length },
        };
      }

      const cakes = await pickRandomCakes(3, drink);
      if (cakes.length > 0) {
        return {
          answer: noComboFallbackToCakeMessage(cakes, drink.name),
          intentCode: "drink_pairing_combo",
          metadata: { drinkId: drink.id, drinkName: drink.name, fallbackToCake: true },
        };
      }

      return {
        answer: noComboNoCakeMessage(),
        intentCode: "drink_pairing_combo",
      };
    } catch (error) {
      console.error("[handleComboOnly] Error:", error);
      return {
        answer: "Dạ hiện tại mình chưa có thông tin về combo phù hợp. Vui lòng thử lại sau.",
        intentCode: "drink_pairing_combo",
      };
    }
  }

  /** Chỉ hỏi bánh: không bắt buộc drink, random bánh */
  private async handleCakeOnly(
    _context: IntentHandlerContext,
    drink: { id: number; name: string; category: string | null } | null
  ): Promise<ChatResponse> {
    try {
      const cakes = await pickRandomCakes(3, drink);
      if (cakes.length > 0) {
        return {
          answer: formatCakeResponse(cakes, drink?.name),
          intentCode: "drink_pairing_cake",
          metadata: { cakeCount: cakes.length },
        };
      }
      return {
        answer: noCakeMessage(),
        intentCode: "drink_pairing_cake",
      };
    } catch (error) {
      console.error("[handleCakeOnly] Error:", error);
      return {
        answer: "Dạ hiện tại mình chưa có thông tin về bánh. Vui lòng thử lại sau.",
        intentCode: "drink_pairing_cake",
      };
    }
  }

  /** Hỏi cả combo và bánh: tách response, combo trước bánh sau */
  private async handleComboAndCake(
    _context: IntentHandlerContext,
    drink: { id: number; name: string; category: string | null } | null
  ): Promise<ChatResponse> {
    try {
      if (!drink) {
        return {
          answer: askWhichDrinkMessage(),
          intentCode: "drink_pairing_combo_and_cake",
        };
      }

      let part1 = "";
      const combos = await findCombosForDrink(drink);
      if (combos.length > 0) {
        part1 = formatComboResponse(combos, drink.name);
      } else {
        part1 = "Dạ hiện chưa có combo phù hợp với món đó.";
      }

      let part2 = "";
      const cakes = await pickRandomCakes(3, drink);
      if (cakes.length > 0) {
        part2 = formatCakeResponse(cakes, drink.name);
      } else {
        part2 = "Hiện cũng chưa có bánh để gợi ý.";
      }

      const answer = part1 + "\n\n" + part2;

      return {
        answer,
        intentCode: "drink_pairing_combo_and_cake",
        metadata: {
          drinkId: drink.id,
          drinkName: drink.name,
          comboCount: combos.length,
          cakeCount: cakes.length,
        },
      };
    } catch (error) {
      console.error("[handleComboAndCake] Error:", error);
      return {
        answer: "Dạ hiện tại mình chưa có thông tin đó. Bạn có thể hỏi mình về menu, combo, khuyến mãi, giờ mở cửa, địa chỉ hoặc tích điểm nhé.",
        intentCode: "drink_pairing_combo_and_cake",
      };
    }
  }
}
