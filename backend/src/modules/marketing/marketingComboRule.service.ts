import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";

export type MarketingComboRuleListItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  autoApply: boolean;
  groupCount: number;
  createdAt: string | null;
};

export type MarketingComboRuleGroup = {
  id: number;
  comboRuleId: number;
  groupNo: number;
  groupName: string | null;
  quantityRequired: number;
  matchType: "category" | "product" | "variant";
  categoryId: number | null;
  productId: number | null;
  productVariantId: number | null;
  requiredSize: string | null;
  categoryName: string | null;
  productName: string | null;
  variantLabel: string | null;
};

export type MarketingComboRuleDetail = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  autoApply: boolean;
  createdAt: string | null;
  groups: MarketingComboRuleGroup[];
};

export type ComboCategoryLookup = {
  id: number;
  name: string;
};

export type ComboProductLookup = {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
};

export type ComboVariantLookup = {
  id: number;
  productId: number;
  productName: string;
  categoryId: number | null;
  categoryName: string | null;
  sku: string | null;
  size: string | null;
  price: number;
};

type ReplaceGroupInput = {
  groupNo: number;
  groupName?: string | null;
  quantityRequired?: number;
  matchType: "category" | "product" | "variant";
  categoryId?: number | null;
  productId?: number | null;
  productVariantId?: number | null;
  requiredSize?: string | null;
};

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeRequiredSize(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .toUpperCase();
  return text ? text : null;
}

async function ensureCategoryExists(client: any, categoryId: number) {
  const r = await client.query(
    `SELECT 1 FROM coffee_chain_db.categories WHERE id = $1 LIMIT 1`,
    [categoryId],
  );
  if (!r.rows[0])
    throw new ApiError(400, `Category ${categoryId} không tồn tại`);
}

async function ensureProductExistsAndActive(client: any, productId: number) {
  const r = await client.query(
    `
      SELECT is_active
      FROM coffee_chain_db.products
      WHERE id = $1
      LIMIT 1
    `,
    [productId],
  );
  if (!r.rows[0]) throw new ApiError(400, `Product ${productId} không tồn tại`);
  if (!r.rows[0].is_active) {
    throw new ApiError(400, `Product ${productId} đang tạm ngưng`);
  }
}

async function ensureVariantExistsAndActive(client: any, variantId: number) {
  const r = await client.query(
    `
      SELECT
        pv.is_active AS variant_active,
        p.is_active AS product_active
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      WHERE pv.id = $1
      LIMIT 1
    `,
    [variantId],
  );
  if (!r.rows[0]) throw new ApiError(400, `Variant ${variantId} không tồn tại`);
  if (!r.rows[0].variant_active || !r.rows[0].product_active) {
    throw new ApiError(400, `Variant ${variantId} đang tạm ngưng`);
  }
}

async function validateGroups(client: any, groups: ReplaceGroupInput[]) {
  if (!Array.isArray(groups) || groups.length < 2) {
    throw new ApiError(400, "Combo phải có ít nhất 2 nhóm");
  }

  const groupNos = new Set<number>();

  for (const group of groups) {
    const groupNo = Number(group.groupNo);
    const quantityRequired = Number(group.quantityRequired ?? 1);
    const matchType = String(group.matchType || "")
      .trim()
      .toLowerCase();

    if (!Number.isInteger(groupNo) || groupNo <= 0) {
      throw new ApiError(400, "groupNo phải là số nguyên dương");
    }
    if (groupNos.has(groupNo)) {
      throw new ApiError(400, "groupNo không được trùng");
    }
    groupNos.add(groupNo);

    if (quantityRequired !== 1) {
      throw new ApiError(
        400,
        "Phiên bản hiện tại chỉ hỗ trợ quantityRequired = 1",
      );
    }

    if (!["category", "product", "variant"].includes(matchType)) {
      throw new ApiError(400, "matchType không hợp lệ");
    }

    const categoryId =
      group.categoryId != null ? Number(group.categoryId) : null;
    const productId = group.productId != null ? Number(group.productId) : null;
    const productVariantId =
      group.productVariantId != null ? Number(group.productVariantId) : null;

    if (matchType === "category") {
      if (
        categoryId == null ||
        !Number.isInteger(categoryId) ||
        categoryId <= 0
      ) {
        throw new ApiError(400, "Nhóm match theo category phải chọn category");
      }
      await ensureCategoryExists(client, categoryId);
    }

    if (matchType === "product") {
      if (productId == null || !Number.isInteger(productId) || productId <= 0) {
        throw new ApiError(400, "Nhóm match theo product phải chọn product");
      }
      await ensureProductExistsAndActive(client, productId);
    }

    if (matchType === "variant") {
      if (
        productVariantId == null ||
        !Number.isInteger(productVariantId) ||
        productVariantId <= 0
      ) {
        throw new ApiError(400, "Nhóm match theo variant phải chọn variant");
      }
      await ensureVariantExistsAndActive(client, productVariantId);
    }
  }
}

