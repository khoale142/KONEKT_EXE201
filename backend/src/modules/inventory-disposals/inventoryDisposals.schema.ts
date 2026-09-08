import { z } from "zod";

export const disposalReportTypeSchema = z.enum(["ingredient", "finished_product"]);
export const disposalPhysicalStateSchema = z.enum(["already_disposed", "quarantined"]);
export const disposalReasonCodeSchema = z.enum([
  "wrong_item",
  "wrong_recipe",
  "overproduction",
  "damaged",
  "spoilage",
  "expired",
  "customer_remake",
  "contamination",
  "other",
]);

export const disposalReportStatusSchema = z.enum([
  "submitted",
  "under_sm_review",
    "verified_by_sm",
  "included_in_disposal_order",
  "duplicate_closed",
  "released_back_to_stock",
  "cancelled_by_sm",
  "finalized",
]);

export const disposalOrderStatusSchema = z.enum([
  "draft",
  "submitted_to_dm",
  "returned_to_sm",
  "approved",
  "cancelled",
]);

const disposalReportLineSchema = z
  .object({
    ingredientId: z.number().int().positive().optional(),
    productVariantId: z.number().int().positive().optional(),
    unitName: z.string().trim().min(1).max(50).optional(),
    quantityReported: z.coerce.number().positive(),
    estimatedCost: z.coerce.number().min(0).optional(),
    note: z.string().trim().max(1000).optional(),
    evidenceUrls: z.array(z.string().trim().max(1000)).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    const hasIngredient = !!data.ingredientId;
    const hasVariant = !!data.productVariantId;

    if ((hasIngredient ? 1 : 0) + (hasVariant ? 1 : 0) !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mỗi line phải chọn đúng 1 loại: ingredient hoặc product variant",
        path: ["ingredientId"],
      });
    }
  });

export const createDisposalReportSchema = z
  .object({
    reportType: disposalReportTypeSchema,
    physicalState: disposalPhysicalStateSchema,
    reasonCode: disposalReasonCodeSchema,
    relatedOrderId: z.number().int().positive().optional(),
    description: z.string().trim().max(2000).optional(),
    lines: z.array(disposalReportLineSchema).min(1).max(100),
  })
  .superRefine((data, ctx) => {
    data.lines.forEach((line, index) => {
      if (data.reportType === "ingredient" && !line.ingredientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Report ingredient chỉ được chọn ingredient",
          path: ["lines", index, "ingredientId"],
        });
      }

      if (data.reportType === "ingredient" && line.productVariantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Report ingredient không được chọn product variant",
          path: ["lines", index, "productVariantId"],
        });
      }

      if (data.reportType === "finished_product" && !line.productVariantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Report finished product phải chọn product variant",
          path: ["lines", index, "productVariantId"],
        });
      }

      if (data.reportType === "finished_product" && line.ingredientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Report finished product không được chọn ingredient",
          path: ["lines", index, "ingredientId"],
        });
      }
    });
  });

export const listDisposalReportsQuerySchema = z.object({
  status: disposalReportStatusSchema.optional(),
  reasonCode: disposalReasonCodeSchema.optional(),
  reportType: disposalReportTypeSchema.optional(),
  physicalState: disposalPhysicalStateSchema.optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const cancelDisposalReportSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const markDuplicateDisposalReportSchema = z.object({
  duplicateOfReportId: z.number().int().positive(),
  note: z.string().trim().max(1000).optional(),
});

export const releaseBackToStockSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const createDisposalOrderSchema = z.object({
  reportIds: z.array(z.number().int().positive()).min(1).max(100),
});

export const listDisposalOrdersQuerySchema = z.object({
  status: disposalOrderStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const approveDisposalOrderSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const returnDisposalOrderSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

export const cancelDisposalOrderSchema = z.object({
  note: z.string().trim().min(3).max(1000),
});