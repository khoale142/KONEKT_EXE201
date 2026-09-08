import { pool } from "../../../config/db";
import { ChatResponse, IntentCode } from "../types";

type ProductCandidate = {
  id: number;
  name: string;
  categoryName: string | null;
  minPrice: number;
  maxPrice: number;
  sizes: string[];
};

type IntentProductFilter = {
  includeCategories?: string[];
  excludeCategories?: string[];
};

const INTENT_PRODUCT_FILTERS: Partial<Record<IntentCode, IntentProductFilter>> = {
  coffee_recommendation: { includeCategories: ["COFFEE", "ESPRESSO"] },
  freeze_recommendation: { includeCategories: ["FREEZE"] },
  phindi_recommendation: { includeCategories: ["PHINDI"] },
  tea_recommendation: { includeCategories: ["TEA"] },
  drink_recommendation: { includeCategories: ["COFFEE", "ESPRESSO", "PHINDI", "TEA", "FREEZE", "JUICE", "OTHERS"] },
  juice_recommendation: { includeCategories: ["JUICE"] },
  others_drink_recommendation: { includeCategories: ["OTHERS"] },
  bakery_recommendation: { includeCategories: ["BAKERY_SAVORY", "BAKERY_SWEET"] },
  bakery_savory_recommendation: { includeCategories: ["BAKERY_SAVORY"] },
  bakery_sweet_recommendation: { includeCategories: ["BAKERY_SWEET"] },
  topping_recommendation: { includeCategories: ["TOPPING"] },
};

const DRINK_CATEGORIES = new Set(["COFFEE", "ESPRESSO", "PHINDI", "TEA", "FREEZE", "JUICE", "OTHERS"]);

function normalizeCatalogText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedText || !normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(normalizedText);
}

function formatPriceRange(minPrice: number, maxPrice: number): string {
  if (minPrice === maxPrice) return `${minPrice.toLocaleString("vi-VN")}d`;
  return `${minPrice.toLocaleString("vi-VN")}d - ${maxPrice.toLocaleString("vi-VN")}d`;
}

function formatSizes(sizes: string[]): string {
  return sizes.filter(Boolean).join(", ");
}

function mapCategoryLabel(categoryName: string | null): string {
  switch (categoryName) {
    case "COFFEE":
    case "ESPRESSO":
      return "ca phe";
    case "PHINDI":
      return "phindi";
    case "TEA":
      return "tra";
    case "FREEZE":
      return "freeze";
    case "JUICE":
      return "nuoc ep";
    case "OTHERS":
      return "do uong";
    case "BAKERY_SWEET":
      return "banh ngot";
    case "BAKERY_SAVORY":
      return "banh man";
    case "TOPPING":
      return "topping";
    default:
      return "mon";
  }
}

function scoreProductMatch(messageNormalized: string, productNameNormalized: string): number {
  if (!messageNormalized || !productNameNormalized) return 0;
  if (messageNormalized === productNameNormalized) return 300;
  if (containsPhrase(messageNormalized, productNameNormalized)) return 250 + productNameNormalized.length;

  const messageTokens = new Set(messageNormalized.split(" ").filter(Boolean));
  const productTokens = productNameNormalized.split(" ").filter((token) => token.length > 1);
  if (productTokens.length === 0) return 0;

  const matchedTokens = productTokens.filter((token) => messageTokens.has(token));
  if (matchedTokens.length === productTokens.length && productTokens.length >= 2) {
    return 220 + matchedTokens.length * 10 + productNameNormalized.length;
  }

  if (productTokens.length === 1 && matchedTokens.length === 1 && messageTokens.size <= 2) {
    return 200 + productNameNormalized.length;
  }

  if (matchedTokens.length >= 2) {
    return 120 + matchedTokens.length * 12;
  }

  return 0;
}

