import { pool } from "../../config/db";

export type MarketingContentType =
  | "NEWS"
  | "NEW_PRODUCT"
  | "NEW_STORE"
  | "TRENDING"
  | "PROMOTION"
  | "VOUCHER"
  | "CAMPAIGN"
  | "EVENT"
  | "ANNOUNCEMENT";

export type MarketingContentStatus = "draft" | "published" | "archived";
export type MarketingContentTargetType =
  | "NONE"
  | "PROMOTION"
  | "VOUCHER"
  | "PRODUCT"
  | "STORE";

export type MarketingContentRow = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  cover_image_url: string | null;
  gallery_images: unknown;
  type: MarketingContentType;
  status: MarketingContentStatus;
  is_active: boolean;
  published_at: string | null;
  display_start_at: string | null;
  display_end_at: string | null;
  view_count: number;
  is_featured: boolean;
  sort_order: number;
  target_type: MarketingContentTargetType;
  target_ref_id: number | null;
  badge_label: string | null;
  cta_label: string | null;
  cta_url: string | null;
  tags: unknown;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  total_count?: number;
};

export type MarketingContentAdminListParams = {
  keyword?: string;
  type?: MarketingContentType;
  status?: MarketingContentStatus;
  isActive?: boolean;
  isFeatured?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
  sortBy: "createdAt" | "updatedAt" | "publishedAt" | "title" | "viewCount" | "sortOrder";
  sortDirection: "asc" | "desc";
};

export type MarketingContentPublicListParams = {
  keyword?: string;
  type?: MarketingContentType;
  featuredOnly?: boolean;
  page: number;
  limit: number;
};

