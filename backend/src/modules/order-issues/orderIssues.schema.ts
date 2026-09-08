import { z } from "zod";

export const orderIssueTypeValues = [
  "missing_item",
  "wrong_item",
  "damaged_item",
  "quality_issue",
  "long_wait",
  "other",
] as const;

export const orderIssueStatusValues = [
  "open",
  "in_progress",
  "resolved",
  "rejected",
  "cancelled",
] as const;

export const orderIssueTypeSchema = z.enum(orderIssueTypeValues);
export const orderIssueStatusSchema = z.enum(orderIssueStatusValues);

export const customerCreateOrderIssueSchema = z.object({
  issueType: orderIssueTypeSchema,
  description: z.string().trim().min(10).max(1000),
});

export const customerListOrderIssuesQuerySchema = z.object({
  status: orderIssueStatusSchema.optional(),
  issueType: orderIssueTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const posListOrderIssuesQuerySchema = z.object({
  status: orderIssueStatusSchema.optional(),
  issueType: orderIssueTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
  orderCode: z.string().trim().max(50).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const posUpdateOrderIssueSchema = z.object({
  status: z.enum(["in_progress", "resolved", "rejected"]),
  internalNote: z.string().trim().max(1000).optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
});
