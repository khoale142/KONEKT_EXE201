import { pool } from "../../config/db";

export async function getPosMenu() {
  const menuR = await pool.query(`
    SELECT
      pv.id AS variant_id,
      pv.size,
      pv.price,
      p.id AS product_id,
      p.name AS product_name,
      p.image_url AS image_url,
      c.name AS category_name
    FROM coffee_chain_db.product_variants pv
    JOIN coffee_chain_db.products p ON p.id = pv.product_id
    LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
    WHERE p.is_active = TRUE
      AND pv.is_active = TRUE
    ORDER BY c.name NULLS LAST, p.name, pv.size
  `);

  const catMap = new Map<
    string,
    { key: string; name: string; products: Map<string, any> }
  >();

  for (const row of menuR.rows) {
    const key = String(row.category_name || "OTHERS");
    const name = String(row.category_name || "OTHERS");
    const productName = String(row.product_name || "");

    const variant = {
      id: Number(row.variant_id),
      size: String(row.size),
      price: Number(row.price),
    };

    if (!catMap.has(key)) {
      catMap.set(key, {
        key,
        name,
        products: new Map(),
      });
    }

    const cat = catMap.get(key)!;

    if (!cat.products.has(productName)) {
      cat.products.set(productName, {
        id: Number(row.product_id),
        name: productName,
        imageUrl: row.image_url ? String(row.image_url) : null,
        description: null,
        variants: [] as any[],
      });
    }

    cat.products.get(productName).variants.push(variant);
  }

  const comboResult = await pool.query(`
    SELECT
      cp.id AS combo_id,
      cp.code AS combo_code,
      cp.name AS combo_name,
      cp.description AS combo_description,
      cp.combo_price AS combo_price,
      cp.priority AS combo_priority,
      ci.product_variant_id AS product_variant_id,
      ci.quantity AS quantity,
      pv.size AS size,
      pv.price AS unit_price,
      p.name AS product_name
    FROM coffee_chain_db.combo_products cp
    JOIN coffee_chain_db.combo_items ci ON ci.combo_id = cp.id
    JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
    JOIN coffee_chain_db.products p ON p.id = pv.product_id
    WHERE cp.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM coffee_chain_db.combo_items ci2
        JOIN coffee_chain_db.product_variants pv2 ON pv2.id = ci2.product_variant_id
        JOIN coffee_chain_db.products p2 ON p2.id = pv2.product_id
        WHERE ci2.combo_id = cp.id
          AND (
            pv2.is_active IS NOT TRUE
            OR p2.is_active IS NOT TRUE
          )
      )
    ORDER BY cp.priority DESC NULLS LAST, cp.id, p.name, pv.size
  `);

  const comboMap = new Map<
    number,
    {
      id: number;
      code: string;
      name: string;
      description: string | null;
      comboPrice: number;
      priority: number;
      items: Array<{
        productVariantId: number;
        productName: string;
        size: string;
        unitPrice: number;
        quantity: number;
      }>;
    }
  >();

  for (const row of comboResult.rows) {
    const comboId = Number(row.combo_id);

    if (!comboMap.has(comboId)) {
      comboMap.set(comboId, {
        id: comboId,
        code: String(row.combo_code || ""),
        name: String(row.combo_name || ""),
        description: row.combo_description ? String(row.combo_description) : null,
        comboPrice: Number(row.combo_price || 0),
        priority: Number(row.combo_priority || 0),
        items: [],
      });
    }

    comboMap.get(comboId)!.items.push({
      productVariantId: Number(row.product_variant_id),
      productName: String(row.product_name || ""),
      size: String(row.size || ""),
      unitPrice: Number(row.unit_price || 0),
      quantity: Number(row.quantity || 1),
    });
  }

  return {
    categories: Array.from(catMap.values()).map((c) => ({
      key: c.key,
      name: c.name,
      products: Array.from(c.products.values()),
    })),
    combos: Array.from(comboMap.values()),
  };
}
