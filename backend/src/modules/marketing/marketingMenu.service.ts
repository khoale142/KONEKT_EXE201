import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";

export type MarketingMenuListItem = {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  variantCount: number;
  activeVariantCount: number;
  createdAt: string | null;
};

export type MarketingMenuVariant = {
  id: number;
  productId: number;
  sku: string | null;
  size: string;
  price: number;
  costPrice: number;
  isActive: boolean;
  createdAt: string | null;
};

export type MarketingMenuProductDetail = {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string | null;
  variants: MarketingMenuVariant[];
};

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function listMarketingMenuCategories() {
  const r = await pool.query(
    `
      SELECT
        c.id,
        c.name,
        c.description
      FROM coffee_chain_db.categories c
      ORDER BY c.name ASC, c.id ASC
    `,
  );

  return r.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    description: row.description ? String(row.description) : null,
  }));
}

export async function listMarketingMenuProducts(params: {
  keyword?: string;
  categoryId?: number;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [];
  const whereParts: string[] = [];

  if (params.keyword) {
    values.push(params.keyword.trim());
    whereParts.push(`p.name ILIKE '%' || $${values.length} || '%'`);
  }

  if (params.categoryId != null && Number.isInteger(Number(params.categoryId))) {
    values.push(Number(params.categoryId));
    whereParts.push(`p.category_id = $${values.length}`);
  }

  if (typeof params.isActive === "boolean") {
    values.push(params.isActive);
    whereParts.push(`p.is_active = $${values.length}`);
  }

  values.push(params.limit ?? 100);
  const limitParam = values.length;
  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const sql = `
    SELECT
      p.id,
      p.category_id,
      c.name AS category_name,
      p.name,
      p.image_url,
      p.is_active,
      p.created_at,
      COUNT(pv.id)::int AS variant_count,
      COUNT(*) FILTER (WHERE pv.is_active = TRUE)::int AS active_variant_count
    FROM coffee_chain_db.products p
    LEFT JOIN coffee_chain_db.categories c
      ON c.id = p.category_id
    LEFT JOIN coffee_chain_db.product_variants pv
      ON pv.product_id = p.id
    ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
    GROUP BY p.id, c.name
    ORDER BY c.name NULLS LAST, p.name ASC, p.id ASC
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
  `;

  const r = await pool.query(sql, values);

  const countValues = values.slice(0, values.length - 2);
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM coffee_chain_db.products p
    ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
  `;
  const countR = await pool.query(countSql, countValues);

  return {
    items: r.rows.map<MarketingMenuListItem>((row) => ({
      id: Number(row.id),
      categoryId: row.category_id != null ? Number(row.category_id) : null,
      categoryName: row.category_name ? String(row.category_name) : null,
      name: String(row.name || ""),
      imageUrl: row.image_url ? String(row.image_url) : null,
      isActive: Boolean(row.is_active),
      variantCount: Number(row.variant_count || 0),
      activeVariantCount: Number(row.active_variant_count || 0),
      createdAt: row.created_at ?? null,
    })),
    pagination: {
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      total: Number(countR.rows[0]?.total || 0),
    },
  };
}

export async function getMarketingMenuProductDetail(productId: number): Promise<MarketingMenuProductDetail> {
  const productR = await pool.query(
    `
      SELECT
        p.id,
        p.category_id,
        c.name AS category_name,
        p.name,
        p.image_url,
        p.is_active,
        p.created_at
      FROM coffee_chain_db.products p
      LEFT JOIN coffee_chain_db.categories c
        ON c.id = p.category_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [productId],
  );

  const product = productR.rows[0];
  if (!product) throw new ApiError(404, "Món không tồn tại");

  const variantR = await pool.query(
    `
      SELECT
        pv.id,
        pv.product_id,
        pv.sku,
        pv.size,
        pv.price,
        pv.cost_price,
        pv.is_active,
        pv.created_at
      FROM coffee_chain_db.product_variants pv
      WHERE pv.product_id = $1
      ORDER BY pv.size ASC, pv.id ASC
    `,
    [productId],
  );

  return {
    id: Number(product.id),
    categoryId: product.category_id != null ? Number(product.category_id) : null,
    categoryName: product.category_name ? String(product.category_name) : null,
    name: String(product.name || ""),
    imageUrl: product.image_url ? String(product.image_url) : null,
    isActive: Boolean(product.is_active),
    createdAt: product.created_at ?? null,
    variants: variantR.rows.map<MarketingMenuVariant>((row) => ({
      id: Number(row.id),
      productId: Number(row.product_id),
      sku: row.sku ? String(row.sku) : null,
      size: String(row.size || ""),
      price: Number(row.price || 0),
      costPrice: Number(row.cost_price || 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ?? null,
    })),
  };
}

export async function updateMarketingMenuProduct(
  productId: number,
  body: {
    categoryId?: number | null;
    name?: string;
    imageUrl?: string | null;
    isActive?: boolean;
  },
) {
  const currentR = await pool.query(
    `SELECT * FROM coffee_chain_db.products WHERE id = $1 LIMIT 1`,
    [productId],
  );
  const current = currentR.rows[0];
  if (!current) throw new ApiError(404, "Món không tồn tại");

  if (body.categoryId != null) {
    const cR = await pool.query(
      `SELECT 1 FROM coffee_chain_db.categories WHERE id = $1 LIMIT 1`,
      [Number(body.categoryId)],
    );
    if (!cR.rows[0]) throw new ApiError(400, "Category không tồn tại");
  }

  const nextName = body.name != null ? String(body.name).trim() : String(current.name || "").trim();
  if (!nextName) throw new ApiError(400, "Tên món không được để trống");

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.products
      SET
        category_id = $2,
        name = $3,
        image_url = $4,
        is_active = $5
      WHERE id = $1
      RETURNING *
    `,
    [
      productId,
      body.categoryId !== undefined ? body.categoryId : current.category_id,
      nextName,
      body.imageUrl !== undefined ? normalizeNullableText(body.imageUrl) : current.image_url,
      body.isActive !== undefined ? body.isActive : current.is_active,
    ],
  );

  return r.rows[0];
}

export async function toggleMarketingMenuProductActive(
  productId: number,
  isActive: boolean,
) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.products
      SET is_active = $2
      WHERE id = $1
      RETURNING *
    `,
    [productId, isActive],
  );
  if (!r.rows[0]) throw new ApiError(404, "Món không tồn tại");
  return r.rows[0];
}

