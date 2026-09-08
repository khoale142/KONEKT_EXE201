import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";
import { ChatKnowledge } from "../../types";
import {
  findStoresForMessage,
  formatAddressAnswer,
  formatContactAnswer,
  formatHoursAnswer,
} from "../store-info.service";

type FaqTopic =
  | "menu"
  | "points"
  | "hours"
  | "address"
  | "contact"
  | "delivery";

const FAQ_TOPIC_PATTERNS: Record<FaqTopic, string[]> = {
  menu: [
    "menu",
    "thuc don",
    "bang gia",
    "gia",
    "gia ca",
    "xem menu",
    "xem thuc don",
    "danh sach mon",
    "mon nao",
    "co mon gi",
    "quan ban gi",
    "co do uong gi",
    "co banh gi",
    "menu hien tai",
    "full menu",
    "xem bang gia",
    "price",
    "pricing",
  ],
  points: [
    "tich diem",
    "diem tich luy",
    "diem thuong",
    "point",
    "points",
    "loyalty",
    "membership",
    "member",
    "doi diem",
    "doi qua",
    "hoi vien",
    "voucher cua toi",
    "uu dai hoi vien",
    "reward points",
    "loyalty points",
    "diem hoi vien",
    "so diem",
    "bao nhieu diem",
    "kiem tra voucher",
  ],
  hours: [
    "gio mo cua",
    "gio dong cua",
    "mo cua",
    "dong cua",
    "mo may gio",
    "dong may gio",
    "may gio mo cua",
    "may gio dong cua",
    "quan mo may gio",
    "quan dong may gio",
    "gio hoat dong",
    "gio phuc vu",
    "gio lam viec",
    "bao gio mo cua",
    "bao gio dong cua",
    "mo cua hom nay",
    "dong cua hom nay",
    "open now",
    "close now",
    "opening hour",
    "opening hours",
    "business hour",
    "business hours",
    "working hours",
  ],
  address: [
    "dia chi",
    "chi nhanh",
    "cua hang",
    "quan o dau",
    "store",
    "branch",
    "google map",
    "map",
    "chi duong",
    "duong di",
    "gan nhat",
    "gan day",
    "near me",
    "location",
    "dia diem",
    "vi tri",
    "toa do",
  ],
  contact: [
    "lien he",
    "hotline",
    "so dien thoai",
    "sdt",
    "phone",
    "facebook",
    "fanpage",
    "instagram",
    "zalo",
    "email",
    "contact",
    "cham soc khach hang",
    "so hotline",
    "phone number",
    "social",
    "fb",
    "messenger",
  ],
  delivery: [
    "ship",
    "giao hang",
    "delivery",
    "freeship",
    "co ship khong",
    "co giao hang khong",
    "ship tan noi",
    "giao tan noi",
    "dat giao hang",
    "ship qua app",
    "co freeship khong",
    "giao den nha",
    "delivery app",
  ],
};

const FAQ_CATEGORY_ALIASES: Record<FaqTopic, string[]> = {
  menu: ["menu", "thuc don", "gia", "bang gia", "pricing", "price"],
  points: ["points", "point", "tich diem", "membership", "member", "loyalty", "reward", "voucher"],
  hours: ["hours", "hour", "gio", "gio mo cua", "opening", "opening_hours", "business_hours"],
  address: ["address", "dia chi", "store", "branch", "location", "chi nhanh"],
  contact: ["contact", "lien he", "hotline", "phone", "social", "facebook", "zalo", "email"],
  delivery: ["delivery", "ship", "giao hang", "shipping", "freeship"],
};

/**
 * Handler cho FAQ (câu hỏi tĩnh)
 * Query từ bảng chat_knowledge
 */
