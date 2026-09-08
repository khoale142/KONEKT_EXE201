import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
