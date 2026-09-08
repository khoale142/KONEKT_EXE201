import "dotenv/config";

export const env = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  /** Base URL cho file tĩnh (avatar, documents). FE dùng trực tiếp làm img src. */
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev_access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev_refresh",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "",

  // VietQR Quick Link (img.vietqr.io) - QR ảnh trực tiếp, staff xác nhận thủ công
  VIETQR_BANK_ACCOUNT: process.env.VIETQR_BANK_ACCOUNT || "",
  VIETQR_BANK_CODE: process.env.VIETQR_BANK_CODE || "",
  VIETQR_USER_BANK_NAME: process.env.VIETQR_USER_BANK_NAME || "",
  VIETQR_QUICKLINK_TEMPLATE: process.env.VIETQR_QUICKLINK_TEMPLATE || "compact2",
  CASSO_API_KEY: process.env.CASSO_API_KEY || "",
  CASSO_BANK_ACC_ID: process.env.CASSO_BANK_ACC_ID || "",
  CASSO_WEBHOOK_SECURE_TOKEN: process.env.CASSO_WEBHOOK_SECURE_TOKEN || "",
  CASSO_SYNC_INTERVAL_MS: Number(process.env.CASSO_SYNC_INTERVAL_MS || 60000),

  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

  CHECKIN_BASE_POINTS: Math.max(0, Number(process.env.CHECKIN_BASE_POINTS || 5)),
  CHECKIN_STREAK_EXTRA_PER_DAY: Math.max(0, Number(process.env.CHECKIN_STREAK_EXTRA_PER_DAY || 2)),
  CHECKIN_STREAK_EXTRA_MAX: Math.max(0, Number(process.env.CHECKIN_STREAK_EXTRA_MAX || 24)),
};

if (!env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in .env");
}
