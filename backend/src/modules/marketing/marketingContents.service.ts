import { ApiError } from "../../utils/apiError";
import type {
  MarketingContentAdminListQueryInput,
  MarketingContentBodyInput,
  MarketingContentPublicListQueryInput,
} from "./marketingContents.schema";
import {
  createMarketingContentRepo,
  getExistingMarketingTargetsRepo,
  getMarketingContentByIdRepo,
  getPublicMarketingContentBySlugRepo,
  incrementMarketingContentViewCountRepo,
  listFeaturedMarketingContentsRepo,
  listLatestMarketingContentsRepo,
  listMarketingContentsAdminRepo,
  listPublicMarketingContentsByTypesRepo,
  listPublicMarketingContentsRepo,
  listRelatedMarketingContentsRepo,
  parseMarketingContentRowArrays,
  softDeleteMarketingContentRepo,
  updateMarketingContentActiveRepo,
  updateMarketingContentFeatureRepo,
  updateMarketingContentRepo,
  updateMarketingContentStatusRepo,
  type MarketingContentRow,
  type MarketingContentStatus,
  type MarketingContentType,
} from "./marketingContents.repo";

type MarketingContentDestinationType =
  | "CONTENT"
  | "PROMOTION"
  | "VOUCHER"
  | "PRODUCT"
  | "STORE"
  | "CUSTOM";

type MarketingTargetAvailability = Awaited<
  ReturnType<typeof getExistingMarketingTargetsRepo>
>;

const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;
const VIETNAM_LOCAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : null;
}

function normalizeMarketingDateTimeInput(value?: string | null) {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) return null;

  const localMatch = trimmed.match(VIETNAM_LOCAL_DATE_TIME_REGEX);
  if (localMatch) {
    const [, year, month, day, hour, minute, second = "00", millisecond = "0"] =
      localMatch;
    const normalizedMillisecond = millisecond.padEnd(3, "0").slice(0, 3);
    const utcTime = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute) - VIETNAM_UTC_OFFSET_MINUTES,
      Number(second),
      Number(normalizedMillisecond),
    );
    return new Date(utcTime).toISOString();
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
}

function normalizeBodyInput(body: MarketingContentBodyInput, actorUserId: number | null) {
  const safeSlug = slugify(body.slug || body.title);
  if (!safeSlug) {
    throw new ApiError(400, "Slug không hợp lệ");
  }

  const publishedAt =
    body.status === "published"
      ? normalizeMarketingDateTimeInput(body.publishedAt) || new Date().toISOString()
      : normalizeMarketingDateTimeInput(body.publishedAt);

  return {
    title: body.title.trim(),
    slug: safeSlug,
    summary: normalizeOptionalString(body.summary),
    content: normalizeOptionalString(body.content),
    coverImageUrl: normalizeOptionalString(body.coverImageUrl),
    galleryImages: body.galleryImages.map((item) => item.trim()).filter(Boolean),
    type: body.type,
    status: body.status,
    isActive: body.isActive,
    publishedAt,
    displayStartAt: normalizeMarketingDateTimeInput(body.displayStartAt),
    displayEndAt: normalizeMarketingDateTimeInput(body.displayEndAt),
    isFeatured: body.isFeatured,
    sortOrder: body.sortOrder,
    targetType: body.targetType,
    targetRefId: body.targetRefId ?? null,
    badgeLabel: normalizeOptionalString(body.badgeLabel),
    ctaLabel: normalizeOptionalString(body.ctaLabel),
    ctaUrl: normalizeOptionalString(body.ctaUrl),
    tags: body.tags.map((item) => slugify(item)).filter(Boolean),
    actorUserId,
  };
}

