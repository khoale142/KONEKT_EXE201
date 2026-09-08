import { z } from "zod";
import { parseShiftTypeLoose } from "../../utils/employmentShiftTypes";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const shiftTypeSchema = z
  .unknown()
  .refine((v) => parseShiftTypeLoose(v) != null, {
    message: "shiftType không hợp lệ (SM | FULL_TIME | PART_TIME hoặc full_time/part_time)",
  })
  .transform((v) => parseShiftTypeLoose(v) as "SM" | "FULL_TIME" | "PART_TIME");

export const upsertScheduleSchema = z.object({
  storeId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  workDate: z.string().regex(dateRegex, "workDate must be YYYY-MM-DD"),
  shiftType: shiftTypeSchema,
  shiftId: z.coerce.number().int().positive().optional(),
  shiftLabel: z.string().trim().max(100).optional(),
  startTime: z.string().regex(timeRegex, "startTime must be HH:mm").optional(),
  endTime: z.string().regex(timeRegex, "endTime must be HH:mm").optional(),
  note: z.string().trim().max(1000).optional(),
});

export const upsertSchedulesBatchSchema = z.object({
  storeId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  shiftType: shiftTypeSchema,
  schedules: z
    .array(
      z.object({
        workDate: z.string().regex(dateRegex, "workDate must be YYYY-MM-DD"),
        shiftId: z.coerce.number().int().positive().optional(),
        startTime: z.string().regex(timeRegex, "startTime must be HH:mm").optional(),
        endTime: z.string().regex(timeRegex, "endTime must be HH:mm").optional(),
      })
    )
    .min(1, "schedules required"),
  note: z.string().trim().max(1000).optional(),
});

export const updateScheduleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateScheduleBodySchema = z.object({
  shiftId: z.coerce.number().int().positive().optional(),
  startTime: z.string().regex(timeRegex, "startTime must be HH:mm").optional(),
  endTime: z.string().regex(timeRegex, "endTime must be HH:mm").optional(),
  note: z.string().trim().max(1000).optional(),
});

export const listMyScheduleQuerySchema = z.object({
  dateFrom: z.string().regex(dateRegex).optional(),
  dateTo: z.string().regex(dateRegex).optional(),
});

export const listStoreScheduleQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  dateFrom: z.string().regex(dateRegex).optional(),
  dateTo: z.string().regex(dateRegex).optional(),
});

export const listScheduleAuditLogsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  workDate: z.string().regex(dateRegex, "workDate must be YYYY-MM-DD"),
});

export const checkInSchema = z.object({
  note: z.string().trim().max(500).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
});

export const checkOutSchema = z.object({
  note: z.string().trim().max(500).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
});

export const listStoreAttendanceQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  dateFrom: z.string().regex(dateRegex).optional(),
  dateTo: z.string().regex(dateRegex).optional(),
});

export const storeDashboardInsightsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  /** Số ngày lùi từ hôm nay (1–14), mặc định 7 */
  windowDays: z.coerce.number().int().min(1).max(14).optional(),
});

export const deleteScheduleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const scheduleChangeRequestSchema = z.object({
  storeId: z.coerce.number().int().positive(),
  scheduleIds: z.array(z.coerce.number().int().positive()).min(1),
  reason: z.string().trim().max(2000).optional(),
  detail: z.unknown().optional(),
});

export const createMyShiftChangeRequestSchema = z.object({
  storeId: z.coerce.number().int().positive(),
  scheduleId: z.coerce.number().int().positive(),
  requestType: z.enum(["DROP_SHIFT", "CHANGE_TIME", "CHANGE_SHIFT"]),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(2000),
  desiredWorkDate: z.string().regex(dateRegex).optional(),
  desiredShiftId: z.coerce.number().int().positive().optional(),
  desiredShiftLabel: z.string().trim().max(120).optional(),
  desiredStartTime: z.string().regex(timeRegex).optional(),
  desiredEndTime: z.string().regex(timeRegex).optional(),
});