export class FaqHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "faq" && intent.handlerType === "static";
  }

  private normalizeFaqText(text: string): string {
    return this.normalizeText(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private containsPhrase(normalizedText: string, phrase: string): boolean {
    const normalizedPhrase = this.normalizeFaqText(phrase);
    if (!normalizedPhrase) return false;

    const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(normalizedText);
  }

  private inferTopics(normalizedMessage: string, matchedKeywords: string[]): FaqTopic[] {
    const topics = new Set<FaqTopic>();

    if (matchedKeywords.includes("menu")) topics.add("menu");
    if (matchedKeywords.includes("points")) topics.add("points");
    if (matchedKeywords.includes("nearest_store")) topics.add("address");

    for (const [topic, patterns] of Object.entries(FAQ_TOPIC_PATTERNS) as Array<[FaqTopic, string[]]>) {
      if (patterns.some((pattern) => this.containsPhrase(normalizedMessage, pattern))) {
        topics.add(topic);
      }
    }

    return Array.from(topics);
  }

  private scoreTextMatches(normalizedMessage: string, phrases: string[]): number {
    let score = 0;

    for (const phrase of phrases) {
      const normalizedPhrase = this.normalizeFaqText(phrase);
      if (!normalizedPhrase) continue;
      if (normalizedPhrase.length <= 2 && !normalizedPhrase.includes(" ")) continue;
      if (!this.containsPhrase(normalizedMessage, normalizedPhrase)) continue;

      score += normalizedPhrase.includes(" ") ? 4 : normalizedPhrase.length >= 6 ? 3 : 2;
    }

    return score;
  }

  private getCategoryBonus(knowledge: ChatKnowledge, topics: FaqTopic[]): number {
    const normalizedCategory = this.normalizeFaqText(knowledge.category || "");
    const normalizedQuestion = this.normalizeFaqText(knowledge.question || "");
    let bonus = 0;

    for (const topic of topics) {
      const aliases = FAQ_CATEGORY_ALIASES[topic];
      if (aliases.some((alias) => normalizedCategory === alias || normalizedCategory.includes(alias))) {
        bonus += 8;
      }

      if (FAQ_TOPIC_PATTERNS[topic].some((pattern) => this.containsPhrase(normalizedQuestion, pattern))) {
        bonus += 3;
      }
    }

    return bonus;
  }

  private pickTopicRow(rows: ChatKnowledge[], topic: FaqTopic): ChatKnowledge | null {
    const aliases = FAQ_CATEGORY_ALIASES[topic];

    return (
      rows.find((row) => {
        const normalizedCategory = this.normalizeFaqText(row.category || "");
        return aliases.some((alias) => normalizedCategory === alias || normalizedCategory.includes(alias));
      }) ||
      rows.find((row) => {
        const normalizedQuestion = this.normalizeFaqText(row.question || "");
        return FAQ_TOPIC_PATTERNS[topic].some((pattern) => this.containsPhrase(normalizedQuestion, pattern));
      }) ||
      rows.find((row) => {
        const keywords = row.keywords || [];
        return keywords.some((keyword) =>
          FAQ_TOPIC_PATTERNS[topic].some((pattern) => this.normalizeFaqText(keyword) === this.normalizeFaqText(pattern))
        );
      }) ||
      null
    );
  }

  private async tryBuildStoreTopicResponse(message: string, topics: FaqTopic[]): Promise<ChatResponse | null> {
    if (topics.includes("hours")) {
      const { stores, specific } = await findStoresForMessage(message, 3);
      if (stores.length > 0) {
        return {
          answer: formatHoursAnswer(stores, specific),
          intentCode: "faq",
          metadata: {
            category: "hours",
            storeId: stores[0].id,
            storeName: stores[0].name,
          },
        };
      }
    }

    if (topics.includes("address")) {
      const { stores, specific } = await findStoresForMessage(message, 3);
      if (stores.length > 0) {
        return {
          answer: formatAddressAnswer(stores, specific),
          intentCode: "faq",
          metadata: {
            category: "address",
            storeId: stores[0].id,
            storeName: stores[0].name,
          },
        };
      }
    }

    if (topics.includes("contact")) {
      const { stores, specific } = await findStoresForMessage(message, 3);
      if (stores.length > 0) {
        return {
          answer: formatContactAnswer(stores, specific),
          intentCode: "faq",
          metadata: {
            category: "contact",
            storeId: stores[0].id,
            storeName: stores[0].name,
          },
        };
      }
    }

    return null;
  }

  private buildTopicFallback(topics: FaqTopic[]): ChatResponse {
    if (topics.includes("hours")) {
      return {
        answer:
          "Dạ giờ mở cửa có thể khác nhau theo từng chi nhánh. Bạn cho mình tên cửa hàng hoặc xem mục cửa hàng gần bạn để kiểm tra giờ hoạt động chính xác nhé.",
        intentCode: "faq",
      };
    }

    if (topics.includes("address")) {
      return {
        answer:
          "Dạ bạn có thể xem danh sách chi nhánh và địa chỉ tại mục cửa hàng trên website hoặc ứng dụng. Nếu cần, mình có thể hỗ trợ tìm cửa hàng gần bạn nhé.",
        intentCode: "faq",
      };
    }

    if (topics.includes("contact")) {
      return {
        answer:
          "Dạ bạn có thể liên hệ qua hotline hoặc kênh chính thức của KOHI trên website/app. Nếu bạn cần hỗ trợ theo chi nhánh cụ thể, mình có thể giúp bạn tìm thông tin phù hợp.",
        intentCode: "faq",
      };
    }

    if (topics.includes("delivery")) {
      return {
        answer:
          "Dạ việc giao hàng có thể phụ thuộc vào khu vực và chi nhánh. Bạn kiểm tra trên app hoặc website để xem cửa hàng gần bạn có hỗ trợ giao hàng không nhé.",
        intentCode: "faq",
      };
    }

    if (topics.includes("menu")) {
      return {
        answer:
          "Dạ menu KOHI có đầy đủ cà phê, trà, nước ép, freeze và bánh. Bạn có thể xem chi tiết món và giá tại mục Thực đơn trên website hoặc ứng dụng nhé.",
        intentCode: "faq",
      };
    }

    if (topics.includes("points")) {
      return {
        answer:
          "Dạ KOHI có chương trình tích điểm cho thành viên. Bạn có thể xem điểm hiện có, voucher và quyền lợi trong tài khoản của mình trên app nhé.",
        intentCode: "faq",
      };
    }

    return {
      answer: "Xin lỗi, tôi chưa có thông tin chính xác cho câu hỏi này. Bạn có thể hỏi cụ thể hơn về menu, giờ mở cửa, địa chỉ, liên hệ hoặc tích điểm nhé.",
      intentCode: "faq",
    };
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    const { message, detectedIntent } = context;
    const normalizedMessage = this.normalizeFaqText(message);
    const topics = this.inferTopics(normalizedMessage, detectedIntent.matchedKeywords || []);

    try {
      const storeTopicResponse = await this.tryBuildStoreTopicResponse(message, topics);
      if (storeTopicResponse) {
        return storeTopicResponse;
      }
      // Tìm knowledge item có keywords match với message
      const result = await pool.query<ChatKnowledge>(`
        SELECT id, intent_code as "intentCode", question, answer, keywords, category, priority, is_active as "isActive"
        FROM coffee_chain_db.chat_knowledge
        WHERE intent_code = $1
          AND is_active = TRUE
        ORDER BY priority DESC, id ASC
      `, [detectedIntent.intent.code]);

      if (result.rows.length === 0) {
        return this.buildTopicFallback(topics);
      }

      // Tìm knowledge item có độ phù hợp cao nhất
      let bestMatch: ChatKnowledge | null = null;
      let bestScore = 0;

      for (const knowledge of result.rows) {
        const keywordScore = this.scoreTextMatches(normalizedMessage, knowledge.keywords || []);
        const questionScore = this.scoreTextMatches(normalizedMessage, [knowledge.question]);
        const categoryBonus = this.getCategoryBonus(knowledge, topics);
        const totalScore = keywordScore + questionScore + categoryBonus;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = knowledge;
        }
      }

      // Nếu có match, trả về answer
      if (bestMatch && bestScore > 0) {
        return {
          answer: bestMatch.answer,
          intentCode: "faq",
          metadata: {
            knowledgeId: bestMatch.id,
            category: bestMatch.category,
          },
        };
      }

      // Không có keyword match đủ mạnh: thử lấy knowledge theo topic đã suy luận
      for (const topic of topics) {
        const topicRow = this.pickTopicRow(result.rows, topic);
        if (topicRow) {
          return {
            answer: topicRow.answer,
            intentCode: "faq",
            metadata: {
              knowledgeId: topicRow.id,
              category: topicRow.category,
            },
          };
        }
      }

      return this.buildTopicFallback(topics);
    } catch (error: any) {
      console.error("[FAQ Handler] Error:", error);
      return {
        answer: "Xin lỗi, có lỗi xảy ra khi tìm kiếm thông tin. Vui lòng thử lại sau.",
        intentCode: "faq",
      };
    }
  }
}
