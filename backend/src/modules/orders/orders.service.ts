import { pool } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import {
  getOrderById,
  getOrderPayments,
  getOrderRefundRows,
  listOnlinePendingOrdersForPos,
  listOrdersByStore,
  searchPaidOrdersByStore,
  listPickupBoardOrdersByStore,
} from "./orders.repo";
import { validateAppliedComboRules } from "../combo-rules/comboRule.service";
import type { Pool, PoolClient } from "pg";
import { assertStoreCanCreatePosOrder } from "../shift-reconciliation/shiftReconciliation.service";
import { safeWritePosActionLog } from "../pos-action-log/posActionLog.service";
import { deductInventoryForOrder } from "../inventory/inventory.service";
import {
  applyCustomerPointsDelta,
  resolveStoredCustomerLevel,
} from "../../utils/membershipLevel";
import { notifyOrderCreated } from "../notifications/notifications.service";
import { scheduleOrderPurchaseOutreach } from "../order-outreach/orderOutreach.service";
function makeOrderCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `OD${y}${m}${day}-${rand}`;
}

function todayVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function normalizeStatuses(raw?: string) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeBenefitType(value: any): "DISCOUNT" | "GIFT" {
  return String(value || "").toUpperCase() === "GIFT" ? "GIFT" : "DISCOUNT";
}

function mapPickupDelayNotice(row: any) {
  if (!row || row.pickup_delay_notice_id == null) return null;

  const expectedArrivalAt =
    row.pickup_delay_expected_arrival_at != null
      ? String(row.pickup_delay_expected_arrival_at)
      : null;

  return {
    id: Number(row.pickup_delay_notice_id),
    reason: String(row.pickup_delay_reason ?? ""),
    expectedArrivalAt,
    expectedPickupVisitAt: expectedArrivalAt,
    requestedPickupTime: expectedArrivalAt,
    createdAt:
      row.pickup_delay_created_at != null
        ? String(row.pickup_delay_created_at)
        : null,
  };
}

type OrderType =
  | "NORMAL"
  | "TEST"
  | "FREE"
  | "INTERNAL"
  | "GUEST"
  | "COMPENSATION";

type ServiceMode = "TAKE_AWAY" | "IN_STORE";

function normalizeServiceMode(value: unknown): ServiceMode {
  return String(value || "").toUpperCase() === "TAKE_AWAY"
    ? "TAKE_AWAY"
    : "IN_STORE";
}

function isSpecialOrderType(orderType?: string) {
  return !!orderType && orderType !== "NORMAL";
}

function toMoneyCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function fromMoneyCents(value: number) {
  return value / 100;
}

function allocateAmountByWeights(totalCents: number, weights: number[]) {
  if (totalCents <= 0 || !weights.length) return weights.map(() => 0);

  const totalWeight = weights.reduce((s, x) => s + Math.max(0, x), 0);
  if (totalWeight <= 0) return weights.map(() => 0);

  const result: number[] = [];
  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      result.push(totalCents - allocated);
      break;
    }

    const cents = Math.round(
      (totalCents * Math.max(0, weights[i])) / totalWeight,
    );
    result.push(cents);
    allocated += cents;
  }

  return result;
}

function splitLineAmountToUnits(totalCents: number, qty: number) {
  if (qty <= 0) return [] as number[];
  const base = Math.floor(totalCents / qty);
  const remainder = totalCents - base * qty;
  return Array.from({ length: qty }, (_, i) => base + (i < remainder ? 1 : 0));
}

async function appendSystemAuditLog(
  client: PoolClient,
  params: {
    userId: number;
    actionType: string;
    targetTable: string;
    targetId?: number | null;
    oldValue?: any;
    newValue?: any;
  },
) {
  await client.query(
    `
      INSERT INTO coffee_chain_db.system_audit_logs(
        user_id,
        action_type,
        target_table,
        target_id,
        old_value,
        new_value
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
    `,
    [
      params.userId,
      params.actionType,
      params.targetTable,
      params.targetId ?? null,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
    ],
  );
}

async function buildRefundContext(
  client: Pool | PoolClient,
  params: { orderId: number; storeId: number },
) {
  const rows = await getOrderById({
    orderId: params.orderId,
    storeId: params.storeId,
  });
  if (!rows.length) throw new ApiError(404, "Order not found");

  const first = rows[0];
  const orderStatus = String(first.status);
  if (!["paid", "completed"].includes(orderStatus)) {
    throw new ApiError(400, "Chi cho refund don da thanh toan");
  }

  const detailMap = new Map<
    number,
    {
      id: number;
      productVariantId: number;
      quantity: number;
      unitPrice: number;
      note: string | null;
      variantName: string | null;
      productName: string | null;
    }
  >();

  for (const row of rows) {
    if (row.detail_id == null) continue;
    const detailId = Number(row.detail_id);
    if (!detailMap.has(detailId)) {
      detailMap.set(detailId, {
        id: detailId,
        productVariantId: Number(row.product_variant_id),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        note: row.item_note ?? null,
        variantName:
          row.product_name && row.variant_size
            ? `${row.product_name} ${row.variant_size}`
            : (row.product_name ?? null),
        productName: row.product_name ?? null,
      });
    }
  }

  const details = Array.from(detailMap.values()).sort((a, b) => a.id - b.id);
  const finalAmountCents = toMoneyCents(Number(first.final_amount));
  const grossWeights = details.map(
    (d) => toMoneyCents(d.unitPrice) * d.quantity,
  );
  const allocatedDetailCents = allocateAmountByWeights(
    finalAmountCents,
    grossWeights,
  );

  const refundRows = await getOrderRefundRows({ orderId: params.orderId });
  const refundedByDetail = new Map<
    number,
    { qty: number; amountCents: number }
  >();
  const refundMap = new Map<number, any>();

  for (const row of refundRows) {
    const refundId = Number(row.id);
    if (!refundMap.has(refundId)) {
      refundMap.set(refundId, {
        id: refundId,
        refundType: String(row.refund_type) as "full" | "partial",
        refundStatus: String(row.refund_status),
        reason: String(row.reason),
        refundAmount: Number(row.refund_amount),
        processedByUserId: Number(row.processed_by_user_id),
        createdAt: row.created_at,
        items: [],
      });
    }

    if (row.order_detail_id != null) {
      refundMap.get(refundId).items.push({
        id: Number(row.refund_item_id),
        orderDetailId: Number(row.order_detail_id),
        quantity: Number(row.quantity),
        lineRefundAmount: Number(row.line_refund_amount),
      });

      const current = refundedByDetail.get(Number(row.order_detail_id)) || {
        qty: 0,
        amountCents: 0,
      };
      current.qty += Number(row.quantity);
      current.amountCents += toMoneyCents(Number(row.line_refund_amount));
      refundedByDetail.set(Number(row.order_detail_id), current);
    }
  }

  const detailsWithRefund = details.map((detail, index) => {
    const lineAllocatedCents = allocatedDetailCents[index] || 0;
    const unitRefundCents = splitLineAmountToUnits(
      lineAllocatedCents,
      detail.quantity,
    );
    const refunded = refundedByDetail.get(detail.id) || {
      qty: 0,
      amountCents: 0,
    };
    const remainingUnitCents = unitRefundCents.slice(refunded.qty);
    const remainingAmountCents = remainingUnitCents.reduce((s, x) => s + x, 0);

    return {
      ...detail,
      refund: {
        allocatedLineAmount: fromMoneyCents(lineAllocatedCents),
        refundedQty: refunded.qty,
        refundedAmount: fromMoneyCents(refunded.amountCents),
        remainingQty: Math.max(0, detail.quantity - refunded.qty),
        remainingAmount: fromMoneyCents(remainingAmountCents),
        remainingUnitCents,
      },
    };
  });

  const refundedAmountCents = detailsWithRefund.reduce(
    (sum, item) => sum + toMoneyCents(item.refund.refundedAmount),
    0,
  );

  return {
    order: {
      id: Number(first.id),
      storeId: Number(first.store_id),
      orderCode: String(first.order_code),
      staffId: first.staff_id ? Number(first.staff_id) : null,
      customerId: first.customer_id ? Number(first.customer_id) : null,
      customerName: first.customer_name ?? null,
      customerPhone: first.customer_phone ?? null,
      totalAmount: Number(first.total_amount),
      discountAmount: Number(first.discount_amount),
      finalAmount: Number(first.final_amount),
      status: orderStatus,
      createdAt: first.created_at,
      completedAt: first.completed_at ?? null,
      pickupNumber: first.pickup_number ?? null,
      notifiedAt: first.notified_at ?? null,
      orderType: (first.order_type || "NORMAL") as OrderType,
      specialNote: first.special_note ?? null,
      refundedAmount: fromMoneyCents(refundedAmountCents),
      refundStatus:
        refundedAmountCents <= 0
          ? "none"
          : refundedAmountCents >= finalAmountCents
            ? "full"
            : "partial",
      lastRefundedAt: refundRows.length
        ? refundRows[refundRows.length - 1].created_at
        : null,
    },
    items: detailsWithRefund,
    refunds: Array.from(refundMap.values()),
  };
}

type DirectItemInput = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

type FixedComboInput = {
  comboId: number;
  quantity: number;
};

type AppliedComboRuleInput = {
  comboRuleId: number;
  selectedItems: Array<{
    productVariantId: number;
    quantity: number;
  }>;
};

type SelectedGiftItemInput = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

type PromotionGiftSelection = {
  required: boolean;
  ruleId: number | null;
  eligibleVariants: Array<{
    productVariantId: number;
    productName: string;
    size: string;
    price: number;
    categoryId: number | null;
    categoryName: string | null;
  }>;
  expectedQty: number;
};

type GiftResolutionResult = {
  giftSelection: PromotionGiftSelection | null;
  materializedGiftItems: ExpandedOrderItem[];
  matchedTriggerQty: number;
  expectedGiftQty: number;
};

type OfferValidationState = {
  sourceType: "PROMOTION" | "VOUCHER";
  isEligible: boolean;
  status: "APPLIED" | "INELIGIBLE" | "GIFT_SELECTION_REQUIRED";
  message: string;
};

type ExpandedOrderItem = {
  productVariantId: number;
  quantity: number;
  note?: string | null;
  unitPrice: number;
};

type PricingBaseResult = {
  mergedItems: ExpandedOrderItem[];
  subtotalAmount: number;
  directTotalAmount: number;
  fixedComboTotalAmount: number;
  ruleComboTotalAmount: number;
};

type VoucherValidationResult = {
  id: number;
  rewardDefId: number;
  voucherCode: string;
  customerId: number;
  rewardName: string;

  benefitType: "DISCOUNT" | "GIFT";
  rewardType: "FIXED" | "PERCENT" | null;
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  allowWithPromotion: boolean;
  requiresGiftSelection: boolean;

  status: "ISSUED" | "USED" | "EXPIRED" | "CANCELLED";
  validFrom: string;
  expiresAt: string;

  rule: null | {
    id: number;
    ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

    triggerCategoryId: number | null;
    triggerProductIds: number[];
    triggerVariantIds: number[];
    triggerSize: string | null;
    triggerQty: number;

    rewardCategoryId: number | null;
    rewardProductIds: number[];
    rewardVariantIds: number[];
    rewardSize: string | null;
    rewardQty: number;

    allowCustomerChoice: boolean;
    noteMode: "OPEN" | "LOCKED";
  };
};

type PromotionValidationResult = {
  id: number;
  code: string;
  name: string;
  promotionType: string;
  discountAmount: number | null;
  discountPercent: number | null;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  allowWithVoucher: boolean;
  requiresGiftSelection: boolean;
  startAt: string;
  endAt: string;
  rule: null | {
    id: number;
    ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

    triggerCategoryId: number | null;
    triggerProductIds: number[];
    triggerVariantIds: number[];
    triggerSize: string | null;
    triggerQty: number;

    rewardCategoryId: number | null;
    rewardProductIds: number[];
    rewardVariantIds: number[];
    rewardSize: string | null;
    rewardQty: number;

    allowCustomerChoice: boolean;
    noteMode: "OPEN" | "LOCKED";
  };
};

type HoldOrderSnapshotInput = any;

type VoidRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

type HeldOrderPayload = {
  pickupNumber: number;
  customerId?: number | null;
  voucherCode?: string;
  promotionCode?: string;
  orderType?: OrderType;
  specialNote?: string | null;
  serviceMode?: ServiceMode;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos: FixedComboInput[];
  appliedComboRules: AppliedComboRuleInput[];
  materializedItems: ExpandedOrderItem[];
  pricing: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
  };
  snapshot?: any;
};

function allocateComboPrices(
  comboPrice: number,
  components: Array<{
    productVariantId: number;
    quantity: number;
    baseUnitPrice: number;
  }>,
): ExpandedOrderItem[] {
  const expandedUnits: Array<{
    productVariantId: number;
    baseUnitPrice: number;
  }> = [];

  for (const c of components) {
    for (let i = 0; i < c.quantity; i++) {
      expandedUnits.push({
        productVariantId: c.productVariantId,
        baseUnitPrice: c.baseUnitPrice,
      });
    }
  }

  if (!expandedUnits.length) return [];

  const totalBase = expandedUnits.reduce((s, x) => s + x.baseUnitPrice, 0);
  if (totalBase <= 0) {
    throw new ApiError(400, "Invalid combo pricing base");
  }

  const allocatedPerUnit: number[] = [];
  let allocatedSum = 0;

  for (let i = 0; i < expandedUnits.length; i++) {
    if (i === expandedUnits.length - 1) {
      allocatedPerUnit.push(comboPrice - allocatedSum);
      break;
    }

    const share = Math.round(
      (comboPrice * expandedUnits[i].baseUnitPrice) / totalBase,
    );
    allocatedPerUnit.push(share);
    allocatedSum += share;
  }

  const grouped = new Map<number, { quantity: number; unitPrices: number[] }>();

  for (let i = 0; i < expandedUnits.length; i++) {
    const vId = expandedUnits[i].productVariantId;
    if (!grouped.has(vId)) {
      grouped.set(vId, { quantity: 0, unitPrices: [] });
    }
    grouped.get(vId)!.quantity += 1;
    grouped.get(vId)!.unitPrices.push(allocatedPerUnit[i]);
  }

  const result: ExpandedOrderItem[] = [];
  for (const [productVariantId, g] of grouped.entries()) {
    const totalAllocated = g.unitPrices.reduce((s, x) => s + x, 0);
    const avgUnit = totalAllocated / g.quantity;

    result.push({
      productVariantId,
      quantity: g.quantity,
      note: null,
      unitPrice: avgUnit,
    });
  }

  return result;
}

