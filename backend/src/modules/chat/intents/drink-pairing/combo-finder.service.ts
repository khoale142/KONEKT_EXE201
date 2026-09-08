import { pool } from "../../../../config/db";
import { mapCategoryToComboGroup } from "./follow-up-context.resolver";

export type ComboItem = {
  id: number;
  name: string;
  price: number;
  items: string[];
  description?: string | null;
};

const CATEGORY_DB_VALUES: Record<string, string[]> = {
  tea: ["TEA", "TRA", "TEA_COLD", "TEA_HOT"],
  coffee: ["COFFEE", "ESPRESSO", "COFFEE_HOT", "COFFEE_ICE"],
  phindi: ["PHINDI", "PHIN DI"],
};

function toFriendlyCategoryName(categoryName: string): string {
  switch (categoryName) {
    case "BAKERY_SWEET":
      return "banh ngot";
    case "BAKERY_SAVORY":
      return "banh man";
    case "COFFEE":
    case "ESPRESSO":
    case "COFFEE_HOT":
    case "COFFEE_ICE":
      return "ca phe";
    case "TEA":
    case "TRA":
    case "TEA_COLD":
    case "TEA_HOT":
      return "tra";
    case "PHINDI":
    case "PHIN DI":
      return "phindi";
    default:
      return categoryName.toLowerCase().replace(/_/g, " ");
  }
}

function formatRuleGroupLabel(row: any): string {
  const quantity = Number(row.quantity_required || 1);
  const requiredSize = row.required_size ? ` size ${row.required_size}` : "";

  if (row.product_name) {
    const variantSize = row.variant_size ? ` size ${row.variant_size}` : "";
    return `${quantity} x ${row.product_name}${variantSize}`;
  }

  if (row.category_name) {
    const categoryName = toFriendlyCategoryName(String(row.category_name || ""));
    return `${quantity} x ${categoryName}${requiredSize}`;
  }

  if (row.group_name) {
    return `${quantity} x ${row.group_name}${requiredSize}`;
  }

  return `${quantity} x mon trong combo`;
}

function mergeUniqueCombos(comboGroups: ComboItem[][], limit: number = 5): ComboItem[] {
  const seenKeys = new Set<string>();
  const merged: ComboItem[] = [];

  for (const combos of comboGroups) {
    for (const combo of combos) {
      const key = `${combo.name}|${combo.price}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push(combo);
      if (merged.length >= limit) {
        return merged;
      }
    }
  }

  return merged;
}

async function findCombosContainingProduct(productId: number): Promise<ComboItem[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT cp.id, cp.name, cp.combo_price, cp.description
    FROM coffee_chain_db.combo_products cp
    JOIN coffee_chain_db.combo_items ci ON ci.combo_id = cp.id
    JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
    WHERE cp.is_active = TRUE
      AND pv.product_id = $1
    ORDER BY cp.priority DESC NULLS LAST, cp.id ASC
    `,
    [productId]
  );

  if (result.rows.length === 0) return [];

  const comboIds = result.rows.map((row: any) => Number(row.id));
  const itemsResult = await pool.query(
    `
    SELECT ci.combo_id, p.name AS product_name, pv.size, ci.quantity
    FROM coffee_chain_db.combo_items ci
    JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
    JOIN coffee_chain_db.products p ON p.id = pv.product_id
    WHERE ci.combo_id = ANY($1::int[])
    ORDER BY ci.combo_id, p.name ASC
    `,
    [comboIds]
  );

  const itemsByCombo = new Map<number, string[]>();
  for (const row of itemsResult.rows) {
    const comboId = Number(row.combo_id);
    const item = `${row.quantity} x ${row.product_name}${row.size ? ` size ${row.size}` : ""}`;
    if (!itemsByCombo.has(comboId)) {
      itemsByCombo.set(comboId, []);
    }
    itemsByCombo.get(comboId)!.push(item);
  }

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    price: Number(row.combo_price || 0),
    items: itemsByCombo.get(Number(row.id)) || [],
    description: row.description || null,
  }));
}

