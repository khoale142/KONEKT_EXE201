import { z } from "zod";

export const listOpsNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const opsNotificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