export async function listMarketingComboRuleCategories() {
  const r = await pool.query(
    `
      SELECT id, name
      FROM coffee_chain_db.categories
      ORDER BY name ASC, id ASC
    `,
  );

  return r.rows.map<ComboCategoryLookup>((row) => ({
    id: Number(row.id),
    name: String(row.name || ""),
  }));
}

export async function listMarketingComboRuleProducts(params?: {
  keyword?: string;
  limit?: number;
}) {
  const values: any[] = [];
  const whereParts = [`p.is_active = TRUE`];

  if (params?.keyword) {
    values.push(params.keyword.trim());
    whereParts.push(`p.name ILIKE '%' || $${values.length} || '%'`);
  }

  values.push(params?.limit ?? 500);
  const limitParam = values.length;

  const r = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        c.id AS category_id,
        c.name AS category_name
      FROM coffee_chain_db.products p
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = p.category_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY c.name NULLS LAST, p.name ASC, p.id ASC
      LIMIT $${limitParam}
    `,
    values,
  );

  return r.rows.map<ComboProductLookup>((row) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
  }));
}

export async function listMarketingComboRuleVariants(params?: {
  keyword?: string;
  limit?: number;
}) {
  const values: any[] = [];
  const whereParts = [`p.is_active = TRUE`, `pv.is_active = TRUE`];

  if (params?.keyword) {
    values.push(params.keyword.trim());
    whereParts.push(`
      (
        p.name ILIKE '%' || $${values.length} || '%'
        OR COALESCE(pv.size, '') ILIKE '%' || $${values.length} || '%'
        OR COALESCE(pv.sku, '') ILIKE '%' || $${values.length} || '%'
      )
    `);
  }

  values.push(params?.limit ?? 1000);
  const limitParam = values.length;

  const r = await pool.query(
    `
      SELECT
        pv.id,
        pv.sku,
        pv.size,
        pv.price,
        p.id AS product_id,
        p.name AS product_name,
        c.id AS category_id,
        c.name AS category_name
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = p.category_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY c.name NULLS LAST, p.name ASC, pv.size ASC, pv.id ASC
      LIMIT $${limitParam}
    `,
    values,
  );

  return r.rows.map<ComboVariantLookup>((row) => ({
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: String(row.product_name || ""),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
    sku: row.sku ? String(row.sku) : null,
    size: row.size ? String(row.size) : null,
    price: Number(row.price || 0),
  }));
}

export async function listMarketingComboRules(params: {
  keyword?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [];
  const whereParts: string[] = [];

  if (params.keyword) {
    values.push(params.keyword.trim());
    whereParts.push(
      `(r.code ILIKE '%' || $${values.length} || '%' OR r.name ILIKE '%' || $${values.length} || '%')`,
    );
  }

  if (typeof params.isActive === "boolean") {
    values.push(params.isActive);
    whereParts.push(`r.is_active = $${values.length}`);
  }

  values.push(params.limit ?? 100);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        r.id,
        r.code,
        r.name,
        r.description,
        r.combo_price,
        r.is_active,
        r.priority,
        r.auto_apply,
        r.created_at,
        COUNT(g.id)::int AS group_count
      FROM coffee_chain_db.combo_rules r
      LEFT JOIN coffee_chain_db.combo_rule_groups g
        ON g.combo_rule_id = r.id
      ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
      GROUP BY r.id
      ORDER BY r.priority DESC NULLS LAST, r.name ASC, r.id ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  const countValues = values.slice(0, values.length - 2);
  const countR = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM coffee_chain_db.combo_rules r
      ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
    `,
    countValues,
  );

  return {
    items: r.rows.map<MarketingComboRuleListItem>((row) => ({
      id: Number(row.id),
      code: String(row.code || ""),
      name: String(row.name || ""),
      description: row.description ? String(row.description) : null,
      comboPrice: Number(row.combo_price || 0),
      isActive: Boolean(row.is_active),
      priority: Number(row.priority || 0),
      autoApply: Boolean(row.auto_apply),
      groupCount: Number(row.group_count || 0),
      createdAt: row.created_at ?? null,
    })),
    pagination: {
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      total: Number(countR.rows[0]?.total || 0),
    },
  };
}

