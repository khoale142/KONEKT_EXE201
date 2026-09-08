/**
 * Resolve conversation context - lấy món nước gần nhất từ lịch sử chat
 */

import { pool } from "../../../../config/db";
import { removeVietnameseTones } from "../../../../utils/vietnamese";
import { getConversationById, getConversationMessages } from "../../chat.repo";

export type ResolvedDrink = {
  id: number;
  name: string;
  category: string | null;
};

export type ConversationContext = {
  lastRecommendedDrink: ResolvedDrink | null;
  lastMentionedDrink: ResolvedDrink | null;
};

function parseMetadataDrink(value: unknown): ResolvedDrink | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "number" || typeof record.name !== "string") {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    category: typeof record.category === "string" ? record.category : null,
  };
}

const RECOMMEND_PATTERNS_ORIGINAL = [
  /mình gợi ý bạn thử (.+?) nhé/i,
  /gợi ý bạn thử (.+?) nhé/i,
  /gợi ý bạn (.+?) nhé/i,
  /gợi ý (.+?) nhé/i,
  /thử (.+?) nhé/i,
];

const RECOMMEND_PATTERNS_NORMALIZED = [
  /goi y ban thu (.+?) nhe/i,
  /goi y ban (.+?) nhe/i,
  /minh goi y ban thu (.+?) nhe/i,
];

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProductNameFromAssistantMessage(content: string): string | null {
  for (const pattern of RECOMMEND_PATTERNS_ORIGINAL) {
    const m = content.match(pattern);
    if (m && m[1]) {
      let name = m[1].trim().replace(/\n.*$/s, "").replace(/\.+$/, "");
      if (name.length >= 2 && name.length <= 80) return name;
    }
  }
  const normalized = normalizeForMatch(content);
  for (const pattern of RECOMMEND_PATTERNS_NORMALIZED) {
    const m = normalized.match(pattern);
    if (m && m[1]) {
      const name = m[1].trim().replace(/\n.*$/s, "");
      if (name.length >= 2 && name.length <= 80) return name;
    }
  }
  return null;
}

function productNamesMatch(a: string, b: string): boolean {
  const na = removeVietnameseTones(a).toLowerCase().trim().replace(/\s+/g, " ");
  const nb = removeVietnameseTones(b).toLowerCase().trim().replace(/\s+/g, " ");
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function lookupProductByName(productName: string): Promise<ResolvedDrink | null> {
  const nameNorm = productName.trim().replace(/\s+/g, " ");
  if (!nameNorm) return null;

  try {
    const r = await pool.query(
      `SELECT p.id, p.name,
        UPPER(TRIM(COALESCE(c.name, ''))) as category_name
       FROM coffee_chain_db.products p
       LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
       WHERE p.is_active = TRUE
         AND (TRIM(p.name) ILIKE $1 OR TRIM(p.name) ILIKE $2)
       ORDER BY CASE WHEN TRIM(p.name) ILIKE $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [nameNorm, `%${nameNorm}%`]
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      return {
        id: Number(row.id),
        name: String(row.name),
        category: row.category_name ? String(row.category_name) : null,
      };
    }

    const fallback = await pool.query(
      `SELECT p.id, p.name,
        UPPER(TRIM(COALESCE(c.name, ''))) as category_name
       FROM coffee_chain_db.products p
       LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
       WHERE p.is_active = TRUE
       LIMIT 200`
    );
    for (const row of fallback.rows) {
      const dbName = String(row.name || "").trim();
      if (productNamesMatch(nameNorm, dbName)) {
        return {
          id: Number(row.id),
          name: dbName,
          category: row.category_name ? String(row.category_name) : null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isDrinkForPairing(category: string | null): boolean {
  if (!category) return true;
  const c = category.toUpperCase();
  const exclude = ["TOPPING", "BAKERY", "CAKE", "CAKES", "BÁNH", "BANH"];
  return !exclude.some((x) => c.includes(x));
}

export function mapCategoryToComboGroup(category: string | null): "tea" | "coffee" | "phindi" | null {
  if (!category) return null;
  const c = category.toUpperCase();
  if (["TEA", "TRA", "TRÀ", "TEA_COLD", "TEA_HOT"].some((x) => c.includes(x))) return "tea";
  if (["COFFEE", "COFFE", "ESPRESSO", "CA PHE", "CÀ PHÊ"].some((x) => c.includes(x))) return "coffee";
  if (["PHINDI", "PHIN DI"].some((x) => c.includes(x))) return "phindi";
  return null;
}

export async function resolveConversationContext(
  conversationId: number,
  limitMessages: number = 20
): Promise<ConversationContext> {
  try {
    const conversation = conversationId > 0 ? await getConversationById(conversationId) : null;
    const metadataRecommendedDrink = parseMetadataDrink(conversation?.metadata?.lastRecommendedDrink);
    const metadataMentionedDrink = parseMetadataDrink(
      conversation?.metadata?.lastMentionedDrink || conversation?.metadata?.lastRecommendedDrink
    );

    if (metadataRecommendedDrink && isDrinkForPairing(metadataRecommendedDrink.category)) {
      return {
        lastRecommendedDrink: metadataRecommendedDrink,
        lastMentionedDrink:
          metadataMentionedDrink && isDrinkForPairing(metadataMentionedDrink.category)
            ? metadataMentionedDrink
            : metadataRecommendedDrink,
      };
    }

    const messages = await getConversationMessages(conversationId, limitMessages);
    let lastRecommendedDrink: ResolvedDrink | null = null;
    let lastMentionedDrink: ResolvedDrink | null = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const productName = extractProductNameFromAssistantMessage(msg.content);
    if (productName) {
      const drink = await lookupProductByName(productName);
      if (drink && isDrinkForPairing(drink.category)) {
        lastRecommendedDrink = drink;
        break;
      }
    }
  }

  if (!lastRecommendedDrink) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const content = msg.content.trim();
      if (content.length < 4 || content.length > 60) continue;
      if (!/[?!]/.test(content) && !content.includes("cho") && !content.includes("minh")) {
        const drink = await lookupProductByName(content);
        if (drink) {
          lastMentionedDrink = drink;
          break;
        }
      }
    }
    }

    return {
      lastRecommendedDrink,
      lastMentionedDrink: lastMentionedDrink || lastRecommendedDrink,
    };
  } catch (error) {
    console.error("[resolveConversationContext] Error:", error);
    return {
      lastRecommendedDrink: null,
      lastMentionedDrink: null,
    };
  }
}