async function findCombosByCategory(category: "tea" | "coffee" | "phindi"): Promise<ComboItem[]> {
  const dbValues = CATEGORY_DB_VALUES[category];
  if (!dbValues) return [];

  const result = await pool.query(
    `
    SELECT cp.id, cp.name, cp.combo_price, cp.description
    FROM coffee_chain_db.combo_products cp
    JOIN coffee_chain_db.combo_items ci ON ci.combo_id = cp.id
    JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
    JOIN coffee_chain_db.products p ON p.id = pv.product_id
    LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
    WHERE cp.is_active = TRUE
      AND UPPER(TRIM(COALESCE(c.name, ''))) = ANY($1::text[])
    GROUP BY cp.id, cp.name, cp.combo_price, cp.description, cp.priority
    ORDER BY cp.priority DESC NULLS LAST, cp.id ASC
    LIMIT 5
    `,
    [dbValues]
  );

  if (result.rows.length === 0) return [];

  const comboIds = result.rows.map((row: any) => Number(row.id));
  const itemsResult = await pool.query(
    `
    SELECT ci.combo_id, p.name AS product_name, pv.size, ci.quantity
    FROM coffee_chain_db.combo_items ci
    JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
    JOIN coffee_chain_db.products p ON p.id = pv.product_id
    WHERE ci.combo_id = ANY($1::int[])
    ORDER BY ci.combo_id, p.name ASC
    `,
    [comboIds]
  );

  const itemsByCombo = new Map<number, string[]>();
  for (const row of itemsResult.rows) {
    const comboId = Number(row.combo_id);
    const item = `${row.quantity} x ${row.product_name}${row.size ? ` size ${row.size}` : ""}`;
    if (!itemsByCombo.has(comboId)) {
      itemsByCombo.set(comboId, []);
    }
    itemsByCombo.get(comboId)!.push(item);
  }

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    price: Number(row.combo_price || 0),
    items: itemsByCombo.get(Number(row.id)) || [],
    description: row.description || null,
  }));
}

async function findRuleCombosForDrink(
  drink: { id: number; name: string; category: string | null },
  category: "tea" | "coffee" | "phindi"
): Promise<ComboItem[]> {
  const dbValues = CATEGORY_DB_VALUES[category];
  if (!dbValues) return [];

  const result = await pool.query(
    `
    WITH matching_rules AS (
      SELECT DISTINCT r.id, r.name, r.combo_price, r.description, r.priority
      FROM coffee_chain_db.combo_rules r
      JOIN coffee_chain_db.combo_rule_groups g ON g.combo_rule_id = r.id
      LEFT JOIN coffee_chain_db.categories c ON c.id = g.category_id
      LEFT JOIN coffee_chain_db.product_variants matched_pv ON matched_pv.id = g.product_variant_id
      WHERE r.is_active = TRUE
        AND (
          g.product_id = $2
          OR (g.product_variant_id IS NOT NULL AND matched_pv.product_id = $2)
          OR (
            g.match_type = 'category'
            AND UPPER(TRIM(COALESCE(c.name, ''))) = ANY($1::text[])
          )
        )
    )
    SELECT
      mr.id,
      mr.name,
      mr.combo_price,
      mr.description,
      mr.priority,
      g.group_no,
      g.group_name,
      g.quantity_required,
      g.match_type,
      g.required_size,
      UPPER(TRIM(COALESCE(c.name, ''))) AS category_name,
      p.name AS product_name,
      pv.size AS variant_size
    FROM matching_rules mr
    JOIN coffee_chain_db.combo_rule_groups g ON g.combo_rule_id = mr.id
    LEFT JOIN coffee_chain_db.categories c ON c.id = g.category_id
    LEFT JOIN coffee_chain_db.products p ON p.id = g.product_id
    LEFT JOIN coffee_chain_db.product_variants pv ON pv.id = g.product_variant_id
    ORDER BY mr.priority DESC NULLS LAST, mr.id ASC, g.group_no ASC
    `,
    [dbValues, drink.id]
  );

  if (result.rows.length === 0) return [];

  const combosByRule = new Map<number, ComboItem>();
  for (const row of result.rows) {
    const ruleId = Number(row.id);
    if (!combosByRule.has(ruleId)) {
      combosByRule.set(ruleId, {
        id: ruleId,
        name: String(row.name || ""),
        price: Number(row.combo_price || 0),
        items: [],
        description: row.description || null,
      });
    }

    combosByRule.get(ruleId)!.items.push(formatRuleGroupLabel(row));
  }

  return Array.from(combosByRule.values());
}

export async function findCombosForDrink(drink: {
  id: number;
  name: string;
  category: string | null;
}): Promise<ComboItem[]> {
  const exactFixedCombos = await findCombosContainingProduct(drink.id);
  const comboGroup = mapCategoryToComboGroup(drink.category);

  if (!comboGroup) {
    return exactFixedCombos.slice(0, 5);
  }

  const [categoryFixedCombos, ruleCombos] = await Promise.all([
    findCombosByCategory(comboGroup),
    findRuleCombosForDrink(drink, comboGroup),
  ]);

  return mergeUniqueCombos([exactFixedCombos, categoryFixedCombos, ruleCombos], 5);
}