async function buildBasePricing(
  client: PoolClient,
  params: {
    items: DirectItemInput[];
    combos?: FixedComboInput[];
    appliedComboRules?: AppliedComboRuleInput[];
  },
): Promise<PricingBaseResult> {
  const directItems = params.items || [];
  const combos = params.combos || [];

  if (!directItems.length && !combos.length) {
    throw new ApiError(400, "Chua co mon hoac combo");
  }

  const directVariantIds = directItems.map((x) => x.productVariantId);

  const comboIds = combos.map((x) => x.comboId);
  let comboRows: any[] = [];

  if (comboIds.length) {
    const comboR = await client.query(
      `
        SELECT
          cp.id AS combo_id,
          cp.name AS combo_name,
          cp.combo_price,
          cp.is_active,
          ci.product_variant_id,
          ci.quantity,
          pv.price AS variant_price,
          pv.is_active AS variant_active
        FROM coffee_chain_db.combo_products cp
        JOIN coffee_chain_db.combo_items ci
          ON ci.combo_id = cp.id
        JOIN coffee_chain_db.product_variants pv
          ON pv.id = ci.product_variant_id
        WHERE cp.id = ANY($1::bigint[])
      `,
      [comboIds],
    );

    comboRows = comboR.rows;
  }

  const directR =
    directVariantIds.length > 0
      ? await client.query(
        `
            SELECT id, price, is_active
            FROM coffee_chain_db.product_variants
            WHERE id = ANY($1::bigint[])
          `,
        [directVariantIds],
      )
      : { rows: [] as any[] };

  const directPriceMap = new Map<number, number>();
  for (const r of directR.rows) {
    if (!r.is_active) {
      throw new ApiError(400, `Variant ${r.id} is inactive`);
    }
    directPriceMap.set(Number(r.id), Number(r.price));
  }

  for (const it of directItems) {
    if (!directPriceMap.has(it.productVariantId)) {
      throw new ApiError(
        400,
        `Khong tim thay variantId=${it.productVariantId}`,
      );
    }
  }

  const comboGrouped = new Map<number, any[]>();
  for (const row of comboRows) {
    const comboId = Number(row.combo_id);
    if (!comboGrouped.has(comboId)) comboGrouped.set(comboId, []);
    comboGrouped.get(comboId)!.push(row);
  }

  for (const combo of combos) {
    const rows = comboGrouped.get(combo.comboId) || [];
    if (!rows.length) {
      throw new ApiError(400, `Combo ${combo.comboId} not found`);
    }

    const comboActive = Boolean(rows[0].is_active);
    if (!comboActive) {
      throw new ApiError(400, `Combo ${combo.comboId} is inactive`);
    }

    for (const row of rows) {
      if (!row.variant_active) {
        throw new ApiError(
          400,
          `Combo ${combo.comboId} contains inactive variant`,
        );
      }
    }
  }

  const appliedRuleValidation = await validateAppliedComboRules({
    items: directItems,
    appliedComboRules: params.appliedComboRules || [],
  });

  const directQtyMap = new Map<number, number>();
  const directNoteMap = new Map<number, string | null>();

  for (const it of directItems) {
    directQtyMap.set(
      it.productVariantId,
      (directQtyMap.get(it.productVariantId) || 0) + it.quantity,
    );
    if (it.note) directNoteMap.set(it.productVariantId, it.note);
  }

  for (const app of appliedRuleValidation.appliedCombos) {
    for (const sel of app.selectedItems) {
      const current = directQtyMap.get(sel.productVariantId) || 0;
      if (current < sel.quantity) {
        throw new ApiError(
          400,
          `Applied combo exceeds direct item quantity for variant ${sel.productVariantId}`,
        );
      }
      directQtyMap.set(sel.productVariantId, current - sel.quantity);
    }
  }

  let fixedComboTotalAmount = 0;
  const expandedFixedComboItems: ExpandedOrderItem[] = [];

  for (const combo of combos) {
    const rows = comboGrouped.get(combo.comboId)!;
    const comboPrice = Number(rows[0].combo_price);

    fixedComboTotalAmount += comboPrice * combo.quantity;

    const baseComponents = rows.map((r) => ({
      productVariantId: Number(r.product_variant_id),
      quantity: Number(r.quantity) * combo.quantity,
      baseUnitPrice: Number(r.variant_price),
    }));

    const allocated = allocateComboPrices(
      comboPrice * combo.quantity,
      baseComponents,
    );
    expandedFixedComboItems.push(...allocated);
  }

  const expandedDirectItems: ExpandedOrderItem[] = [];

  for (const [variantId, qty] of directQtyMap.entries()) {
    if (qty <= 0) continue;

    const price = directPriceMap.get(variantId);
    if (price == null) {
      throw new ApiError(400, `Missing direct price for variant ${variantId}`);
    }

    expandedDirectItems.push({
      productVariantId: variantId,
      quantity: qty,
      note: directNoteMap.get(variantId) || null,
      unitPrice: price,
    });
  }

  const expandedRuleComboItems: ExpandedOrderItem[] = [];
  let ruleComboTotalAmount = 0;

  for (const app of appliedRuleValidation.appliedCombos) {
    ruleComboTotalAmount += app.comboPrice;

    const allocated = allocateComboPrices(
      app.comboPrice,
      app.selectedItems.map((x) => ({
        productVariantId: x.productVariantId,
        quantity: x.quantity,
        baseUnitPrice: x.unitPrice,
      })),
    );

    expandedRuleComboItems.push(...allocated);
  }

  const directTotalAmount = expandedDirectItems.reduce(
    (sum, it) => sum + it.unitPrice * it.quantity,
    0,
  );

  const subtotalAmount =
    directTotalAmount + fixedComboTotalAmount + ruleComboTotalAmount;

  const allExpanded = [
    ...expandedDirectItems,
    ...expandedFixedComboItems,
    ...expandedRuleComboItems,
  ];

  const mergedMap = new Map<string, ExpandedOrderItem>();

  for (const item of allExpanded) {
    const key = `${item.productVariantId}__${item.note || ""}__${item.unitPrice}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...item });
    } else {
      mergedMap.get(key)!.quantity += item.quantity;
    }
  }

  return {
    mergedItems: Array.from(mergedMap.values()),
    subtotalAmount,
    directTotalAmount,
    fixedComboTotalAmount,
    ruleComboTotalAmount,
  };
}

async function getAndValidateVoucher(
  client: PoolClient,
  params: {
    voucherCode?: string;
    customerId?: number;
    storeId: number;
    subtotalAmount: number;
    forUpdate?: boolean;
  },
): Promise<VoucherValidationResult | null> {
  const voucherCode = (params.voucherCode || "").trim();
  if (!voucherCode) return null;

  const r = await client.query(
    `
      SELECT
        cv.id,
        cv.reward_def_id,
        cv.voucher_code,
        cv.customer_id,
        cv.status,
        cv.valid_from,
        cv.expires_at,

        vd.name AS reward_name,
        vd.benefit_type,
        vd.reward_type,
        vd.discount_amount,
        vd.discount_percent,
        vd.max_discount_amount,
        vd.min_order_amount,
        vd.allow_with_promotion,
        vd.requires_gift_selection,
        vd.is_active,
        vd.is_all_stores,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.voucher_reward_def_stores vrs
          WHERE vrs.reward_def_id = vd.id
            AND vrs.store_id = $2
        ) AS matched_store,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.voucher_reward_def_excluded_stores vre
          WHERE vre.reward_def_id = vd.id
            AND vre.store_id = $2
        ) AS excluded_store,

        vr.id AS rule_id,
        vr.rule_type,
        vr.trigger_category_id,
        vr.trigger_product_id,
        vr.trigger_variant_id,
        vr.trigger_size,
        vr.trigger_qty,
        vr.reward_category_id,
        vr.reward_product_id,
        vr.reward_variant_id,
        vr.reward_size,
        vr.reward_qty,
        vr.allow_customer_choice,
        vr.note_mode
      FROM coffee_chain_db.customer_vouchers cv
      JOIN coffee_chain_db.voucher_reward_defs vd
        ON vd.id = cv.reward_def_id
      LEFT JOIN coffee_chain_db.voucher_reward_rules vr
        ON vr.reward_def_id = vd.id
       AND vr.is_active = TRUE
      WHERE cv.voucher_code = $1
      ${params.forUpdate ? "FOR UPDATE OF cv" : ""}
    `,
    [voucherCode, params.storeId],
  );

  const row = r.rows[0];
  if (!row) {
    throw new ApiError(400, "Voucher khong ton tai");
  }
  // Reward defs can later be deactivated or switched out of stamp mode to stop
  // new issuance, but vouchers already granted to customers should remain
  // usable until their own status/time window says otherwise.
  if (String(row.status) !== "ISSUED") {
    throw new ApiError(400, "Voucher da duoc su dung hoac khong hop le");
  }

  if (
    params.customerId != null &&
    Number(row.customer_id) !== Number(params.customerId)
  ) {
    throw new ApiError(400, "Voucher nay khong thuoc khach hang hien tai");
  }

  const now = Date.now();
  const validFrom = new Date(row.valid_from).getTime();
  const expiresAt = new Date(row.expires_at).getTime();

  if (Number.isNaN(validFrom) || Number.isNaN(expiresAt)) {
    throw new ApiError(400, "Voucher time invalid");
  }

  if (now < validFrom) {
    throw new ApiError(400, "Voucher chua den ngay hieu luc");
  }

  if (now > expiresAt) {
    throw new ApiError(400, "Voucher da het han");
  }

  if (!row.is_all_stores && !row.matched_store) {
    throw new ApiError(400, "Voucher khong ap dung tai cua hang nay");
  }

  if (row.is_all_stores && row.excluded_store) {
    throw new ApiError(400, "Voucher khong ap dung tai cua hang nay");
  }

  const minOrderAmount = Number(row.min_order_amount || 0);
  if (params.subtotalAmount < minOrderAmount) {
    throw new ApiError(400, `Don hang chua dat toi thieu ${minOrderAmount}`);
  }

  const benefitType = normalizeBenefitType(row.benefit_type);

  const finalRule = row.rule_id
    ? await (async () => {
      const scope = await getRuleScopeIds(client, {
        kind: "voucher",
        ruleId: Number(row.rule_id),
      });

      const fallbackTriggerProductId =
        row.trigger_product_id != null
          ? Number(row.trigger_product_id)
          : null;
      const fallbackTriggerVariantId =
        row.trigger_variant_id != null
          ? Number(row.trigger_variant_id)
          : null;
      const fallbackRewardProductId =
        row.reward_product_id != null ? Number(row.reward_product_id) : null;
      const fallbackRewardVariantId =
        row.reward_variant_id != null ? Number(row.reward_variant_id) : null;

      return {
        id: Number(row.rule_id),
        ruleType: String(row.rule_type) as
          | "BUY_X_GET_Y"
          | "GIFT_WITH_PURCHASE",

        triggerCategoryId:
          row.trigger_category_id != null
            ? Number(row.trigger_category_id)
            : null,
        triggerProductIds: scope.triggerProductIds.length
          ? scope.triggerProductIds
          : fallbackTriggerProductId != null
            ? [fallbackTriggerProductId]
            : [],
        triggerVariantIds: scope.triggerVariantIds.length
          ? scope.triggerVariantIds
          : fallbackTriggerVariantId != null
            ? [fallbackTriggerVariantId]
            : [],
        triggerSize: row.trigger_size ?? null,
        triggerQty: Number(row.trigger_qty || 0),

        rewardCategoryId:
          row.reward_category_id != null
            ? Number(row.reward_category_id)
            : null,
        rewardProductIds: scope.rewardProductIds.length
          ? scope.rewardProductIds
          : fallbackRewardProductId != null
            ? [fallbackRewardProductId]
            : [],
        rewardVariantIds: scope.rewardVariantIds.length
          ? scope.rewardVariantIds
          : fallbackRewardVariantId != null
            ? [fallbackRewardVariantId]
            : [],
        rewardSize: row.reward_size ?? null,
        rewardQty: Number(row.reward_qty || 0),

        allowCustomerChoice: Boolean(row.allow_customer_choice),
        noteMode: String(row.note_mode || "OPEN") as "OPEN" | "LOCKED",
      };
    })()
    : null;

  return {
    id: Number(row.id),
    rewardDefId: Number(row.reward_def_id),
    voucherCode: String(row.voucher_code),
    customerId: Number(row.customer_id),
    rewardName: String(row.reward_name),

    benefitType,
    rewardType:
      row.reward_type != null
        ? (String(row.reward_type) as "FIXED" | "PERCENT")
        : null,
    discountAmount:
      row.discount_amount != null ? Number(row.discount_amount) : null,
    discountPercent:
      row.discount_percent != null ? Number(row.discount_percent) : null,
    maxDiscountAmount:
      row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    minOrderAmount,
    allowWithPromotion: Boolean(row.allow_with_promotion),
    requiresGiftSelection: Boolean(row.requires_gift_selection),

    status: String(row.status) as VoucherValidationResult["status"],
    validFrom: row.valid_from,
    expiresAt: row.expires_at,

    rule: finalRule,
  };
}

async function getAndValidatePromotionWithRule(
  client: PoolClient,
  params: {
    promotionCode?: string;
    storeId: number;
    customerId?: number;
    subtotalAmount: number;
  },
): Promise<PromotionValidationResult | null> {
  const promotionCode = (params.promotionCode || "").trim();
  if (!promotionCode) return null;

  const promoR = await client.query(
    `
      SELECT
        pc.id,
        pc.code,
        pc.name,
        pc.promotion_type,
        pc.discount_amount,
        pc.discount_percent,
        pc.max_discount_amount,
        pc.min_order_amount,
        pc.allow_with_voucher,
        pc.requires_gift_selection,
        pc.start_at,
        pc.end_at,
        pc.is_active,
        pc.is_all_stores,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.promotion_campaign_stores pcs
          WHERE pcs.campaign_id = pc.id
            AND pcs.store_id = $2
        ) AS matched_store,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.promotion_campaign_excluded_stores pce
          WHERE pce.campaign_id = pc.id
            AND pce.store_id = $2
        ) AS excluded_store,
        EXISTS(
          SELECT 1
          FROM coffee_chain_db.promotion_campaign_customer_levels pcl
          WHERE pcl.campaign_id = pc.id
        ) AS has_level_scope
      FROM coffee_chain_db.promotion_campaigns pc
      WHERE pc.code = $1
        AND pc.deleted_at IS NULL
      LIMIT 1
    `,
    [promotionCode, params.storeId],
  );

  const row = promoR.rows[0];
  if (!row) throw new ApiError(400, "Promotion khong ton tai");
  if (!row.is_active) throw new ApiError(400, "Promotion dang bi khoa");

  const now = Date.now();
  const startAt = new Date(row.start_at).getTime();
  const endAt = new Date(row.end_at).getTime();

  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    throw new ApiError(400, "Promotion time invalid");
  }

  if (now < startAt) {
    throw new ApiError(400, "Promotion chua den thoi gian ap dung");
  }
  if (now > endAt) {
    throw new ApiError(400, "Promotion da het han");
  }

  if (!row.is_all_stores && !row.matched_store) {
    throw new ApiError(400, "Promotion khong ap dung tai cua hang nay");
  }

  if (row.is_all_stores && row.excluded_store) {
    throw new ApiError(400, "Promotion khong ap dung tai cua hang nay");
  }

  const minOrderAmount = Number(row.min_order_amount || 0);
  if (params.subtotalAmount < minOrderAmount) {
    throw new ApiError(400, `Don hang chua dat toi thieu ${minOrderAmount}`);
  }

  if (row.has_level_scope) {
    if (!params.customerId) {
      throw new ApiError(400, "Promotion nay yeu cau khach co hang phu hop");
    }

    const cR = await client.query(
      `SELECT COALESCE(points, 0)::int AS points, level FROM coffee_chain_db.customers WHERE id = $1 LIMIT 1`,
      [params.customerId],
    );
    const customer = cR.rows[0];
    if (!customer) throw new ApiError(400, "Khong tim thay customer");
    const customerLevel = resolveStoredCustomerLevel(
      customer.level,
      Number(customer.points ?? 0),
    );

    const lvR = await client.query(
      `
        SELECT 1
        FROM coffee_chain_db.promotion_campaign_customer_levels
        WHERE campaign_id = $1
          AND LOWER(customer_level) = $2
        LIMIT 1
      `,
      [row.id, customerLevel],
    );
    if (!lvR.rows[0]) {
      throw new ApiError(
        400,
        "Khach hang hien tai khong thuoc doi tuong ap dung promotion",
      );
    }
  }

  const ruleR = await client.query(
    `
      SELECT
        id,
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
        note_mode
      FROM coffee_chain_db.promotion_campaign_rules
      WHERE campaign_id = $1
        AND is_active = TRUE
      ORDER BY id ASC
      LIMIT 1
    `,
    [row.id],
  );

  const rule = ruleR.rows[0]
    ? await (async () => {
      const scope = await getRuleScopeIds(client, {
        kind: "promotion",
        ruleId: Number(ruleR.rows[0].id),
      });

      const fallbackTriggerProductId =
        ruleR.rows[0].trigger_product_id != null
          ? Number(ruleR.rows[0].trigger_product_id)
          : null;
      const fallbackTriggerVariantId =
        ruleR.rows[0].trigger_variant_id != null
          ? Number(ruleR.rows[0].trigger_variant_id)
          : null;
      const fallbackRewardProductId =
        ruleR.rows[0].reward_product_id != null
          ? Number(ruleR.rows[0].reward_product_id)
          : null;
      const fallbackRewardVariantId =
        ruleR.rows[0].reward_variant_id != null
          ? Number(ruleR.rows[0].reward_variant_id)
          : null;

      return {
        id: Number(ruleR.rows[0].id),
        ruleType: String(ruleR.rows[0].rule_type) as
          | "BUY_X_GET_Y"
          | "GIFT_WITH_PURCHASE",

        triggerCategoryId:
          ruleR.rows[0].trigger_category_id != null
            ? Number(ruleR.rows[0].trigger_category_id)
            : null,
        triggerProductIds: scope.triggerProductIds.length
          ? scope.triggerProductIds
          : fallbackTriggerProductId != null
            ? [fallbackTriggerProductId]
            : [],
        triggerVariantIds: scope.triggerVariantIds.length
          ? scope.triggerVariantIds
          : fallbackTriggerVariantId != null
            ? [fallbackTriggerVariantId]
            : [],
        triggerSize: ruleR.rows[0].trigger_size ?? null,
        triggerQty: Number(ruleR.rows[0].trigger_qty),

        rewardCategoryId:
          ruleR.rows[0].reward_category_id != null
            ? Number(ruleR.rows[0].reward_category_id)
            : null,
        rewardProductIds: scope.rewardProductIds.length
          ? scope.rewardProductIds
          : fallbackRewardProductId != null
            ? [fallbackRewardProductId]
            : [],
        rewardVariantIds: scope.rewardVariantIds.length
          ? scope.rewardVariantIds
          : fallbackRewardVariantId != null
            ? [fallbackRewardVariantId]
            : [],
        rewardSize: ruleR.rows[0].reward_size ?? null,
        rewardQty: Number(ruleR.rows[0].reward_qty),

        allowCustomerChoice: Boolean(ruleR.rows[0].allow_customer_choice),
        noteMode: String(ruleR.rows[0].note_mode || "OPEN") as
          | "OPEN"
          | "LOCKED",
      };
    })()
    : null;

  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    promotionType: String(row.promotion_type),
    discountAmount:
      row.discount_amount != null ? Number(row.discount_amount) : null,
    discountPercent:
      row.discount_percent != null ? Number(row.discount_percent) : null,
    maxDiscountAmount:
      row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    minOrderAmount,
    allowWithVoucher: Boolean(row.allow_with_voucher),
    requiresGiftSelection: Boolean(row.requires_gift_selection),
    startAt: row.start_at,
    endAt: row.end_at,
    rule,
  };
}

function calculateVoucherDiscount(
  subtotalAmount: number,
  voucher: VoucherValidationResult | null,
) {
  if (!voucher) return 0;
  if (voucher.benefitType === "GIFT") return 0;

  if (voucher.rewardType === "FIXED") {
    return Math.max(
      0,
      Math.min(subtotalAmount, Number(voucher.discountAmount || 0)),
    );
  }

  if (voucher.rewardType === "PERCENT") {
    const raw = subtotalAmount * (Number(voucher.discountPercent || 0) / 100);
    const capped =
      voucher.maxDiscountAmount != null
        ? Math.min(raw, Number(voucher.maxDiscountAmount))
        : raw;
    return Math.max(0, Math.min(subtotalAmount, Math.round(capped)));
  }

  return 0;
}

function calculatePromotionDiscount(
  subtotalAmount: number,
  promotion: PromotionValidationResult | null,
) {
  if (!promotion) return 0;

  if (promotion.promotionType === "ORDER_FIXED") {
    return Math.max(
      0,
      Math.min(subtotalAmount, Number(promotion.discountAmount || 0)),
    );
  }

  if (promotion.promotionType === "ORDER_PERCENT") {
    const raw = subtotalAmount * (Number(promotion.discountPercent || 0) / 100);
    const capped =
      promotion.maxDiscountAmount != null
        ? Math.min(raw, Number(promotion.maxDiscountAmount))
        : raw;
    return Math.max(0, Math.min(subtotalAmount, Math.round(capped)));
  }

  return 0;
}

function countMatchedTriggerQty(
  mergedItems: ExpandedOrderItem[],
  variantMetaMap: Map<
    number,
    {
      productId: number;
      categoryId: number | null;
      size: string;
    }
  >,
  rule:
    | NonNullable<PromotionValidationResult["rule"]>
    | NonNullable<VoucherValidationResult["rule"]>,
) {
  let qty = 0;

  for (const item of mergedItems) {
    const meta = variantMetaMap.get(item.productVariantId);
    if (!meta) continue;

    let ok = true;

    const hasTriggerVariantScope = rule.triggerVariantIds.length > 0;
    const hasTriggerProductScope = rule.triggerProductIds.length > 0;

    if (
      hasTriggerVariantScope &&
      !rule.triggerVariantIds.includes(item.productVariantId)
    ) {
      ok = false;
    }

    if (
      hasTriggerProductScope &&
      !rule.triggerProductIds.includes(meta.productId)
    ) {
      ok = false;
    }

    if (rule.triggerCategoryId && meta.categoryId !== rule.triggerCategoryId) {
      ok = false;
    }

    if (
      rule.triggerSize &&
      String(meta.size).toLowerCase() !== String(rule.triggerSize).toLowerCase()
    ) {
      ok = false;
    }

    if (ok) qty += item.quantity;
  }

  return qty;
}

async function buildVariantMetaMap(client: PoolClient, variantIds: number[]) {
  if (!variantIds.length) {
    return new Map<
      number,
      { productId: number; categoryId: number | null; size: string }
    >();
  }

  const r = await client.query(
    `
      SELECT
        pv.id AS product_variant_id,
        pv.product_id,
        pv.size,
        p.category_id
      FROM coffee_chain_db.product_variants pv
      JOIN coffee_chain_db.products p
        ON p.id = pv.product_id
      WHERE pv.id = ANY($1::bigint[])
    `,
    [variantIds],
  );

  const m = new Map<
    number,
    { productId: number; categoryId: number | null; size: string }
  >();
  for (const row of r.rows) {
    m.set(Number(row.product_variant_id), {
      productId: Number(row.product_id),
      categoryId: row.category_id != null ? Number(row.category_id) : null,
      size: String(row.size),
    });
  }
  return m;
}

async function getRuleScopeIds(
  client: PoolClient,
  params: {
    kind: "promotion" | "voucher";
    ruleId: number;
  },
): Promise<{
  triggerProductIds: number[];
  triggerVariantIds: number[];
  rewardProductIds: number[];
  rewardVariantIds: number[];
}> {
  if (params.kind === "promotion") {
    const [tp, tv, rp, rv] = await Promise.all([
      client.query(
        `
        SELECT product_id
        FROM coffee_chain_db.promotion_campaign_rule_trigger_products
        WHERE rule_id = $1
        `,
        [params.ruleId],
      ),
      client.query(
        `
        SELECT product_variant_id
        FROM coffee_chain_db.promotion_campaign_rule_trigger_variants
        WHERE rule_id = $1
        `,
        [params.ruleId],
      ),
      client.query(
        `
        SELECT product_id
        FROM coffee_chain_db.promotion_campaign_rule_reward_products
        WHERE rule_id = $1
        `,
        [params.ruleId],
      ),
      client.query(
        `
        SELECT product_variant_id
        FROM coffee_chain_db.promotion_campaign_rule_reward_variants
        WHERE rule_id = $1
        `,
        [params.ruleId],
      ),
    ]);

    return {
      triggerProductIds: tp.rows.map((x) => Number(x.product_id)),
      triggerVariantIds: tv.rows.map((x) => Number(x.product_variant_id)),
      rewardProductIds: rp.rows.map((x) => Number(x.product_id)),
      rewardVariantIds: rv.rows.map((x) => Number(x.product_variant_id)),
    };
  }

  const [tp, tv, rp, rv] = await Promise.all([
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.voucher_reward_rule_trigger_products
      WHERE rule_id = $1
      `,
      [params.ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.voucher_reward_rule_trigger_variants
      WHERE rule_id = $1
      `,
      [params.ruleId],
    ),
    client.query(
      `
      SELECT product_id
      FROM coffee_chain_db.voucher_reward_rule_reward_products
      WHERE rule_id = $1
      `,
      [params.ruleId],
    ),
    client.query(
      `
      SELECT product_variant_id
      FROM coffee_chain_db.voucher_reward_rule_reward_variants
      WHERE rule_id = $1
      `,
      [params.ruleId],
    ),
  ]);

  return {
    triggerProductIds: tp.rows.map((x) => Number(x.product_id)),
    triggerVariantIds: tv.rows.map((x) => Number(x.product_variant_id)),
    rewardProductIds: rp.rows.map((x) => Number(x.product_id)),
    rewardVariantIds: rv.rows.map((x) => Number(x.product_variant_id)),
  };
}

async function getEligibleGiftVariants(
  client: PoolClient,
  rule: NonNullable<PromotionValidationResult["rule"]>,
) {
  const clauses: string[] = [`pv.is_active = TRUE`, `p.is_active = TRUE`];
  const values: any[] = [];
  let idx = 1;

  if (rule.rewardVariantIds.length > 0) {
    clauses.push(`pv.id = ANY($${idx++}::bigint[])`);
    values.push(rule.rewardVariantIds);
  }

  if (rule.rewardProductIds.length > 0) {
    clauses.push(`p.id = ANY($${idx++}::bigint[])`);
    values.push(rule.rewardProductIds);
  }

  if (rule.rewardCategoryId) {
    clauses.push(`p.category_id = $${idx++}`);
    values.push(rule.rewardCategoryId);
  }

  if (rule.rewardSize) {
    clauses.push(`LOWER(pv.size) = LOWER($${idx++})`);
    values.push(rule.rewardSize);
  }

  const sql = `
    SELECT
      pv.id AS product_variant_id,
      p.name AS product_name,
      pv.size,
      pv.price,
      p.category_id,
      c.name AS category_name
    FROM coffee_chain_db.product_variants pv
    JOIN coffee_chain_db.products p
      ON p.id = pv.product_id
    LEFT JOIN coffee_chain_db.categories c
      ON c.id = p.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.name, pv.size
  `;

  const r = await client.query(sql, values);

  return r.rows.map((row) => ({
    productVariantId: Number(row.product_variant_id),
    productName: String(row.product_name),
    size: String(row.size),
    price: Number(row.price || 0),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    categoryName: row.category_name ?? null,
  }));
}

async function getEligibleVoucherGiftVariants(
  client: PoolClient,
  rule: NonNullable<VoucherValidationResult["rule"]>,
) {
  const clauses: string[] = [`pv.is_active = TRUE`, `p.is_active = TRUE`];
  const values: any[] = [];
  let idx = 1;

  if (rule.rewardVariantIds.length > 0) {
    clauses.push(`pv.id = ANY($${idx++}::bigint[])`);
    values.push(rule.rewardVariantIds);
  }

  if (rule.rewardProductIds.length > 0) {
    clauses.push(`p.id = ANY($${idx++}::bigint[])`);
    values.push(rule.rewardProductIds);
  }

  if (rule.rewardCategoryId) {
    clauses.push(`p.category_id = $${idx++}`);
    values.push(rule.rewardCategoryId);
  }

  if (rule.rewardSize) {
    clauses.push(`LOWER(pv.size) = LOWER($${idx++})`);
    values.push(rule.rewardSize);
  }

  const sql = `
    SELECT
      pv.id AS product_variant_id,
      p.name AS product_name,
      pv.size,
      pv.price,
      p.category_id,
      c.name AS category_name
    FROM coffee_chain_db.product_variants pv
    JOIN coffee_chain_db.products p
      ON p.id = pv.product_id
    LEFT JOIN coffee_chain_db.categories c
      ON c.id = p.category_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.name, pv.size
  `;

  const r = await client.query(sql, values);

  return r.rows.map((row) => ({
    productVariantId: Number(row.product_variant_id),
    productName: String(row.product_name),
    size: String(row.size),
    price: Number(row.price || 0),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    categoryName: row.category_name ?? null,
  }));
}

async function resolvePromotionGiftSelection(
  client: PoolClient,
  params: {
    promotion: PromotionValidationResult | null;
    mergedItems: ExpandedOrderItem[];
    selectedGiftItems?: SelectedGiftItemInput[];
  },
): Promise<GiftResolutionResult> {
  const promotion = params.promotion;
  if (!promotion?.rule) {
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: 0,
      expectedGiftQty: 0,
    };
  }

  const rule = promotion.rule;

  const variantIds = params.mergedItems.map((x) => x.productVariantId);
  const metaMap = await buildVariantMetaMap(client, variantIds);
  const matchedQty = countMatchedTriggerQty(params.mergedItems, metaMap, rule);

  if (matchedQty < rule.triggerQty) {
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty: 0,
    };
  }

  const applyCount = matchedQty >= rule.triggerQty ? 1 : 0;
  const expectedGiftQty = applyCount * rule.rewardQty;

  if (expectedGiftQty <= 0) {
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty: 0,
    };
  }

  const eligibleVariants = await getEligibleGiftVariants(client, rule);

  if (!eligibleVariants.length) {
    throw new ApiError(
      400,
      "Promotion co cau hinh mon tang nhung khong tim thay variant hop le",
    );
  }

  const selectedGiftItems = params.selectedGiftItems || [];

  if (promotion.requiresGiftSelection) {
    const selectedQty = selectedGiftItems.reduce((s, x) => s + x.quantity, 0);

    if (!selectedQty) {
      return {
        giftSelection: {
          required: true,
          ruleId: rule.id,
          eligibleVariants,
          expectedQty: expectedGiftQty,
        },
        materializedGiftItems: [],
        matchedTriggerQty: matchedQty,
        expectedGiftQty,
      };
    }

    if (selectedQty !== expectedGiftQty) {
      throw new ApiError(400, `Can chon dung ${expectedGiftQty} mon tang`);
    }

    const eligibleSet = new Set(
      eligibleVariants.map((x) => x.productVariantId),
    );

    for (const gift of selectedGiftItems) {
      if (!eligibleSet.has(gift.productVariantId)) {
        throw new ApiError(400, "Co mon tang khong nam trong danh sach hop le");
      }
    }

    const materializedGiftItems: ExpandedOrderItem[] = selectedGiftItems.map(
      (x) => ({
        productVariantId: x.productVariantId,
        quantity: x.quantity,
        note: rule.noteMode === "LOCKED" ? null : x.note || null,
        unitPrice: 0,
      }),
    );

    return {
      giftSelection: {
        required: false,
        ruleId: rule.id,
        eligibleVariants,
        expectedQty: expectedGiftQty,
      },
      materializedGiftItems,
      matchedTriggerQty: matchedQty,
      expectedGiftQty,
    };
  }

  // Không bắt khách chọn tay:
  // - nếu có nhiều món hợp lệ -> vẫn mở UI cho khách chọn
  // - nếu chỉ có 1 món hợp lệ -> tự thêm quà
  if (eligibleVariants.length !== 1) {
    return {
      giftSelection: {
        required: true,
        ruleId: rule.id,
        eligibleVariants,
        expectedQty: expectedGiftQty,
      },
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty,
    };
  }

  return {
    giftSelection: {
      required: false,
      ruleId: rule.id,
      eligibleVariants,
      expectedQty: expectedGiftQty,
    },
    materializedGiftItems: [
      {
        productVariantId: eligibleVariants[0].productVariantId,
        quantity: expectedGiftQty,
        note: null,
        unitPrice: 0,
      },
    ],
    matchedTriggerQty: matchedQty,
    expectedGiftQty,
  };
}
async function resolveVoucherGiftSelection(
  client: PoolClient,
  params: {
    voucher: VoucherValidationResult | null;
    mergedItems: ExpandedOrderItem[];
    selectedGiftItems?: SelectedGiftItemInput[];
    softValidation?: boolean;
  },
): Promise<GiftResolutionResult> {
  const voucher = params.voucher;
  if (!voucher?.rule || voucher.benefitType !== "GIFT") {
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: 0,
      expectedGiftQty: 0,
    };
  }

  const rule = voucher.rule;

  const variantIds = params.mergedItems.map((x) => x.productVariantId);
  const metaMap = await buildVariantMetaMap(client, variantIds);
  const matchedQty = countMatchedTriggerQty(params.mergedItems, metaMap, rule);

  if (matchedQty < rule.triggerQty) {
    if (!params.softValidation) {
      throw new ApiError(400, "Don hang chua dat dieu kien voucher");
    }
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty: 0,
    };
  }

  const applyCount = matchedQty >= rule.triggerQty ? 1 : 0;
  const expectedGiftQty = applyCount * rule.rewardQty;

  if (expectedGiftQty <= 0) {
    return {
      giftSelection: null,
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty: 0,
    };
  }

  const eligibleVariants = await getEligibleVoucherGiftVariants(client, rule);

  if (!eligibleVariants.length) {
    throw new ApiError(
      400,
      "Voucher co cau hinh mon tang nhung khong tim thay variant hop le",
    );
  }

  const selectedGiftItems = params.selectedGiftItems || [];

  if (voucher.requiresGiftSelection) {
    const selectedQty = selectedGiftItems.reduce((s, x) => s + x.quantity, 0);

    if (!selectedQty) {
      return {
        giftSelection: {
          required: true,
          ruleId: rule.id,
          eligibleVariants,
          expectedQty: expectedGiftQty,
        },
        materializedGiftItems: [],
        matchedTriggerQty: matchedQty,
        expectedGiftQty,
      };
    }

    if (selectedQty !== expectedGiftQty) {
      throw new ApiError(400, `Can chon dung ${expectedGiftQty} mon tang`);
    }

    const eligibleSet = new Set(
      eligibleVariants.map((x) => x.productVariantId),
    );

    for (const gift of selectedGiftItems) {
      if (!eligibleSet.has(gift.productVariantId)) {
        throw new ApiError(400, "Co mon tang khong nam trong danh sach hop le");
      }
    }

    const materializedGiftItems: ExpandedOrderItem[] = selectedGiftItems.map(
      (x) => ({
        productVariantId: x.productVariantId,
        quantity: x.quantity,
        note: rule.noteMode === "LOCKED" ? null : x.note || null,
        unitPrice: 0,
      }),
    );

    return {
      giftSelection: {
        required: false,
        ruleId: rule.id,
        eligibleVariants,
        expectedQty: expectedGiftQty,
      },
      materializedGiftItems,
      matchedTriggerQty: matchedQty,
      expectedGiftQty,
    };
  }

  if (eligibleVariants.length !== 1) {
    return {
      giftSelection: {
        required: true,
        ruleId: rule.id,
        eligibleVariants,
        expectedQty: expectedGiftQty,
      },
      materializedGiftItems: [],
      matchedTriggerQty: matchedQty,
      expectedGiftQty,
    };
  }

  return {
    giftSelection: {
      required: false,
      ruleId: rule.id,
      eligibleVariants,
      expectedQty: expectedGiftQty,
    },
    materializedGiftItems: [
      {
        productVariantId: eligibleVariants[0].productVariantId,
        quantity: expectedGiftQty,
        note: null,
        unitPrice: 0,
      },
    ],
    matchedTriggerQty: matchedQty,
    expectedGiftQty,
  };
}

function buildOfferValidationState(params: {
  promotion: PromotionValidationResult | null;
  voucher: VoucherValidationResult | null;
  promotionGiftResolved: GiftResolutionResult;
  voucherGiftResolved: GiftResolutionResult;
}): OfferValidationState | null {
  if (params.voucher) {
    const voucher = params.voucher;
    const resolved = params.voucherGiftResolved;

    if (voucher.benefitType !== "GIFT" || !voucher.rule) {
      return {
        sourceType: "VOUCHER",
        isEligible: true,
        status: "APPLIED",
        message: "Voucher đã được áp dụng.",
      };
    }

    if (resolved.matchedTriggerQty <= 0) {
      return {
        sourceType: "VOUCHER",
        isEligible: false,
        status: "INELIGIBLE",
        message:
          "Voucher này không áp dụng cho món hiện tại. Bạn cần mua sản phẩm đủ điều kiện để nhận quà tặng.",
      };
    }

    if (resolved.matchedTriggerQty < voucher.rule.triggerQty) {
      return {
        sourceType: "VOUCHER",
        isEligible: false,
        status: "INELIGIBLE",
        message:
          "Bạn cần mua thêm sản phẩm đủ điều kiện để nhận quà tặng từ voucher này.",
      };
    }

    if (resolved.giftSelection?.required) {
      return {
        sourceType: "VOUCHER",
        isEligible: true,
        status: "GIFT_SELECTION_REQUIRED",
        message: `Voucher đã đủ điều kiện. Vui lòng chọn ${resolved.expectedGiftQty} món được tặng để hoàn tất áp dụng.`,
      };
    }

    return {
      sourceType: "VOUCHER",
      isEligible: true,
      status: "APPLIED",
      message: "Voucher đã được áp dụng thành công.",
    };
  }

  if (!params.promotion) {
    return null;
  }

  const promotion = params.promotion;
  const resolved = params.promotionGiftResolved;

  if (!promotion.rule) {
    return {
      sourceType: "PROMOTION",
      isEligible: true,
      status: "APPLIED",
      message: "Khuyến mãi đã được áp dụng.",
    };
  }

  if (resolved.matchedTriggerQty <= 0) {
    return {
      sourceType: "PROMOTION",
      isEligible: false,
      status: "INELIGIBLE",
      message:
        "Mã này không áp dụng cho món hiện tại. Bạn cần mua sản phẩm đủ điều kiện để nhận quà tặng.",
    };
  }

  if (resolved.matchedTriggerQty < promotion.rule.triggerQty) {
    return {
      sourceType: "PROMOTION",
      isEligible: false,
      status: "INELIGIBLE",
      message:
        "Bạn cần mua thêm sản phẩm đủ điều kiện để nhận quà tặng từ khuyến mãi này.",
    };
  }

  if (resolved.giftSelection?.required) {
    return {
      sourceType: "PROMOTION",
      isEligible: true,
      status: "GIFT_SELECTION_REQUIRED",
      message: `Khuyến mãi đã đủ điều kiện. Vui lòng chọn ${resolved.expectedGiftQty} món được tặng để hoàn tất áp dụng.`,
    };
  }

  return {
    sourceType: "PROMOTION",
    isEligible: true,
    status: "APPLIED",
    message: "Khuyến mãi đã được áp dụng thành công.",
  };
}

function buildHeldPayload(params: {
  pickupNumber: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  orderType?: OrderType;
  specialNote?: string;
  serviceMode?: ServiceMode;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
  materializedItems: ExpandedOrderItem[];
  pricing: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
  };
  snapshot?: HoldOrderSnapshotInput;
}): HeldOrderPayload {
  return {
    pickupNumber: params.pickupNumber,
    customerId: params.customerId || null,
    voucherCode: (params.voucherCode || "").trim(),
    promotionCode: (params.promotionCode || "").trim(),
    orderType: (params.orderType || "NORMAL") as OrderType,
    specialNote: (params.specialNote || "").trim() || null,
    serviceMode: normalizeServiceMode(params.serviceMode),
    selectedGiftItems: params.selectedGiftItems || [],
    items: params.items || [],
    combos: params.combos || [],
    appliedComboRules: params.appliedComboRules || [],
    materializedItems: params.materializedItems || [],
    pricing: params.pricing,
    snapshot: params.snapshot || null,
  };
}

function parseHeldPayload(raw: any): HeldOrderPayload {
  const payload = raw && typeof raw === "object" ? raw : {};

  return {
    pickupNumber: Number(payload.pickupNumber || 0),
    customerId:
      payload.customerId != null && Number.isFinite(Number(payload.customerId))
        ? Number(payload.customerId)
        : null,
    voucherCode: String(payload.voucherCode || ""),
    promotionCode: String(payload.promotionCode || ""),
    orderType: String(payload.orderType || "NORMAL") as OrderType,
    specialNote:
      payload.specialNote != null ? String(payload.specialNote) : null,
    serviceMode: normalizeServiceMode(payload.serviceMode),
    selectedGiftItems: Array.isArray(payload.selectedGiftItems)
      ? payload.selectedGiftItems.map((x: any) => ({
        productVariantId: Number(x.productVariantId),
        quantity: Number(x.quantity),
        note: x.note != null ? String(x.note) : undefined,
      }))
      : [],
    items: Array.isArray(payload.items) ? payload.items : [],
    combos: Array.isArray(payload.combos) ? payload.combos : [],
    appliedComboRules: Array.isArray(payload.appliedComboRules)
      ? payload.appliedComboRules
      : [],
    materializedItems: Array.isArray(payload.materializedItems)
      ? payload.materializedItems
      : [],
    pricing: payload.pricing || {
      subtotalAmount: 0,
      promotionDiscountAmount: 0,
      voucherDiscountAmount: 0,
      totalDiscountAmount: 0,
      finalAmount: 0,
    },
    snapshot: payload.snapshot || null,
  };
}

function buildHeldDisplayItemsFromPayload(payload: HeldOrderPayload) {
  const uiSnapshot =
    payload.snapshot && typeof payload.snapshot === "object"
      ? payload.snapshot
      : {};

  const cartItems = Array.isArray(uiSnapshot.cartItems)
    ? uiSnapshot.cartItems
    : [];
  const comboItems = Array.isArray(uiSnapshot.comboItems)
    ? uiSnapshot.comboItems
    : [];

  const items: Array<{
    id: number;
    productVariantId: number;
    quantity: number;
    unitPrice: number;
    note?: string | null;
    variantName?: string | null;
    productName?: string | null;
  }> = [];

  let syntheticId = -1;

  for (const it of cartItems) {
    items.push({
      id: syntheticId--,
      productVariantId: Number(it.variantId || 0),
      quantity: Number(it.qty || 0),
      unitPrice: Number(it.price || 0),
      note: it.note || null,
      variantName:
        it.productName && it.size
          ? `${it.productName} ${it.size}`
          : it.productName || null,
      productName: it.productName || null,
    });
  }

  for (const cb of comboItems) {
    const comboQty = Number(cb.qty || 0);
    const comboChildItems = Array.isArray(cb.items) ? cb.items : [];

    for (const child of comboChildItems) {
      items.push({
        id: syntheticId--,
        productVariantId: Number(child.productVariantId || 0),
        quantity: Number(child.quantity || 0) * comboQty,
        unitPrice: 0,
        note: null,
        variantName:
          child.productName && child.size
            ? `${child.productName} ${child.size}`
            : child.productName || null,
        productName: child.productName || null,
      });
    }
  }

  if (items.length > 0) {
    return items.filter((x) => x.quantity > 0);
  }

  let fallbackId = -100000;

  return (payload.materializedItems || [])
    .map((it) => ({
      id: fallbackId--,
      productVariantId: Number(it.productVariantId),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      note: it.note || null,
      variantName: null,
      productName: null,
    }))
    .filter((x) => x.quantity > 0);
}

export async function previewPosOrderPricing(params: {
  storeId: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
  orderType?: OrderType;
  specialNote?: string;
  softOfferValidation?: boolean;
}) {
  const orderType = params.orderType || "NORMAL";
  const specialNote = (params.specialNote || "").trim();

  if (isSpecialOrderType(orderType) && !specialNote) {
    throw new ApiError(400, "Don dac biet bat buoc nhap ly do / ghi chu");
  }

  if (
    isSpecialOrderType(orderType) &&
    (params.voucherCode || params.promotionCode)
  ) {
    throw new ApiError(400, "Don dac biet khong duoc ap voucher/promotion");
  }

  const hasVoucher = !!(params.voucherCode || "").trim();
  const hasPromotion = !!(params.promotionCode || "").trim();
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasVoucher && hasPromotion) {
    throw new ApiError(400, "Moi don chi duoc dung 1 voucher hoac 1 promotion");
  }

  if ((hasVoucher || hasPromotion) && hasCombo) {
    throw new ApiError(
      400,
      "Don hang dung voucher/promotion thi khong duoc ap dung combo",
    );
  }

  const client = await pool.connect();
  try {
    const base = await buildBasePricing(client, {
      items: params.items,
      combos: params.combos,
      appliedComboRules: params.appliedComboRules,
    });

    const voucher = await getAndValidateVoucher(client, {
      voucherCode: params.voucherCode,
      customerId: params.customerId,
      storeId: params.storeId,
      subtotalAmount: base.subtotalAmount,
      forUpdate: false,
    });

    const promotion = await getAndValidatePromotionWithRule(client, {
      promotionCode: params.promotionCode,
      storeId: params.storeId,
      customerId: params.customerId,
      subtotalAmount: base.subtotalAmount,
    });

    const promotionGiftResolved = await resolvePromotionGiftSelection(client, {
      promotion,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    const voucherGiftResolved = await resolveVoucherGiftSelection(client, {
      voucher,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
      softValidation: Boolean(params.softOfferValidation),
    });

    const offerValidation = buildOfferValidationState({
      promotion,
      voucher,
      promotionGiftResolved,
      voucherGiftResolved,
    });

    if (
      promotionGiftResolved.materializedGiftItems.length > 0 &&
      voucherGiftResolved.materializedGiftItems.length > 0
    ) {
      throw new ApiError(400, "Khong the ap dung dong thoi 2 loai qua tang");
    }

    const finalGiftResolved =
      voucherGiftResolved.giftSelection ||
        voucherGiftResolved.materializedGiftItems.length > 0
        ? voucherGiftResolved
        : promotionGiftResolved;

    const mergedItemsWithGifts = [
      ...base.mergedItems,
      ...finalGiftResolved.materializedGiftItems,
    ];

    const isSpecial = isSpecialOrderType(orderType);

    const voucherDiscountAmount = isSpecial
      ? 0
      : calculateVoucherDiscount(base.subtotalAmount, voucher);

    const promotionDiscountAmount = isSpecial
      ? 0
      : calculatePromotionDiscount(base.subtotalAmount, promotion);

    const totalDiscountAmount = isSpecial
      ? base.subtotalAmount
      : voucherDiscountAmount + promotionDiscountAmount;

    const finalAmount = isSpecial
      ? 0
      : Math.max(0, base.subtotalAmount - totalDiscountAmount);

    return {
      ok: true,
      pricing: {
        subtotalAmount: base.subtotalAmount,
        directTotalAmount: base.directTotalAmount,
        fixedComboTotalAmount: base.fixedComboTotalAmount,
        ruleComboTotalAmount: base.ruleComboTotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
        orderType,
        specialNote: specialNote || null,
        giftSelection: finalGiftResolved.giftSelection,
        materializedGiftItems: finalGiftResolved.materializedGiftItems,
        mergedItems: mergedItemsWithGifts,
        offerValidation,
        appliedVoucher: voucher
          ? {
            id: voucher.id,
            voucherCode: voucher.voucherCode,
            rewardName: voucher.rewardName,
            rewardType: voucher.rewardType,
            benefitType: voucher.benefitType,
          }
          : null,
        appliedPromotion: promotion
          ? {
            id: promotion.id,
            code: promotion.code,
            name: promotion.name,
            promotionType: promotion.promotionType,
          }
          : null,
      },
    };
  } finally {
    client.release();
  }
}

export async function createPosOrder(params: {
  storeId: number;
  actorUserId: number;
  pickupNumber: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  orderType?: OrderType;
  specialNote?: string;
  serviceMode?: ServiceMode;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
  payment: {
    method: "cash" | "transfer" | "card" | "gateway";
    amount?: number;
    referenceCode?: string;
  };
}) {
  const orderType = params.orderType || "NORMAL";
  const specialNote = (params.specialNote || "").trim();
  const serviceMode = normalizeServiceMode(params.serviceMode);
  const isSpecial = isSpecialOrderType(orderType);

  if (isSpecial && !specialNote) {
    throw new ApiError(400, "Don dac biet bat buoc nhap ly do / ghi chu");
  }

  if (isSpecial && (params.voucherCode || params.promotionCode)) {
    throw new ApiError(400, "Don dac biet khong duoc ap voucher/promotion");
  }

  const hasVoucher = !!(params.voucherCode || "").trim();
  const hasPromotion = !!(params.promotionCode || "").trim();
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasVoucher && hasPromotion) {
    throw new ApiError(400, "Moi don chi duoc dung 1 voucher hoac 1 promotion");
  }

  if ((hasVoucher || hasPromotion) && hasCombo) {
    throw new ApiError(
      400,
      "Don hang dung voucher/promotion thi khong duoc ap dung combo",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftGate = await assertStoreCanCreatePosOrder(params.storeId);

    const base = await buildBasePricing(client, {
      items: params.items,
      combos: params.combos,
      appliedComboRules: params.appliedComboRules,
    });

    const voucher = await getAndValidateVoucher(client, {
      voucherCode: params.voucherCode,
      customerId: params.customerId,
      storeId: params.storeId,
      subtotalAmount: base.subtotalAmount,
      forUpdate: true,
    });

    const promotion = await getAndValidatePromotionWithRule(client, {
      promotionCode: params.promotionCode,
      storeId: params.storeId,
      customerId: params.customerId,
      subtotalAmount: base.subtotalAmount,
    });

    const promotionGiftResolved = await resolvePromotionGiftSelection(client, {
      promotion,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    const voucherGiftResolved = await resolveVoucherGiftSelection(client, {
      voucher,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    if (
      promotionGiftResolved.materializedGiftItems.length > 0 &&
      voucherGiftResolved.materializedGiftItems.length > 0
    ) {
      throw new ApiError(400, "Khong the ap dung dong thoi 2 loai qua tang");
    }

    const finalGiftResolved =
      voucherGiftResolved.giftSelection ||
        voucherGiftResolved.materializedGiftItems.length > 0
        ? voucherGiftResolved
        : promotionGiftResolved;

    if (finalGiftResolved.giftSelection?.required) {
      throw new ApiError(400, "Uu dai nay can chon mon tang truoc khi tao don");
    }

    const mergedItemsWithGifts = [
      ...base.mergedItems,
      ...finalGiftResolved.materializedGiftItems,
    ];

    const voucherDiscountAmount = isSpecial
      ? 0
      : calculateVoucherDiscount(base.subtotalAmount, voucher);

    const promotionDiscountAmount = isSpecial
      ? 0
      : calculatePromotionDiscount(base.subtotalAmount, promotion);

    const totalDiscountAmount = isSpecial
      ? base.subtotalAmount
      : voucherDiscountAmount + promotionDiscountAmount;

    const finalAmount = isSpecial
      ? 0
      : Math.max(0, base.subtotalAmount - totalDiscountAmount);

    const paidAmount = isSpecial
      ? 0
      : params.payment.amount != null
        ? Number(params.payment.amount)
        : finalAmount;

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      throw new ApiError(400, "Invalid payment amount");
    }

    if (!isSpecial && paidAmount !== finalAmount) {
      throw new ApiError(
        400,
        `Payment amount must equal final_amount (${finalAmount})`,
      );
    }

    const orderCode = makeOrderCode();

    const oR = await client.query(
      `
        INSERT INTO coffee_chain_db.orders(
          store_id,
          order_code,
          staff_id,
          customer_id,
          total_amount,
          discount_amount,
          final_amount,
          status,
          pickup_number,
          subtotal_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          total_discount_amount,
          applied_campaign_id,
          applied_customer_voucher_id,
          order_type,
          special_note,
          service_mode,
          shift_session_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING
          id,
          order_code,
          order_type,
          special_note,
          service_mode,
          status,
          created_at,
          final_amount,
          customer_id,
          pickup_number
      `,
      [
        params.storeId,
        orderCode,
        params.actorUserId,
        params.customerId || null,
        base.subtotalAmount,
        totalDiscountAmount,
        finalAmount,
        params.pickupNumber,
        base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        promotion?.id || null,
        voucher?.id || null,
        orderType,
        specialNote || null,
        serviceMode,
        shiftGate.reconciliationId,
      ],
    );

    const order = oR.rows[0];

    for (const it of mergedItemsWithGifts) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_details(
            order_id,
            product_variant_id,
            quantity,
            unit_price,
            note
          )
          VALUES ($1,$2,$3,$4,$5)
        `,
        [
          order.id,
          it.productVariantId,
          it.quantity,
          it.unitPrice,
          it.note || null,
        ],
      );
    }

    if (!isSpecial) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_payments(order_id, method, amount, reference_code, shift_session_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          order.id,
          params.payment.method,
          paidAmount,
          params.payment.referenceCode || null,
          shiftGate.reconciliationId,
        ],
      );

      await deductInventoryForOrder({
        client,
        storeId: params.storeId,
        orderId: Number(order.id),
        items: mergedItemsWithGifts.map((it) => ({
          productVariantId: Number(it.productVariantId),
          quantity: Number(it.quantity),
        })),
        actorUserId: params.actorUserId,
      });
    }

    if (voucher) {
      await client.query(
        `
          UPDATE coffee_chain_db.customer_vouchers
          SET
            status = 'USED',
            used_at = NOW(),
            used_order_id = $1,
            used_store_id = $2,
            updated_at = NOW()
          WHERE id = $3
            AND status = 'ISSUED'
        `,
        [order.id, params.storeId, voucher.id],
      );

      await client.query(
        `
          INSERT INTO coffee_chain_db.order_discount_applications(
            order_id,
            source_type,
            source_id,
            source_code,
            source_name,
            discount_type,
            discount_value,
            discount_percent,
            discount_amount_applied,
            meta
          )
          VALUES ($1,'VOUCHER',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        `,
        [
          order.id,
          voucher.id,
          voucher.voucherCode,
          voucher.rewardName,
          voucher.benefitType === "GIFT"
            ? "FIXED"
            : voucher.rewardType === "FIXED"
              ? "FIXED"
              : "PERCENT",
          voucher.benefitType === "GIFT"
            ? 0
            : voucher.rewardType === "FIXED"
              ? voucher.discountAmount
              : null,
          voucher.benefitType === "GIFT"
            ? null
            : voucher.rewardType === "PERCENT"
              ? voucher.discountPercent
              : null,
          voucherDiscountAmount,
          JSON.stringify({
            rewardDefId: voucher.rewardDefId,
            minOrderAmount: voucher.minOrderAmount,
            benefitType: voucher.benefitType,
            giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
              productVariantId: x.productVariantId,
              quantity: x.quantity,
            })),
          }),
        ],
      );
    }

    if (promotion) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_discount_applications(
            order_id,
            source_type,
            source_id,
            source_code,
            source_name,
            discount_type,
            discount_value,
            discount_percent,
            discount_amount_applied,
            meta
          )
          VALUES ($1,'PROMOTION',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        `,
        [
          order.id,
          promotion.id,
          promotion.code,
          promotion.name,
          promotion.promotionType === "ORDER_FIXED" ? "FIXED" : "PERCENT",
          promotion.promotionType === "ORDER_FIXED"
            ? promotion.discountAmount
            : null,
          promotion.promotionType === "ORDER_PERCENT"
            ? promotion.discountPercent
            : null,
          promotionDiscountAmount,
          JSON.stringify({
            minOrderAmount: promotion.minOrderAmount,
            startAt: promotion.startAt,
            endAt: promotion.endAt,
          }),
        ],
      );

      if (finalGiftResolved.materializedGiftItems.length > 0) {
        await client.query(
          `
            UPDATE coffee_chain_db.order_discount_applications
            SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
            WHERE order_id = $1
              AND source_type = 'PROMOTION'
          `,
          [
            order.id,
            JSON.stringify({
              giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
                productVariantId: x.productVariantId,
                quantity: x.quantity,
              })),
            }),
          ],
        );
      }
    }

    let earnedPoints = 0;
    if (order.customer_id) {
      earnedPoints = Math.floor(Number(order.final_amount) / 1000);

      if (earnedPoints > 0) {
        await applyCustomerPointsDelta(
          client,
          Number(order.customer_id),
          earnedPoints,
        );

        await client.query(
          `
            INSERT INTO coffee_chain_db.customer_point_transactions(
              customer_id,
              order_id,
              points_change,
              reason
            )
            VALUES ($1,$2,$3,$4)
          `,
          [
            order.customer_id,
            order.id,
            earnedPoints,
            `Earn from order ${order.order_code}`,
          ],
        );
      }
    }

    await client.query(
      `
        INSERT INTO coffee_chain_db.system_audit_logs
          (user_id, action_type, target_table, target_id, old_value, new_value, flagged)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        params.actorUserId,
        "POS_CREATE_ORDER",
        "orders",
        order.id,
        null,
        JSON.stringify({
          orderCode,
          orderType,
          specialNote: specialNote || null,
          serviceMode,
          subtotalAmount: base.subtotalAmount,
          finalAmount,
          specialZeroAmount: isSpecial,
        }),
        isSpecial,
      ],
    );

    await client.query("COMMIT");

    if (order.customer_id && !isSpecial) {
      scheduleOrderPurchaseOutreach(Number(order.id));
    }

    await safeWritePosActionLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actionType: "ORDER_CREATE",
      entityType: "ORDER",
      entityId: Number(order.id),
      orderId: Number(order.id),
      orderCode: String(order.order_code),
      memberId: order.customer_id ? Number(order.customer_id) : null,
      pickupNumber: Number(order.pickup_number),
      note: isSpecial
        ? `Tao don dac biet ${orderType}`
        : "Tao don va thanh toan ngay",
      afterData: {
        orderId: Number(order.id),
        orderCode: String(order.order_code),
        status: "paid",
        orderType,
        specialNote: specialNote || null,
        serviceMode,
        customerId: order.customer_id ? Number(order.customer_id) : null,
        pickupNumber: Number(order.pickup_number),
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      metadata: {
        paymentMethod: isSpecial ? null : params.payment.method,
        referenceCode: params.payment.referenceCode || null,
        earnedPoints,
      },
    });

    if (order.customer_id) {
      await safeWritePosActionLog({
        storeId: params.storeId,
        actorUserId: params.actorUserId,
        actionType: "ORDER_ATTACH_MEMBER",
        entityType: "ORDER",
        entityId: Number(order.id),
        orderId: Number(order.id),
        orderCode: String(order.order_code),
        memberId: Number(order.customer_id),
        pickupNumber: Number(order.pickup_number),
        note: "Gan member vao don khi tao don",
        beforeData: {
          memberId: null,
        },
        afterData: {
          memberId: Number(order.customer_id),
        },
      });
    }

    return {
      ok: true,
      order: {
        id: Number(order.id),
        orderCode: String(order.order_code),
        orderType: (order.order_type || "NORMAL") as OrderType,
        specialNote: order.special_note ?? null,
        serviceMode: normalizeServiceMode(order.service_mode),
        status: String(order.status),
        createdAt: order.created_at,
        pickupNumber: Number(order.pickup_number),
        finalAmount: Number(order.final_amount),
      },
      payment: !isSpecial
        ? {
          method: params.payment.method,
          amount: paidAmount,
          referenceCode: params.payment.referenceCode || null,
        }
        : undefined,
      pricing: {
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      giftSelection: finalGiftResolved.giftSelection,
      materializedGiftItems: finalGiftResolved.materializedGiftItems,
      appliedVoucher: voucher
        ? {
          id: voucher.id,
          voucherCode: voucher.voucherCode,
          rewardName: voucher.rewardName,
          rewardType: voucher.rewardType,
          benefitType: voucher.benefitType,
        }
        : null,
      appliedPromotion: promotion
        ? {
          id: promotion.id,
          code: promotion.code,
          name: promotion.name,
          promotionType: promotion.promotionType,
        }
        : null,
      earnedPoints,
      shiftWarning: shiftGate.warning || null,
    };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("CREATE POS ORDER ERROR:", e?.message || e);
    throw e;
  } finally {
    client.release();
  }
}

