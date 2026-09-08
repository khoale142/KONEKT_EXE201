/**
 * Cấu hình trợ lý AI KOHI - phong cách trả lời khách hàng
 * Dùng cho: fallback, format response, scope validation
 */

export const ASSISTANT_CONFIG = {
  /** Phạm vi trả lời được phép */
  scope: [
    "menu",
    "combo",
    "khuyen_mai",
    "gio_mo_cua",
    "dia_chi",
    "dat_ban",
    "tich_diem",
    "thong_tin_co_ban",
  ] as const,

  /** Câu trả lời khi ngoài phạm vi (fallback out-of-scope) */
  outOfScopeMessage:
    "Dạ hiện tại mình chưa có thông tin đó. Bạn có thể hỏi mình về menu, combo, khuyến mãi, giờ mở cửa, địa chỉ hoặc tích điểm nhé.",

  /** Câu gợi ý sau khi trả lời combo chung */
  comboGeneralFollowUp:
    "Bạn muốn mình gợi ý combo nào trước ạ?",

  /** Câu kết thúc combo cụ thể */
  comboSpecificEnding:
    "Nếu bạn thích vị thanh nhẹ, mình có thể gợi ý combo trà dễ uống nhất cho bạn ạ.",

  /** Thông báo khi không có dữ liệu */
  noDataMessage:
    "Dạ hiện tại mình chưa có thông tin đó. Bạn có thể hỏi về menu, combo, khuyến mãi hoặc đến cửa hàng xem trực tiếp nhé.",
} as const;

/** Quy tắc phong cách trả lời (hướng dẫn cho handler) */
export const RESPONSE_STYLE = {
  /** Dùng tiếng Việt tự nhiên, thân thiện */
  tone: "friendly",
  /** Câu ngắn gọn, dễ đọc */
  brevity: true,
  /** Hạn chế markdown **, ## */
  avoidHeavyMarkdown: true,
  /** Tối đa 1 emoji nếu phù hợp */
  maxEmojiPerMessage: 1,
  /** Gợi ý bước tiếp theo nhẹ nhàng, không ép mua */
  suggestFollowUp: true,
} as const;

export type AssistantScope = (typeof ASSISTANT_CONFIG.scope)[number];
