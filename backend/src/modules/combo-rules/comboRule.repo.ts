import { pool } from "../../config/db";

export async function getActiveComboRules() {
  const r = await pool.query(
    `
      SELECT
        r.id AS combo_rule_id,
        r.code,
        r.name,
        r.description,
        r.combo_price,
        r.priority,
        r.auto_apply,

        g.id AS group_id,
        g.group_no,
        g.group_name,
        g.quantity_required,
        g.match_type,
        g.category_id,
        g.product_id,
        g.product_variant_id,
        g.required_size,

        c.name AS category_name
      FROM coffee_chain_db.combo_rules r
      JOIN coffee_chain_db.combo_rule_groups g
        ON g.combo_rule_id = r.id
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = g.category_id
      WHERE r.is_active = TRUE
      ORDER BY r.priority DESC, r.id DESC, g.group_no ASC
    `
  );

  return r.rows;
}

export async function getVariantMetaByIds(variantIds: number[]) {
  if (!variantIds.length) return [];

  const r = await pool.query(
    `
      SELECT
        pv.id AS product_variant_id,
        pv.sku,
        pv.size,
        pv.price,
        pv.is_active AS is_active,

        p.id AS product_id,
        p.name AS product_name,
        p.is_active AS product_active,

        c.id AS category_id,
        c.name AS category_name
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = p.category_id
      WHERE pv.id = ANY($1::bigint[])
    `,
    [variantIds]
  );

  return r.rows;
}