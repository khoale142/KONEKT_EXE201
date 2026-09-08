import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import type { PoolClient } from "pg";
import {
  applyCustomerPointsDelta,
  formatCustomerLevelLabel,
} from "../../utils/membershipLevel";

function randomVoucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "VCH-";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function generateUniqueVoucherCode(client: PoolClient): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomVoucherCode();
    const r = await client.query(
      `SELECT 1 FROM coffee_chain_db.customer_vouchers WHERE voucher_code = $1 LIMIT 1`,
      [code],
    );
    if (!r.rows[0]) return code;
  }
  throw new ApiError(500, "Khong tao duoc voucher code duy nhat");
}

function normalizeBenefitType(value: any): "DISCOUNT" | "GIFT" {
  return String(value || "").toUpperCase() === "GIFT" ? "GIFT" : "DISCOUNT";
}

function nowMs() {
  return Date.now();
}

function toTimeMs(value: any): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getVoucherEffectiveStatus(params: {
  status: string;
  validFrom?: string | null;
  expiresAt?: string | null;
}) {
  const rawStatus = String(params.status || "").toUpperCase();

  if (rawStatus === "USED") return "USED";
  if (rawStatus === "CANCELLED") return "CANCELLED";
  if (rawStatus === "EXPIRED") return "EXPIRED";

  const now = nowMs();
  const validFromMs = toTimeMs(params.validFrom);
  const expiresAtMs = toTimeMs(params.expiresAt);

  if (expiresAtMs != null && now > expiresAtMs) return "EXPIRED";
  if (validFromMs != null && now < validFromMs) return "ISSUED_NOT_READY";

  return "ISSUED";
}

function isRewardActiveNow(params: {
  isActive: any;
  fixedStartAt?: string | null;
  fixedEndAt?: string | null;
}) {
  if (!params.isActive) return false;

  const now = nowMs();
  const startMs = toTimeMs(params.fixedStartAt);
  const endMs = toTimeMs(params.fixedEndAt);

  if (startMs != null && now < startMs) return false;
  if (endMs != null && now > endMs) return false;

  return true;
}

async function getPromotionRuleScopeIds(
  client: PoolClient,
  ruleId: number,
): Promise<{
  triggerProductIds: number[];
  triggerVariantIds: number[];
  rewardProductIds: number[];
  rewardVariantIds: number[];
}> {
  const [tp, tv, rp, rv] = await Promise.all([
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.promotion_campaign_rule_trigger_products
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.promotion_campaign_rule_trigger_variants
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.promotion_campaign_rule_reward_products
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.promotion_campaign_rule_reward_variants
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
  ]);

  return {
    triggerProductIds: tp.rows.map((x) => Number(x.product_id)),
    triggerVariantIds: tv.rows.map((x) => Number(x.product_variant_id)),
    rewardProductIds: rp.rows.map((x) => Number(x.product_id)),
    rewardVariantIds: rv.rows.map((x) => Number(x.product_variant_id)),
  };
}