export type UpsertMarketingContentParams = {
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  type: MarketingContentType;
  status: MarketingContentStatus;
  isActive: boolean;
  publishedAt: string | null;
  displayStartAt: string | null;
  displayEndAt: string | null;
  isFeatured: boolean;
  sortOrder: number;
  targetType: MarketingContentTargetType;
  targetRefId: number | null;
  badgeLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  tags: string[];
  actorUserId: number | null;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function buildAdminWhere(params: MarketingContentAdminListParams) {
  const where: string[] = ["mc.deleted_at IS NULL"];
  const values: unknown[] = [];

  if (params.keyword) {
    values.push(`%${params.keyword.trim()}%`);
    const idx = values.length;
    where.push(`(mc.title ILIKE $${idx} OR mc.summary ILIKE $${idx} OR mc.slug ILIKE $${idx})`);
  }

  if (params.type) {
    values.push(params.type);
    where.push(`mc.type = $${values.length}`);
  }

  if (params.status) {
    values.push(params.status);
    where.push(`mc.status = $${values.length}`);
  }

  if (typeof params.isActive === "boolean") {
    values.push(params.isActive);
    where.push(`mc.is_active = $${values.length}`);
  }

  if (typeof params.isFeatured === "boolean") {
    values.push(params.isFeatured);
    where.push(`mc.is_featured = $${values.length}`);
  }

  if (params.dateFrom) {
    values.push(params.dateFrom);
    where.push(`COALESCE(mc.published_at, mc.created_at) >= $${values.length}`);
  }

  if (params.dateTo) {
    values.push(params.dateTo);
    where.push(`COALESCE(mc.published_at, mc.created_at) <= $${values.length}`);
  }

  return { where, values };
}

function buildPublicWhere(params: MarketingContentPublicListParams) {
  const where: string[] = [
    "mc.deleted_at IS NULL",
    "mc.status = 'published'",
    "mc.is_active = TRUE",
    "mc.published_at IS NOT NULL",
    "mc.published_at <= NOW()",
    "(mc.display_start_at IS NULL OR mc.display_start_at <= NOW())",
    "(mc.display_end_at IS NULL OR mc.display_end_at >= NOW())",
  ];
  const values: unknown[] = [];

  if (params.keyword) {
    values.push(`%${params.keyword.trim()}%`);
    const idx = values.length;
    where.push(`(mc.title ILIKE $${idx} OR mc.summary ILIKE $${idx} OR mc.content ILIKE $${idx})`);
  }

  if (params.type) {
    values.push(params.type);
    where.push(`mc.type = $${values.length}`);
  }

  if (params.featuredOnly) {
    where.push("mc.is_featured = TRUE");
  }

  return { where, values };
}

function getSortClause(
  sortBy: MarketingContentAdminListParams["sortBy"],
  sortDirection: MarketingContentAdminListParams["sortDirection"],
) {
  const direction = sortDirection === "asc" ? "ASC" : "DESC";
  const sortMap: Record<MarketingContentAdminListParams["sortBy"], string> = {
    createdAt: "mc.created_at",
    updatedAt: "mc.updated_at",
    publishedAt: "mc.published_at",
    title: "mc.title",
    viewCount: "mc.view_count",
    sortOrder: "mc.sort_order",
  };

  return `${sortMap[sortBy]} ${direction}, mc.is_featured DESC, mc.sort_order DESC, mc.updated_at DESC, mc.id DESC`;
}

export async function listMarketingContentsAdminRepo(
  params: MarketingContentAdminListParams,
) {
  const { where, values } = buildAdminWhere(params);
  const offset = (params.page - 1) * params.limit;
  values.push(params.limit, offset);
  const limitIdx = values.length - 1;
  const offsetIdx = values.length;

  const result = await pool.query<MarketingContentRow>(
    `
    SELECT
      mc.*,
      COUNT(*) OVER()::int AS total_count
    FROM coffee_chain_db.marketing_contents mc
    WHERE ${where.join(" AND ")}
    ORDER BY ${getSortClause(params.sortBy, params.sortDirection)}
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
    `,
    values,
  );

  return {
    rows: result.rows,
    total: result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0,
  };
}

export async function getMarketingContentByIdRepo(id: number) {
  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.id = $1
      AND mc.deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createMarketingContentRepo(params: UpsertMarketingContentParams) {
  const result = await pool.query<MarketingContentRow>(
    `
    INSERT INTO coffee_chain_db.marketing_contents(
      title,
      slug,
      summary,
      content,
      cover_image_url,
      gallery_images,
      type,
      status,
      is_active,
      published_at,
      display_start_at,
      display_end_at,
      is_featured,
      sort_order,
      target_type,
      target_ref_id,
      badge_label,
      cta_label,
      cta_url,
      tags,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,NOW(),NOW()
    )
    RETURNING *
    `,
    [
      params.title,
      params.slug,
      params.summary,
      params.content,
      params.coverImageUrl,
      JSON.stringify(params.galleryImages),
      params.type,
      params.status,
      params.isActive,
      params.publishedAt,
      params.displayStartAt,
      params.displayEndAt,
      params.isFeatured,
      params.sortOrder,
      params.targetType,
      params.targetRefId,
      params.badgeLabel,
      params.ctaLabel,
      params.ctaUrl,
      JSON.stringify(params.tags),
      params.actorUserId,
      params.actorUserId,
    ],
  );

  return result.rows[0];
}

export async function updateMarketingContentRepo(
  id: number,
  params: UpsertMarketingContentParams,
) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      title = $1,
      slug = $2,
      summary = $3,
      content = $4,
      cover_image_url = $5,
      gallery_images = $6::jsonb,
      type = $7,
      status = $8,
      is_active = $9,
      published_at = $10,
      display_start_at = $11,
      display_end_at = $12,
      is_featured = $13,
      sort_order = $14,
      target_type = $15,
      target_ref_id = $16,
      badge_label = $17,
      cta_label = $18,
      cta_url = $19,
      tags = $20::jsonb,
      updated_by = $21,
      updated_at = NOW()
    WHERE id = $22
      AND deleted_at IS NULL
    RETURNING *
    `,
    [
      params.title,
      params.slug,
      params.summary,
      params.content,
      params.coverImageUrl,
      JSON.stringify(params.galleryImages),
      params.type,
      params.status,
      params.isActive,
      params.publishedAt,
      params.displayStartAt,
      params.displayEndAt,
      params.isFeatured,
      params.sortOrder,
      params.targetType,
      params.targetRefId,
      params.badgeLabel,
      params.ctaLabel,
      params.ctaUrl,
      JSON.stringify(params.tags),
      params.actorUserId,
      id,
    ],
  );

  return result.rows[0] ?? null;
}

export async function updateMarketingContentStatusRepo(params: {
  id: number;
  status: MarketingContentStatus;
  publishedAt: string | null;
  updatedBy: number | null;
}) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      status = $1,
      published_at = $2,
      updated_by = $3,
      updated_at = NOW()
    WHERE id = $4
      AND deleted_at IS NULL
    RETURNING *
    `,
    [params.status, params.publishedAt, params.updatedBy, params.id],
  );

  return result.rows[0] ?? null;
}

