/**
 * Chatbot Level 2: Keyword + Database Types
 */

export type IntentCode = 
  | "greeting"
  | "faq" 
  | "order_status" 
  | "promotion" 
  | "reservation" 
  | "table_availability"
  | "coffee_recommendation"
  | "freeze_recommendation"
  | "phindi_recommendation"
  | "tea_recommendation"
  | "drink_recommendation"
  | "juice_recommendation"
  | "others_drink_recommendation"
  | "bakery_recommendation"
  | "bakery_savory_recommendation"
  | "bakery_sweet_recommendation"
  | "topping_recommendation"
  | "combo_recommendation"
  | "drink_pairing_combo"
  | "drink_pairing_cake"
  | "drink_pairing_combo_and_cake"
  | "nearest_store"
  | "fallback";

export type HandlerType = "static" | "dynamic";

export interface ChatIntent {
  id: number;
  code: IntentCode;
  name: string;
  description: string | null;
  keywords: string[];
  handlerType: HandlerType;
  priority: number;
  isActive: boolean;
}

export interface ChatKnowledge {
  id: number;
  intentCode: IntentCode;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  priority: number;
  isActive: boolean;
}

export interface DetectedIntent {
  intent: ChatIntent;
  confidence: number; // Số keywords match / tổng số keywords
  matchedKeywords: string[];
}

export interface ChatResponse {
  answer: string;
  intentCode: IntentCode;
  metadata?: {
    orderId?: number;
    orderCode?: string;
    promotionId?: number;
    reservationId?: number;
    productId?: number;
    productName?: string;
    productCategory?: string | null;
    storeId?: number;
    storeName?: string;
    latitude?: number;
    longitude?: number;
    [key: string]: unknown;
  };
}

export interface IntentHandlerContext {
  customerId: number;
  message: string;
  detectedIntent: DetectedIntent;
  conversationId: number;
}

export interface IntentHandler {
  canHandle(intent: ChatIntent): boolean;
  handle(context: IntentHandlerContext): Promise<ChatResponse>;
}
