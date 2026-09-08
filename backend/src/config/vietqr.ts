import { env } from "./env";

export const vietqrConfig = {
  bankAccount: env.VIETQR_BANK_ACCOUNT,
  bankCode: env.VIETQR_BANK_CODE,
  userBankName: env.VIETQR_USER_BANK_NAME,
  quicklinkTemplate: env.VIETQR_QUICKLINK_TEMPLATE,
};