function mapBaseContent(row: MarketingContentRow) {
  const { galleryImages, tags } = parseMarketingContentRowArrays(row);
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    coverImageUrl: row.cover_image_url,
    galleryImages,
    type: row.type,
    status: row.status,
    isActive: Boolean(row.is_active),
    publishedAt: row.published_at,
    displayStartAt: row.display_start_at,
    displayEndAt: row.display_end_at,
    viewCount: Number(row.view_count || 0),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0),
    targetType: row.target_type,
    targetRefId: row.target_ref_id != null ? Number(row.target_ref_id) : null,
    badgeLabel: row.badge_label,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    tags,
    createdBy: row.created_by != null ? Number(row.created_by) : null,
    updatedBy: row.updated_by != null ? Number(row.updated_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveDestination(params: {
  row: MarketingContentRow;
  targetAvailability: MarketingTargetAvailability;
}) {
  const baseDetailPath = `/discover/${params.row.slug}`;
  const ctaUrl = normalizeOptionalString(params.row.cta_url);

  if (ctaUrl) {
    return {
      destinationType: "CUSTOM" as MarketingContentDestinationType,
      destinationPath: ctaUrl,
      resolvedUrl: ctaUrl,
    };
  }

  const targetRefId =
    params.row.target_ref_id != null ? Number(params.row.target_ref_id) : null;

  if (params.row.target_type === "PROMOTION" && targetRefId != null) {
    if (params.targetAvailability.promotionIds.has(targetRefId)) {
      const path = `/customer/promotions/${targetRefId}`;
      return {
        destinationType: "PROMOTION" as MarketingContentDestinationType,
        destinationPath: path,
        resolvedUrl: path,
      };
    }
  }

  if (params.row.target_type === "VOUCHER" && targetRefId != null) {
    if (params.targetAvailability.voucherIds.has(targetRefId)) {
      const path = `/customer/vouchers/${targetRefId}`;
      return {
        destinationType: "VOUCHER" as MarketingContentDestinationType,
        destinationPath: path,
        resolvedUrl: path,
      };
    }
  }

  if (params.row.target_type === "PRODUCT" && targetRefId != null) {
    if (params.targetAvailability.productIds.has(targetRefId)) {
      const path = `/menu?productId=${targetRefId}`;
      return {
        destinationType: "PRODUCT" as MarketingContentDestinationType,
        destinationPath: path,
        resolvedUrl: path,
      };
    }
  }

  if (params.row.target_type === "STORE" && targetRefId != null) {
    if (params.targetAvailability.storeIds.has(targetRefId)) {
      const path = `/stores/${targetRefId}`;
      return {
        destinationType: "STORE" as MarketingContentDestinationType,
        destinationPath: path,
        resolvedUrl: path,
      };
    }
  }

  return {
    destinationType: "CONTENT" as MarketingContentDestinationType,
    destinationPath: baseDetailPath,
    resolvedUrl: baseDetailPath,
  };
}

async function buildTargetAvailability(rows: MarketingContentRow[]) {
  const promotionIds: number[] = [];
  const voucherIds: number[] = [];
  const productIds: number[] = [];
  const storeIds: number[] = [];

  for (const row of rows) {
    const targetRefId = row.target_ref_id != null ? Number(row.target_ref_id) : null;
    if (!targetRefId) continue;

    if (row.target_type === "PROMOTION") promotionIds.push(targetRefId);
    if (row.target_type === "VOUCHER") voucherIds.push(targetRefId);
    if (row.target_type === "PRODUCT") productIds.push(targetRefId);
    if (row.target_type === "STORE") storeIds.push(targetRefId);
  }

  return getExistingMarketingTargetsRepo({
    promotionIds,
    voucherIds,
    productIds,
    storeIds,
  });
}

async function mapPublicContents(rows: MarketingContentRow[]) {
  const targetAvailability = await buildTargetAvailability(rows);
  return rows.map((row) => ({
    ...mapBaseContent(row),
    ...resolveDestination({ row, targetAvailability }),
  }));
}

function handleRepoError(error: unknown, duplicateMessage: string): never {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  if (code === "23505") {
    throw new ApiError(400, duplicateMessage);
  }
  throw error;
}

export async function createMarketingContent(
  body: MarketingContentBodyInput,
  actorUserId: number | null,
) {
  try {
    const row = await createMarketingContentRepo(normalizeBodyInput(body, actorUserId));
    return mapBaseContent(row);
  } catch (error) {
    handleRepoError(error, "Slug đã tồn tại");
  }
}

export async function listMarketingContents(query: MarketingContentAdminListQueryInput) {
  const result = await listMarketingContentsAdminRepo(query);
  return {
    items: result.rows.map(mapBaseContent),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total > 0 ? Math.ceil(result.total / query.limit) : 0,
    },
  };
}

export async function getMarketingContentDetail(id: number) {
  const row = await getMarketingContentByIdRepo(id);
  if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
  return mapBaseContent(row);
}

export async function updateMarketingContent(
  id: number,
  body: MarketingContentBodyInput,
  actorUserId: number | null,
) {
  try {
    const row = await updateMarketingContentRepo(id, normalizeBodyInput(body, actorUserId));
    if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
    return mapBaseContent(row);
  } catch (error) {
    handleRepoError(error, "Slug đã tồn tại");
  }
}