/** Tạo đơn pending (có order_details), không ghi order_payments, để thanh toán qua gateway (VietQR). */
export async function createPosOrderForGateway(
  params: Omit<Parameters<typeof createPosOrder>[0], "payment"> & {
    payment: { method: "gateway" };
  },
) {
  const orderType = params.orderType || "NORMAL";
  const specialNote = (params.specialNote || "").trim();
  const serviceMode = normalizeServiceMode(params.serviceMode);
  const isSpecial = isSpecialOrderType(orderType);

  if (isSpecial && !specialNote) {
    throw new ApiError(400, "Don dac biet bat buoc nhap ly do / ghi chu");
  }

  if (isSpecial && (params.voucherCode || params.promotionCode)) {
    throw new ApiError(400, "Don dac biet khong duoc ap voucher/promotion");
  }

  const hasVoucher = !!(params.voucherCode || "").trim();
  const hasPromotion = !!(params.promotionCode || "").trim();
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasVoucher && hasPromotion) {
    throw new ApiError(400, "Moi don chi duoc dung 1 voucher hoac 1 promotion");
  }

  if ((hasVoucher || hasPromotion) && hasCombo) {
    throw new ApiError(
      400,
      "Don hang dung voucher/promotion thi khong duoc ap dung combo",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftGate = await assertStoreCanCreatePosOrder(params.storeId);

    const base = await buildBasePricing(client, {
      items: params.items,
      combos: params.combos,
      appliedComboRules: params.appliedComboRules,
    });

    const voucher = await getAndValidateVoucher(client, {
      voucherCode: params.voucherCode,
      customerId: params.customerId,
      storeId: params.storeId,
      subtotalAmount: base.subtotalAmount,
      forUpdate: true,
    });

    const promotion = await getAndValidatePromotionWithRule(client, {
      promotionCode: params.promotionCode,
      storeId: params.storeId,
      customerId: params.customerId,
      subtotalAmount: base.subtotalAmount,
    });

    const promotionGiftResolved = await resolvePromotionGiftSelection(client, {
      promotion,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    const voucherGiftResolved = await resolveVoucherGiftSelection(client, {
      voucher,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    if (
      promotionGiftResolved.materializedGiftItems.length > 0 &&
      voucherGiftResolved.materializedGiftItems.length > 0
    ) {
      throw new ApiError(400, "Khong the ap dung dong thoi 2 loai qua tang");
    }

    const finalGiftResolved =
      voucherGiftResolved.giftSelection ||
        voucherGiftResolved.materializedGiftItems.length > 0
        ? voucherGiftResolved
        : promotionGiftResolved;

    if (finalGiftResolved.giftSelection?.required) {
      throw new ApiError(400, "Uu dai nay can chon mon tang truoc khi tao don");
    }

    const mergedItemsWithGifts = [
      ...base.mergedItems,
      ...finalGiftResolved.materializedGiftItems,
    ];

    const voucherDiscountAmount = isSpecial
      ? 0
      : calculateVoucherDiscount(base.subtotalAmount, voucher);

    const promotionDiscountAmount = isSpecial
      ? 0
      : calculatePromotionDiscount(base.subtotalAmount, promotion);

    const totalDiscountAmount = isSpecial
      ? base.subtotalAmount
      : voucherDiscountAmount + promotionDiscountAmount;

    const finalAmount = isSpecial
      ? 0
      : Math.max(0, base.subtotalAmount - totalDiscountAmount);

    const orderCode = makeOrderCode();

    const oR = await client.query(
      `
        INSERT INTO coffee_chain_db.orders(
          store_id,
          order_code,
          staff_id,
          customer_id,
          total_amount,
          discount_amount,
          final_amount,
          status,
          pickup_number,
          subtotal_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          total_discount_amount,
          applied_campaign_id,
          applied_customer_voucher_id,
          order_type,
          special_note,
          service_mode,
          shift_session_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING
          id,
          order_code,
          order_type,
          special_note,
          service_mode,
          status,
          created_at,
          final_amount,
          customer_id,
          pickup_number
      `,
      [
        params.storeId,
        orderCode,
        params.actorUserId,
        params.customerId || null,
        base.subtotalAmount,
        totalDiscountAmount,
        finalAmount,
        params.pickupNumber,
        base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        promotion?.id || null,
        voucher?.id || null,
        orderType,
        specialNote || null,
        serviceMode,
        shiftGate.reconciliationId,
      ],
    );

    const order = oR.rows[0];

    for (const it of mergedItemsWithGifts) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_details(
            order_id,
            product_variant_id,
            quantity,
            unit_price,
            note
          )
          VALUES ($1,$2,$3,$4,$5)
        `,
        [
          order.id,
          it.productVariantId,
          it.quantity,
          it.unitPrice,
          it.note || null,
        ],
      );
    }

    if (voucher) {
      await client.query(
        `
          UPDATE coffee_chain_db.customer_vouchers
          SET
            status = 'USED',
            used_at = NOW(),
            used_order_id = $1,
            used_store_id = $2,
            updated_at = NOW()
          WHERE id = $3
            AND status = 'ISSUED'
        `,
        [order.id, params.storeId, voucher.id],
      );

      await client.query(
        `
          INSERT INTO coffee_chain_db.order_discount_applications(
            order_id,
            source_type,
            source_id,
            source_code,
            source_name,
            discount_type,
            discount_value,
            discount_percent,
            discount_amount_applied,
            meta
          )
          VALUES ($1,'VOUCHER',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        `,
        [
          order.id,
          voucher.id,
          voucher.voucherCode,
          voucher.rewardName,
          voucher.benefitType === "GIFT"
            ? "FIXED"
            : voucher.rewardType === "FIXED"
              ? "FIXED"
              : "PERCENT",
          voucher.benefitType === "GIFT"
            ? 0
            : voucher.rewardType === "FIXED"
              ? voucher.discountAmount
              : null,
          voucher.benefitType === "GIFT"
            ? null
            : voucher.rewardType === "PERCENT"
              ? voucher.discountPercent
              : null,
          voucherDiscountAmount,
          JSON.stringify({
            rewardDefId: voucher.rewardDefId,
            minOrderAmount: voucher.minOrderAmount,
            benefitType: voucher.benefitType,
            giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
              productVariantId: x.productVariantId,
              quantity: x.quantity,
            })),
          }),
        ],
      );
    }

    if (promotion) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_discount_applications(
            order_id,
            source_type,
            source_id,
            source_code,
            source_name,
            discount_type,
            discount_value,
            discount_percent,
            discount_amount_applied,
            meta
          )
          VALUES ($1,'PROMOTION',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        `,
        [
          order.id,
          promotion.id,
          promotion.code,
          promotion.name,
          promotion.promotionType === "ORDER_FIXED" ? "FIXED" : "PERCENT",
          promotion.promotionType === "ORDER_FIXED"
            ? promotion.discountAmount
            : null,
          promotion.promotionType === "ORDER_PERCENT"
            ? promotion.discountPercent
            : null,
          promotionDiscountAmount,
          JSON.stringify({
            minOrderAmount: promotion.minOrderAmount,
            startAt: promotion.startAt,
            endAt: promotion.endAt,
          }),
        ],
      );

      if (finalGiftResolved.materializedGiftItems.length > 0) {
        await client.query(
          `
            UPDATE coffee_chain_db.order_discount_applications
            SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
            WHERE order_id = $1
              AND source_type = 'PROMOTION'
          `,
          [
            order.id,
            JSON.stringify({
              giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
                productVariantId: x.productVariantId,
                quantity: x.quantity,
              })),
            }),
          ],
        );
      }
    }

    await client.query(
      `
        INSERT INTO coffee_chain_db.system_audit_logs
          (user_id, action_type, target_table, target_id, old_value, new_value, flagged)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        params.actorUserId,
        "POS_CREATE_ORDER_FOR_GATEWAY",
        "orders",
        order.id,
        null,
        JSON.stringify({
          orderCode,
          orderType,
          specialNote: specialNote || null,
          serviceMode,
          subtotalAmount: base.subtotalAmount,
          finalAmount,
          specialZeroAmount: isSpecial,
        }),
        isSpecial,
      ],
    );

    await client.query("COMMIT");

    await safeWritePosActionLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actionType: "ORDER_CREATE",
      entityType: "ORDER",
      entityId: Number(order.id),
      orderId: Number(order.id),
      orderCode: String(order.order_code),
      memberId: order.customer_id ? Number(order.customer_id) : null,
      pickupNumber: Number(order.pickup_number),
      note: "Tao don cho thanh toan gateway (VietQR)",
      afterData: {
        orderId: Number(order.id),
        orderCode: String(order.order_code),
        status: "pending",
        orderType,
        specialNote: specialNote || null,
        serviceMode,
        customerId: order.customer_id ? Number(order.customer_id) : null,
        pickupNumber: Number(order.pickup_number),
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      metadata: { paymentMethod: "gateway" },
    });

    return {
      ok: true,
      order: {
        id: Number(order.id),
        orderCode: String(order.order_code),
        orderType: (order.order_type || "NORMAL") as OrderType,
        specialNote: order.special_note ?? null,
        serviceMode: normalizeServiceMode(order.service_mode),
        status: String(order.status),
        createdAt: order.created_at,
        pickupNumber: Number(order.pickup_number),
        finalAmount: Number(order.final_amount),
      },
      pricing: {
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      giftSelection: finalGiftResolved.giftSelection,
      materializedGiftItems: finalGiftResolved.materializedGiftItems,
      appliedVoucher: voucher
        ? {
          id: voucher.id,
          voucherCode: voucher.voucherCode,
          rewardName: voucher.rewardName,
          rewardType: voucher.rewardType,
          benefitType: voucher.benefitType,
        }
        : null,
      appliedPromotion: promotion
        ? {
          id: promotion.id,
          code: promotion.code,
          name: promotion.name,
          promotionType: promotion.promotionType,
        }
        : null,
      shiftWarning: shiftGate.warning || null,
    };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("CREATE POS ORDER FOR GATEWAY ERROR:", e?.message || e);
    throw e;
  } finally {
    client.release();
  }
}

/** Member online order: create pending gateway order first, payment is confirmed later via VietQR. */
export async function createMemberOnlineOrder(params: {
  storeId: number;
  customerId: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
  paymentReferenceCode?: string;
}) {
  const hasVoucher = !!(params.voucherCode || "").trim();
  const hasPromotion = !!(params.promotionCode || "").trim();
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasVoucher && hasPromotion) {
    throw new ApiError(400, "Moi don chi duoc dung 1 voucher hoac 1 promotion");
  }

  if ((hasVoucher || hasPromotion) && hasCombo) {
    throw new ApiError(
      400,
      "Don hang dung voucher/promotion thi khong duoc ap dung combo",
    );
  }

  const client = await pool.connect();
  let currentStep = "member-online:init";
  let voucher: any = null;
  let promotion: any = null;
  let order: any = null;

  try {
    console.log("[member-order] step: begin", {
      storeId: params.storeId,
      customerId: params.customerId,
      voucherCode: (params.voucherCode || "").trim() || null,
      promotionCode: (params.promotionCode || "").trim() || null,
      hasVoucher,
      hasPromotion,
      hasCombo,
      itemsCount: params.items?.length || 0,
    });

    await client.query("BEGIN");

    // Member online: no POS shift gate (createPosOrder still uses assertStoreCanCreatePosOrder).

    currentStep = "buildBasePricing";
    const base = await buildBasePricing(client, {
      items: params.items,
      combos: params.combos || [],
      appliedComboRules: params.appliedComboRules || [],
    });
    console.log("[member-order] step: buildBasePricing done", {
      subtotalAmount: base?.subtotalAmount,
      directTotalAmount: base?.directTotalAmount,
    });

    currentStep = "getAndValidateVoucher";
    voucher = hasVoucher
      ? await getAndValidateVoucher(client, {
        voucherCode: params.voucherCode,
        customerId: params.customerId,
        storeId: params.storeId,
        subtotalAmount: base.subtotalAmount,
        forUpdate: true,
      })
      : null;
    console.log("[member-order] step: voucher validated", {
      hasVoucher,
      voucherId: voucher?.id ?? null,
      rewardName: voucher?.rewardName ?? null,
      benefitType: voucher?.benefitType ?? null,
      rewardType: voucher?.rewardType ?? null,
    });

    currentStep = "getAndValidatePromotionWithRule";
    promotion = hasPromotion
      ? await getAndValidatePromotionWithRule(client, {
        promotionCode: params.promotionCode,
        storeId: params.storeId,
        customerId: params.customerId,
        subtotalAmount: base.subtotalAmount,
      })
      : null;
    console.log("[member-order] step: promotion validated", {
      hasPromotion,
      promotionId: promotion?.id ?? null,
      promotionType: promotion?.promotionType ?? null,
      discountAmount: promotion?.discountAmount ?? null,
      discountPercent: promotion?.discountPercent ?? null,
    });

    currentStep = "resolvePromotionGiftSelection";
    const promotionGiftResolved = await resolvePromotionGiftSelection(client, {
      promotion,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });
    console.log("[member-order] step: resolvePromotionGiftSelection done", {
      giftSelectionRequired:
        promotionGiftResolved.giftSelection?.required ?? null,
      materializedGiftCount:
        promotionGiftResolved.materializedGiftItems?.length || 0,
    });

    currentStep = "resolveVoucherGiftSelection";
    const voucherGiftResolved = await resolveVoucherGiftSelection(client, {
      voucher,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
      softValidation: true,
    });
    const offerValidation = buildOfferValidationState({
      promotion,
      voucher,
      promotionGiftResolved,
      voucherGiftResolved,
    });
    console.log("[member-order] step: resolveVoucherGiftSelection done", {
      giftSelectionRequired:
        voucherGiftResolved.giftSelection?.required ?? null,
      materializedGiftCount:
        voucherGiftResolved.materializedGiftItems?.length || 0,
    });

    if (offerValidation && !offerValidation.isEligible) {
      throw new ApiError(400, offerValidation.message);
    }

    if (
      promotionGiftResolved.materializedGiftItems.length > 0 &&
      voucherGiftResolved.materializedGiftItems.length > 0
    ) {
      throw new ApiError(400, "Khong the ap dung dong thoi 2 loai qua tang");
    }

    const finalGiftResolved =
      voucherGiftResolved.giftSelection ||
        voucherGiftResolved.materializedGiftItems.length > 0
        ? voucherGiftResolved
        : promotionGiftResolved;

    if (finalGiftResolved.giftSelection?.required) {
      throw new ApiError(
        400,
        offerValidation?.message ||
          "Ưu đãi này cần chọn món tặng trước khi thanh toán",
      );
    }

    const mergedItemsWithGifts = [
      ...base.mergedItems,
      ...finalGiftResolved.materializedGiftItems,
    ];

    const voucherDiscountAmount = calculateVoucherDiscount(
      base.subtotalAmount,
      voucher,
    );
    const promotionDiscountAmount = calculatePromotionDiscount(
      base.subtotalAmount,
      promotion,
    );
    const totalDiscountAmount = voucherDiscountAmount + promotionDiscountAmount;
    const finalAmount = Math.max(0, base.subtotalAmount - totalDiscountAmount);

    console.log("[member-order] step: pricing computed", {
      voucherDiscountAmount,
      promotionDiscountAmount,
      totalDiscountAmount,
      finalAmount,
    });

    currentStep = "create order";
    const orderCode = makeOrderCode();

    const oR = await client.query(
      `
        INSERT INTO coffee_chain_db.orders(
          store_id,
          order_code,
          staff_id,
          customer_id,
          total_amount,
          discount_amount,
          final_amount,
          status,
          pickup_number,
          subtotal_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          total_discount_amount,
          applied_campaign_id,
          applied_customer_voucher_id,
          order_type,
          special_note
        )
        VALUES ($1,$2,NULL,$3,$4,$5,$6,'pending',NULL,$7,$8,$9,$10,$11,$12,'NORMAL',NULL)
        RETURNING id, order_code, status, created_at, final_amount, customer_id, pickup_number
      `,
      [
        params.storeId,
        orderCode,
        params.customerId,
        base.subtotalAmount,
        totalDiscountAmount,
        finalAmount,
        base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        promotion?.id || null,
        voucher?.id || null,
      ],
    );

    order = oR.rows[0];
    console.log("[member-order] step: order inserted", {
      orderId: order?.id,
      orderCode: order?.order_code,
      status: order?.status,
      finalAmount: order?.final_amount,
      pickupNumber: order?.pickup_number ?? null,
    });

    currentStep = "create order_details";
    for (const it of mergedItemsWithGifts) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_details(order_id, product_variant_id, quantity, unit_price, note)
          VALUES ($1,$2,$3,$4,$5)
        `,
        [
          order.id,
          it.productVariantId,
          it.quantity,
          it.unitPrice,
          it.note || null,
        ],
      );
    }
    console.log("[member-order] step: order_details inserted", {
      insertedCount: mergedItemsWithGifts?.length || 0,
    });

    if (voucher) {
      console.log(
        "[member-order] step: voucher updated + discount application start",
        {
          voucherId: voucher.id,
        },
      );

      currentStep = "update customer_vouchers";
      await client.query(
        `UPDATE coffee_chain_db.customer_vouchers
         SET status = 'USED', used_at = NOW(), used_order_id = $1, used_store_id = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'ISSUED'`,
        [order.id, params.storeId, voucher.id],
      );

      currentStep = "insert order_discount_applications (voucher)";
      const voucherDiscountType =
        voucher.benefitType === "GIFT"
          ? "FIXED"
          : voucher.rewardType === "FIXED"
            ? "FIXED"
            : "PERCENT";
      const voucherDiscountValue =
        voucher.benefitType === "GIFT"
          ? 0
          : voucher.rewardType === "FIXED"
            ? voucher.discountAmount
            : null;
      const voucherDiscountPercent =
        voucher.benefitType === "GIFT"
          ? null
          : voucher.rewardType === "PERCENT"
            ? voucher.discountPercent
            : null;

      await client.query(
        `INSERT INTO coffee_chain_db.order_discount_applications(
          order_id, source_type, source_id, source_code, source_name, discount_type, discount_value,
          discount_percent, discount_amount_applied, meta)
         VALUES ($1,'VOUCHER',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          order.id,
          voucher.id,
          voucher.voucherCode,
          voucher.rewardName,
          voucherDiscountType,
          voucherDiscountValue,
          voucherDiscountPercent,
          voucherDiscountAmount,
          JSON.stringify({
            rewardDefId: voucher.rewardDefId,
            minOrderAmount: voucher.minOrderAmount,
            benefitType: voucher.benefitType,
            giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
              productVariantId: x.productVariantId,
              quantity: x.quantity,
            })),
          }),
        ],
      );
      console.log(
        "[member-order] step: voucher discount application inserted",
        {
          orderId: order.id,
          sourceId: voucher.id,
        },
      );
    }

    if (promotion) {
      console.log("[member-order] step: promotion discount application start", {
        promotionId: promotion.id,
        promotionType: promotion.promotionType,
      });

      currentStep = "insert order_discount_applications (promotion)";
      await client.query(
        `INSERT INTO coffee_chain_db.order_discount_applications(
          order_id, source_type, source_id, source_code, source_name, discount_type, discount_value,
          discount_percent, discount_amount_applied, meta)
         VALUES ($1,'PROMOTION',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          order.id,
          promotion.id,
          promotion.code,
          promotion.name,
          promotion.promotionType === "ORDER_FIXED" ? "FIXED" : "PERCENT",
          promotion.promotionType === "ORDER_FIXED"
            ? promotion.discountAmount
            : null,
          promotion.promotionType === "ORDER_PERCENT"
            ? promotion.discountPercent
            : null,
          promotionDiscountAmount,
          JSON.stringify({
            minOrderAmount: promotion.minOrderAmount,
            startAt: promotion.startAt,
            endAt: promotion.endAt,
          }),
        ],
      );

      if (finalGiftResolved.materializedGiftItems.length > 0) {
        currentStep =
          "update order_discount_applications.meta (promotion gifts)";
        await client.query(
          `
            UPDATE coffee_chain_db.order_discount_applications
            SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
            WHERE order_id = $1
              AND source_type = 'PROMOTION'
          `,
          [
            order.id,
            JSON.stringify({
              giftItems: finalGiftResolved.materializedGiftItems.map((x) => ({
                productVariantId: x.productVariantId,
                quantity: x.quantity,
              })),
            }),
          ],
        );
      }
      console.log(
        "[member-order] step: promotion discount application inserted",
        {
          orderId: order.id,
          sourceId: promotion.id,
        },
      );
    }

    const earnedPoints = Math.floor(Number(order.final_amount) / 1000);

    currentStep = "commit";
    await client.query("COMMIT");
    console.log("[member-order] step: commit done", { orderId: order.id });

    try {
      await notifyOrderCreated({
        userId: params.customerId,
        orderId: Number(order.id),
        storeId: params.storeId,
        orderCode: String(order.order_code),
      });
    } catch (notificationError: any) {
      console.error(
        "[notifications] failed to create order_created notification:",
        notificationError?.message || notificationError,
      );
    }

    return {
      ok: true,
      order: {
        id: Number(order.id),
        orderCode: String(order.order_code),
        status: String(order.status),
        createdAt: order.created_at,
        pickupNumber:
          order.pickup_number != null ? Number(order.pickup_number) : null,
        finalAmount: Number(order.final_amount),
      },
      pricing: {
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      earnedPoints,
    };
  } catch (e: any) {
    await client.query("ROLLBACK");
    const err = e as any;
    console.error("[member-order] CREATE MEMBER ONLINE ORDER ERROR", {
      step: currentStep,
      message: err?.message,
      detail: err?.detail,
      hint: err?.hint,
      code: err?.code,
      schema: err?.schema,
      table: err?.table,
      column: err?.column,
      dataType: err?.dataType,
      constraint: err?.constraint,
      where: err?.where,
      severity: err?.severity,
      file: err?.file,
      routine: err?.routine,
      position: err?.position,
      internalPosition: err?.internalPosition,
      internalQuery: err?.internalQuery,
      stack: err?.stack,
    });
    throw e;
  } finally {
    client.release();
  }
}

