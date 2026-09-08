import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";

export type MarketingOfferListItem = {
  id: number;
  code: string;
  name: string;
  kind: "PROMOTION" | "VOUCHER_REWARD";
  status: "active" | "inactive" | "expired" | "scheduled";
  isActive: boolean;
  isPublic: boolean;
  startAt?: string | null;
  endAt?: string | null;
  minOrderAmount: number;

  benefitType: "DISCOUNT" | "GIFT";

  discountType: "FIXED" | "PERCENT" | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;

  pointsCost?: number | null;
  stampsRequired?: number | null;
  allowWithVoucher?: boolean | null;
  allowWithPromotion?: boolean | null;
  totalQuantity?: number | null;
  redeemedQuantity?: number | null;
  requiresGiftSelection?: boolean | null;

  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicMarketingHomeOffer = {
  id: number;
  code: string;
  name: string;
  kind: "PROMOTION" | "VOUCHER_REWARD";
  title: string;
  description: string;
  imageUrl: string | null;
  publishedAt: string | null;
  startAt: string | null;
  endAt: string | null;
  to: string;
};

type StoreScopeMode = "ALL" | "SELECTED" | "ALL_EXCEPT";

export type PromotionCampaignRuleInput = {
  ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

  triggerCategoryId?: number | null;
  triggerProductId?: number | null;
  triggerProductIds?: number[];
  triggerVariantId?: number | null;
  triggerVariantIds?: number[];
  triggerSize?: string | null;
  triggerQty: number;

  rewardCategoryId?: number | null;
  rewardProductId?: number | null;
  rewardProductIds?: number[];
  rewardVariantId?: number | null;
  rewardVariantIds?: number[];
  rewardSize?: string | null;
  rewardQty: number;

  allowCustomerChoice?: boolean;
};

function getNowSafeMs() {
  return Date.now();
}

function parseDateMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function mapCampaignStatus(row: any): MarketingOfferListItem["status"] {
  const now = Date.now();
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();

  if (!row.is_active) return "inactive";
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

function mapRewardStatus(row: any): MarketingOfferListItem["status"] {
  const now = Date.now();
  const start = row.fixed_start_at
    ? new Date(row.fixed_start_at).getTime()
    : null;
  const end = row.fixed_end_at ? new Date(row.fixed_end_at).getTime() : null;

  if (!row.is_active) return "inactive";
  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";
  return "active";
}

function normalizeBenefitType(value: any): "DISCOUNT" | "GIFT" {
  return String(value || "").toUpperCase() === "GIFT" ? "GIFT" : "DISCOUNT";
}

function sanitizeIdList(values?: number[] | null): number[] {
  return Array.from(
    new Set(
      (values || [])
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0),
    ),
  );
}

function pickSingleId(
  primary?: number | null,
  list?: number[] | null,
): number | null {
  if (
    primary != null &&
    Number.isInteger(Number(primary)) &&
    Number(primary) > 0
  ) {
    return Number(primary);
  }

  const cleaned = sanitizeIdList(list);
  return cleaned.length > 0 ? cleaned[0] : null;
}

function normalizeStoreScopeMode(params: {
  isAllStores?: boolean | null;
  storeIds?: number[];
  excludedStoreIds?: number[];
}): StoreScopeMode {
  if (params.isAllStores === false) return "SELECTED";
  if (sanitizeIdList(params.excludedStoreIds).length > 0) return "ALL_EXCEPT";
  return "ALL";
}

async function savePromotionStoreScope(
  client: any,
  campaignId: number,
  params: {
    isAllStores?: boolean;
    storeIds?: number[];
    excludedStoreIds?: number[];
  },
) {
  const selectedStoreIds = sanitizeIdList(params.storeIds);
  const excludedStoreIds = sanitizeIdList(params.excludedStoreIds);
  const scopeMode = normalizeStoreScopeMode(params);

  if (scopeMode === "SELECTED") {
    for (const storeId of selectedStoreIds) {
      await client.query(
        `
        INSERT INTO coffee_chain_db.promotion_campaign_stores(campaign_id, store_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [campaignId, storeId],
      );
    }
    return;
  }

  if (scopeMode === "ALL_EXCEPT") {
    for (const storeId of excludedStoreIds) {
      await client.query(
        `
        INSERT INTO coffee_chain_db.promotion_campaign_excluded_stores(campaign_id, store_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [campaignId, storeId],
      );
    }
  }
}

async function saveVoucherStoreScope(
  client: any,
  rewardDefId: number,
  params: {
    isAllStores?: boolean;
    storeIds?: number[];
    excludedStoreIds?: number[];
  },
) {
  const selectedStoreIds = sanitizeIdList(params.storeIds);
  const excludedStoreIds = sanitizeIdList(params.excludedStoreIds);
  const scopeMode = normalizeStoreScopeMode(params);

  if (scopeMode === "SELECTED") {
    for (const storeId of selectedStoreIds) {
      await client.query(
        `
        INSERT INTO coffee_chain_db.voucher_reward_def_stores(reward_def_id, store_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [rewardDefId, storeId],
      );
    }
    return;
  }

  if (scopeMode === "ALL_EXCEPT") {
    for (const storeId of excludedStoreIds) {
      await client.query(
        `
        INSERT INTO coffee_chain_db.voucher_reward_def_excluded_stores(reward_def_id, store_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [rewardDefId, storeId],
      );
    }
  }
}

async function saveGiftRuleScopes(
  client: any,
  params: {
    kind: "promotion" | "voucher";
    ruleId: number;
    rule: PromotionCampaignRuleInput;
  },
) {
  const triggerProductIds = sanitizeIdList([
    ...sanitizeIdList(params.rule.triggerProductIds),
    ...(params.rule.triggerProductId ? [params.rule.triggerProductId] : []),
  ]);

  const triggerVariantIds = sanitizeIdList([
    ...sanitizeIdList(params.rule.triggerVariantIds),
    ...(params.rule.triggerVariantId ? [params.rule.triggerVariantId] : []),
  ]);

  const rewardProductIds = sanitizeIdList([
    ...sanitizeIdList(params.rule.rewardProductIds),
    ...(params.rule.rewardProductId ? [params.rule.rewardProductId] : []),
  ]);

  const rewardVariantIds = sanitizeIdList([
    ...sanitizeIdList(params.rule.rewardVariantIds),
    ...(params.rule.rewardVariantId ? [params.rule.rewardVariantId] : []),
  ]);

  const tableMap =
    params.kind === "promotion"
      ? {
          triggerProducts:
            "coffee_chain_db.promotion_campaign_rule_trigger_products",
          triggerVariants:
            "coffee_chain_db.promotion_campaign_rule_trigger_variants",
          rewardProducts:
            "coffee_chain_db.promotion_campaign_rule_reward_products",
          rewardVariants:
            "coffee_chain_db.promotion_campaign_rule_reward_variants",
        }
      : {
          triggerProducts:
            "coffee_chain_db.voucher_reward_rule_trigger_products",
          triggerVariants:
            "coffee_chain_db.voucher_reward_rule_trigger_variants",
          rewardProducts: "coffee_chain_db.voucher_reward_rule_reward_products",
          rewardVariants: "coffee_chain_db.voucher_reward_rule_reward_variants",
        };

  for (const productId of triggerProductIds) {
    await client.query(
      `
      INSERT INTO ${tableMap.triggerProducts}(rule_id, product_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [params.ruleId, productId],
    );
  }

  for (const variantId of triggerVariantIds) {
    await client.query(
      `
      INSERT INTO ${tableMap.triggerVariants}(rule_id, product_variant_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [params.ruleId, variantId],
    );
  }

  for (const productId of rewardProductIds) {
    await client.query(
      `
      INSERT INTO ${tableMap.rewardProducts}(rule_id, product_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [params.ruleId, productId],
    );
  }

  for (const variantId of rewardVariantIds) {
    await client.query(
      `
      INSERT INTO ${tableMap.rewardVariants}(rule_id, product_variant_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [params.ruleId, variantId],
    );
  }
}

function assertValidGiftRule(rule?: PromotionCampaignRuleInput | null) {
  if (!rule) {
    throw new ApiError(400, "Offer benefitType=GIFT bat buoc phai co rule");
  }

  if (!["BUY_X_GET_Y", "GIFT_WITH_PURCHASE"].includes(rule.ruleType)) {
    throw new ApiError(400, "Loại rule không hợp lệ");
  }

  if (!(Number(rule.triggerQty || 0) > 0)) {
    throw new ApiError(400, "Rule phai co triggerQty > 0");
  }

  if (!(Number(rule.rewardQty || 0) > 0)) {
    throw new ApiError(400, "Rule phai co rewardQty > 0");
  }

  const hasAnyTriggerTarget =
    !!rule.triggerCategoryId ||
    !!rule.triggerProductId ||
    !!rule.triggerVariantId ||
    sanitizeIdList(rule.triggerProductIds).length > 0 ||
    sanitizeIdList(rule.triggerVariantIds).length > 0;

  if (!hasAnyTriggerTarget) {
    throw new ApiError(
      400,
      "Rule phai co it nhat 1 trigger target: triggerCategoryId / triggerProductIds / triggerVariantIds",
    );
  }

  const hasAnyRewardTarget =
    !!rule.rewardCategoryId ||
    !!rule.rewardProductId ||
    !!rule.rewardVariantId ||
    sanitizeIdList(rule.rewardProductIds).length > 0 ||
    sanitizeIdList(rule.rewardVariantIds).length > 0;

  if (!hasAnyRewardTarget) {
    throw new ApiError(
      400,
      "Rule phai co it nhat 1 reward target: rewardCategoryId / rewardProductIds / rewardVariantIds",
    );
  }

  if (
    rule.allowCustomerChoice &&
    !rule.rewardCategoryId &&
    !rule.rewardProductId &&
    !rule.rewardVariantId &&
    sanitizeIdList(rule.rewardProductIds).length === 0 &&
    sanitizeIdList(rule.rewardVariantIds).length === 0
  ) {
    throw new ApiError(
      400,
      "Neu allowCustomerChoice = true thi nen co rewardVariantIds hoac rewardProductIds hoac rewardCategoryId",
    );
  }
}

function assertValidDiscountCampaign(params: {
  promotionType:
    | "ORDER_FIXED"
    | "ORDER_PERCENT"
    | "BUY_X_GET_Y"
    | "GIFT_WITH_PURCHASE";
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;
}) {
  if (params.promotionType === "ORDER_FIXED") {
    if (!(Number(params.discountAmount || 0) > 0)) {
      throw new ApiError(400, "Promotion giam tien phai co discountAmount > 0");
    }
    return;
  }

  if (params.promotionType === "ORDER_PERCENT") {
    if (
      !(
        Number(params.discountPercent || 0) > 0 &&
        Number(params.discountPercent || 0) <= 100
      )
    ) {
      throw new ApiError(
        400,
        "Promotion giam % phai co discountPercent trong khoang 1..100",
      );
    }

    if (
      params.maxDiscountAmount != null &&
      Number(params.maxDiscountAmount) < 0
    ) {
      throw new ApiError(400, "Giá trị giảm tối đa không hợp lệ");
    }
    return;
  }

  throw new ApiError(
    400,
    "Promotion benefitType=DISCOUNT chi ho tro ORDER_FIXED hoac ORDER_PERCENT",
  );
}

function assertValidDiscountReward(params: {
  rewardType?: "FIXED" | "PERCENT";
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;
}) {
  if (params.rewardType === "FIXED") {
    if (!(Number(params.discountAmount || 0) > 0)) {
      throw new ApiError(400, "Voucher FIXED phai co discountAmount > 0");
    }
    return;
  }

  if (params.rewardType === "PERCENT") {
    if (
      !(
        Number(params.discountPercent || 0) > 0 &&
        Number(params.discountPercent || 0) <= 100
      )
    ) {
      throw new ApiError(
        400,
        "Voucher PERCENT phai co discountPercent trong khoang 1..100",
      );
    }

    if (
      params.maxDiscountAmount != null &&
      Number(params.maxDiscountAmount) < 0
    ) {
      throw new ApiError(400, "Giá trị giảm tối đa không hợp lệ");
    }
    return;
  }

  throw new ApiError(
    400,
    "Voucher benefitType=DISCOUNT phai co rewardType FIXED hoac PERCENT",
  );
}

export async function listOffers() {
  const campaignR = await pool.query(`
    SELECT
      pc.id,
      pc.code,
      pc.name,
      pc.is_active,
      pc.is_public,
      pc.start_at,
      pc.end_at,
      pc.min_order_amount,
      pc.benefit_type,
      pc.promotion_type,
      pc.discount_amount,
      pc.discount_percent,
      pc.max_discount_amount,
      pc.allow_with_voucher,
      pc.requires_gift_selection,
      pc.created_at,
      pc.updated_at,
      COUNT(o.id)::int AS used_count
    FROM coffee_chain_db.promotion_campaigns pc
    LEFT JOIN coffee_chain_db.orders o
      ON o.applied_campaign_id = pc.id
     AND o.status != 'voided'
    WHERE pc.deleted_at IS NULL
    GROUP BY pc.id
    ORDER BY pc.created_at DESC, pc.id DESC
  `);

  const rewardR = await pool.query(`
    SELECT
      vd.id,
      vd.code,
      vd.name,
      vd.is_active,
      vd.is_public,
      vd.fixed_start_at,
      vd.fixed_end_at,
      vd.min_order_amount,
      vd.benefit_type,
      vd.reward_type,
      vd.discount_amount,
      vd.discount_percent,
      vd.max_discount_amount,
      vd.points_cost,
      vd.stamps_required,
      vd.allow_with_promotion,
      vd.total_quantity,
      vd.redeemed_quantity,
      vd.requires_gift_selection,
      vd.created_at,
      vd.updated_at,
      COUNT(cv.id)::int AS used_count
    FROM coffee_chain_db.voucher_reward_defs vd
    LEFT JOIN coffee_chain_db.customer_vouchers cv
      ON cv.reward_def_id = vd.id
    WHERE vd.deleted_at IS NULL
    GROUP BY vd.id
    ORDER BY vd.created_at DESC, vd.id DESC
  `);

  const campaigns: MarketingOfferListItem[] = campaignR.rows.map((row) => {
    const benefitType = normalizeBenefitType(row.benefit_type);

    return {
      id: Number(row.id),
      code: String(row.code),
      name: String(row.name),
      kind: "PROMOTION",
      status: mapCampaignStatus(row),
      isActive: Boolean(row.is_active),
      isPublic: Boolean(row.is_public),
      startAt: row.start_at,
      endAt: row.end_at,
      minOrderAmount: Number(row.min_order_amount || 0),

      benefitType,
      discountType:
        benefitType === "DISCOUNT"
          ? row.discount_percent != null
            ? "PERCENT"
            : "FIXED"
          : null,
      discountAmount:
        row.discount_amount != null ? Number(row.discount_amount) : null,
      discountPercent:
        row.discount_percent != null ? Number(row.discount_percent) : null,
      maxDiscountAmount:
        row.max_discount_amount != null
          ? Number(row.max_discount_amount)
          : null,

      pointsCost: null,
      stampsRequired: null,
      allowWithVoucher: Boolean(row.allow_with_voucher),
      allowWithPromotion: null,
      totalQuantity: null,
      redeemedQuantity: null,
      requiresGiftSelection: Boolean(row.requires_gift_selection),

      usedCount: Number(row.used_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const rewards: MarketingOfferListItem[] = rewardR.rows.map((row) => {
    const benefitType = normalizeBenefitType(row.benefit_type);

    return {
      id: Number(row.id),
      code: String(row.code),
      name: String(row.name),
      kind: "VOUCHER_REWARD",
      status: mapRewardStatus(row),
      isActive: Boolean(row.is_active),
      isPublic: Boolean(row.is_public),
      startAt: row.fixed_start_at ?? null,
      endAt: row.fixed_end_at ?? null,
      minOrderAmount: Number(row.min_order_amount || 0),

      benefitType,
      discountType:
        benefitType === "DISCOUNT"
          ? String(row.reward_type) === "PERCENT"
            ? "PERCENT"
            : "FIXED"
          : null,
      discountAmount:
        row.discount_amount != null ? Number(row.discount_amount) : null,
      discountPercent:
        row.discount_percent != null ? Number(row.discount_percent) : null,
      maxDiscountAmount:
        row.max_discount_amount != null
          ? Number(row.max_discount_amount)
          : null,

      pointsCost: Number(row.points_cost || 0),
      stampsRequired:
        row.stamps_required != null ? Number(row.stamps_required) : null,
      allowWithVoucher: null,
      allowWithPromotion: Boolean(row.allow_with_promotion),
      totalQuantity:
        row.total_quantity != null ? Number(row.total_quantity) : null,
      redeemedQuantity: Number(row.redeemed_quantity || 0),
      requiresGiftSelection: Boolean(row.requires_gift_selection),

      usedCount: Number(row.used_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return [...campaigns, ...rewards].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function listPublicHomeOffers(
  limit = 6,
): Promise<PublicMarketingHomeOffer[]> {
  const safeLimit =
    Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 6;

  const campaignR = await pool.query(
    `
    SELECT
      pc.id,
      pc.code,
      pc.name,
      pc.banner_title,
      pc.banner_image_url,
      pc.banner_content,
      pc.start_at,
      pc.end_at,
      pc.created_at
    FROM coffee_chain_db.promotion_campaigns pc
    WHERE pc.deleted_at IS NULL
      AND pc.is_active = TRUE
      AND pc.is_public = TRUE
      AND NOW() >= pc.start_at
      AND NOW() <= pc.end_at
    ORDER BY pc.start_at DESC, pc.created_at DESC, pc.id DESC
    LIMIT $1
    `,
    [safeLimit],
  );

  const rewardR = await pool.query(
    `
    SELECT
      vd.id,
      vd.code,
      vd.name,
      vd.banner_title,
      vd.banner_image_url,
      vd.banner_content,
      vd.fixed_start_at,
      vd.fixed_end_at,
      vd.created_at
    FROM coffee_chain_db.voucher_reward_defs vd
    WHERE vd.deleted_at IS NULL
      AND vd.is_active = TRUE
      AND vd.is_public = TRUE
      AND (
        (vd.fixed_start_at IS NULL AND vd.fixed_end_at IS NULL)
        OR (
          NOW() >= COALESCE(vd.fixed_start_at, NOW())
          AND NOW() <= COALESCE(vd.fixed_end_at, NOW() + INTERVAL '100 years')
        )
      )
    ORDER BY COALESCE(vd.fixed_start_at, vd.created_at) DESC, vd.created_at DESC, vd.id DESC
    LIMIT $1
    `,
    [safeLimit],
  );

  const campaigns: PublicMarketingHomeOffer[] = campaignR.rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    kind: "PROMOTION",
    title: String(row.banner_title || row.name || ""),
    description: String(
      row.banner_content || "Ưu đãi đang áp dụng trên toàn hệ thống.",
    ),
    imageUrl: row.banner_image_url || null,
    publishedAt: row.start_at || row.created_at || null,
    startAt: row.start_at || null,
    endAt: row.end_at || null,
    to: `/customer/promotions/${Number(row.id)}`,
  }));

  const rewards: PublicMarketingHomeOffer[] = rewardR.rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    kind: "VOUCHER_REWARD",
    title: String(row.banner_title || row.name || ""),
    description: String(
      row.banner_content || "Đổi điểm lấy voucher hấp dẫn ngay hôm nay.",
    ),
    imageUrl: row.banner_image_url || null,
    publishedAt: row.fixed_start_at || row.created_at || null,
    startAt: row.fixed_start_at || null,
    endAt: row.fixed_end_at || null,
    to: `/customer/vouchers/${Number(row.id)}`,
  }));

  return [...campaigns, ...rewards]
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, safeLimit);
}

export async function createPromotionCampaign(params: {
  code: string;
  name: string;
  description?: string | null;

  benefitType: "DISCOUNT" | "GIFT";
  promotionType:
    | "ORDER_FIXED"
    | "ORDER_PERCENT"
    | "BUY_X_GET_Y"
    | "GIFT_WITH_PURCHASE";

  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;

  minOrderAmount?: number;
  isAllStores?: boolean;
  storeIds?: number[];
  excludedStoreIds?: number[];
  allowWithVoucher?: boolean;
  startAt: string;
  endAt: string;
  isActive?: boolean;
  isPublic?: boolean;
  bannerTitle?: string | null;
  bannerImageUrl?: string | null;
  bannerContent?: string | null;
  createdBy?: number | null;
  rule?: PromotionCampaignRuleInput;
}) {
  const code = params.code.trim().toUpperCase();
  const name = params.name.trim();

  if (!code) throw new ApiError(400, "Mã không được để trống");
  if (!name) throw new ApiError(400, "Tên không được để trống");

  const benefitType = normalizeBenefitType(params.benefitType);

  if (benefitType === "DISCOUNT") {
    assertValidDiscountCampaign({
      promotionType: params.promotionType,
      discountAmount: params.discountAmount,
      discountPercent: params.discountPercent,
      maxDiscountAmount: params.maxDiscountAmount,
    });
  } else {
    if (!["BUY_X_GET_Y", "GIFT_WITH_PURCHASE"].includes(params.promotionType)) {
      throw new ApiError(
        400,
        "Promotion benefitType=GIFT chi ho tro BUY_X_GET_Y hoac GIFT_WITH_PURCHASE",
      );
    }
    assertValidGiftRule(params.rule);
  }

  const start = new Date(params.startAt);
  const end = new Date(params.endAt);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const now = getNowSafeMs();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new ApiError(400, "Thời gian khuyến mãi không hợp lệ");
  }

  if (startMs < now) {
    throw new ApiError(400, "Không được chọn thời gian bắt đầu ở quá khứ");
  }

  if (endMs < now) {
    throw new ApiError(400, "Không được chọn thời gian kết thúc ở quá khứ");
  }

  if (!(endMs > startMs)) {
    throw new ApiError(400, "Thời gian khuyến mãi không hợp lệ");
  }

  if (
    params.maxDiscountAmount != null &&
    Number(params.maxDiscountAmount) < 0
  ) {
    throw new ApiError(400, "Giá trị giảm tối đa không hợp lệ");
  }

  const scopeMode = normalizeStoreScopeMode(params);

  if (
    scopeMode === "SELECTED" &&
    sanitizeIdList(params.storeIds).length === 0
  ) {
    throw new ApiError(400, "Phai chon it nhat 1 cua hang ap dung");
  }

  if (
    scopeMode === "ALL_EXCEPT" &&
    sanitizeIdList(params.excludedStoreIds).length === 0
  ) {
    throw new ApiError(400, "Phai chon it nhat 1 cua hang loai tru");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `
      INSERT INTO coffee_chain_db.promotion_campaigns(
        code,
        name,
        description,
        benefit_type,
        promotion_type,
        discount_percent,
        discount_amount,
        combo_rule_id,
        min_order_amount,
        is_all_stores,
        allow_with_voucher,
        start_at,
        end_at,
        is_active,
        is_public,
        banner_title,
        banner_image_url,
        banner_content,
        max_discount_amount,
        requires_gift_selection,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        code,
        name,
        params.description ?? null,
        benefitType,
        params.promotionType,
        benefitType === "DISCOUNT" && params.promotionType === "ORDER_PERCENT"
          ? (params.discountPercent ?? null)
          : null,
        benefitType === "DISCOUNT" && params.promotionType === "ORDER_FIXED"
          ? (params.discountAmount ?? null)
          : null,
        params.minOrderAmount ?? 0,
        scopeMode !== "SELECTED",
        params.allowWithVoucher ?? false,
        params.startAt,
        params.endAt,
        params.isActive ?? true,
        params.isPublic ?? false,
        params.bannerTitle ?? null,
        params.bannerImageUrl ?? null,
        params.bannerContent ?? null,
        benefitType === "DISCOUNT" && params.promotionType === "ORDER_PERCENT"
          ? (params.maxDiscountAmount ?? null)
          : null,
        benefitType === "GIFT"
          ? Boolean(params.rule?.allowCustomerChoice)
          : false,
        params.createdBy ?? null,
        params.createdBy ?? null,
      ],
    );

    const campaign = inserted.rows[0];

    await savePromotionStoreScope(client, Number(campaign.id), {
      isAllStores: scopeMode !== "SELECTED",
      storeIds: scopeMode === "SELECTED" ? params.storeIds : [],
      excludedStoreIds:
        scopeMode === "ALL_EXCEPT" ? params.excludedStoreIds : [],
    });

    if (benefitType === "GIFT" && params.rule) {
      const ruleInsert = await client.query(
        `
        INSERT INTO coffee_chain_db.promotion_campaign_rules(
          campaign_id,
          rule_type,
          trigger_category_id,
          trigger_product_id,
          trigger_variant_id,
          trigger_size,
          trigger_qty,
          reward_category_id,
          reward_product_id,
          reward_variant_id,
          reward_size,
          reward_qty,
          allow_customer_choice,
          note_mode,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'OPEN',TRUE,NOW(),NOW())
        RETURNING id
        `,
        [
          campaign.id,
          params.rule.ruleType,
          params.rule.triggerCategoryId ?? null,
          pickSingleId(
            params.rule.triggerProductId,
            params.rule.triggerProductIds,
          ),
          pickSingleId(
            params.rule.triggerVariantId,
            params.rule.triggerVariantIds,
          ),
          params.rule.triggerSize ?? null,
          params.rule.triggerQty,
          params.rule.rewardCategoryId ?? null,
          pickSingleId(
            params.rule.rewardProductId,
            params.rule.rewardProductIds,
          ),
          pickSingleId(
            params.rule.rewardVariantId,
            params.rule.rewardVariantIds,
          ),
          params.rule.rewardSize ?? null,
          params.rule.rewardQty,
          params.rule.allowCustomerChoice ?? false,
        ],
      );

      const ruleId = Number(ruleInsert.rows[0].id);

      await saveGiftRuleScopes(client, {
        kind: "promotion",
        ruleId,
        rule: params.rule,
      });
    }

    await client.query("COMMIT");
    return campaign;
  } catch (e: any) {
    await client.query("ROLLBACK");
    if (e?.code === "23505") {
      throw new ApiError(400, "Mã khuyến mãi đã tồn tại");
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function createVoucherRewardDef(params: {
  code: string;
  name: string;
  description?: string | null;

  benefitType: "DISCOUNT" | "GIFT";
  rewardType?: "FIXED" | "PERCENT";

  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;

  minOrderAmount?: number;
  pointsCost: number;
  stampsRequired?: number | null;
  allowWithPromotion?: boolean;
  validDays?: number | null;
  fixedStartAt?: string | null;
  fixedEndAt?: string | null;
  totalQuantity?: number | null;
  isActive?: boolean;
  isPublic?: boolean;
  isAllStores?: boolean;
  storeIds?: number[];
  excludedStoreIds?: number[];
  bannerTitle?: string | null;
  bannerImageUrl?: string | null;
  bannerContent?: string | null;
  createdBy?: number | null;

  rule?: PromotionCampaignRuleInput;
}) {
  const code = params.code.trim().toUpperCase();
  const name = params.name.trim();

  if (!code) throw new ApiError(400, "Code khong duoc de trong");
  if (!name) throw new ApiError(400, "Ten khong duoc de trong");

  const pointsCost = Number(params.pointsCost ?? 0);
  const stampsRequired =
    params.stampsRequired == null ? null : Number(params.stampsRequired);

  if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
    throw new ApiError(400, "pointsCost phai > 0");
  }

  if (
    stampsRequired != null &&
    (!Number.isInteger(stampsRequired) || stampsRequired < 0)
  ) {
    throw new ApiError(400, "stampsRequired khong hop le");
  }

  if (Number(stampsRequired || 0) > 0) {
    throw new ApiError(400, "Voucher doi diem khong duoc kem stampsRequired");
  }

  const benefitType = normalizeBenefitType(params.benefitType);

  if (benefitType === "DISCOUNT") {
    assertValidDiscountReward({
      rewardType: params.rewardType,
      discountAmount: params.discountAmount,
      discountPercent: params.discountPercent,
      maxDiscountAmount: params.maxDiscountAmount,
    });
  } else {
    assertValidGiftRule(params.rule);
  }

  const now = getNowSafeMs();
  const fixedStartMs = parseDateMs(params.fixedStartAt);
  const fixedEndMs = parseDateMs(params.fixedEndAt);

  if (fixedStartMs != null && fixedStartMs < now) {
    throw new ApiError(400, "Không được chọn thời gian bắt đầu ở quá khứ");
  }

  if (fixedEndMs != null && fixedEndMs < now) {
    throw new ApiError(400, "Không được chọn thời gian kết thúc ở quá khứ");
  }

  if (
    fixedStartMs != null &&
    fixedEndMs != null &&
    !(fixedEndMs > fixedStartMs)
  ) {
    throw new ApiError(400, "Khung thời gian voucher reward không hợp lệ");
  }

  if (
    params.maxDiscountAmount != null &&
    Number(params.maxDiscountAmount) < 0
  ) {
    throw new ApiError(400, "Giá trị giảm tối đa không hợp lệ");
  }

  const scopeMode = normalizeStoreScopeMode(params);

  if (
    scopeMode === "SELECTED" &&
    sanitizeIdList(params.storeIds).length === 0
  ) {
    throw new ApiError(400, "Phai chon it nhat 1 cua hang ap dung");
  }

  if (
    scopeMode === "ALL_EXCEPT" &&
    sanitizeIdList(params.excludedStoreIds).length === 0
  ) {
    throw new ApiError(400, "Phai chon it nhat 1 cua hang loai tru");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `
      INSERT INTO coffee_chain_db.voucher_reward_defs(
        code,
        name,
        description,
        points_cost,
        stamps_required,
        benefit_type,
        reward_type,
        discount_percent,
        discount_amount,
        max_discount_amount,
        min_order_amount,
        allow_with_promotion,
        is_active,
        valid_days,
        fixed_start_at,
        fixed_end_at,
        total_quantity,
        redeemed_quantity,
        is_public,
        is_all_stores,
        banner_title,
        banner_image_url,
        banner_content,
        requires_gift_selection,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW()
      )
      RETURNING *
      `,
      [
        code,
        name,
        params.description ?? null,
        pointsCost,
        null,
        benefitType,
        benefitType === "DISCOUNT" ? (params.rewardType ?? null) : null,
        benefitType === "DISCOUNT" && params.rewardType === "PERCENT"
          ? (params.discountPercent ?? null)
          : null,
        benefitType === "DISCOUNT" && params.rewardType === "FIXED"
          ? (params.discountAmount ?? null)
          : null,
        benefitType === "DISCOUNT" && params.rewardType === "PERCENT"
          ? (params.maxDiscountAmount ?? null)
          : null,
        params.minOrderAmount ?? 0,
        params.allowWithPromotion ?? false,
        params.isActive ?? true,
        params.validDays ?? null,
        params.fixedStartAt ?? null,
        params.fixedEndAt ?? null,
        params.totalQuantity ?? null,
        params.isPublic ?? true,
        scopeMode !== "SELECTED",
        params.bannerTitle ?? null,
        params.bannerImageUrl ?? null,
        params.bannerContent ?? null,
        benefitType === "GIFT"
          ? Boolean(params.rule?.allowCustomerChoice)
          : false,
        params.createdBy ?? null,
        params.createdBy ?? null,
      ],
    );

    const rewardDef = r.rows[0];

    await saveVoucherStoreScope(client, Number(rewardDef.id), {
      isAllStores: scopeMode !== "SELECTED",
      storeIds: scopeMode === "SELECTED" ? params.storeIds : [],
      excludedStoreIds:
        scopeMode === "ALL_EXCEPT" ? params.excludedStoreIds : [],
    });

    if (benefitType === "GIFT" && params.rule) {
      const ruleInsert = await client.query(
        `
        INSERT INTO coffee_chain_db.voucher_reward_rules(
          reward_def_id,
          rule_type,
          trigger_category_id,
          trigger_product_id,
          trigger_variant_id,
          trigger_size,
          trigger_qty,
          reward_category_id,
          reward_product_id,
          reward_variant_id,
          reward_size,
          reward_qty,
          allow_customer_choice,
          note_mode,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'OPEN',TRUE,NOW(),NOW())
        RETURNING id
        `,
        [
          rewardDef.id,
          params.rule.ruleType,
          params.rule.triggerCategoryId ?? null,
          pickSingleId(
            params.rule.triggerProductId,
            params.rule.triggerProductIds,
          ),
          pickSingleId(
            params.rule.triggerVariantId,
            params.rule.triggerVariantIds,
          ),
          params.rule.triggerSize ?? null,
          params.rule.triggerQty,
          params.rule.rewardCategoryId ?? null,
          pickSingleId(
            params.rule.rewardProductId,
            params.rule.rewardProductIds,
          ),
          pickSingleId(
            params.rule.rewardVariantId,
            params.rule.rewardVariantIds,
          ),
          params.rule.rewardSize ?? null,
          params.rule.rewardQty,
          params.rule.allowCustomerChoice ?? false,
        ],
      );

      const ruleId = Number(ruleInsert.rows[0].id);

      await saveGiftRuleScopes(client, {
        kind: "voucher",
        ruleId,
        rule: params.rule,
      });
    }

    await client.query("COMMIT");
    return rewardDef;
  } catch (e: any) {
    await client.query("ROLLBACK");
    if (e?.code === "23505") {
      throw new ApiError(400, "Mã voucher reward đã tồn tại");
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function toggleCampaign(
  id: number,
  isActive: boolean,
  updatedBy?: number | null,
) {
  const r = await pool.query(
    `
    UPDATE coffee_chain_db.promotion_campaigns
    SET is_active = $1, updated_by = $2, updated_at = NOW()
    WHERE id = $3 AND deleted_at IS NULL
    RETURNING *
    `,
    [isActive, updatedBy ?? null, id],
  );
  if (!r.rows[0]) throw new ApiError(404, "Khuyến mãi không tồn tại");
  return r.rows[0];
}

export async function switchStampRewardByCode(params: {
  code: string;
  updatedBy?: number | null;
}) {
  const code = String(params.code || "")
    .trim()
    .toUpperCase();
  if (!code) throw new ApiError(400, "Code khong duoc de trong");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const targetR = await client.query(
      `
      SELECT *
      FROM coffee_chain_db.voucher_reward_defs
      WHERE code = $1
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [code],
    );

    const target = targetR.rows[0];
    if (!target) {
      throw new ApiError(404, "Khong tim thay voucher reward theo code");
    }

    const targetId = Number(target.id);
    const targetIsStampReward =
      Number(target.points_cost || 0) === 0 &&
      Number(target.stamps_required || 0) > 0;

    const originalPointsCost = targetIsStampReward
      ? target.stamp_original_points_cost != null
        ? Number(target.stamp_original_points_cost)
        : null
      : Number(target.points_cost || 0);

    const originalIsPublic = targetIsStampReward
      ? target.stamp_original_is_public != null
        ? Boolean(target.stamp_original_is_public)
        : Boolean(target.is_public)
      : Boolean(target.is_public);

    const originalIsActive = targetIsStampReward
      ? target.stamp_original_is_active != null
        ? Boolean(target.stamp_original_is_active)
        : Boolean(target.is_active)
      : Boolean(target.is_active);

    await client.query(
      `
      UPDATE coffee_chain_db.voucher_reward_defs
      SET points_cost = stamp_original_points_cost,
          stamps_required = NULL,
          is_public = COALESCE(stamp_original_is_public, FALSE),
          is_active = COALESCE(stamp_original_is_active, FALSE),
          stamp_original_points_cost = NULL,
          stamp_original_is_public = NULL,
          stamp_original_is_active = NULL,
          updated_by = $1,
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND id <> $2
        AND COALESCE(points_cost, 0) = 0
        AND COALESCE(stamps_required, 0) > 0
        AND is_active = TRUE
        AND stamp_original_points_cost IS NOT NULL
      `,
      [params.updatedBy ?? null, targetId],
    );

    await client.query(
      `
      UPDATE coffee_chain_db.voucher_reward_defs
      SET is_active = FALSE,
          updated_by = $1,
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND id <> $2
        AND COALESCE(points_cost, 0) = 0
        AND COALESCE(stamps_required, 0) > 0
        AND is_active = TRUE
      `,
      [params.updatedBy ?? null, targetId],
    );

    const switchedR = await client.query(
      `
      UPDATE coffee_chain_db.voucher_reward_defs
      SET points_cost = 0,
          stamps_required = 9,
          is_public = FALSE,
          is_active = TRUE,
          stamp_original_points_cost = $2,
          stamp_original_is_public = $3,
          stamp_original_is_active = $4,
          updated_by = $1,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        params.updatedBy ?? null,
        originalPointsCost,
        originalIsPublic,
        originalIsActive,
        targetId,
      ],
    );

    await client.query("COMMIT");
    return switchedR.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function toggleReward(
  id: number,
  isActive: boolean,
  updatedBy?: number | null,
) {
  const r = await pool.query(
    `
    UPDATE coffee_chain_db.voucher_reward_defs
    SET is_active = $1, updated_by = $2, updated_at = NOW()
    WHERE id = $3 AND deleted_at IS NULL
    RETURNING *
    `,
    [isActive, updatedBy ?? null, id],
  );
  if (!r.rows[0]) throw new ApiError(404, "Voucher reward không tồn tại");
  return r.rows[0];
}

export async function deleteCampaign(id: number) {
  const used = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM coffee_chain_db.orders WHERE applied_campaign_id = $1`,
    [id],
  );
  if (Number(used.rows[0]?.cnt || 0) > 0) {
    throw new ApiError(400, "Không thể xóa khuyến mãi đã từng được áp dụng");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_rule_trigger_products
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.promotion_campaign_rules
         WHERE campaign_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_rule_trigger_variants
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.promotion_campaign_rules
         WHERE campaign_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_rule_reward_products
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.promotion_campaign_rules
         WHERE campaign_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_rule_reward_variants
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.promotion_campaign_rules
         WHERE campaign_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_rules WHERE campaign_id = $1`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_customer_levels WHERE campaign_id = $1`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_stores WHERE campaign_id = $1`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaign_excluded_stores WHERE campaign_id = $1`,
      [id],
    );

    const r = await client.query(
      `DELETE FROM coffee_chain_db.promotion_campaigns WHERE id = $1 RETURNING id`,
      [id],
    );

    if (!r.rows[0]) throw new ApiError(404, "Khuyến mãi không tồn tại");

    await client.query("COMMIT");
    return { id: Number(r.rows[0].id) };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteReward(id: number) {
  const used = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM coffee_chain_db.customer_vouchers WHERE reward_def_id = $1`,
    [id],
  );
  if (Number(used.rows[0]?.cnt || 0) > 0) {
    throw new ApiError(
      400,
      "Không thể xóa voucher reward đã được đổi hoặc cấp",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_rule_trigger_products
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.voucher_reward_rules
         WHERE reward_def_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_rule_trigger_variants
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.voucher_reward_rules
         WHERE reward_def_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_rule_reward_products
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.voucher_reward_rules
         WHERE reward_def_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_rule_reward_variants
       WHERE rule_id IN (
         SELECT id
         FROM coffee_chain_db.voucher_reward_rules
         WHERE reward_def_id = $1
       )`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_rules WHERE reward_def_id = $1`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_def_stores WHERE reward_def_id = $1`,
      [id],
    );

    await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_def_excluded_stores WHERE reward_def_id = $1`,
      [id],
    );

    const r = await client.query(
      `DELETE FROM coffee_chain_db.voucher_reward_defs WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!r.rows[0]) throw new ApiError(404, "Voucher reward không tồn tại");

    await client.query("COMMIT");
    return { id: Number(r.rows[0].id) };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
