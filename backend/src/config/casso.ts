import { env } from "./env";

export const cassoConfig = {
  apiKey: env.CASSO_API_KEY,
  bankAccId: env.CASSO_BANK_ACC_ID,
  webhookSecureToken: env.CASSO_WEBHOOK_SECURE_TOKEN,
  syncIntervalMs: env.CASSO_SYNC_INTERVAL_MS,
};
