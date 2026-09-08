import { z } from "zod";

export const createVietqrPaymentSchema = z.object({
  orderId: z.number().int().positive(),
});

export type CreateVietqrPaymentInput = z.infer<typeof createVietqrPaymentSchema>;