export async function updateMarketingContentStatus(params: {
  id: number;
  status: MarketingContentStatus;
  publishedAt?: string | null;
  actorUserId: number | null;
}) {
  const publishedAt =
    params.status === "published"
      ? normalizeMarketingDateTimeInput(params.publishedAt) || new Date().toISOString()
      : normalizeMarketingDateTimeInput(params.publishedAt) || null;

  const row = await updateMarketingContentStatusRepo({
    id: params.id,
    status: params.status,
    publishedAt,
    updatedBy: params.actorUserId,
  });

  if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
  return mapBaseContent(row);
}

export async function toggleMarketingContentActive(params: {
  id: number;
  isActive: boolean;
  actorUserId: number | null;
}) {
  const row = await updateMarketingContentActiveRepo({
    id: params.id,
    isActive: params.isActive,
    updatedBy: params.actorUserId,
  });

  if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
  return mapBaseContent(row);
}

export async function updateMarketingContentFeature(params: {
  id: number;
  isFeatured: boolean;
  sortOrder: number;
  actorUserId: number | null;
}) {
  const row = await updateMarketingContentFeatureRepo({
    id: params.id,
    isFeatured: params.isFeatured,
    sortOrder: params.sortOrder,
    updatedBy: params.actorUserId,
  });

  if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
  return mapBaseContent(row);
}

export async function deleteMarketingContent(id: number, actorUserId: number | null) {
  const row = await softDeleteMarketingContentRepo({ id, updatedBy: actorUserId });
  if (!row) throw new ApiError(404, "Bài viết marketing không tồn tại");
  return { id: Number(row.id) };
}

export async function listPublicMarketingContents(
  query: MarketingContentPublicListQueryInput,
) {
  const result = await listPublicMarketingContentsRepo(query);
  const items = await mapPublicContents(result.rows);
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total > 0 ? Math.ceil(result.total / query.limit) : 0,
    },
  };
}

export async function getPublicMarketingContentDetail(slug: string) {
  const row = await getPublicMarketingContentBySlugRepo(slug);
  if (!row) {
    throw new ApiError(404, "Nội dung marketing không tồn tại hoặc chưa được xuất bản");
  }

  const incrementedRow = await incrementMarketingContentViewCountRepo(Number(row.id));
  if (!incrementedRow) {
    throw new ApiError(404, "Nội dung marketing không tồn tại hoặc chưa được xuất bản");
  }

  const relatedRows = await listRelatedMarketingContentsRepo({
    id: Number(incrementedRow.id),
    type: incrementedRow.type as MarketingContentType,
    limit: 3,
  });

  const [item] = await mapPublicContents([incrementedRow]);
  const relatedItems = await mapPublicContents(relatedRows);

  return { item, relatedItems };
}

function uniqueById(rows: MarketingContentRow[]) {
  const seen = new Set<number>();
  const next: MarketingContentRow[] = [];

  for (const row of rows) {
    const id = Number(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(row);
  }

  return next;
}

export async function getPublicHomeMarketingContents(params: {
  featuredLimit: number;
  latestLimit: number;
  sectionLimit: number;
}) {
  const [
    featuredRows,
    latestRows,
    promotionRows,
    trendingRows,
    newStoreRows,
    newProductRows,
  ] = await Promise.all([
    listFeaturedMarketingContentsRepo(params.featuredLimit),
    listLatestMarketingContentsRepo(params.latestLimit),
    listPublicMarketingContentsByTypesRepo(["PROMOTION", "VOUCHER"], params.sectionLimit),
    listPublicMarketingContentsByTypesRepo(["TRENDING"], params.sectionLimit),
    listPublicMarketingContentsByTypesRepo(["NEW_STORE"], params.sectionLimit),
    listPublicMarketingContentsByTypesRepo(["NEW_PRODUCT"], params.sectionLimit),
  ]);

  const allRows = uniqueById([
    ...featuredRows,
    ...latestRows,
    ...promotionRows,
    ...trendingRows,
    ...newStoreRows,
    ...newProductRows,
  ]);

  const targetAvailability = await buildTargetAvailability(allRows);

  const mapWithTarget = (rows: MarketingContentRow[]) =>
    rows.map((row) => ({
      ...mapBaseContent(row),
      ...resolveDestination({ row, targetAvailability }),
    }));

  return {
    featuredBanners: mapWithTarget(featuredRows),
    latestPosts: mapWithTarget(latestRows),
    promotions: mapWithTarget(promotionRows),
    trendingItems: mapWithTarget(trendingRows),
    newStores: mapWithTarget(newStoreRows),
    newProducts: mapWithTarget(newProductRows),
  };
}
