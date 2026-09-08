import { pool } from "../../../../config/db";

export type CakeItem = {
  id: number;
  name: string;
  categoryName: string | null;
  minPrice?: number;
  maxPrice?: number;
};

type PairingDrink = {
  id: number;
  name: string;
  category: string | null;
} | null;

function normalizeCakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCakeForDrink(cake: CakeItem, drink: PairingDrink): number {
  const cakeName = normalizeCakeText(cake.name);
  const drinkName = normalizeCakeText(drink?.name || "");
  const drinkCategory = (drink?.category || "").toUpperCase();
  const cakeCategory = (cake.categoryName || "").toUpperCase();

  let score = 0;

  if (!drink) {
    score += cakeCategory === "BAKERY_SWEET" ? 50 : 30;
  } else if (["TEA", "FREEZE", "JUICE", "OTHERS"].includes(drinkCategory)) {
    score += cakeCategory === "BAKERY_SWEET" ? 70 : 20;
  } else if (["COFFEE", "ESPRESSO", "PHINDI"].includes(drinkCategory)) {
    score += cakeCategory === "BAKERY_SWEET" ? 60 : 45;
  } else {
    score += cakeCategory === "BAKERY_SWEET" ? 55 : 25;
  }

  if (cakeCategory === "BAKERY_SWEET") {
    if (/(cheesecake|mousse|viet quat|chanh day|red velvet|su kem|tiramisu)/.test(cakeName)) {
      score += 12;
    }
    if (/(brownie|socola|opera)/.test(cakeName)) {
      score += 10;
    }
  }

  if (cakeCategory === "BAKERY_SAVORY") {
    if (/(croissant|sandwich|ham cheese|ga xe|ca ngu|bo toi)/.test(cakeName)) {
      score += 10;
    }
  }

  if (drinkName) {
    if (/(tra|sen|dao|vai|chanh|cam|dua hau|oi|freeze tra xanh)/.test(drinkName) && cakeCategory === "BAKERY_SWEET") {
      score += 12;
    }

    if (/(coffee|ca phe|espresso|phindi|bac xiu|mocha|choco|chocolate)/.test(drinkName)) {
      if (/(brownie|socola|opera|croissant|ham cheese|cheesecake)/.test(cakeName)) {
        score += 14;
      }
    }
  }

  return score;
}

export async function pickRandomCakes(
  limit: number = 3,
  drink: PairingDrink = null
): Promise<CakeItem[]> {
  if (limit < 1) limit = 1;
  if (limit > 5) limit = 5;

  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        UPPER(TRIM(COALESCE(c.name, ''))) AS category_name,
        MIN(pv.price) AS min_price,
        MAX(pv.price) AS max_price
      FROM coffee_chain_db.products p
      JOIN coffee_chain_db.product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
      LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
      WHERE p.is_active = TRUE
        AND UPPER(COALESCE(c.name, '')) IN ('BAKERY_SAVORY', 'BAKERY_SWEET')
      GROUP BY p.id, p.name, UPPER(TRIM(COALESCE(c.name, '')))
      ORDER BY p.name ASC
      `
    );

    const rankedCakes = result.rows
      .map((row: any) => ({
        id: Number(row.id),
        name: String(row.name || ""),
        categoryName: row.category_name ? String(row.category_name) : null,
        minPrice: row.min_price != null ? Number(row.min_price) : undefined,
        maxPrice: row.max_price != null ? Number(row.max_price) : undefined,
      }))
      .sort((a, b) => scoreCakeForDrink(b, drink) - scoreCakeForDrink(a, drink) || a.name.localeCompare(b.name));

    return rankedCakes.slice(0, limit);
  } catch {
    return [];
  }
}