async function loadCatalogCandidates(): Promise<ProductCandidate[]> {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      UPPER(TRIM(COALESCE(c.name, ''))) AS category_name,
      MIN(pv.price) AS min_price,
      MAX(pv.price) AS max_price,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(TRIM(COALESCE(pv.size, '')), '')), NULL) AS sizes
    FROM coffee_chain_db.products p
    JOIN coffee_chain_db.product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
    LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
    WHERE p.is_active = TRUE
    GROUP BY p.id, p.name, UPPER(TRIM(COALESCE(c.name, '')))
    ORDER BY p.name ASC
    `
  );

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    categoryName: row.category_name ? String(row.category_name) : null,
    minPrice: Number(row.min_price || 0),
    maxPrice: Number(row.max_price || 0),
    sizes: Array.isArray(row.sizes) ? row.sizes.map((size: unknown) => String(size)) : [],
  }));
}

function filterCandidatesByIntent(candidates: ProductCandidate[], intentCode: IntentCode): ProductCandidate[] {
  const filter = INTENT_PRODUCT_FILTERS[intentCode];
  if (!filter) return [];

  return candidates.filter((candidate) => {
    const categoryName = candidate.categoryName || "";

    if (filter.includeCategories?.length && !filter.includeCategories.includes(categoryName)) {
      return false;
    }

    if (filter.excludeCategories?.length && filter.excludeCategories.includes(categoryName)) {
      return false;
    }

    return true;
  });
}

function buildSpecificProductAnswer(product: ProductCandidate): string {
  const lines = [
    `Da mon ${product.name} hien dang co trong menu.`,
    "",
    `Gia: ${formatPriceRange(product.minPrice, product.maxPrice)}`,
  ];

  const sizeText = formatSizes(product.sizes);
  if (sizeText) {
    lines.push(`Cac size: ${sizeText}`);
  }

  lines.push("");
  if (isDrinkCategoryName(product.categoryName)) {
    lines.push("Ban muon minh goi y combo hoac banh di kem voi mon nay khong?");
  } else {
    lines.push("Ban muon minh goi y them mon lien quan khong?");
  }

  return lines.join("\n");
}

export function isDrinkCategoryName(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  return DRINK_CATEGORIES.has(categoryName);
}

export async function lookupProductSummaryById(productId: number): Promise<ProductCandidate | null> {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      UPPER(TRIM(COALESCE(c.name, ''))) AS category_name,
      MIN(pv.price) AS min_price,
      MAX(pv.price) AS max_price,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(TRIM(COALESCE(pv.size, '')), '')), NULL) AS sizes
    FROM coffee_chain_db.products p
    JOIN coffee_chain_db.product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
    LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
    WHERE p.is_active = TRUE
      AND p.id = $1
    GROUP BY p.id, p.name, UPPER(TRIM(COALESCE(c.name, '')))
    LIMIT 1
    `,
    [productId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    categoryName: row.category_name ? String(row.category_name) : null,
    minPrice: Number(row.min_price || 0),
    maxPrice: Number(row.max_price || 0),
    sizes: Array.isArray(row.sizes) ? row.sizes.map((size: unknown) => String(size)) : [],
  };
}

export async function tryBuildSpecificProductResponse(
  message: string,
  intentCode: IntentCode
): Promise<ChatResponse | null> {
  const normalizedMessage = normalizeCatalogText(message);
  if (!normalizedMessage) return null;

  const filter = INTENT_PRODUCT_FILTERS[intentCode];
  if (!filter) return null;

  const candidates = filterCandidatesByIntent(await loadCatalogCandidates(), intentCode);
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreProductMatch(normalizedMessage, normalizeCatalogText(candidate.name)),
    }))
    .filter((item) => item.score >= 200)
    .sort((a, b) => b.score - a.score || b.candidate.name.length - a.candidate.name.length || a.candidate.name.localeCompare(b.candidate.name));

  const best = ranked[0]?.candidate;
  if (!best) return null;

  return {
    answer: buildSpecificProductAnswer(best),
    intentCode,
    metadata: {
      productId: best.id,
      productName: best.name,
      productCategory: best.categoryName,
      productLabel: mapCategoryLabel(best.categoryName),
    },
  };
}
