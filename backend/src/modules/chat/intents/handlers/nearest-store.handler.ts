import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";
import { findStoresForMessage, formatNearestStoreAnswer } from "../store-info.service";

export class NearestStoreHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "nearest_store" && intent.handlerType === "dynamic";
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    try {
      const { stores } = await findStoresForMessage(context.message, 1);
      if (stores.length === 0) {
        return {
          answer: "Da hien tai minh chua lay duoc thong tin chi nhanh dang hoat dong. Ban vui long thu lai sau nhe.",
          intentCode: "nearest_store",
        };
      }

      const store = stores[0];
      return {
        answer: formatNearestStoreAnswer(store),
        intentCode: "nearest_store",
        metadata: {
          storeId: store.id,
          storeName: store.name,
          latitude: store.latitude ?? undefined,
          longitude: store.longitude ?? undefined,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err.message?.includes("does not exist") || err.message?.includes("relation") || err.code === "42P01") {
        return {
          answer: "Da hien tai thong tin chi nhanh dang duoc cap nhat. Ban vui long xem trong app hoac website nhe.",
          intentCode: "nearest_store",
        };
      }

      return {
        answer: "Xin loi, minh gap loi khi tim thong tin chi nhanh. Ban vui long thu lai sau nhe.",
        intentCode: "nearest_store",
      };
    }
  }
}
