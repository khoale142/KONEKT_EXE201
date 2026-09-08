import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const openShiftReconciliationSchema = z.object({
  workDate: z.string().regex(dateRegex, "workDate must be YYYY-MM-DD"),
  shiftCode: z.enum(["A", "B"]),
  openingCashAmount: z.coerce.number().min(0).default(0),
  shiftSessionId: z.coerce.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const verifyShiftCloseSchema = z.object({
  actualCashAmount: z.coerce.number().min(0),
});

export const closeShiftReconciliationSchema = z.object({
  actualCashAmount: z.coerce.number().min(0),
  confirmActualCashAmount: z.coerce.number().min(0),
  confirmText: z.string().trim(),
  note: z.string().trim().max(1000).optional(),
});

export const listShiftReconciliationsQuerySchema = z.object({
  dateFrom: z.string().regex(dateRegex).optional(),
  dateTo: z.string().regex(dateRegex).optional(),
  status: z.enum(["open", "closed"]).optional(),
  shiftCode: z.enum(["A", "B"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});