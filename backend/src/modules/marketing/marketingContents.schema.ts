import { z } from "zod";

export const marketingContentTypeValues = [
  "NEWS",
  "NEW_PRODUCT",
  "NEW_STORE",
  "TRENDING",
  "PROMOTION",
  "VOUCHER",
  "CAMPAIGN",
  "EVENT",
  "ANNOUNCEMENT",
] as const;

export const marketingContentStatusValues = [
  "draft",
  "published",
  "archived",
] as const;

export const marketingContentTargetTypeValues = [
  "NONE",
  "PROMOTION",
  "VOUCHER",
  "PRODUCT",
  "STORE",
] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dateTimeLikeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

const dateTimeLikeSchema = z
  .string()
  .trim()
  .refine((value) => dateTimeLikeRegex.test(value), "Thời gian không hợp lệ");

const marketingContentTypeSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().min(1, "Vui lòng chọn loại nội dung"),
  )
  .refine(
    (value): value is (typeof marketingContentTypeValues)[number] =>
      marketingContentTypeValues.includes(value as (typeof marketingContentTypeValues)[number]),
    "Vui lòng chọn loại nội dung",
  );

const marketingContentStatusSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().min(1, "Vui lòng chọn trạng thái"),
  )
  .refine(
    (value): value is (typeof marketingContentStatusValues)[number] =>
      marketingContentStatusValues.includes(
        value as (typeof marketingContentStatusValues)[number],
      ),
    "Vui lòng chọn trạng thái",
  );

const optionalUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value.length === 0 ||
      value.startsWith("/") ||
      value.startsWith("http://") ||
      value.startsWith("https://"),
    "URL phải là đường dẫn nội bộ bắt đầu bằng / hoặc URL đầy đủ",
  )
  .optional()
  .nullable();

const optionalDateTimeSchema = dateTimeLikeSchema.optional().nullable();

function requiredDateTimeSchema(requiredMessage: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z
      .string()
      .min(1, requiredMessage)
      .refine((value) => dateTimeLikeRegex.test(value), "Thời gian không hợp lệ"),
  );
}

function requiredHttpUrlSchema(requiredMessage: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z
      .string()
      .min(1, requiredMessage)
      .max(500)
      .refine(
        (value) =>
          value.startsWith("/") ||
          value.startsWith("http://") ||
          value.startsWith("https://"),
        "URL phải là đường dẫn nội bộ bắt đầu bằng / hoặc URL đầy đủ",
      ),
  );
}

const stringArraySchema = z
  .array(z.string().trim().min(1).max(255))
  .max(20)
  .default([]);

export const marketingContentBodySchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(255),
    slug: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập slug")
      .max(255)
      .regex(slugRegex, "Slug chỉ được gồm chữ thường, số và dấu gạch ngang"),
    summary: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z.string().min(1, "Vui lòng nhập mô tả ngắn").max(600),
    ),
    content: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z.string().min(1, "Vui lòng nhập nội dung chi tiết").max(100_000),
    ),
    coverImageUrl: requiredHttpUrlSchema("Vui lòng tải lên ảnh bìa"),
    galleryImages: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    type: marketingContentTypeSchema,
    status: marketingContentStatusSchema,
    isActive: z.boolean().default(true),
    publishedAt: requiredDateTimeSchema("Vui lòng chọn ngày xuất bản"),
    displayStartAt: requiredDateTimeSchema("Vui lòng chọn ngày bắt đầu hiển thị"),
    displayEndAt: requiredDateTimeSchema("Vui lòng chọn ngày kết thúc hiển thị"),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    targetType: z.enum(marketingContentTargetTypeValues).default("NONE"),
    targetRefId: z.number().int().positive().optional().nullable(),
    badgeLabel: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z.string().min(1, "Vui lòng nhập nhãn badge").max(50),
    ),
    ctaLabel: z.string().trim().max(100).optional().nullable(),
    ctaUrl: optionalUrlSchema,
    tags: stringArraySchema,
  })
  .superRefine((data, ctx) => {
    if (data.displayStartAt && data.displayEndAt) {
      const startAt = new Date(data.displayStartAt);
      const endAt = new Date(data.displayEndAt);
      if (endAt.getTime() < startAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ngày kết thúc hiển thị phải sau hoặc bằng ngày bắt đầu hiển thị",
          path: ["displayEndAt"],
        });
      }
    }

    if (data.targetType !== "NONE" && !data.targetRefId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID liên kết là bắt buộc khi loại liên kết khác NONE",
        path: ["targetRefId"],
      });
    }

    if (data.targetType === "NONE" && data.targetRefId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID liên kết phải để trống khi loại liên kết là NONE",
        path: ["targetRefId"],
      });
    }
  });

export const marketingContentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const marketingContentSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(255),
});

export const marketingContentAdminListQuerySchema = z.object({
  keyword: z.string().trim().max(255).optional(),
  type: z.enum(marketingContentTypeValues).optional(),
  status: z.enum(marketingContentStatusValues).optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  dateFrom: dateTimeLikeSchema.optional(),
  dateTo: dateTimeLikeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sortBy: z
    .enum(["createdAt", "updatedAt", "publishedAt", "title", "viewCount", "sortOrder"])
    .default("updatedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const marketingContentPublicListQuerySchema = z.object({
  keyword: z.string().trim().max(255).optional(),
  type: z.enum(marketingContentTypeValues).optional(),
  featuredOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(24).default(9),
  page: z.coerce.number().int().min(1).default(1),
});

export const marketingContentHomeQuerySchema = z.object({
  featuredLimit: z.coerce.number().int().min(1).max(12).default(4),
  latestLimit: z.coerce.number().int().min(1).max(12).default(6),
  sectionLimit: z.coerce.number().int().min(1).max(12).default(4),
});

export const marketingContentStatusBodySchema = z.object({
  status: z.enum(marketingContentStatusValues),
  publishedAt: optionalDateTimeSchema,
});

export const marketingContentToggleActiveBodySchema = z.object({
  isActive: z.boolean(),
});

export const marketingContentFeatureBodySchema = z.object({
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export type MarketingContentBodyInput = z.infer<typeof marketingContentBodySchema>;
export type MarketingContentAdminListQueryInput = z.infer<
  typeof marketingContentAdminListQuerySchema
>;
export type MarketingContentPublicListQueryInput = z.infer<
  typeof marketingContentPublicListQuerySchema
>;