export async function getMarketingComboRuleDetail(
  ruleId: number,
): Promise<MarketingComboRuleDetail> {
  const ruleR = await pool.query(
    `
      SELECT
        id,
        code,
        name,
        description,
        combo_price,
        is_active,
        priority,
        auto_apply,
        created_at
      FROM coffee_chain_db.combo_rules
      WHERE id = $1
      LIMIT 1
    `,
    [ruleId],
  );

  const rule = ruleR.rows[0];
  if (!rule) throw new ApiError(404, "Combo không tồn tại");

  const groupR = await pool.query(
    `
      SELECT
        g.id,
        g.combo_rule_id,
        g.group_no,
        g.group_name,
        g.quantity_required,
        g.match_type,
        g.category_id,
        g.product_id,
        g.product_variant_id,
        g.required_size,
        c.name AS category_name,
        p.name AS product_name,
        CASE
          WHEN pv.id IS NULL THEN NULL
          ELSE CONCAT(pv.id, ' - ', p.name, ' (', COALESCE(pv.size, '?'), ')')
        END AS variant_label
      FROM coffee_chain_db.combo_rule_groups g
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = g.category_id
      LEFT JOIN coffee_chain_db.products p
        ON p.id = g.product_id
      LEFT JOIN coffee_chain_db.product_variants pv
        ON pv.id = g.product_variant_id
      LEFT JOIN coffee_chain_db.products p2
        ON p2.id = pv.product_id
      WHERE g.combo_rule_id = $1
      ORDER BY g.group_no ASC, g.id ASC
    `,
    [ruleId],
  );

  return {
    id: Number(rule.id),
    code: String(rule.code || ""),
    name: String(rule.name || ""),
    description: rule.description ? String(rule.description) : null,
    comboPrice: Number(rule.combo_price || 0),
    isActive: Boolean(rule.is_active),
    priority: Number(rule.priority || 0),
    autoApply: Boolean(rule.auto_apply),
    createdAt: rule.created_at ?? null,
    groups: groupR.rows.map<MarketingComboRuleGroup>((row) => ({
      id: Number(row.id),
      comboRuleId: Number(row.combo_rule_id),
      groupNo: Number(row.group_no),
      groupName: row.group_name ? String(row.group_name) : null,
      quantityRequired: Number(row.quantity_required || 1),
      matchType: String(row.match_type || "").toLowerCase() as
        | "category"
        | "product"
        | "variant",
      categoryId: row.category_id != null ? Number(row.category_id) : null,
      productId: row.product_id != null ? Number(row.product_id) : null,
      productVariantId:
        row.product_variant_id != null ? Number(row.product_variant_id) : null,
      requiredSize: row.required_size ? String(row.required_size) : null,
      categoryName: row.category_name ? String(row.category_name) : null,
      productName: row.product_name ? String(row.product_name) : null,
      variantLabel: row.variant_label ? String(row.variant_label) : null,
    })),
  };
}

