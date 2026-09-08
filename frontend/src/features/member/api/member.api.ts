import api from "../../../lib/http/axios";

export type CustomerPromotion = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  benefitType: "DISCOUNT" | "GIFT";
  promotionType: string;
  discountPercent?: number | null;
  discountAmount?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  startAt: string;
  endAt: string;
  bannerTitle?: string | null;
  bannerImageUrl?: string | null;
  bannerContent?: string | null;
  requiresGiftSelection?: boolean;
  ruleSummary?: {
    ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";
    triggerQty: number;
    triggerSize?: string | null;
    rewardQty: number;
    rewardSize?: string | null;
    triggerCategoryName?: string | null;
    rewardCategoryName?: string | null;
  } | null;
};

export type VoucherRewardDef = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  benefitType: "DISCOUNT" | "GIFT";
  rewardType?: "FIXED" | "PERCENT" | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  validDays?: number | null;
  fixedStartAt?: string | null;
  fixedEndAt?: string | null;
  totalQuantity?: number | null;
  redeemedQuantity: number;
  bannerTitle?: string | null;
  bannerImageUrl?: string | null;
  bannerContent?: string | null;
  requiresGiftSelection?: boolean;
  ruleSummary?: {
    ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";
    triggerQty: number;
    triggerSize?: string | null;
    rewardQty: number;
    rewardSize?: string | null;
    triggerCategoryName?: string | null;
    rewardCategoryName?: string | null;
  } | null;
};

export type CustomerVoucher = {
  id: number;
  voucherCode: string;
  status: string;
  effectiveStatus?: "ISSUED" | "ISSUED_NOT_READY" | "USED" | "EXPIRED" | "CANCELLED";
  isUsableNow?: boolean;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  usedAt?: string | null;
  usedOrderId?: number | null;
  reward: {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    benefitType: "DISCOUNT" | "GIFT";
    rewardType?: "FIXED" | "PERCENT" | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    maxDiscountAmount?: number | null;
    minOrderAmount: number;
    requiresGiftSelection?: boolean;
    ruleSummary?: {
      ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";
      triggerQty: number;
      triggerSize?: string | null;
      rewardQty: number;
      rewardSize?: string | null;
      triggerCategoryName?: string | null;
      rewardCategoryName?: string | null;
    } | null;
  };
};

export const memberApi = {
  getProfile: () => api.get("/auth/customer/me").then((r) => r.data),

  getStores: () =>
    api.get("/stores").then(
      (r) =>
        r.data as {
          stores: Array<{
            id: number;
            name: string;
            address: string;
            latitude: number;
            longitude: number;
          }>;
        }
    ),

  updateProfile: (payload: {
    fullName: string;
    phone: string;
    gender: "male" | "female" | "other";
    birthday: string;
    city: string;
  }) => api.put("/auth/customer/me", payload).then((r) => r.data),

  getPublicPromotions: () =>
    api.get("/promotions/public/campaigns").then(
      (r) =>
        r.data as {
          ok: boolean;
          promotions: CustomerPromotion[];
        }
    ),

  getPublicVoucherRewards: () =>
    api.get("/promotions/public/voucher-rewards").then(
      (r) =>
        r.data as {
          ok: boolean;
          rewards: VoucherRewardDef[];
        }
    ),

  redeemVoucherReward: (payload: { rewardDefId: number }) =>
    api.post("/promotions/me/vouchers/redeem", payload).then(
      (r) =>
        r.data as {
          ok: boolean;
          message: string;
          voucher: {
            id: number;
            voucherCode: string;
            status: string;
            issuedAt: string;
            validFrom: string;
            expiresAt: string;
            reward: {
              id: number;
              code: string;
              name: string;
              description?: string | null;
              pointsCost: number;
              benefitType: "DISCOUNT" | "GIFT";
              rewardType?: "FIXED" | "PERCENT" | null;
              discountPercent?: number | null;
              discountAmount?: number | null;
              maxDiscountAmount?: number | null;
              minOrderAmount: number;
              requiresGiftSelection?: boolean;
              ruleSummary?: {
                ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";
                triggerQty: number;
                triggerSize?: string | null;
                rewardQty: number;
                rewardSize?: string | null;
                triggerCategoryName?: string | null;
                rewardCategoryName?: string | null;
              } | null;
            };
          };
          customer: {
            id: number;
            fullName: string;
            pointsBefore: number;
            pointsAfter: number;
            level: string;
          };
        }
    ),

  getMyVouchers: () =>
    api.get("/promotions/me/vouchers").then(
      (r) =>
        r.data as {
          ok: boolean;
          vouchers: CustomerVoucher[];
        }
    ),

  getMyStamps: () =>
    api.get("/promotions/me/stamps").then(
      (r) =>
        r.data as {
          ok: boolean;
          stamps: {
            totalStampsEarned: number;
            stampsInCurrentCycle: number;
            cycleSize: number;
            untilNextReward: number;
            rewardConfigured: boolean;
          };
        }
    ),

  getMyStampHistory: (params?: { limit?: number }) =>
    api
      .get("/promotions/me/stamps/history", {
        params: params?.limit ? { limit: params.limit } : {},
      })
      .then(
        (r) =>
          r.data as {
            ok: boolean;
            items: Array<{
              stampId: number;
              orderId: number;
              orderCode: string | null;
              storeId: number | null;
              storeName: string | null;
              stampedAt: string;
            }>;
          }
      ),

  getRewardsCheckin: () =>
    api.get("/rewards/me/checkin").then(
      (r) =>
        r.data as {
          ok: boolean;
          checkin: {
            today: string;
            checkedInToday: boolean;
            streak?: number;
            pointsAwarded?: number;
            streakIfCheckInToday?: number;
            pointsPreview?: number;
          };
        }
    ),

  postRewardsCheckin: () =>
    api.post("/rewards/me/checkin").then(
      (r) =>
        r.data as {
          ok: true;
          today: string;
          streak: number;
          pointsAwarded: number;
          pointsBalance: number;
        }
    ),
};
