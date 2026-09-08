import { pool } from "../../../config/db";
import { ChatIntent, DetectedIntent } from "../types";
import {
  SYNONYMS,
  TARGET_PATTERNS,
  INTENT_RULES,
  Action,
  Target,
} from "./intent-config";

/**
 * Step 1: Normalize text - lowercase, remove Vietnamese diacritics
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

/**
 * Step 2: Replace synonyms - chuỗi normalized → chuỗi chuẩn
 * Input đã normalize, SYNONYMS chỉ dùng phiên bản không dấu.
 * Sắp xếp theo độ dài giảm dần để ưu tiên match cụm dài trước.
 */
function replaceSynonyms(normalizedText: string): string {
  let result = normalizedText;
  const sorted = [...SYNONYMS].sort((a, b) => b[0].length - a[0].length);

  for (const [from, to] of sorted) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "gi");
    result = result.replace(regex, (_match, prefix: string) => `${prefix}${to}`);
  }

  return result;
}

function containsNormalizedPhrase(normalizedText: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;

  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(normalizedText);
}

/**
 * Step 3: Extract action + target from normalized+synonym text
 */
function extractActionAndTarget(normalizedText: string, synonymText: string): { action: Action | string; targets: Target[] } {
  let action: Action | string = "fallback";
  const targets: Target[] = [];

  // Detect action from synonym-replaced text
  // Ưu tiên suggest/recommend trước greet: "chào, gợi ý cà phê" → suggest, không phải greet
  if (synonymText.includes("suggest") || synonymText.includes("recommend")) {
    action = "suggest";
  } else if (synonymText.includes("greet")) {
    action = "greet";
  } else if (synonymText.includes("book_table")) {
    action = "book_table";
  } else if (synonymText.includes("book")) {
    action = "book";
  } else if (synonymText.includes("view") || synonymText.includes("check")) {
    action = synonymText.includes("check") ? "check" : "view";
  }

  // Detect targets - check in priority order (specific first)
  const sortedTargets = [...TARGET_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const { target, patterns } of sortedTargets) {
    const found = patterns.some((p) => containsNormalizedPhrase(normalizedText, p));
    if (found) {
      targets.push(target);
      // Nếu đã match target cụ thể (bakery_savory, bakery_sweet, coffee, freeze...) thì không thêm target cha
      if (["bakery_savory", "bakery_sweet", "coffee", "freeze", "tea", "phindi", "juice", "topping", "combo_tea", "combo_coffee", "combo_phindi"].includes(target)) {
        break;
      }
    }
  }

  // Nếu câu vừa chào vừa hỏi việc khác ("chào shop khuyến mãi gì") thì ưu tiên intent thật sự.
  if (action === "greet" && targets.some((target) => target !== "greeting")) {
    action = "fallback";
  }

  // Nếu có target nhưng chưa có action → suy luận action mặc định theo nhóm intent
  if (targets.length > 0 && action === "fallback") {
    const suggestTargets: Target[] = [
      "coffee",
      "freeze",
      "tea",
      "phindi",
      "juice",
      "others_drink",
      "drink",
      "bakery_savory",
      "bakery_sweet",
      "bakery",
      "topping",
    ];
    const viewTargets: Target[] = [
      "menu",
      "order",
      "promotion",
      "table",
      "nearest_store",
      "faq",
      "reservation",
      "combo",
      "combo_tea",
      "combo_coffee",
      "combo_phindi",
      "points",
      "drink_pairing_combo",
      "drink_pairing_cake",
      "drink_pairing_combo_and_cake",
    ];

    if (targets.some((t) => suggestTargets.includes(t))) {
      action = "suggest";
    } else if (targets.some((t) => viewTargets.includes(t))) {
      action = "view";
    }
  }

  return { action, targets };
}

/**
 * Step 4 & 5: Score intents, return best match
 */
function scoreIntents(
  action: Action | string,
  targets: Target[]
): { intentCode: string; score: number } | null {
  let bestRule: (typeof INTENT_RULES)[0] | null = null;
  let bestScore = 0;

  for (const rule of INTENT_RULES) {
    const actionMatch = rule.action === action;
    const targetMatch = targets.includes(rule.target);

    if (!actionMatch || !targetMatch) continue;

    const score = rule.priority;
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (bestRule) {
    return { intentCode: bestRule.intentCode, score: bestScore };
  }

  // Fallback: nếu có action suggest nhưng không match target cụ thể, thử drink
  if (action === "suggest" && targets.length === 0) {
    return null;
  }

  return null;
}

/**
 * Main: Pipeline detect intent
 * 1. Normalize text
 * 2. Replace synonyms
 * 3. Extract action + target
 * 4. Score intents
 * 5. Lấy intent tốt nhất
 * 6. Query DB để lấy ChatIntent
 */
export async function detectIntent(message: string): Promise<DetectedIntent | null> {
  try {
    // Step 1: Normalize trước
    const normalized = normalizeText(message);

    // Step 2: Replace synonyms (input đã normalize, config chỉ dùng không dấu)
    const withSynonyms = replaceSynonyms(normalized);

    // Step 3: Extract action + target
    const { action, targets } = extractActionAndTarget(normalized, withSynonyms);

    console.log("[Intent Pipeline]", {
      normalized: normalized.substring(0, 50),
      action,
      targets,
    });

    // Step 4 & 5: Score and get best intent
    const best = scoreIntents(action, targets);

    let intentCode: string;

    if (best) {
      intentCode = best.intentCode;
    } else {
      // Fallback
      const fallbackIntent = await pool.query<ChatIntent>(
        `SELECT id, code, name, description, keywords, handler_type as "handlerType", priority, is_active as "isActive"
         FROM coffee_chain_db.chat_intents WHERE code = 'fallback' AND is_active = TRUE LIMIT 1`
      );
      if (fallbackIntent.rows.length > 0) {
        return {
          intent: fallbackIntent.rows[0],
          confidence: 0,
          matchedKeywords: [],
        };
      }
      return null;
    }

    // Step 6: Query DB để lấy ChatIntent
    const result = await pool.query<ChatIntent>(
      `SELECT id, code, name, description, keywords, handler_type as "handlerType", priority, is_active as "isActive"
       FROM coffee_chain_db.chat_intents
       WHERE code = $1 AND is_active = TRUE LIMIT 1`,
      [intentCode]
    );

    if (result.rows.length === 0) {
      console.warn("[Intent Detector] Intent not found in DB:", intentCode);
      const fallbackResult = await pool.query<ChatIntent>(
        `SELECT id, code, name, description, keywords, handler_type as "handlerType", priority, is_active as "isActive"
         FROM coffee_chain_db.chat_intents WHERE code = 'fallback' AND is_active = TRUE LIMIT 1`
      );
      if (fallbackResult.rows.length > 0) {
        return {
          intent: fallbackResult.rows[0],
          confidence: 0,
          matchedKeywords: [],
        };
      }
      return null;
    }

    const intent = result.rows[0];

    console.log("[Intent Detector] Detected", {
      intentCode: intent.code,
      action,
      targets,
    });

    return {
      intent,
      confidence: best ? 1 : 0,
      matchedKeywords: [action, ...targets],
    };
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error("[Intent Detector] Error:", {
      error: err.message,
      stack: err.stack,
    });
    return null;
  }
}
