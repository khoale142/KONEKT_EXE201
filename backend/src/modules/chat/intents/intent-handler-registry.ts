import { ChatIntent, IntentHandler } from "../types";
import { GreetingHandler } from "./handlers/greeting.handler";
import { FaqHandler } from "./handlers/faq.handler";
import { OrderStatusHandler } from "./handlers/order-status.handler";
import { PromotionHandler } from "./handlers/promotion.handler";
import { ReservationHandler } from "./handlers/reservation.handler";
import { TableAvailabilityHandler } from "./handlers/table-availability.handler";
import { CoffeeRecommendationHandler } from "./handlers/coffee-recommendation.handler";
import { FreezeRecommendationHandler } from "./handlers/freeze-recommendation.handler";
import { PhindiRecommendationHandler } from "./handlers/phindi-recommendation.handler";
import { TeaRecommendationHandler } from "./handlers/tea-recommendation.handler";
import { DrinkRecommendationHandler } from "./handlers/drink-recommendation.handler";
import { JuiceRecommendationHandler } from "./handlers/juice-recommendation.handler";
import { OthersDrinkRecommendationHandler } from "./handlers/others-drink-recommendation.handler";
import { BakeryRecommendationHandler } from "./handlers/bakery-recommendation.handler";
import { BakerySavoryRecommendationHandler } from "./handlers/bakery-savory-recommendation.handler";
import { BakerySweetRecommendationHandler } from "./handlers/bakery-sweet-recommendation.handler";
import { ToppingRecommendationHandler } from "./handlers/topping-recommendation.handler";
import { NearestStoreHandler } from "./handlers/nearest-store.handler";
import { ComboRecommendationHandler } from "./handlers/combo-recommendation.handler";
import { DrinkPairingHandler } from "./handlers/drink-pairing.handler";
import { FallbackHandler } from "./handlers/fallback.handler";

/**
 * Registry để quản lý các intent handlers
 */
class IntentHandlerRegistry {
  private handlers: IntentHandler[] = [];

  constructor() {
    // Đăng ký tất cả handlers
    // Lưu ý: Thứ tự đăng ký không quan trọng vì handler được chọn dựa trên canHandle()
    this.register(new GreetingHandler());
    this.register(new FaqHandler());
    this.register(new OrderStatusHandler());
    this.register(new PromotionHandler());
    this.register(new ReservationHandler());
    this.register(new TableAvailabilityHandler());
    this.register(new CoffeeRecommendationHandler());
    this.register(new FreezeRecommendationHandler());
    this.register(new PhindiRecommendationHandler());
    this.register(new TeaRecommendationHandler());
    this.register(new DrinkRecommendationHandler());
    this.register(new JuiceRecommendationHandler());
    this.register(new OthersDrinkRecommendationHandler());
    this.register(new BakeryRecommendationHandler());
    this.register(new BakerySavoryRecommendationHandler());
    this.register(new BakerySweetRecommendationHandler());
    this.register(new ToppingRecommendationHandler());
    this.register(new NearestStoreHandler());
    this.register(new ComboRecommendationHandler());
    this.register(new DrinkPairingHandler());
    this.register(new FallbackHandler());
  }

  register(handler: IntentHandler): void {
    this.handlers.push(handler);
  }

  getHandler(intent: ChatIntent): IntentHandler | null {
    for (const handler of this.handlers) {
      if (handler.canHandle(intent)) {
        return handler;
      }
    }
    return null;
  }
}

// Singleton instance
export const intentHandlerRegistry = new IntentHandlerRegistry();
