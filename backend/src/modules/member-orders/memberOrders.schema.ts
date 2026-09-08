import { z } from "zod";

const orderItemSchema = z.object({
  productVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  note: z.string().max(300).optional(),
});

const comboItemSchema = z.object({
  comboId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const appliedComboRuleSchema = z.object({
  comboRuleId: z.number().int().positive(),
  selectedItems: z
    .array(
      z.object({
        productVariantId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

const selectedGiftItemSchema = z.object({
  productVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(255).optional(),
});

function refineMemberVoucherVsPromotion(data: any, ctx: z.RefinementCtx) {
  const voucherCode = (data.voucherCode || "").trim();
  const promotionCode = (data.promotionCode || "").trim();

  if (voucherCode && promotionCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Moi don chi duoc dung 1 voucher hoac 1 promotion",
      path: ["promotionCode"],
    });
  }

  const combos = Array.isArray(data.combos) ? data.combos : [];
  const appliedComboRules = Array.isArray(data.appliedComboRules) ? data.appliedComboRules : [];
  if ((voucherCode || promotionCode) && (combos.length > 0 || appliedComboRules.length > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Don hang dung voucher/promotion thi khong duoc ap dung combo",
      path: ["voucherCode"],
    });
  }
}

export const memberPreviewPricingSchema = z
  .object({
    storeId: z.number().int().positive(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(comboItemSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
  })
  .passthrough()
  .superRefine(refineMemberVoucherVsPromotion);

export const memberCreateOrderSchema = z
  .object({
    storeId: z.number().int().positive(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(comboItemSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
    paymentReferenceCode: z.string().trim().max(100).optional(),
  })
  .passthrough()
  .superRefine(refineMemberVoucherVsPromotion);

export const memberListOrdersQuerySchema = z.object({
  status: z.enum(["all", "pending", "paid", "completed", "voided", "refunded"]).optional(),
  storeId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const memberOrderReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  serviceRating: z.number().int().min(1).max(5),
  foodRating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

const optionalPickupDelayTimeSchema = z.union([z.string().trim().max(60), z.null()]).optional();

export const memberPickupPostponeBodySchema = z.object({
  reason: z.string().trim().min(5, "Vui lòng nhập lý do ít nhất 5 ký tự").max(2000),
  expectedArrivalAt: optionalPickupDelayTimeSchema,
  expectedPickupVisitAt: optionalPickupDelayTimeSchema,
  requestedPickupTime: optionalPickupDelayTimeSchema,
});