export async function updateMarketingContentActiveRepo(params: {
  id: number;
  isActive: boolean;
  updatedBy: number | null;
}) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      is_active = $1,
      updated_by = $2,
      updated_at = NOW()
    WHERE id = $3
      AND deleted_at IS NULL
    RETURNING *
    `,
    [params.isActive, params.updatedBy, params.id],
  );

  return result.rows[0] ?? null;
}

export async function updateMarketingContentFeatureRepo(params: {
  id: number;
  isFeatured: boolean;
  sortOrder: number;
  updatedBy: number | null;
}) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      is_featured = $1,
      sort_order = $2,
      updated_by = $3,
      updated_at = NOW()
    WHERE id = $4
      AND deleted_at IS NULL
    RETURNING *
    `,
    [params.isFeatured, params.sortOrder, params.updatedBy, params.id],
  );

  return result.rows[0] ?? null;
}

export async function softDeleteMarketingContentRepo(params: {
  id: number;
  updatedBy: number | null;
}) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      deleted_at = NOW(),
      updated_by = $2,
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING *
    `,
    [params.id, params.updatedBy],
  );

  return result.rows[0] ?? null;
}

export async function listPublicMarketingContentsRepo(
  params: MarketingContentPublicListParams,
) {
  const { where, values } = buildPublicWhere(params);
  const offset = (params.page - 1) * params.limit;
  values.push(params.limit, offset);
  const limitIdx = values.length - 1;
  const offsetIdx = values.length;

  const result = await pool.query<MarketingContentRow>(
    `
    SELECT
      mc.*,
      COUNT(*) OVER()::int AS total_count
    FROM coffee_chain_db.marketing_contents mc
    WHERE ${where.join(" AND ")}
    ORDER BY mc.is_featured DESC, mc.sort_order DESC, mc.published_at DESC, mc.id DESC
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
    `,
    values,
  );

  return {
    rows: result.rows,
    total: result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0,
  };
}

export async function getPublicMarketingContentBySlugRepo(slug: string) {
  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.slug = $1
      AND mc.deleted_at IS NULL
      AND mc.status = 'published'
      AND mc.is_active = TRUE
      AND mc.published_at IS NOT NULL
      AND mc.published_at <= NOW()
      AND (mc.display_start_at IS NULL OR mc.display_start_at <= NOW())
      AND (mc.display_end_at IS NULL OR mc.display_end_at >= NOW())
    LIMIT 1
    `,
    [slug],
  );

  return result.rows[0] ?? null;
}

export async function incrementMarketingContentViewCountRepo(id: number) {
  const result = await pool.query<MarketingContentRow>(
    `
    UPDATE coffee_chain_db.marketing_contents
    SET
      view_count = COALESCE(view_count, 0) + 1,
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING *
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listPublicMarketingContentsByTypesRepo(
  types: MarketingContentType[],
  limit: number,
) {
  if (!types.length) return [];

  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.deleted_at IS NULL
      AND mc.status = 'published'
      AND mc.is_active = TRUE
      AND mc.published_at IS NOT NULL
      AND mc.published_at <= NOW()
      AND (mc.display_start_at IS NULL OR mc.display_start_at <= NOW())
      AND (mc.display_end_at IS NULL OR mc.display_end_at >= NOW())
      AND mc.type = ANY($1::coffee_chain_db.marketing_content_type[])
    ORDER BY mc.is_featured DESC, mc.sort_order DESC, mc.published_at DESC, mc.id DESC
    LIMIT $2
    `,
    [types, limit],
  );

  return result.rows;
}