export async function updateMarketingMenuVariant(
  variantId: number,
  body: {
    size?: string;
    price?: number;
    isActive?: boolean;
  },
) {
  const currentR = await pool.query(
    `SELECT * FROM coffee_chain_db.product_variants WHERE id = $1 LIMIT 1`,
    [variantId],
  );
  const current = currentR.rows[0];
  if (!current) throw new ApiError(404, "Variant không tồn tại");

  const nextSize = body.size != null ? String(body.size).trim() : String(current.size || "").trim();
  if (!nextSize) throw new ApiError(400, "Size không được để trống");

  const nextPrice = body.price != null ? Number(body.price) : Number(current.price || 0);
  if (!Number.isFinite(nextPrice) || nextPrice < 0) {
    throw new ApiError(400, "Giá variant không hợp lệ");
  }

  const duplicateR = await pool.query(
    `
      SELECT 1
      FROM coffee_chain_db.product_variants
      WHERE product_id = $1
        AND size = $2
        AND id <> $3
      LIMIT 1
    `,
    [Number(current.product_id), nextSize, variantId],
  );
  if (duplicateR.rows[0]) {
    throw new ApiError(400, "Variant size này đã tồn tại trong món");
  }

  const r = await pool.query(
    `
      UPDATE coffee_chain_db.product_variants
      SET
        size = $2,
        price = $3,
        is_active = $4
      WHERE id = $1
      RETURNING *
    `,
    [
      variantId,
      nextSize,
      nextPrice,
      body.isActive !== undefined ? body.isActive : current.is_active,
    ],
  );

  return r.rows[0];
}

export async function toggleMarketingMenuVariantActive(
  variantId: number,
  isActive: boolean,
) {
  const r = await pool.query(
    `
      UPDATE coffee_chain_db.product_variants
      SET is_active = $2
      WHERE id = $1
      RETURNING *
    `,
    [variantId, isActive],
  );
  if (!r.rows[0]) throw new ApiError(404, "Variant không tồn tại");
  return r.rows[0];
}