export async function createMarketingComboRule(body: {
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive?: boolean;
  priority?: number;
  autoApply?: boolean;
  groups: ReplaceGroupInput[];
}) {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const comboPrice = Number(body.comboPrice);
  const priority = Number(body.priority ?? 0);

  if (!code) throw new ApiError(400, "Code combo không được để trống");
  if (!name) throw new ApiError(400, "Tên combo không được để trống");
  if (!Number.isFinite(comboPrice) || comboPrice < 0) {
    throw new ApiError(400, "Giá combo không hợp lệ");
  }
  if (!Number.isFinite(priority)) {
    throw new ApiError(400, "Priority không hợp lệ");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dupR = await client.query(
      `
        SELECT 1
        FROM coffee_chain_db.combo_rules
        WHERE code = $1
        LIMIT 1
      `,
      [code],
    );
    if (dupR.rows[0]) throw new ApiError(400, "Code combo đã tồn tại");

    await validateGroups(client, body.groups);

    const createdR = await client.query(
      `
        INSERT INTO coffee_chain_db.combo_rules(
          code,
          name,
          description,
          combo_price,
          is_active,
          priority,
          auto_apply
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        code,
        name,
        normalizeNullableText(body.description),
        comboPrice,
        body.isActive !== false,
        priority,
        body.autoApply === true,
      ],
    );

    const comboRuleId = Number(createdR.rows[0].id);

    for (const group of body.groups) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.combo_rule_groups(
            combo_rule_id,
            group_no,
            group_name,
            quantity_required,
            match_type,
            category_id,
            product_id,
            product_variant_id,
            required_size
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          comboRuleId,
          Number(group.groupNo),
          normalizeNullableText(group.groupName),
          1,
          String(group.matchType).trim().toLowerCase(),
          String(group.matchType).trim().toLowerCase() === "category"
            ? Number(group.categoryId)
            : null,
          String(group.matchType).trim().toLowerCase() === "product"
            ? Number(group.productId)
            : null,
          String(group.matchType).trim().toLowerCase() === "variant"
            ? Number(group.productVariantId)
            : null,
          normalizeRequiredSize(group.requiredSize),
        ],
      );
    }

    await client.query("COMMIT");
    return { id: comboRuleId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMarketingComboRule(
  ruleId: number,
  body: {
    code?: string;
    name?: string;
    description?: string | null;
    comboPrice?: number;
    isActive?: boolean;
    priority?: number;
    autoApply?: boolean;
  },
) {
  const currentR = await pool.query(
    `SELECT * FROM coffee_chain_db.combo_rules WHERE id = $1 LIMIT 1`,
    [ruleId],
  );
  const current = currentR.rows[0];
  if (!current) throw new ApiError(404, "Combo không tồn tại");

  const code =
    body.code != null
      ? String(body.code).trim()
      : String(current.code || "").trim();
  const name =
    body.name != null
      ? String(body.name).trim()
      : String(current.name || "").trim();
  const comboPrice =
    body.comboPrice != null
      ? Number(body.comboPrice)
      : Number(current.combo_price || 0);
  const priority =
    body.priority != null
      ? Number(body.priority)
      : Number(current.priority || 0);

  if (!code) throw new ApiError(400, "Code combo không được để trống");
  if (!name) throw new ApiError(400, "Tên combo không được để trống");
  if (!Number.isFinite(comboPrice) || comboPrice < 0) {
    throw new ApiError(400, "Giá combo không hợp lệ");
  }
  if (!Number.isFinite(priority)) {
    throw new ApiError(400, "Priority không hợp lệ");
  }

  const dupR = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.combo_rules
      WHERE code = $1
        AND id <> $2
      LIMIT 1
    `,
    [code, ruleId],
  );
  if (dupR.rows[0]) throw new ApiError(400, "Code combo đã tồn tại");

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.combo_rules
      SET
        code = $2,
        name = $3,
        description = $4,
        combo_price = $5,
        is_active = $6,
        priority = $7,
        auto_apply = $8
      WHERE id = $1
      RETURNING *
    `,
    [
      ruleId,
      code,
      name,
      body.description !== undefined
        ? normalizeNullableText(body.description)
        : current.description,
      comboPrice,
      body.isActive !== undefined ? body.isActive : current.is_active,
      priority,
      body.autoApply !== undefined ? body.autoApply : current.auto_apply,
    ],
  );

  return r.rows[0];
}

export async function toggleMarketingComboRuleActive(
  ruleId: number,
  isActive: boolean,
) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.combo_rules
      SET is_active = $2
      WHERE id = $1
      RETURNING *
    `,
    [ruleId, isActive],
  );
  if (!r.rows[0]) throw new ApiError(404, "Combo không tồn tại");
  return r.rows[0];
}

export async function replaceMarketingComboRuleGroups(
  ruleId: number,
  groups: ReplaceGroupInput[],
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ruleR = await client.query(
      `SELECT 1 FROM coffee_chain_db.combo_rules WHERE id = $1 LIMIT 1`,
      [ruleId],
    );
    if (!ruleR.rows[0]) throw new ApiError(404, "Combo không tồn tại");

    await validateGroups(client, groups);

    await client.query(
      `DELETE FROM coffee_chain_db.combo_rule_groups WHERE combo_rule_id = $1`,
      [ruleId],
    );

    for (const group of groups) {
      const matchType = String(group.matchType).trim().toLowerCase();

      await client.query(
        `
          INSERT INTO coffee_chain_db.combo_rule_groups(
            combo_rule_id,
            group_no,
            group_name,
            quantity_required,
            match_type,
            category_id,
            product_id,
            product_variant_id,
            required_size
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          ruleId,
          Number(group.groupNo),
          normalizeNullableText(group.groupName),
          1,
          matchType,
          matchType === "category" ? Number(group.categoryId) : null,
          matchType === "product" ? Number(group.productId) : null,
          matchType === "variant" ? Number(group.productVariantId) : null,
          normalizeRequiredSize(group.requiredSize),
        ],
      );
    }

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