async function getVoucherRuleScopeIds(
  client: PoolClient,
  ruleId: number,
): Promise<{
  triggerProductIds: number[];
  triggerVariantIds: number[];
  rewardProductIds: number[];
  rewardVariantIds: number[];
}> {
  const [tp, tv, rp, rv] = await Promise.all([
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.voucher_reward_rule_trigger_products
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.voucher_reward_rule_trigger_variants
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.voucher_reward_rule_reward_products
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.voucher_reward_rule_reward_variants
      WHERE rule_id = $1
      `,
      [ruleId],
    ),
  ]);

  return {
    triggerProductIds: tp.rows.map((x) => Number(x.product_id)),
    triggerVariantIds: tv.rows.map((x) => Number(x.product_variant_id)),
    rewardProductIds: rp.rows.map((x) => Number(x.product_id)),
    rewardVariantIds: rv.rows.map((x) => Number(x.product_variant_id)),
  };
}

async function loadProductNamesByIds(
  client: PoolClient,
  productIds: number[],
): Promise<string[]> {
  if (!productIds.length) return [];
  const r = await client.query(
    `
    SELECT id, name
    FROM coffee_chain_db.products
    WHERE id = ANY($1::bigint[])
    ORDER BY name ASC
    `,
    [productIds],
  );
  return r.rows.map((x) => String(x.name));
}

async function loadVariantLabelsByIds(
  client: PoolClient,
  variantIds: number[],
): Promise<string[]> {
  if (!variantIds.length) return [];
  const r = await client.query(
    `
    SELECT
      pv.id,
      p.name AS product_name,
      pv.size
    FROM coffee_chain_db.product_variants pv
    JOIN coffee_chain_db.products p
      ON p.id = pv.product_id
    WHERE pv.id = ANY($1::bigint[])
    ORDER BY p.name, pv.size
    `,
    [variantIds],
  );

  return r.rows.map((x) => {
    const productName = String(x.product_name || "");
    const size = x.size ? String(x.size) : "";
    return size ? `${productName} ${size}` : productName;
  });
}

function makeCompactLabel(params: {
  categoryName?: string | null;
  size?: string | null;
  productNames?: string[];
  variantLabels?: string[];
  fallback: string;
}) {
  if (params.categoryName) return params.categoryName;

  if (params.variantLabels && params.variantLabels.length > 0) {
    if (params.variantLabels.length === 1) return params.variantLabels[0];
    if (params.variantLabels.length <= 3)
      return params.variantLabels.join(", ");
    return `${params.variantLabels[0]} +${params.variantLabels.length - 1} món`;
  }

  if (params.productNames && params.productNames.length > 0) {
    if (params.productNames.length === 1) return params.productNames[0];
    if (params.productNames.length <= 3) return params.productNames.join(", ");
    return `${params.productNames[0]} +${params.productNames.length - 1} sản phẩm`;
  }

  if (params.size) {
    return `${params.fallback} size ${params.size}`;
  }

  return params.fallback;
}

async function buildRuleSummaryFromRow(
  client: PoolClient,
  row: any,
  kind: "promotion" | "voucher",
) {
  if (!row.rule_type) return null;

  const ruleType = String(row.rule_type) as
    | "BUY_X_GET_Y"
    | "GIFT_WITH_PURCHASE";

  const ruleId = row.rule_id != null ? Number(row.rule_id) : null;

  let scope = {
    triggerProductIds: [] as number[],
    triggerVariantIds: [] as number[],
    rewardProductIds: [] as number[],
    rewardVariantIds: [] as number[],
  };

  if (ruleId != null) {
    scope =
      kind === "promotion"
        ? await getPromotionRuleScopeIds(client, ruleId)
        : await getVoucherRuleScopeIds(client, ruleId);
  }

  const fallbackTriggerProductId =
    row.trigger_product_id != null ? Number(row.trigger_product_id) : null;
  const fallbackTriggerVariantId =
    row.trigger_variant_id != null ? Number(row.trigger_variant_id) : null;
  const fallbackRewardProductId =
    row.reward_product_id != null ? Number(row.reward_product_id) : null;
  const fallbackRewardVariantId =
    row.reward_variant_id != null ? Number(row.reward_variant_id) : null;

  const triggerProductIds = scope.triggerProductIds.length
    ? scope.triggerProductIds
    : fallbackTriggerProductId != null
      ? [fallbackTriggerProductId]
      : [];

  const triggerVariantIds = scope.triggerVariantIds.length
    ? scope.triggerVariantIds
    : fallbackTriggerVariantId != null
      ? [fallbackTriggerVariantId]
      : [];

  const rewardProductIds = scope.rewardProductIds.length
    ? scope.rewardProductIds
    : fallbackRewardProductId != null
      ? [fallbackRewardProductId]
      : [];

  const rewardVariantIds = scope.rewardVariantIds.length
    ? scope.rewardVariantIds
    : fallbackRewardVariantId != null
      ? [fallbackRewardVariantId]
      : [];

  const [
    triggerProductNames,
    triggerVariantLabels,
    rewardProductNames,
    rewardVariantLabels,
  ] = await Promise.all([
    loadProductNamesByIds(client, triggerProductIds),
    loadVariantLabelsByIds(client, triggerVariantIds),
    loadProductNamesByIds(client, rewardProductIds),
    loadVariantLabelsByIds(client, rewardVariantIds),
  ]);

  const triggerLabel = makeCompactLabel({
    categoryName: row.trigger_category_name ?? null,
    size: row.trigger_size ?? null,
    productNames: triggerProductNames,
    variantLabels: triggerVariantLabels,
    fallback: "Sản phẩm áp dụng",
  });

  const rewardLabel = makeCompactLabel({
    categoryName: row.reward_category_name ?? null,
    size: row.reward_size ?? null,
    productNames: rewardProductNames,
    variantLabels: rewardVariantLabels,
    fallback: "Món quà",
  });

  return {
    ruleType,
    triggerQty: Number(row.trigger_qty || 0),
    triggerSize: row.trigger_size ?? null,
    rewardQty: Number(row.reward_qty || 0),
    rewardSize: row.reward_size ?? null,

    triggerCategoryName: row.trigger_category_name ?? null,
    rewardCategoryName: row.reward_category_name ?? null,

    triggerLabel,
    rewardLabel,
  };
}

export async function listPublicPromotions() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `
        SELECT
          pc.id,
          pc.code,
          pc.name,
          pc.description,
          pc.benefit_type,
          pc.promotion_type,
          pc.discount_percent,
          pc.discount_amount,
          pc.max_discount_amount,
          pc.min_order_amount,
          pc.start_at,
          pc.end_at,
          pc.banner_title,
          pc.banner_image_url,
          pc.banner_content,
          pc.requires_gift_selection,

          pr.id AS rule_id,
          pr.rule_type,
          pr.trigger_category_id,
          pr.trigger_product_id,
          pr.trigger_variant_id,
          pr.trigger_qty,
          pr.trigger_size,
          pr.reward_category_id,
          pr.reward_product_id,
          pr.reward_variant_id,
          pr.reward_qty,
          pr.reward_size,

          tc.name AS trigger_category_name,
          rc.name AS reward_category_name
        FROM coffee_chain_db.promotion_campaigns pc
        LEFT JOIN coffee_chain_db.promotion_campaign_rules pr
          ON pr.campaign_id = pc.id
         AND pr.is_active = TRUE
        LEFT JOIN coffee_chain_db.categories tc
          ON tc.id = pr.trigger_category_id
        LEFT JOIN coffee_chain_db.categories rc
          ON rc.id = pr.reward_category_id
        WHERE pc.is_active = TRUE
          AND pc.is_public = TRUE
          AND pc.deleted_at IS NULL
          AND NOW() BETWEEN pc.start_at AND pc.end_at
        ORDER BY pc.start_at DESC, pc.id DESC
      `,
    );

    const promotions = await Promise.all(
      r.rows.map(async (row) => ({
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        description: row.description ?? null,
        benefitType: normalizeBenefitType(row.benefit_type),
        promotionType: String(row.promotion_type),
        discountPercent:
          row.discount_percent != null ? Number(row.discount_percent) : null,
        discountAmount:
          row.discount_amount != null ? Number(row.discount_amount) : null,
        maxDiscountAmount:
          row.max_discount_amount != null
            ? Number(row.max_discount_amount)
            : null,
        minOrderAmount: Number(row.min_order_amount || 0),
        startAt: row.start_at,
        endAt: row.end_at,
        bannerTitle: row.banner_title ?? null,
        bannerImageUrl: row.banner_image_url ?? null,
        bannerContent: row.banner_content ?? null,
        requiresGiftSelection: Boolean(row.requires_gift_selection),
        ruleSummary: await buildRuleSummaryFromRow(client, row, "promotion"),
      })),
    );

    return {
      ok: true,
      promotions,
    };
  } finally {
    client.release();
  }
}

export async function listPublicVoucherRewardDefs() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `
        SELECT
          vd.id,
          vd.code,
          vd.name,
          vd.description,
          vd.points_cost,
          vd.benefit_type,
          vd.reward_type,
          vd.discount_percent,
          vd.discount_amount,
          vd.max_discount_amount,
          vd.min_order_amount,
          vd.valid_days,
          vd.fixed_start_at,
          vd.fixed_end_at,
          vd.total_quantity,
          vd.redeemed_quantity,
          vd.banner_title,
          vd.banner_image_url,
          vd.banner_content,
          vd.requires_gift_selection,

          vr.id AS rule_id,
          vr.rule_type,
          vr.trigger_category_id,
          vr.trigger_product_id,
          vr.trigger_variant_id,
          vr.trigger_qty,
          vr.trigger_size,
          vr.reward_category_id,
          vr.reward_product_id,
          vr.reward_variant_id,
          vr.reward_qty,
          vr.reward_size,

          tc.name AS trigger_category_name,
          rc.name AS reward_category_name
        FROM coffee_chain_db.voucher_reward_defs vd
        LEFT JOIN coffee_chain_db.voucher_reward_rules vr
          ON vr.reward_def_id = vd.id
         AND vr.is_active = TRUE
        LEFT JOIN coffee_chain_db.categories tc
          ON tc.id = vr.trigger_category_id
        LEFT JOIN coffee_chain_db.categories rc
          ON rc.id = vr.reward_category_id
        WHERE vd.is_active = TRUE
          AND vd.is_public = TRUE
          AND vd.deleted_at IS NULL
          AND COALESCE(vd.stamps_required, 0) <= 0
          AND (vd.fixed_start_at IS NULL OR NOW() >= vd.fixed_start_at)
          AND (vd.fixed_end_at IS NULL OR NOW() <= vd.fixed_end_at)
          AND (
            vd.total_quantity IS NULL
            OR vd.redeemed_quantity < vd.total_quantity
          )
        ORDER BY vd.points_cost ASC, vd.id DESC
      `,
    );

    const rewards = await Promise.all(
      r.rows.map(async (row) => ({
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        description: row.description ?? null,
        pointsCost: Number(row.points_cost),
        benefitType: normalizeBenefitType(row.benefit_type),
        rewardType:
          row.reward_type != null
            ? (String(row.reward_type) as "FIXED" | "PERCENT")
            : null,
        discountPercent:
          row.discount_percent != null ? Number(row.discount_percent) : null,
        discountAmount:
          row.discount_amount != null ? Number(row.discount_amount) : null,
        maxDiscountAmount:
          row.max_discount_amount != null
            ? Number(row.max_discount_amount)
            : null,
        minOrderAmount: Number(row.min_order_amount || 0),
        validDays: row.valid_days != null ? Number(row.valid_days) : null,
        fixedStartAt: row.fixed_start_at ?? null,
        fixedEndAt: row.fixed_end_at ?? null,
        totalQuantity:
          row.total_quantity != null ? Number(row.total_quantity) : null,
        redeemedQuantity: Number(row.redeemed_quantity || 0),
        bannerTitle: row.banner_title ?? null,
        bannerImageUrl: row.banner_image_url ?? null,
        bannerContent: row.banner_content ?? null,
        requiresGiftSelection: Boolean(row.requires_gift_selection),
        ruleSummary: await buildRuleSummaryFromRow(client, row, "voucher"),
      })),
    );

    return {
      ok: true,
      rewards,
    };
  } finally {
    client.release();
  }
}

export async function redeemVoucherReward(params: {
  customerId: number;
  rewardDefId: number;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const customerR = await client.query(
      `
        SELECT id, full_name, points, level
        FROM coffee_chain_db.customers
        WHERE id = $1
        FOR UPDATE
      `,
      [params.customerId],
    );

    const customer = customerR.rows[0];
    if (!customer) throw new ApiError(404, "Khong tim thay customer");

    const rewardR = await client.query(
      `
    SELECT
      vd.id,
      vd.code,
      vd.name,
      vd.description,
      vd.points_cost,
      vd.stamps_required,
      vd.benefit_type,
      vd.reward_type,
      vd.discount_percent,
      vd.discount_amount,
      vd.max_discount_amount,
      vd.min_order_amount,
      vd.allow_with_promotion,
      vd.is_active,
      vd.valid_days,
      vd.fixed_start_at,
      vd.fixed_end_at,
      vd.total_quantity,
      vd.redeemed_quantity,
      vd.requires_gift_selection,

      vr.id AS rule_id,
      vr.rule_type,
      vr.trigger_category_id,
      vr.trigger_product_id,
      vr.trigger_variant_id,
      vr.trigger_qty,
      vr.trigger_size,
      vr.reward_category_id,
      vr.reward_product_id,
      vr.reward_variant_id,
      vr.reward_qty,
      vr.reward_size,

      tc.name AS trigger_category_name,
      rc.name AS reward_category_name
    FROM coffee_chain_db.voucher_reward_defs vd
    LEFT JOIN coffee_chain_db.voucher_reward_rules vr
      ON vr.reward_def_id = vd.id
     AND vr.is_active = TRUE
    LEFT JOIN coffee_chain_db.categories tc
      ON tc.id = vr.trigger_category_id
    LEFT JOIN coffee_chain_db.categories rc
      ON rc.id = vr.reward_category_id
    WHERE vd.id = $1
    FOR UPDATE OF vd
  `,
      [params.rewardDefId],
    );

    const reward = rewardR.rows[0];
    if (!reward) throw new ApiError(404, "Khong tim thay voucher reward");
    if (!reward.is_active)
      throw new ApiError(400, "Voucher reward dang bi khoa");

    const fixedStartAtMs = toTimeMs(reward.fixed_start_at);
    const fixedEndAtMs = toTimeMs(reward.fixed_end_at);
    const now = nowMs();

    if (fixedStartAtMs != null && now < fixedStartAtMs) {
      throw new ApiError(400, "Voucher reward chua toi thoi gian ap dung");
    }

    if (fixedEndAtMs != null && now > fixedEndAtMs) {
      throw new ApiError(400, "Voucher reward da het han");
    }

    const totalQuantity =
      reward.total_quantity != null ? Number(reward.total_quantity) : null;
    const redeemedQuantity = Number(reward.redeemed_quantity || 0);

    if (totalQuantity != null && redeemedQuantity >= totalQuantity) {
      throw new ApiError(400, "Voucher reward da het luot doi");
    }

    const stampsRequired = Number(reward.stamps_required || 0);
    if (stampsRequired > 0) {
      throw new ApiError(
        400,
        "Voucher thuong tem chi duoc cap tu dong khi ban du so tem yeu cau",
      );
    }

    const pointsCost = Number(reward.points_cost);
    if (!(pointsCost > 0)) {
      throw new ApiError(400, "Voucher reward nay khong ho tro doi bang diem");
    }

    const currentPoints = Number(customer.points || 0);

    if (currentPoints < pointsCost) {
      throw new ApiError(400, "Khong du diem de doi voucher");
    }

    let validFrom: Date;
    let expiresAt: Date;

    if (reward.fixed_start_at && reward.fixed_end_at) {
      validFrom = new Date(reward.fixed_start_at);
      expiresAt = new Date(reward.fixed_end_at);
    } else {
      validFrom = new Date();
      const days = Number(reward.valid_days || 30);
      expiresAt = new Date(validFrom.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (!(expiresAt.getTime() > validFrom.getTime())) {
      throw new ApiError(400, "Cau hinh thoi gian voucher khong hop le");
    }

    const voucherCode = await generateUniqueVoucherCode(client);

    const voucherR = await client.query(
      `
        INSERT INTO coffee_chain_db.customer_vouchers(
          voucher_code,
          reward_def_id,
          customer_id,
          status,
          issued_at,
          valid_from,
          expires_at,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,'ISSUED',NOW(),$4,$5,NOW(),NOW())
        RETURNING
          id,
          voucher_code,
          status,
          issued_at,
          valid_from,
          expires_at
      `,
      [voucherCode, reward.id, params.customerId, validFrom, expiresAt],
    );

    const customerMembership = await applyCustomerPointsDelta(
      client,
      params.customerId,
      -pointsCost,
    );

    await client.query(
      `
        UPDATE coffee_chain_db.voucher_reward_defs
        SET redeemed_quantity = COALESCE(redeemed_quantity, 0) + 1,
            updated_at = NOW()
        WHERE id = $1
      `,
      [reward.id],
    );

    const pointTxnTableExists = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'coffee_chain_db'
            AND table_name = 'customer_point_transactions'
        ) AS ok
      `,
    );

    if (pointTxnTableExists.rows[0]?.ok) {
      const orderIdColExists = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'coffee_chain_db'
              AND table_name = 'customer_point_transactions'
              AND column_name = 'order_id'
          ) AS ok
        `,
      );

      const reasonColExists = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'coffee_chain_db'
              AND table_name = 'customer_point_transactions'
              AND column_name = 'reason'
          ) AS ok
        `,
      );

      if (orderIdColExists.rows[0]?.ok && reasonColExists.rows[0]?.ok) {
        await client.query(
          `
            INSERT INTO coffee_chain_db.customer_point_transactions(
              customer_id,
              order_id,
              points_change,
              reason
            )
            VALUES ($1, NULL, $2, $3)
          `,
          [
            params.customerId,
            -pointsCost,
            `Redeem voucher ${reward.code} (${reward.name})`,
          ],
        );
      }
    }

    const rewardRuleSummary = await buildRuleSummaryFromRow(
      client,
      reward,
      "voucher",
    );

    await client.query("COMMIT");

    return {
      ok: true,
      message: "Doi voucher thanh cong",
      voucher: {
        id: Number(voucherR.rows[0].id),
        voucherCode: String(voucherR.rows[0].voucher_code),
        status: String(voucherR.rows[0].status),
        issuedAt: voucherR.rows[0].issued_at,
        validFrom: voucherR.rows[0].valid_from,
        expiresAt: voucherR.rows[0].expires_at,
        reward: {
          id: Number(reward.id),
          code: String(reward.code),
          name: String(reward.name),
          description: reward.description ?? null,
          pointsCost,
          benefitType: normalizeBenefitType(reward.benefit_type),
          rewardType:
            reward.reward_type != null
              ? (String(reward.reward_type) as "FIXED" | "PERCENT")
              : null,
          discountPercent:
            reward.discount_percent != null
              ? Number(reward.discount_percent)
              : null,
          discountAmount:
            reward.discount_amount != null
              ? Number(reward.discount_amount)
              : null,
          maxDiscountAmount:
            reward.max_discount_amount != null
              ? Number(reward.max_discount_amount)
              : null,
          minOrderAmount: Number(reward.min_order_amount || 0),
          requiresGiftSelection: Boolean(reward.requires_gift_selection),
          ruleSummary: rewardRuleSummary,
        },
      },
      customer: {
        id: Number(customer.id),
        fullName: customer.full_name ?? "",
        pointsBefore: currentPoints,
        pointsAfter: customerMembership.points,
        level: formatCustomerLevelLabel(customerMembership.level),
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listMyVouchers(customerId: number) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `
        SELECT
          cv.id,
          cv.voucher_code,
          cv.status,
          cv.issued_at,
          cv.valid_from,
          cv.expires_at,
          cv.used_at,
          cv.used_order_id,

          vd.id AS reward_def_id,
          vd.code AS reward_code,
          vd.name AS reward_name,
          vd.description,
          vd.benefit_type,
          vd.reward_type,
          vd.discount_percent,
          vd.discount_amount,
          vd.max_discount_amount,
          vd.min_order_amount,
          vd.requires_gift_selection,

          vr.id AS rule_id,
          vr.rule_type,
          vr.trigger_category_id,
          vr.trigger_product_id,
          vr.trigger_variant_id,
          vr.trigger_qty,
          vr.trigger_size,
          vr.reward_category_id,
          vr.reward_product_id,
          vr.reward_variant_id,
          vr.reward_qty,
          vr.reward_size,

          tc.name AS trigger_category_name,
          rc.name AS reward_category_name
        FROM coffee_chain_db.customer_vouchers cv
        JOIN coffee_chain_db.voucher_reward_defs vd
          ON vd.id = cv.reward_def_id
        LEFT JOIN coffee_chain_db.voucher_reward_rules vr
          ON vr.reward_def_id = vd.id
         AND vr.is_active = TRUE
        LEFT JOIN coffee_chain_db.categories tc
          ON tc.id = vr.trigger_category_id
        LEFT JOIN coffee_chain_db.categories rc
          ON rc.id = vr.reward_category_id
        WHERE cv.customer_id = $1
        ORDER BY cv.created_at DESC, cv.id DESC
      `,
      [customerId],
    );

    const vouchers = await Promise.all(
      r.rows.map(async (row) => {
        const effectiveStatus = getVoucherEffectiveStatus({
          status: row.status,
          validFrom: row.valid_from,
          expiresAt: row.expires_at,
        });

        return {
          id: Number(row.id),
          voucherCode: String(row.voucher_code),
          status: String(row.status),
          effectiveStatus,
          isUsableNow: effectiveStatus === "ISSUED",
          issuedAt: row.issued_at,
          validFrom: row.valid_from,
          expiresAt: row.expires_at,
          usedAt: row.used_at ?? null,
          usedOrderId:
            row.used_order_id != null ? Number(row.used_order_id) : null,
          reward: {
            id: Number(row.reward_def_id),
            code: String(row.reward_code),
            name: String(row.reward_name),
            description: row.description ?? null,
            benefitType: normalizeBenefitType(row.benefit_type),
            rewardType:
              row.reward_type != null
                ? (String(row.reward_type) as "FIXED" | "PERCENT")
                : null,
            discountPercent:
              row.discount_percent != null
                ? Number(row.discount_percent)
                : null,
            discountAmount:
              row.discount_amount != null ? Number(row.discount_amount) : null,
            maxDiscountAmount:
              row.max_discount_amount != null
                ? Number(row.max_discount_amount)
                : null,
            minOrderAmount: Number(row.min_order_amount || 0),
            requiresGiftSelection: Boolean(row.requires_gift_selection),
            ruleSummary: await buildRuleSummaryFromRow(client, row, "voucher"),
          },
        };
      }),
    );

    return {
      ok: true,
      vouchers,
    };
  } finally {
    client.release();
  }
}