export async function listFeaturedMarketingContentsRepo(limit: number) {
  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.deleted_at IS NULL
      AND mc.status = 'published'
      AND mc.is_active = TRUE
      AND mc.is_featured = TRUE
      AND mc.published_at IS NOT NULL
      AND mc.published_at <= NOW()
      AND (mc.display_start_at IS NULL OR mc.display_start_at <= NOW())
      AND (mc.display_end_at IS NULL OR mc.display_end_at >= NOW())
    ORDER BY mc.sort_order DESC, mc.published_at DESC, mc.id DESC
    LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function listLatestMarketingContentsRepo(limit: number) {
  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.deleted_at IS NULL
      AND mc.status = 'published'
      AND mc.is_active = TRUE
      AND mc.published_at IS NOT NULL
      AND mc.published_at <= NOW()
      AND (mc.display_start_at IS NULL OR mc.display_start_at <= NOW())
      AND (mc.display_end_at IS NULL OR mc.display_end_at >= NOW())
    ORDER BY mc.is_featured DESC, mc.sort_order DESC, mc.published_at DESC, mc.id DESC
    LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function listRelatedMarketingContentsRepo(params: {
  id: number;
  type: MarketingContentType;
  limit: number;
}) {
  const result = await pool.query<MarketingContentRow>(
    `
    SELECT mc.*
    FROM coffee_chain_db.marketing_contents mc
    WHERE mc.deleted_at IS NULL
      AND mc.id <> $1
      AND mc.status = 'published'
      AND mc.is_active = TRUE
      AND mc.published_at IS NOT NULL
      AND mc.published_at <= NOW()
      AND (mc.display_start_at IS NULL OR mc.display_start_at <= NOW())
      AND (mc.display_end_at IS NULL OR mc.display_end_at >= NOW())
      AND mc.type = $2
    ORDER BY mc.is_featured DESC, mc.sort_order DESC, mc.published_at DESC, mc.id DESC
    LIMIT $3
    `,
    [params.id, params.type, params.limit],
  );

  return result.rows;
}

export async function getExistingMarketingTargetsRepo(params: {
  promotionIds: number[];
  voucherIds: number[];
  productIds: number[];
  storeIds: number[];
}) {
  const [promotionResult, voucherResult, productResult, storeResult] = await Promise.all([
    params.promotionIds.length
      ? pool.query<{ id: number }>(
        `
        SELECT id
        FROM coffee_chain_db.promotion_campaigns
        WHERE id = ANY($1::bigint[])
          AND deleted_at IS NULL
        `,
        [params.promotionIds],
      )
      : Promise.resolve({ rows: [] }),
    params.voucherIds.length
      ? pool.query<{ id: number }>(
        `
        SELECT id
        FROM coffee_chain_db.voucher_reward_defs
        WHERE id = ANY($1::bigint[])
          AND deleted_at IS NULL
        `,
        [params.voucherIds],
      )
      : Promise.resolve({ rows: [] }),
    params.productIds.length
      ? pool.query<{ id: number }>(
        `
        SELECT id
        FROM coffee_chain_db.products
        WHERE id = ANY($1::bigint[])
          AND is_active = TRUE
        `,
        [params.productIds],
      )
      : Promise.resolve({ rows: [] }),
    params.storeIds.length
      ? pool.query<{ id: number }>(
        `
        SELECT id
        FROM stores
        WHERE id = ANY($1::bigint[])
          AND is_active = TRUE
        `,
        [params.storeIds],
      )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    promotionIds: new Set(promotionResult.rows.map((row) => Number(row.id))),
    voucherIds: new Set(voucherResult.rows.map((row) => Number(row.id))),
    productIds: new Set(productResult.rows.map((row) => Number(row.id))),
    storeIds: new Set(storeResult.rows.map((row) => Number(row.id))),
  };
}

export function parseMarketingContentRowArrays(row: MarketingContentRow) {
  return {
    galleryImages: normalizeStringArray(row.gallery_images),
    tags: normalizeStringArray(row.tags),
  };
}
