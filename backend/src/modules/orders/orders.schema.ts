import { z } from "zod";

const orderItemSchema = z.object({
  productVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  note: z.string().max(300).optional(),
});

const selectedGiftItemSchema = z.object({
  productVariantId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(255).optional(),
});

const orderComboSchema = z.object({
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
      }),
    )
    .min(1),
});

const orderTypeSchema = z.enum([
  "NORMAL",
  "TEST",
  "FREE",
  "INTERNAL",
  "GUEST",
  "COMPENSATION",
]);

const serviceModeSchema = z.enum(["TAKE_AWAY", "IN_STORE"]);

function isSpecialOrderType(orderType?: string) {
  return !!orderType && orderType !== "NORMAL";
}

function refineVoucherVsCombo(
  data: {
    customerId?: number;
    voucherCode?: string;
    promotionCode?: string;
    orderType?:
      | "NORMAL"
      | "TEST"
      | "FREE"
      | "INTERNAL"
      | "GUEST"
      | "COMPENSATION";
    specialNote?: string;
    selectedGiftItems?: Array<{
      productVariantId: number;
      quantity: number;
      note?: string;
    }>;
    combos?: Array<{ comboId: number; quantity: number }>;
    appliedComboRules?: Array<{
      comboRuleId: number;
      selectedItems: Array<{ productVariantId: number; quantity: number }>;
    }>;
    items?: Array<{
      productVariantId: number;
      quantity: number;
      note?: string;
    }>;
  },
  ctx: z.RefinementCtx,
) {
  const hasItems = (data.items || []).length > 0;
  const hasCombos = (data.combos || []).length > 0;
  const hasAppliedComboRules = (data.appliedComboRules || []).length > 0;
  const voucherCode = (data.voucherCode || "").trim();
  const promotionCode = (data.promotionCode || "").trim();

  if (!hasItems && !hasCombos) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Phai co it nhat 1 mon hoac 1 combo",
      path: ["items"],
    });
  }

  if (voucherCode && promotionCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Moi don chi duoc dung 1 voucher hoac 1 promotion",
      path: ["promotionCode"],
    });
  }

  if ((voucherCode || promotionCode) && (hasCombos || hasAppliedComboRules)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Don hang dung voucher/promotion thi khong duoc ap dung combo",
      path: ["voucherCode"],
    });
  }

  const orderType = data.orderType || "NORMAL";
  const specialNote = (data.specialNote || "").trim();

  if (isSpecialOrderType(orderType) && !specialNote) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Don dac biet bat buoc nhap ly do / ghi chu",
      path: ["specialNote"],
    });
  }

  if (
    isSpecialOrderType(orderType) &&
    (data.voucherCode || data.promotionCode)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Don dac biet khong duoc ap voucher/promotion",
      path: ["orderType"],
    });
  }
}

export const createPosOrderSchema = z
  .object({
    pickupNumber: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    orderType: orderTypeSchema.default("NORMAL"),
    specialNote: z.string().trim().max(500).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(orderComboSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
    serviceMode: serviceModeSchema.default("IN_STORE"),
    payment: z.object({
      method: z.enum(["cash", "transfer", "card", "gateway"]),
      amount: z.number().nonnegative().optional(),
      referenceCode: z.string().max(80).optional(),
    }),
  })
  .superRefine(refineVoucherVsCombo);

/** Body giống create order, dùng để tạo đơn pending cho thanh toán gateway (VietQR). */
export const createPosOrderForGatewaySchema = z
  .object({
    pickupNumber: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    orderType: orderTypeSchema.default("NORMAL"),
    specialNote: z.string().trim().max(500).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(orderComboSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
    serviceMode: serviceModeSchema.default("IN_STORE"),
    payment: z.object({ method: z.literal("gateway") }),
  })
  .superRefine(refineVoucherVsCombo);

export const holdPosOrderSchema = z
  .object({
    pickupNumber: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    orderType: orderTypeSchema.default("NORMAL"),
    specialNote: z.string().trim().max(500).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(orderComboSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
    snapshot: z.any().optional(),
    serviceMode: serviceModeSchema.default("IN_STORE"),
  })
  .superRefine(refineVoucherVsCombo);

export const previewPosOrderPricingSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    voucherCode: z.string().trim().max(50).optional(),
    promotionCode: z.string().trim().max(50).optional(),
    orderType: orderTypeSchema.default("NORMAL"),
    specialNote: z.string().trim().max(500).optional(),
    selectedGiftItems: z.array(selectedGiftItemSchema).default([]),
    items: z.array(orderItemSchema).default([]),
    combos: z.array(orderComboSchema).default([]),
    appliedComboRules: z.array(appliedComboRuleSchema).default([]),
  })
  .superRefine(refineVoucherVsCombo);

export const listAvailablePromotionsSchema = z.object({
  customerId: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .default([]),
  combos: z
    .array(
      z.object({
        comboId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .default([]),
  appliedComboRules: z.array(appliedComboRuleSchema).default([]),
});

export const payHeldOrderSchema = z.object({
  orderType: orderTypeSchema.optional(),
  specialNote: z.string().trim().max(500).optional(),
  serviceMode: serviceModeSchema.optional(),
  payment: z.object({
    method: z.enum(["cash", "transfer", "card", "gateway"]),
    amount: z.number().nonnegative().optional(),
    referenceCode: z.string().max(80).optional(),
  }),
});

export const createVoidRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const getOrdersQuerySchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.string().optional(),
  orderType: orderTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listOnlinePendingOrdersQuerySchema = z.object({
  orderCode: z.string().trim().max(50).optional(),
  memberPhone: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const confirmOnlineOrderSchema = z.object({
  pickupNumber: z.coerce.number().int().positive(),
  serviceMode: serviceModeSchema.default("IN_STORE"),
});

export const listHeldOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listVoidRequestsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listPaidOrdersQuerySchema = z.object({
  orderCode: z.string().trim().max(50).optional(),
  pickupNumber: z.coerce.number().int().positive().optional(),
  memberPhone: z.string().trim().max(20).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  refundStatus: z.enum(["none", "partial", "full"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const refundOrderSchema = z
  .object({
    refundType: z.enum(["full", "partial"]),
    reason: z.string().trim().min(5).max(500),
    items: z
      .array(
        z.object({
          orderDetailId: z.number().int().positive(),
          quantity: z.number().int().positive(),
        }),
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.refundType === "partial" && data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Refund partial phai chon it nhat 1 mon",
        path: ["items"],
      });
    }

    if (data.refundType === "full" && data.items.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Refund full khong duoc gui danh sach mon",
        path: ["items"],
      });
    }
  });