export async function holdPosOrder(params: {
  storeId: number;
  actorUserId: number;
  pickupNumber: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  orderType?: OrderType;
  specialNote?: string;
  serviceMode?: ServiceMode;
  selectedGiftItems?: SelectedGiftItemInput[];
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
  snapshot?: HoldOrderSnapshotInput;
}) {
  const orderType = params.orderType || "NORMAL";
  const specialNote = (params.specialNote || "").trim();
  const serviceMode = normalizeServiceMode(params.serviceMode);
  const isSpecial = isSpecialOrderType(orderType);

  if (isSpecial && !specialNote) {
    throw new ApiError(400, "Don dac biet bat buoc nhap ly do / ghi chu");
  }

  if (isSpecial && (params.voucherCode || params.promotionCode)) {
    throw new ApiError(400, "Don dac biet khong duoc ap voucher/promotion");
  }

  const hasVoucher = !!(params.voucherCode || "").trim();
  const hasPromotion = !!(params.promotionCode || "").trim();
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasVoucher && hasPromotion) {
    throw new ApiError(400, "Moi don chi duoc dung 1 voucher hoac 1 promotion");
  }

  if ((hasVoucher || hasPromotion) && hasCombo) {
    throw new ApiError(
      400,
      "Don hang dung voucher/promotion thi khong duoc ap dung combo",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftGate = await assertStoreCanCreatePosOrder(params.storeId);

    const base = await buildBasePricing(client, {
      items: params.items,
      combos: params.combos,
      appliedComboRules: params.appliedComboRules,
    });

    const voucher = await getAndValidateVoucher(client, {
      voucherCode: params.voucherCode,
      customerId: params.customerId,
      storeId: params.storeId,
      subtotalAmount: base.subtotalAmount,
      forUpdate: false,
    });

    const promotion = await getAndValidatePromotionWithRule(client, {
      promotionCode: params.promotionCode,
      storeId: params.storeId,
      customerId: params.customerId,
      subtotalAmount: base.subtotalAmount,
    });

    const promotionGiftResolved = await resolvePromotionGiftSelection(client, {
      promotion,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    const voucherGiftResolved = await resolveVoucherGiftSelection(client, {
      voucher,
      mergedItems: base.mergedItems,
      selectedGiftItems: params.selectedGiftItems,
    });

    if (
      promotionGiftResolved.materializedGiftItems.length > 0 &&
      voucherGiftResolved.materializedGiftItems.length > 0
    ) {
      throw new ApiError(400, "Khong the ap dung dong thoi 2 loai qua tang");
    }

    const finalGiftResolved =
      voucherGiftResolved.giftSelection ||
        voucherGiftResolved.materializedGiftItems.length > 0
        ? voucherGiftResolved
        : promotionGiftResolved;

    if (finalGiftResolved.giftSelection?.required) {
      throw new ApiError(400, "Uu dai nay can chon mon tang truoc khi giu don");
    }

    const mergedItemsWithGifts = [
      ...base.mergedItems,
      ...finalGiftResolved.materializedGiftItems,
    ];

    const voucherDiscountAmount = isSpecial
      ? 0
      : calculateVoucherDiscount(base.subtotalAmount, voucher);

    const promotionDiscountAmount = isSpecial
      ? 0
      : calculatePromotionDiscount(base.subtotalAmount, promotion);

    const totalDiscountAmount = isSpecial
      ? base.subtotalAmount
      : voucherDiscountAmount + promotionDiscountAmount;

    const finalAmount = isSpecial
      ? 0
      : Math.max(0, base.subtotalAmount - totalDiscountAmount);

    const orderCode = makeOrderCode();

    const oR = await client.query(
      `
        INSERT INTO coffee_chain_db.orders(
          store_id,
          order_code,
          staff_id,
          customer_id,
          total_amount,
          discount_amount,
          final_amount,
          status,
          pickup_number,
          subtotal_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          total_discount_amount,
          applied_campaign_id,
          applied_customer_voucher_id,
          order_type,
          special_note,
          service_mode
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING
          id,
          order_code,
          order_type,
          special_note,
          service_mode,
          status,
          created_at,
          final_amount,
          customer_id,
          pickup_number
      `,
      [
        params.storeId,
        orderCode,
        params.actorUserId,
        params.customerId || null,
        base.subtotalAmount,
        totalDiscountAmount,
        finalAmount,
        params.pickupNumber,
        base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        promotion?.id || null,
        voucher?.id || null,
        orderType,
        specialNote || null,
        serviceMode,
      ],
    );

    const order = oR.rows[0];

    const payload = buildHeldPayload({
      pickupNumber: params.pickupNumber,
      customerId: params.customerId,
      voucherCode: params.voucherCode,
      promotionCode: params.promotionCode,
      orderType,
      specialNote,
      serviceMode,
      selectedGiftItems: params.selectedGiftItems || [],
      items: params.items,
      combos: params.combos,
      appliedComboRules: params.appliedComboRules,
      materializedItems: mergedItemsWithGifts,
      pricing: {
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      snapshot: {
        ...(params.snapshot || {}),
        voucherCode: params.voucherCode,
        promotionCode: params.promotionCode,
        orderType,
        specialNote,
        serviceMode,
        selectedGiftItems: params.selectedGiftItems || [],
      },
    });

    await client.query(
      `
        INSERT INTO coffee_chain_db.pos_order_snapshots(order_id, payload)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (order_id)
        DO UPDATE SET
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [order.id, JSON.stringify(payload)],
    );

    await client.query(
      `
        INSERT INTO coffee_chain_db.system_audit_logs
          (user_id, action_type, target_table, target_id, old_value, new_value, flagged)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        params.actorUserId,
        "POS_HOLD_ORDER",
        "orders",
        order.id,
        null,
        JSON.stringify({
          orderCode,
          orderType,
          specialNote: specialNote || null,
          serviceMode,
          subtotalAmount: base.subtotalAmount,
          finalAmount,
          specialZeroAmount: isSpecial,
        }),
        isSpecial,
      ],
    );

    await client.query("COMMIT");

    return {
      ok: true,
      order: {
        id: Number(order.id),
        orderCode: String(order.order_code),
        orderType: (order.order_type || "NORMAL") as OrderType,
        specialNote: order.special_note ?? null,
        serviceMode: normalizeServiceMode(order.service_mode),
        status: String(order.status),
        createdAt: order.created_at,
        pickupNumber: Number(order.pickup_number),
        finalAmount: Number(order.final_amount),
      },
      pricing: {
        subtotalAmount: base.subtotalAmount,
        promotionDiscountAmount,
        voucherDiscountAmount,
        totalDiscountAmount,
        finalAmount,
      },
      giftSelection: finalGiftResolved.giftSelection,
      materializedGiftItems: finalGiftResolved.materializedGiftItems,
      appliedVoucher: voucher
        ? {
          id: voucher.id,
          voucherCode: voucher.voucherCode,
          rewardName: voucher.rewardName,
          rewardType: voucher.rewardType,
          benefitType: voucher.benefitType,
        }
        : null,
      appliedPromotion: promotion
        ? {
          id: promotion.id,
          code: promotion.code,
          name: promotion.name,
          promotionType: promotion.promotionType,
        }
        : null,
      shiftWarning: shiftGate.warning || null,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function payHeldPosOrder(params: {
  orderId: number;
  storeId: number;
  actorUserId: number;
  orderType?: OrderType;
  specialNote?: string;
  serviceMode?: ServiceMode;
  payment: {
    method: "cash" | "transfer" | "card" | "gateway";
    amount?: number;
    referenceCode?: string;
  };
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftGate = await assertStoreCanCreatePosOrder(params.storeId);

    const orderRes = await client.query(
      `
        SELECT
          o.id,
          o.store_id,
          o.order_code,
          o.status,
          o.customer_id,
          o.final_amount,
          o.subtotal_amount,
          o.promotion_discount_amount,
          o.voucher_discount_amount,
          o.total_discount_amount,
          o.discount_amount,
          o.applied_campaign_id,
          o.applied_customer_voucher_id,
          o.pickup_number,
          o.order_type,
          o.special_note,
          o.service_mode,
          o.created_at
        FROM coffee_chain_db.orders o
        WHERE o.id = $1
          AND o.store_id = $2
        FOR UPDATE
      `,
      [params.orderId, params.storeId],
    );

    const orderRow = orderRes.rows[0];
    if (!orderRow) throw new ApiError(404, "Order not found");

    const currentStatus = String(orderRow.status);
    if (currentStatus !== "pending") {
      throw new ApiError(400, "Chi cho thanh toan don dang giu (pending)");
    }

    const snapshotRes = await client.query(
      `
        SELECT payload
        FROM coffee_chain_db.pos_order_snapshots
        WHERE order_id = $1
        FOR UPDATE
      `,
      [params.orderId],
    );

    const snapshotRow = snapshotRes.rows[0];
    if (!snapshotRow) {
      throw new ApiError(404, "Khong tim thay snapshot cua don giu");
    }

    const payload = parseHeldPayload(snapshotRow.payload);

    const orderType =
      params.orderType ||
      payload.snapshot?.orderType ||
      payload.orderType ||
      orderRow.order_type ||
      "NORMAL";

    const specialNote = (
      params.specialNote ||
      payload.snapshot?.specialNote ||
      payload.specialNote ||
      orderRow.special_note ||
      ""
    ).trim();

    const serviceMode = normalizeServiceMode(
      params.serviceMode ||
        payload.snapshot?.serviceMode ||
        payload.serviceMode ||
        orderRow.service_mode ||
        "IN_STORE",
    );

    const isSpecial = isSpecialOrderType(orderType);

    if (isSpecial && !specialNote) {
      throw new ApiError(400, "Don dac biet bat buoc nhap ly do / ghi chu");
    }

    if (
      isSpecial &&
      ((payload.voucherCode && String(payload.voucherCode).trim()) ||
        (payload.promotionCode && String(payload.promotionCode).trim()) ||
        orderRow.applied_customer_voucher_id ||
        orderRow.applied_campaign_id)
    ) {
      throw new ApiError(400, "Don dac biet khong duoc ap voucher/promotion");
    }

    let materializedItems = Array.isArray(payload.materializedItems)
      ? payload.materializedItems
      : [];

    if (!materializedItems.length) {
      const rebuiltBase = await buildBasePricing(client, {
        items: payload.items || [],
        combos: payload.combos || [],
        appliedComboRules: payload.appliedComboRules || [],
      });
      materializedItems = rebuiltBase.mergedItems;
    }

    if (!materializedItems.length) {
      throw new ApiError(400, "Don giu khong co mon de thanh toan");
    }

    const finalAmount = isSpecial ? 0 : Number(orderRow.final_amount);
    const paidAmount = isSpecial
      ? 0
      : params.payment.amount != null
        ? Number(params.payment.amount)
        : finalAmount;

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      throw new ApiError(400, "Invalid payment amount");
    }

    if (!isSpecial && paidAmount !== finalAmount) {
      throw new ApiError(
        400,
        `Payment amount must equal final_amount (${finalAmount})`,
      );
    }

    if (orderRow.applied_customer_voucher_id) {
      const voucherRes = await client.query(
        `
          SELECT
            cv.id,
            cv.voucher_code,
            cv.status,
            vd.id AS reward_def_id,
            vd.name AS reward_name,
            vd.benefit_type,
            vd.reward_type,
            vd.discount_amount,
            vd.discount_percent,
            vd.max_discount_amount,
            vd.min_order_amount
          FROM coffee_chain_db.customer_vouchers cv
          JOIN coffee_chain_db.voucher_reward_defs vd
            ON vd.id = cv.reward_def_id
          WHERE cv.id = $1
          FOR UPDATE
        `,
        [orderRow.applied_customer_voucher_id],
      );

      const voucher = voucherRes.rows[0];
      if (!voucher) {
        throw new ApiError(400, "Voucher cua don giu khong con ton tai");
      }

      if (String(voucher.status) !== "ISSUED") {
        throw new ApiError(
          400,
          "Voucher cua don giu da khong con hop le, vui long huy don giu va tao lai",
        );
      }

      await client.query(
        `
          UPDATE coffee_chain_db.customer_vouchers
          SET
            status = 'USED',
            used_at = NOW(),
            used_order_id = $1,
            used_store_id = $2,
            updated_at = NOW()
          WHERE id = $3
            AND status = 'ISSUED'
        `,
        [orderRow.id, params.storeId, voucher.id],
      );

      const existedDiscountAppRes = await client.query(
        `
          SELECT id
          FROM coffee_chain_db.order_discount_applications
          WHERE order_id = $1
            AND source_type = 'VOUCHER'
          LIMIT 1
        `,
        [orderRow.id],
      );

      if (!existedDiscountAppRes.rows[0]) {
        const benefitType = normalizeBenefitType(voucher.benefit_type);

        await client.query(
          `
            INSERT INTO coffee_chain_db.order_discount_applications(
              order_id,
              source_type,
              source_id,
              source_code,
              source_name,
              discount_type,
              discount_value,
              discount_percent,
              discount_amount_applied,
              meta
            )
            VALUES ($1,'VOUCHER',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
          `,
          [
            orderRow.id,
            voucher.id,
            voucher.voucher_code,
            voucher.reward_name,
            benefitType === "GIFT"
              ? "FIXED"
              : String(voucher.reward_type) === "FIXED"
                ? "FIXED"
                : "PERCENT",
            benefitType === "GIFT"
              ? 0
              : String(voucher.reward_type) === "FIXED"
                ? Number(voucher.discount_amount || 0)
                : null,
            benefitType === "GIFT"
              ? null
              : String(voucher.reward_type) === "PERCENT"
                ? Number(voucher.discount_percent || 0)
                : null,
            Number(orderRow.voucher_discount_amount || 0),
            JSON.stringify({
              rewardDefId: Number(voucher.reward_def_id),
              minOrderAmount: Number(voucher.min_order_amount || 0),
              benefitType,
            }),
          ],
        );
      }
    }

    if (orderRow.applied_campaign_id) {
      const promoRes = await client.query(
        `
          SELECT
            id,
            code,
            name,
            promotion_type,
            discount_amount,
            discount_percent,
            min_order_amount,
            start_at,
            end_at
          FROM coffee_chain_db.promotion_campaigns
          WHERE id = $1
          LIMIT 1
        `,
        [orderRow.applied_campaign_id],
      );

      const promotion = promoRes.rows[0];
      if (!promotion) {
        throw new ApiError(
          400,
          "Promotion cua don giu khong con ton tai, vui long huy don giu va tao lai",
        );
      }

      const existedDiscountAppRes = await client.query(
        `
          SELECT id
          FROM coffee_chain_db.order_discount_applications
          WHERE order_id = $1
            AND source_type = 'PROMOTION'
          LIMIT 1
        `,
        [orderRow.id],
      );

      if (!existedDiscountAppRes.rows[0]) {
        await client.query(
          `
            INSERT INTO coffee_chain_db.order_discount_applications(
              order_id,
              source_type,
              source_id,
              source_code,
              source_name,
              discount_type,
              discount_value,
              discount_percent,
              discount_amount_applied,
              meta
            )
            VALUES ($1,'PROMOTION',$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
          `,
          [
            orderRow.id,
            Number(promotion.id),
            String(promotion.code),
            String(promotion.name),
            String(promotion.promotion_type) === "ORDER_FIXED"
              ? "FIXED"
              : "PERCENT",
            String(promotion.promotion_type) === "ORDER_FIXED"
              ? Number(promotion.discount_amount || 0)
              : null,
            String(promotion.promotion_type) === "ORDER_PERCENT"
              ? Number(promotion.discount_percent || 0)
              : null,
            Number(orderRow.promotion_discount_amount || 0),
            JSON.stringify({
              minOrderAmount: Number(promotion.min_order_amount || 0),
              startAt: promotion.start_at,
              endAt: promotion.end_at,
            }),
          ],
        );
      }
    }

    const nextDiscountAmount = isSpecial
      ? Number(orderRow.subtotal_amount || 0)
      : Number(orderRow.discount_amount || orderRow.total_discount_amount || 0);

    const nextTotalDiscountAmount = isSpecial
      ? Number(orderRow.subtotal_amount || 0)
      : Number(orderRow.total_discount_amount || 0);

    const updatedRes = await client.query(
      `
        UPDATE coffee_chain_db.orders
        SET
          status = 'paid',
          staff_id = $1,
          final_amount = $2,
          discount_amount = $3,
          total_discount_amount = $4,
          order_type = $5,
          special_note = $6,
          service_mode = $7
        WHERE id = $8
          AND store_id = $9
        RETURNING
          id,
          order_code,
          order_type,
          special_note,
          service_mode,
          status,
          created_at,
          pickup_number,
          final_amount,
          customer_id,
          subtotal_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          total_discount_amount,
          discount_amount
      `,
      [
        params.actorUserId,
        finalAmount,
        nextDiscountAmount,
        nextTotalDiscountAmount,
        orderType,
        specialNote || null,
        serviceMode,
        orderRow.id,
        params.storeId,
      ],
    );

    const updated = updatedRes.rows[0];

    const detailCheckRes = await client.query(
      `
        SELECT id
        FROM coffee_chain_db.order_details
        WHERE order_id = $1
        LIMIT 1
      `,
      [orderRow.id],
    );

    if (!detailCheckRes.rows[0]) {
      for (const it of materializedItems) {
        await client.query(
          `
            INSERT INTO coffee_chain_db.order_details(
              order_id,
              product_variant_id,
              quantity,
              unit_price,
              note
            )
            VALUES ($1,$2,$3,$4,$5)
          `,
          [
            orderRow.id,
            Number(it.productVariantId),
            Number(it.quantity),
            Number(it.unitPrice),
            it.note || null,
          ],
        );
      }
    }

    if (!isSpecial) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_payments(order_id, method, amount, reference_code, shift_session_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          orderRow.id,
          params.payment.method,
          paidAmount,
          params.payment.referenceCode || null,
          shiftGate.reconciliationId,
        ],
      );

      await deductInventoryForOrder({
        client,
        storeId: params.storeId,
        orderId: Number(orderRow.id),
        items: materializedItems.map((it) => ({
          productVariantId: Number(it.productVariantId),
          quantity: Number(it.quantity),
        })),
        actorUserId: params.actorUserId,
      });
    }

    let earnedPoints = 0;
    if (updated.customer_id) {
      earnedPoints = Math.floor(Number(updated.final_amount) / 1000);

      if (earnedPoints > 0) {
        await applyCustomerPointsDelta(
          client,
          Number(updated.customer_id),
          earnedPoints,
        );

        await client.query(
          `
            INSERT INTO coffee_chain_db.customer_point_transactions(
              customer_id,
              order_id,
              points_change,
              reason
            )
            VALUES ($1,$2,$3,$4)
          `,
          [
            updated.customer_id,
            updated.id,
            earnedPoints,
            `Earn from held order ${updated.order_code}`,
          ],
        );
      }
    }

    await client.query(
      `
        INSERT INTO coffee_chain_db.system_audit_logs
          (user_id, action_type, target_table, target_id, old_value, new_value, flagged)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        params.actorUserId,
        "POS_PAY_HELD_ORDER",
        "orders",
        updated.id,
        null,
        JSON.stringify({
          orderType,
          specialNote: specialNote || null,
          serviceMode,
          finalAmount,
          specialZeroAmount: isSpecial,
        }),
        isSpecial,
      ],
    );

    await client.query("COMMIT");

    if (updated.customer_id && !isSpecial) {
      scheduleOrderPurchaseOutreach(Number(updated.id));
    }

    await safeWritePosActionLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actionType: "ORDER_PAY",
      entityType: "ORDER",
      entityId: Number(updated.id),
      orderId: Number(updated.id),
      orderCode: String(updated.order_code),
      memberId: updated.customer_id ? Number(updated.customer_id) : null,
      pickupNumber: Number(updated.pickup_number),
      note: isSpecial
        ? `Thanh toan don giu dang special ${orderType}`
        : "Thanh toan don giu",
      beforeData: {
        status: String(orderRow.status),
        orderType: String(orderRow.order_type || "NORMAL"),
        specialNote: orderRow.special_note || null,
        serviceMode: normalizeServiceMode(orderRow.service_mode),
        customerId: orderRow.customer_id ? Number(orderRow.customer_id) : null,
      },
      afterData: {
        status: "paid",
        orderType,
        specialNote: specialNote || null,
        serviceMode,
        customerId: updated.customer_id ? Number(updated.customer_id) : null,
        finalAmount,
      },
      metadata: {
        paymentMethod: isSpecial ? null : params.payment.method,
        referenceCode: params.payment.referenceCode || null,
        earnedPoints,
      },
    });

    if (
      Number(orderRow.customer_id || 0) !== Number(updated.customer_id || 0) &&
      updated.customer_id
    ) {
      await safeWritePosActionLog({
        storeId: params.storeId,
        actorUserId: params.actorUserId,
        actionType: "ORDER_ATTACH_MEMBER",
        entityType: "ORDER",
        entityId: Number(updated.id),
        orderId: Number(updated.id),
        orderCode: String(updated.order_code),
        memberId: Number(updated.customer_id),
        pickupNumber: Number(updated.pickup_number),
        note: "Gan member vao don giu",
        beforeData: {
          memberId: orderRow.customer_id ? Number(orderRow.customer_id) : null,
        },
        afterData: {
          memberId: Number(updated.customer_id),
        },
      });
    }

    if (
      String(orderRow.order_type || "NORMAL") !==
      String(orderType || "NORMAL") ||
      String(orderRow.special_note || "") !== String(specialNote || "")
    ) {
      await safeWritePosActionLog({
        storeId: params.storeId,
        actorUserId: params.actorUserId,
        actionType: "ORDER_CHANGE_TYPE",
        entityType: "ORDER",
        entityId: Number(updated.id),
        orderId: Number(updated.id),
        orderCode: String(updated.order_code),
        memberId: updated.customer_id ? Number(updated.customer_id) : null,
        pickupNumber: Number(updated.pickup_number),
        note: "Thay doi loai don truoc khi thanh toan",
        beforeData: {
          orderType: String(orderRow.order_type || "NORMAL"),
          specialNote: orderRow.special_note || null,
          serviceMode: normalizeServiceMode(orderRow.service_mode),
        },
        afterData: {
          orderType,
          specialNote: specialNote || null,
          serviceMode,
        },
      });
    }

    return {
      ok: true,
      order: {
        id: Number(updated.id),
        orderCode: String(updated.order_code),
        orderType: (updated.order_type || "NORMAL") as OrderType,
        specialNote: updated.special_note ?? null,
        serviceMode: normalizeServiceMode(updated.service_mode),
        status: String(updated.status),
        createdAt: updated.created_at,
        pickupNumber: Number(updated.pickup_number),
        finalAmount: Number(updated.final_amount),
      },
      payment: !isSpecial
        ? {
          method: params.payment.method,
          amount: paidAmount,
          referenceCode: params.payment.referenceCode || null,
        }
        : undefined,
      pricing: {
        subtotalAmount: Number(updated.subtotal_amount || 0),
        promotionDiscountAmount: Number(updated.promotion_discount_amount || 0),
        voucherDiscountAmount: Number(updated.voucher_discount_amount || 0),
        totalDiscountAmount: Number(updated.total_discount_amount || 0),
        finalAmount: Number(updated.final_amount || 0),
      },
      appliedVoucher: null,
      appliedPromotion: null,
      earnedPoints,
      shiftWarning: shiftGate.warning || null,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function voidHeldPosOrder(params: {
  orderId: number;
  storeId: number;
  actorUserId: number;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentRes = await client.query(
      `
        SELECT id, store_id, status, order_code
        FROM coffee_chain_db.orders
        WHERE id = $1 AND store_id = $2
        FOR UPDATE
      `,
      [params.orderId, params.storeId],
    );

    const current = currentRes.rows[0];
    if (!current) throw new ApiError(404, "Order not found");

    if (String(current.status) !== "pending") {
      throw new ApiError(400, "Chi duoc huy truc tiep don dang giu (pending)");
    }

    const updated = await client.query(
      `
        UPDATE coffee_chain_db.orders
        SET
          status = 'voided',
          staff_id = $1
        WHERE id = $2
          AND store_id = $3
        RETURNING id, status, order_code
      `,
      [params.actorUserId, params.orderId, params.storeId],
    );

    await client.query("COMMIT");

    await safeWritePosActionLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actionType: "ORDER_CANCEL_PENDING",
      entityType: "ORDER",
      entityId: Number(updated.rows[0].id),
      orderId: Number(updated.rows[0].id),
      orderCode: String(updated.rows[0].order_code),
      note: "Huy don pending",
      beforeData: {
        status: "pending",
      },
      afterData: {
        status: String(updated.rows[0].status),
      },
    });

    return {
      ok: true,
      order: {
        id: Number(updated.rows[0].id),
        status: String(updated.rows[0].status),
        orderCode: String(updated.rows[0].order_code),
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getPosHeldOrderSnapshot(params: {
  orderId: number;
  storeId: number;
}) {
  const client = await pool.connect();

  try {
    const orderRes = await client.query(
      `
        SELECT
          o.id,
          o.order_code,
          o.order_type,
          o.special_note,
          o.service_mode,
          o.status,
          o.pickup_number,
          o.final_amount,
          o.subtotal_amount,
          o.promotion_discount_amount,
          o.voucher_discount_amount,
          o.total_discount_amount,
          o.created_at
        FROM coffee_chain_db.orders o
        WHERE o.id = $1
          AND o.store_id = $2
      `,
      [params.orderId, params.storeId],
    );

    const row = orderRes.rows[0];
    if (!row) throw new ApiError(404, "Order not found");

    if (String(row.status) !== "pending") {
      throw new ApiError(400, "Order nay khong phai don giu");
    }

    const snapshotRes = await client.query(
      `
        SELECT payload, created_at, updated_at
        FROM coffee_chain_db.pos_order_snapshots
        WHERE order_id = $1
      `,
      [params.orderId],
    );

    const snapshot = snapshotRes.rows[0];
    if (!snapshot) {
      throw new ApiError(404, "Khong tim thay snapshot cua don giu");
    }

    return {
      ok: true,
      order: {
        id: Number(row.id),
        orderCode: String(row.order_code),
        orderType: (row.order_type || "NORMAL") as OrderType,
        specialNote: row.special_note || null,
        serviceMode: normalizeServiceMode(row.service_mode),
        status: String(row.status),
        pickupNumber: Number(row.pickup_number),
        finalAmount: Number(row.final_amount),
        subtotalAmount: Number(row.subtotal_amount || 0),
        promotionDiscountAmount: Number(row.promotion_discount_amount || 0),
        voucherDiscountAmount: Number(row.voucher_discount_amount || 0),
        totalDiscountAmount: Number(row.total_discount_amount || 0),
        createdAt: row.created_at,
      },
      snapshot: snapshot.payload,
    };
  } finally {
    client.release();
  }
}

export async function listHeldPosOrders(params: {
  storeId: number;
  limit?: number;
  offset?: number;
}) {
  const rows = await listOrdersByStore({
    storeId: params.storeId,
    statuses: ["pending"],
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  const map = new Map<number, any>();

  for (const row of rows) {
    const id = Number(row.id);

    if (!map.has(id)) {
      map.set(id, {
        id,
        storeId: Number(row.store_id),
        orderCode: String(row.order_code),
        orderType: (row.order_type || "NORMAL") as OrderType,
        specialNote: row.special_note || null,
        serviceMode: normalizeServiceMode(row.service_mode),
        status: String(row.status),
        createdAt: row.created_at,
        completedAt: row.completed_at ?? null,
        pickupNumber: row.pickup_number ?? null,
        totalAmount: Number(row.total_amount ?? 0),
        discountAmount: Number(row.discount_amount ?? 0),
        finalAmount: Number(row.final_amount ?? 0),
        customerId: row.customer_id ? Number(row.customer_id) : null,
        items: [],
      });
    }

    if (row.detail_id != null) {
      map.get(id).items.push({
        id: Number(row.detail_id),
        productVariantId: Number(row.product_variant_id),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        note: row.item_note ?? null,
        variantName:
          row.product_name && row.variant_size
            ? `${row.product_name} ${row.variant_size}`
            : (row.product_name ?? null),
        productName: row.product_name ?? null,
      });
    }
  }

  const orderIds = Array.from(map.keys());
  if (orderIds.length) {
    const snapshotRes = await pool.query(
      `
        SELECT order_id, payload
        FROM coffee_chain_db.pos_order_snapshots
        WHERE order_id = ANY($1::bigint[])
      `,
      [orderIds],
    );

    const snapshotMap = new Map<number, any>();
    for (const row of snapshotRes.rows) {
      snapshotMap.set(Number(row.order_id), row.payload);
    }

    for (const [orderId, order] of map.entries()) {
      if (order.items.length > 0) continue;

      const payload = parseHeldPayload(snapshotMap.get(orderId));
      order.items = buildHeldDisplayItemsFromPayload(payload);
    }
  }

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    orders: Array.from(map.values()),
  };
}

export async function createPosOrderVoidRequest(params: {
  orderId: number;
  storeId: number;
  actorUserId: number;
  reason: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      `
        SELECT id, store_id, order_code, status
        FROM coffee_chain_db.orders
        WHERE id = $1
          AND store_id = $2
        FOR UPDATE
      `,
      [params.orderId, params.storeId],
    );

    const order = orderRes.rows[0];
    if (!order) throw new ApiError(404, "Order not found");

    const currentStatus = String(order.status);
    if (!["pending", "paid"].includes(currentStatus)) {
      throw new ApiError(
        400,
        "Chi duoc gui request void voi don pending hoac paid",
      );
    }

    const existingRes = await client.query(
      `
        SELECT id, status
        FROM coffee_chain_db.order_void_requests
        WHERE order_id = $1
          AND status = 'pending'
        LIMIT 1
      `,
      [params.orderId],
    );

    const existing = existingRes.rows[0];
    if (existing) {
      throw new ApiError(400, "Don nay da co request void dang cho xu ly");
    }

    const insertRes = await client.query(
      `
        INSERT INTO coffee_chain_db.order_void_requests(
          order_id,
          store_id,
          requested_by_user_id,
          reason,
          status
        )
        VALUES ($1,$2,$3,$4,'pending')
        RETURNING id, order_id, store_id, requested_by_user_id, reason, status, created_at
      `,
      [params.orderId, params.storeId, params.actorUserId, params.reason],
    );

    await client.query("COMMIT");

    const row = insertRes.rows[0];

    return {
      ok: true,
      request: {
        id: Number(row.id),
        orderId: Number(row.order_id),
        storeId: Number(row.store_id),
        requestedByUserId: Number(row.requested_by_user_id),
        reason: String(row.reason),
        status: String(row.status) as VoidRequestStatus,
        createdAt: row.created_at,
      },
      order: {
        id: Number(order.id),
        orderCode: String(order.order_code),
        status: currentStatus,
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listPosOrderVoidRequests(params: {
  storeId: number;
  status?: VoidRequestStatus;
  limit?: number;
  offset?: number;
}) {
  const values: any[] = [params.storeId];
  const whereParts = [`r.store_id = $1`];

  if (params.status) {
    values.push(params.status);
    whereParts.push(`r.status = $${values.length}`);
  }

  values.push(params.limit ?? 50);
  const limitParam = values.length;

  values.push(params.offset ?? 0);
  const offsetParam = values.length;

  const r = await pool.query(
    `
      SELECT
        r.id,
        r.order_id,
        r.store_id,
        r.requested_by_user_id,
        r.reason,
        r.status,
        r.approved_by_user_id,
        r.approved_at,
        r.rejected_by_user_id,
        r.rejected_at,
        r.decision_note,
        r.created_at,
        r.updated_at,
        o.order_code,
        o.status AS order_status
      FROM coffee_chain_db.order_void_requests r
      JOIN coffee_chain_db.orders o
        ON o.id = r.order_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY r.created_at DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values,
  );

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      status: params.status || null,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    requests: r.rows.map((row) => ({
      id: Number(row.id),
      orderId: Number(row.order_id),
      orderCode: String(row.order_code),
      orderStatus: String(row.order_status),
      storeId: Number(row.store_id),
      requestedByUserId: Number(row.requested_by_user_id),
      reason: String(row.reason),
      status: String(row.status) as VoidRequestStatus,
      approvedByUserId: row.approved_by_user_id
        ? Number(row.approved_by_user_id)
        : null,
      approvedAt: row.approved_at ?? null,
      rejectedByUserId: row.rejected_by_user_id
        ? Number(row.rejected_by_user_id)
        : null,
      rejectedAt: row.rejected_at ?? null,
      decisionNote: row.decision_note ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function getPosOrderDetail(params: {
  orderId: number;
  storeId: number;
}) {
  const detail = await buildRefundContext(pool, params);
  const payments = await getOrderPayments({ orderId: params.orderId });

  return {
    ok: true,
    order: {
      id: detail.order.id,
      storeId: detail.order.storeId,
      orderCode: detail.order.orderCode,
      orderType: detail.order.orderType,
      specialNote: detail.order.specialNote,
      staffId: detail.order.staffId,
      customerId: detail.order.customerId,
      customerName: detail.order.customerName,
      customerPhone: detail.order.customerPhone,
      totalAmount: detail.order.totalAmount,
      discountAmount: detail.order.discountAmount,
      finalAmount: detail.order.finalAmount,
      status: detail.order.status,
      createdAt: detail.order.createdAt,
      completedAt: detail.order.completedAt,
      pickupNumber: detail.order.pickupNumber,
      notifiedAt: detail.order.notifiedAt,
      refund: {
        refundStatus: detail.order.refundStatus,
        refundedAmount: detail.order.refundedAmount,
        remainingRefundableAmount: Math.max(
          0,
          detail.order.finalAmount - detail.order.refundedAmount,
        ),
        lastRefundedAt: detail.order.lastRefundedAt,
      },
      items: detail.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        note: item.note,
        variantName: item.variantName,
        productName: item.productName,
        refund: {
          refundedQty: item.refund.refundedQty,
          refundedAmount: item.refund.refundedAmount,
          remainingQty: item.refund.remainingQty,
          remainingAmount: item.refund.remainingAmount,
        },
      })),
      payments: payments.map((p) => ({
        id: Number(p.id),
        method: String(p.method),
        amount: Number(p.amount),
        referenceCode: p.reference_code ?? null,
        paidAt: p.paid_at,
      })),
      refunds: detail.refunds,
    },
  };
}

export async function listPosOrders(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  orderType?: string;
  limit?: number;
  offset?: number;
}) {
  const dateFrom = params.dateFrom || todayVN();
  const dateTo = params.dateTo || dateFrom;
  const statuses = normalizeStatuses(params.status);

  const rows = await listOrdersByStore({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    statuses,
    orderType: params.orderType,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  const map = new Map<number, any>();

  for (const row of rows) {
    const id = Number(row.id);

    if (!map.has(id)) {
      map.set(id, {
        id,
        storeId: Number(row.store_id),
        orderCode: String(row.order_code),
        orderType: (row.order_type || "NORMAL") as OrderType,
        specialNote: row.special_note || null,
        status: String(row.status),
        createdAt: row.created_at,
        completedAt: row.completed_at ?? null,
        pickupNumber: row.pickup_number ?? null,
        totalAmount: Number(row.total_amount ?? 0),
        discountAmount: Number(row.discount_amount ?? 0),
        finalAmount: Number(row.final_amount ?? 0),
        customerId: row.customer_id ? Number(row.customer_id) : null,
        customerName: row.customer_name ?? null,
        customerPhone: row.customer_phone ?? null,
        refundedAmount: Number(row.refunded_amount || 0),
        refundStatus: row.refund_status || "none",
        lastRefundedAt: row.last_refunded_at || null,
        items: [],
      });
    }

    if (row.detail_id != null) {
      map.get(id).items.push({
        id: Number(row.detail_id),
        productVariantId: Number(row.product_variant_id),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        note: row.item_note ?? null,
        variantName:
          row.product_name && row.variant_size
            ? `${row.product_name} ${row.variant_size}`
            : (row.product_name ?? null),
        productName: row.product_name ?? null,
      });
    }
  }

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      dateFrom,
      dateTo,
      statuses,
      orderType: params.orderType || null,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    orders: Array.from(map.values()),
  };
}

export async function listPaidPosOrders(params: {
  storeId: number;
  orderCode?: string;
  pickupNumber?: number;
  memberPhone?: string;
  refundStatus?: "none" | "partial" | "full";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const dateFrom = params.dateFrom || todayVN();
  const dateTo = params.dateTo || dateFrom;

  const rows = await searchPaidOrdersByStore({
    storeId: params.storeId,
    orderCode: params.orderCode,
    pickupNumber: params.pickupNumber,
    memberPhone: params.memberPhone,
    refundStatus: params.refundStatus,
    dateFrom,
    dateTo,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      orderCode: params.orderCode || null,
      pickupNumber: params.pickupNumber ?? null,
      memberPhone: params.memberPhone || null,
      refundStatus: params.refundStatus || null,
      dateFrom,
      dateTo,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    orders: rows.map((row) => ({
      id: Number(row.id),
      storeId: Number(row.store_id),
      orderCode: String(row.order_code),
      status: String(row.status),
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
      pickupNumber: row.pickup_number ?? null,
      finalAmount: Number(row.final_amount ?? 0),
      customerId: row.customer_id ? Number(row.customer_id) : null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      paidAt: row.latest_paid_at ?? null,
      refundedAmount: Number(row.refunded_amount ?? 0),
      refundStatus: String(row.refund_status ?? "none") as
        | "none"
        | "partial"
        | "full",
      lastRefundedAt: row.last_refunded_at ?? null,
    })),
  };
}

export async function listPosOnlinePendingOrders(params: {
  storeId: number;
  orderCode?: string;
  memberPhone?: string;
  limit?: number;
  offset?: number;
}) {
  const rows = await listOnlinePendingOrdersForPos({
    storeId: params.storeId,
    orderCode: params.orderCode,
    memberPhone: params.memberPhone,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    filters: {
      storeId: params.storeId,
      orderCode: params.orderCode || null,
      memberPhone: params.memberPhone || null,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
    orders: rows.map((row) => ({
      id: Number(row.id),
      storeId: Number(row.store_id),
      orderCode: String(row.order_code),
      status: "paid" as const,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? null,
      pickupNumber:
        row.pickup_number != null ? Number(row.pickup_number) : null,
      finalAmount: Number(row.final_amount ?? 0),
      customerId: row.customer_id ? Number(row.customer_id) : null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      paidAt: row.latest_paid_at ?? null,
      pickupDelayNotice: mapPickupDelayNotice(row),
    })),
  };
}

export async function confirmPosOnlineOrder(params: {
  orderId: number;
  storeId: number;
  actorUserId: number;
  pickupNumber: number;
  serviceMode: ServiceMode;
}) {
  const client = await pool.connect();

  try {
    const serviceMode = normalizeServiceMode(params.serviceMode);

    await client.query("BEGIN");

    const orderRes = await client.query(
      `
        SELECT
          o.id,
          o.store_id,
          o.order_code,
          o.status,
          o.created_at,
          o.pickup_number,
          o.staff_id,
          o.customer_id,
          o.final_amount,
          o.service_mode
        FROM coffee_chain_db.orders o
        WHERE o.id = $1
          AND o.store_id = $2
        FOR UPDATE
      `,
      [params.orderId, params.storeId],
    );

    const current = orderRes.rows[0];
    if (!current) {
      throw new ApiError(404, "Order not found");
    }

    if (String(current.status) !== "paid") {
      throw new ApiError(400, "Chi cho xac nhan don online da thanh toan");
    }

    if (current.pickup_number != null) {
      throw new ApiError(400, "Don nay da duoc gan so the");
    }

    if (current.staff_id != null) {
      throw new ApiError(400, "Don nay da duoc POS nhan truoc do");
    }

    const paymentRes = await client.query(
      `
        SELECT 1
        FROM coffee_chain_db.order_payments
        WHERE order_id = $1
          AND method = 'gateway'
        LIMIT 1
      `,
      [params.orderId],
    );

    if (!paymentRes.rows[0]) {
      throw new ApiError(400, "Don nay khong phai don online gateway");
    }

    const pickupConflictRes = await client.query(
      `
        SELECT 1
        FROM coffee_chain_db.orders
        WHERE store_id = $1
          AND pickup_number = $2
          AND id <> $3
          AND status = ANY(ARRAY['pending','paid']::order_status_enum[])
        LIMIT 1
      `,
      [params.storeId, params.pickupNumber, params.orderId],
    );

    if (pickupConflictRes.rows[0]) {
      throw new ApiError(409, "So the nay dang duoc su dung");
    }

    const updatedRes = await client.query(
      `
        UPDATE coffee_chain_db.orders
        SET
          pickup_number = $1,
          staff_id = $2,
          service_mode = $3
        WHERE id = $4
          AND store_id = $5
        RETURNING
          id,
          store_id,
          order_code,
          status,
          created_at,
          pickup_number,
          staff_id,
          customer_id,
          final_amount,
          service_mode
      `,
      [params.pickupNumber, params.actorUserId, serviceMode, params.orderId, params.storeId],
    );

    const updated = updatedRes.rows[0];

    await client.query("COMMIT");

    return {
      ok: true,
      order: {
        id: Number(updated.id),
        storeId: Number(updated.store_id),
        orderCode: String(updated.order_code),
        status: String(updated.status),
        createdAt: updated.created_at,
        serviceMode: normalizeServiceMode(updated.service_mode),
        pickupNumber: Number(updated.pickup_number),
        staffId: updated.staff_id ? Number(updated.staff_id) : null,
        customerId: updated.customer_id ? Number(updated.customer_id) : null,
        finalAmount: Number(updated.final_amount ?? 0),
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function refundPosOrder(params: {
  orderId: number;
  storeId: number;
  actorUserId: number;
  refundType: "full" | "partial";
  reason: string;
  items?: Array<{ orderDetailId: number; quantity: number }>;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ctx = await buildRefundContext(client, {
      orderId: params.orderId,
      storeId: params.storeId,
    });

    const currentRefundedAmount = ctx.order.refundedAmount;
    const remainingOrderAmount = Math.max(
      0,
      ctx.order.finalAmount - currentRefundedAmount,
    );
    if (remainingOrderAmount <= 0) {
      throw new ApiError(400, "Don nay da refund het");
    }

    const requestedItems = params.items || [];
    const refundLines: Array<{
      orderDetailId: number;
      quantity: number;
      lineRefundAmount: number;
    }> = [];

    if (params.refundType === "full") {
      for (const item of ctx.items) {
        if (item.refund.remainingQty <= 0) continue;
        const cents = item.refund.remainingUnitCents.reduce((s, x) => s + x, 0);
        refundLines.push({
          orderDetailId: item.id,
          quantity: item.refund.remainingQty,
          lineRefundAmount: fromMoneyCents(cents),
        });
      }
    } else {
      const requestedMap = new Map<number, number>();
      for (const item of requestedItems) {
        requestedMap.set(Number(item.orderDetailId), Number(item.quantity));
      }

      for (const item of ctx.items) {
        const reqQty = requestedMap.get(item.id) || 0;
        if (reqQty <= 0) continue;
        if (reqQty > item.refund.remainingQty) {
          throw new ApiError(
            400,
            `Mon ${item.id} refund vuot so luong con lai`,
          );
        }

        const cents = item.refund.remainingUnitCents
          .slice(0, reqQty)
          .reduce((s, x) => s + x, 0);

        refundLines.push({
          orderDetailId: item.id,
          quantity: reqQty,
          lineRefundAmount: fromMoneyCents(cents),
        });
      }

      if (!refundLines.length) {
        throw new ApiError(400, "Refund partial phai chon it nhat 1 mon");
      }
    }

    const refundAmount = refundLines.reduce(
      (sum, line) => sum + line.lineRefundAmount,
      0,
    );
    if (refundAmount <= 0) {
      throw new ApiError(400, "Khong con so tien hop le de refund");
    }

    if (refundAmount - remainingOrderAmount > 0.0001) {
      throw new ApiError(400, "Refund vuot qua so tien da thanh toan");
    }

    const refundInsert = await client.query(
      `
        INSERT INTO coffee_chain_db.order_refunds(
          order_id,
          store_id,
          refund_type,
          refund_status,
          reason,
          refund_amount,
          processed_by_user_id
        )
        VALUES ($1,$2,$3,'completed',$4,$5,$6)
        RETURNING id, created_at
      `,
      [
        params.orderId,
        params.storeId,
        params.refundType,
        params.reason.trim(),
        refundAmount,
        params.actorUserId,
      ],
    );

    const refundId = Number(refundInsert.rows[0].id);
    const refundCreatedAt = refundInsert.rows[0].created_at;

    for (const line of refundLines) {
      await client.query(
        `
          INSERT INTO coffee_chain_db.order_refund_items(
            refund_id,
            order_detail_id,
            quantity,
            line_refund_amount
          )
          VALUES ($1,$2,$3,$4)
        `,
        [refundId, line.orderDetailId, line.quantity, line.lineRefundAmount],
      );
    }

    const newRefundedAmount = currentRefundedAmount + refundAmount;
    const nextRefundStatus =
      newRefundedAmount <= 0
        ? "none"
        : newRefundedAmount + 0.0001 >= ctx.order.finalAmount
          ? "full"
          : "partial";

    await client.query(
      `
        UPDATE coffee_chain_db.orders
        SET refunded_amount = $2,
            refund_status = $3,
            last_refunded_at = $4
        WHERE id = $1
      `,
      [params.orderId, newRefundedAmount, nextRefundStatus, refundCreatedAt],
    );

    if (ctx.order.customerId) {
      const beforeNetAmount = Math.max(
        0,
        ctx.order.finalAmount - currentRefundedAmount,
      );
      const afterNetAmount = Math.max(
        0,
        ctx.order.finalAmount - newRefundedAmount,
      );
      const pointsBefore = Math.floor(beforeNetAmount / 1000);
      const pointsAfter = Math.floor(afterNetAmount / 1000);
      const pointDelta = pointsAfter - pointsBefore;

      if (pointDelta !== 0) {
        await applyCustomerPointsDelta(client, ctx.order.customerId, pointDelta);

        await client.query(
          `
            INSERT INTO coffee_chain_db.customer_point_transactions(
              customer_id,
              order_id,
              points_change,
              reason
            )
            VALUES ($1,$2,$3,$4)
          `,
          [
            ctx.order.customerId,
            params.orderId,
            pointDelta,
            `Refund order ${ctx.order.orderCode}`,
          ],
        );
      }
    }

    await appendSystemAuditLog(client, {
      userId: params.actorUserId,
      actionType: "ORDER_REFUND_CREATED",
      targetTable: "order_refunds",
      targetId: refundId,
      oldValue: {
        orderId: ctx.order.id,
        orderCode: ctx.order.orderCode,
        refundedAmount: currentRefundedAmount,
        refundStatus: ctx.order.refundStatus,
      },
      newValue: {
        refundId,
        refundType: params.refundType,
        refundAmount,
        refundStatus: nextRefundStatus,
        reason: params.reason.trim(),
        items: refundLines,
      },
    });

    await client.query("COMMIT");

    await safeWritePosActionLog({
      storeId: params.storeId,
      actorUserId: params.actorUserId,
      actionType: "ORDER_REFUND",
      entityType: "ORDER_REFUND",
      entityId: refundId,
      orderId: ctx.order.id,
      orderCode: ctx.order.orderCode,
      memberId: ctx.order.customerId ?? null,
      pickupNumber: ctx.order.pickupNumber ?? null,
      note: `Refund don ${params.refundType}`,
      beforeData: {
        refundedAmount: currentRefundedAmount,
        refundStatus: ctx.order.refundStatus,
      },
      afterData: {
        refundId,
        refundType: params.refundType,
        refundAmount,
        refundStatus: nextRefundStatus,
        reason: params.reason.trim(),
      },
      metadata: {
        items: refundLines,
      },
    });

    return {
      ok: true,
      refund: {
        id: refundId,
        orderId: params.orderId,
        refundType: params.refundType,
        refundAmount,
        reason: params.reason.trim(),
        refundStatus: nextRefundStatus,
        createdAt: refundCreatedAt,
        items: refundLines,
      },
      order: {
        id: ctx.order.id,
        orderCode: ctx.order.orderCode,
        status: ctx.order.status,
        refundedAmount: newRefundedAmount,
        refundStatus: nextRefundStatus,
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listPosAvailablePromotions(params: {
  storeId: number;
  customerId?: number;
  items: DirectItemInput[];
  combos?: FixedComboInput[];
  appliedComboRules?: AppliedComboRuleInput[];
}) {
  const hasCombo =
    (params.combos || []).length > 0 ||
    (params.appliedComboRules || []).length > 0;

  if (hasCombo) {
    return {
      ok: true,
      promotions: [],
      pricingBase: {
        subtotalAmount: 0,
        directTotalAmount: 0,
        fixedComboTotalAmount: 0,
        ruleComboTotalAmount: 0,
      },
      reason:
        "Don hang dang su dung combo nen khong ho tro promotion order/voucher song song",
    };
  }

  const client = await pool.connect();
  try {
    const base = await buildBasePricing(client, {
      items: params.items || [],
      combos: params.combos || [],
      appliedComboRules: params.appliedComboRules || [],
    });

    const promoR = await client.query(
      `
        SELECT
          pc.id,
          pc.code,
          pc.name,
          pc.description,
          pc.promotion_type,
          pc.discount_amount,
          pc.discount_percent,
          pc.max_discount_amount,
          pc.min_order_amount,
          pc.allow_with_voucher,
          pc.requires_gift_selection,
          pc.start_at,
          pc.end_at,
          pc.is_active,
          pc.is_all_stores,
          EXISTS(
            SELECT 1
            FROM coffee_chain_db.promotion_campaign_stores pcs
            WHERE pcs.campaign_id = pc.id
              AND pcs.store_id = $1
          ) AS matched_store,
          EXISTS(
            SELECT 1
            FROM coffee_chain_db.promotion_campaign_excluded_stores pce
            WHERE pce.campaign_id = pc.id
              AND pce.store_id = $1
          ) AS excluded_store,
          EXISTS(
            SELECT 1
            FROM coffee_chain_db.promotion_campaign_customer_levels pcl
            WHERE pcl.campaign_id = pc.id
          ) AS has_level_scope
        FROM coffee_chain_db.promotion_campaigns pc
        WHERE pc.deleted_at IS NULL
          AND pc.is_active = TRUE
        ORDER BY pc.start_at DESC, pc.id DESC
      `,
      [params.storeId],
    );

    let customerLevel: string | null = null;
    if (params.customerId) {
      const cR = await client.query(
        `SELECT COALESCE(points, 0)::int AS points, level FROM coffee_chain_db.customers WHERE id = $1 LIMIT 1`,
        [params.customerId],
      );
      if (cR.rows[0]) {
        customerLevel = resolveStoredCustomerLevel(
          cR.rows[0].level,
          Number(cR.rows[0].points ?? 0),
        );
      }
    }

    const promotions = [];

    for (const row of promoR.rows) {
      let eligible = true;
      let reason: string | null = null;

      const now = Date.now();
      const startAtMs = new Date(row.start_at).getTime();
      const endAtMs = new Date(row.end_at).getTime();

      if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) {
        eligible = false;
        reason = "Promotion time invalid";
      } else if (now < startAtMs) {
        eligible = false;
        reason = "Chua den thoi gian ap dung";
      } else if (now > endAtMs) {
        eligible = false;
        reason = "Da het han";
      } else if (!row.is_all_stores && !row.matched_store) {
        eligible = false;
        reason = "Khong ap dung tai cua hang nay";
      } else if (row.is_all_stores && row.excluded_store) {
        eligible = false;
        reason = "Khong ap dung tai cua hang nay";
      }

      const minOrderAmount = Number(row.min_order_amount || 0);
      if (eligible && base.subtotalAmount < minOrderAmount) {
        eligible = false;
        reason = `Chua dat don toi thieu ${minOrderAmount}`;
      }

      if (eligible && row.has_level_scope) {
        if (!params.customerId || !customerLevel) {
          eligible = false;
          reason = "Yeu cau khach hang dung hang";
        } else {
          const lvR = await client.query(
            `
              SELECT 1
              FROM coffee_chain_db.promotion_campaign_customer_levels
              WHERE campaign_id = $1
                AND LOWER(customer_level) = $2
              LIMIT 1
            `,
            [row.id, customerLevel],
          );
          if (!lvR.rows[0]) {
            eligible = false;
            reason = "Khach hang khong thuoc doi tuong ap dung";
          }
        }
      }

      const promotionLike: PromotionValidationResult = {
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        promotionType: String(row.promotion_type),
        discountAmount:
          row.discount_amount != null ? Number(row.discount_amount) : null,
        discountPercent:
          row.discount_percent != null ? Number(row.discount_percent) : null,
        maxDiscountAmount:
          row.max_discount_amount != null
            ? Number(row.max_discount_amount)
            : null,
        minOrderAmount,
        allowWithVoucher: Boolean(row.allow_with_voucher),
        requiresGiftSelection: Boolean(row.requires_gift_selection),
        startAt: row.start_at,
        endAt: row.end_at,
        rule: null,
      };

      let estimatedDiscountAmount = 0;
      if (eligible) {
        estimatedDiscountAmount = calculatePromotionDiscount(
          base.subtotalAmount,
          promotionLike,
        );
      }

      promotions.push({
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        description: row.description ?? null,
        promotionType: String(row.promotion_type),
        discountPercent:
          row.discount_percent != null ? Number(row.discount_percent) : null,
        discountAmount:
          row.discount_amount != null ? Number(row.discount_amount) : null,
        maxDiscountAmount:
          row.max_discount_amount != null
            ? Number(row.max_discount_amount)
            : null,
        minOrderAmount,
        allowWithVoucher: Boolean(row.allow_with_voucher),
        requiresGiftSelection: Boolean(row.requires_gift_selection),
        startAt: row.start_at,
        endAt: row.end_at,
        eligible,
        reason,
        estimatedDiscountAmount,
      });
    }

    return {
      ok: true,
      pricingBase: {
        subtotalAmount: base.subtotalAmount,
        directTotalAmount: base.directTotalAmount,
        fixedComboTotalAmount: base.fixedComboTotalAmount,
        ruleComboTotalAmount: base.ruleComboTotalAmount,
      },
      promotions,
    };
  } finally {
    client.release();
  }
}

export async function getPublicPickupBoard(params: {
  storeId: number;
  limit?: number;
}) {
  const rows = await listPickupBoardOrdersByStore(params);

  const items = rows.map((row) => ({
    orderId: Number(row.id),
    orderCode: String(row.order_code),
    pickupNumber: row.pickup_number != null ? Number(row.pickup_number) : null,
    status: String(row.status),
    createdAt: row.created_at ?? null,
    completedAt: row.completed_at ?? null,
  }));

  return {
    ok: true,
    storeId: params.storeId,
    preparing: items.filter((x) => x.status === "paid"),
    ready: items.filter((x) => x.status === "completed"),
    generatedAt: new Date().toISOString(),
  };
}
