import {
  getOrCreateConversation,
  getConversationMessages,
  saveMessage,
  updateConversationMetadata,
} from "./chat.repo";
import { detectIntent } from "./intents/intent-detector";
import { ASSISTANT_CONFIG } from "./assistant.config";
import { intentHandlerRegistry } from "./intents/intent-handler-registry";
import { ChatResponse } from "./types";
import {
  isDrinkCategoryName,
  lookupProductSummaryById,
  tryBuildSpecificProductResponse,
} from "./intents/product-catalog.service";

export type CustomerMessageDto = {
  id: number;
  from: "user" | "bot";
  text: string;
};

async function buildConversationMetadataPatch(
  message: string,
  detectedIntent: NonNullable<Awaited<ReturnType<typeof detectIntent>>>,
  response: ChatResponse
): Promise<Record<string, unknown>> {
  const metadataPatch: Record<string, unknown> = {
    lastUserMessage: message,
    lastDetectedIntentCode: detectedIntent.intent.code,
    lastMatchedKeywords: detectedIntent.matchedKeywords,
    lastResponseIntentCode: response.intentCode,
    lastInteractionAt: new Date().toISOString(),
  };

  const responseMetadata = response.metadata || {};
  const responseProductId =
    typeof responseMetadata.productId === "number" ? responseMetadata.productId : undefined;

  const productSummary = responseProductId
    ? await lookupProductSummaryById(responseProductId)
    : null;

  const resolvedProductName =
    productSummary?.name ||
    (typeof responseMetadata.productName === "string" ? responseMetadata.productName : null);
  const resolvedProductCategory =
    productSummary?.categoryName ||
    (typeof responseMetadata.productCategory === "string" ? responseMetadata.productCategory : null);

  if (responseProductId && resolvedProductName) {
    metadataPatch.lastRecommendedProduct = {
      id: responseProductId,
      name: resolvedProductName,
      category: resolvedProductCategory,
      intentCode: response.intentCode,
      updatedAt: new Date().toISOString(),
    };
  }

  if (responseProductId && resolvedProductName && isDrinkCategoryName(resolvedProductCategory)) {
    metadataPatch.lastRecommendedDrink = {
      id: responseProductId,
      name: resolvedProductName,
      category: resolvedProductCategory,
      intentCode: response.intentCode,
      updatedAt: new Date().toISOString(),
    };
  }

  if (typeof responseMetadata.storeId === "number") {
    metadataPatch.lastStore = {
      id: responseMetadata.storeId,
      name: typeof responseMetadata.storeName === "string" ? responseMetadata.storeName : null,
      updatedAt: new Date().toISOString(),
    };
  }

  return metadataPatch;
}

/**
 * Lấy lịch sử tin nhắn của customer (user + assistant)
 */
export async function getCustomerMessages(customerId: string): Promise<CustomerMessageDto[]> {
  const customerIdNum = parseInt(customerId, 10);
  if (isNaN(customerIdNum)) return [];

  try {
    const conversation = await getOrCreateConversation(customerIdNum);
    const rows = await getConversationMessages(conversation.id, 50);
    return rows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        from: m.role === "user" ? "user" : "bot",
        text: m.content,
      }));
  } catch (err) {
    console.error("[getCustomerMessages]", err);
    return [];
  }
}

/**
 * Chatbot Level 2: Keyword + Database
 * 
 * Flow:
 * 1. Detect intent từ message (keyword-based)
 * 2. Route đến handler tương ứng
 * 3. Handler xử lý:
 *    - Static (FAQ): Query từ chat_knowledge
 *    - Dynamic: Query từ database thật (orders, promotions, etc.)
 * 4. Trả về response
 */
export async function customerChat(message: string, customerId?: string): Promise<ChatResponse & { conversationId: number }> {
  const customerIdNum = customerId ? parseInt(customerId, 10) : undefined;
  if (!customerIdNum || isNaN(customerIdNum)) {
    throw new Error("Customer ID is required and must be a valid number");
  }

  let conversation;

  try {
    // Lấy hoặc tạo conversation
    conversation = await getOrCreateConversation(customerIdNum);

    // Lưu user message
    await saveMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });

    await updateConversationMetadata(conversation.id, {
      lastUserMessage: message,
      lastUserMessageAt: new Date().toISOString(),
    });
  } catch (dbError: any) {
    console.error("[Chat DB Error]", {
      error: dbError.message,
      stack: dbError.stack,
      customerId: customerIdNum,
    });

    if (dbError.message?.includes("not found") || dbError.message?.includes("does not exist")) {
      throw new Error(
        "Chat database tables not found. Please run migration scripts to create chat_conversations, chat_messages, chat_intents, and chat_knowledge tables."
      );
    }
    throw dbError;
  }

  // Step 1: Detect intent
  const detectedIntent = await detectIntent(message);
  
  console.log("[Chat Service] Intent detection result:", {
    detected: !!detectedIntent,
    intentCode: detectedIntent?.intent.code,
    confidence: detectedIntent?.confidence,
    matchedKeywords: detectedIntent?.matchedKeywords,
    message: message.substring(0, 50),
  });

  if (!detectedIntent) {
    const fallbackAnswer = ASSISTANT_CONFIG.outOfScopeMessage;
    
    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: fallbackAnswer,
    });

    return {
      answer: fallbackAnswer,
      intentCode: "fallback",
      conversationId: conversation.id,
    };
  }

  // Step 2: Get handler
  const handler = intentHandlerRegistry.getHandler(detectedIntent.intent);
  
  console.log("[Chat Service] Handler lookup:", {
    intentCode: detectedIntent.intent.code,
    handlerFound: !!handler,
    handlerType: detectedIntent.intent.handlerType,
  });

  if (!handler) {
    console.warn("[Chat Service] No handler found for intent", detectedIntent.intent.code);
    const fallbackAnswer = ASSISTANT_CONFIG.outOfScopeMessage;
    
    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: fallbackAnswer,
    });

    return {
      answer: fallbackAnswer,
      intentCode: "fallback",
      conversationId: conversation.id,
    };
  }

  // Step 3: Handle intent
  let response: ChatResponse;
  try {
    const specificProductResponse = await tryBuildSpecificProductResponse(message, detectedIntent.intent.code);
    if (specificProductResponse) {
      response = specificProductResponse;
    } else {
      response = await handler.handle({
        customerId: customerIdNum,
        message,
        detectedIntent,
        conversationId: conversation.id,
      });
    }
  } catch (handlerError: any) {
    console.error("[Chat Service] Handler error:", handlerError);
    response = {
      answer: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.",
      intentCode: "fallback",
    };
  }

  // Step 4: Save assistant response
  try {
    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: response.answer,
    });

    await updateConversationMetadata(
      conversation.id,
      await buildConversationMetadataPatch(message, detectedIntent, response)
    );
  } catch (saveError: any) {
    console.error("[Save Message Error]", {
      error: saveError.message,
      conversationId: conversation.id,
    });
    // Tiếp tục dù có lỗi lưu message
  }

  console.log("[Chat Success]", {
    conversationId: conversation.id,
    intentCode: response.intentCode,
    answerLength: response.answer.length,
    customerId: customerIdNum,
    confidence: detectedIntent.confidence,
  });

  return {
    ...response,
    conversationId: conversation.id,
  };
}
