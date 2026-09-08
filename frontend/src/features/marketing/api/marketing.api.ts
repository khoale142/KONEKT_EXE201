import api from "../../../lib/http/axios";
import type { Complaint, StoreSM } from "../../head-officer/api/head-officer.api";
import type {
  MarketingContentBase,
  MarketingContentListResponse,
  MarketingContentStatus,
  MarketingContentTargetType,
  MarketingContentType,
  PublicMarketingContent,
  PublicMarketingDetailResponse,
  PublicMarketingHomeResponse,
} from "../types/marketingContent.types.ts";

/* ─── Ticket Enterprise Types ─── */
export type TicketMessage = {
  id: number;
  sender_type: "customer" | "staff";
  sender_id: number | null;
  sender_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

export type TicketLog = {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action_type: string;
  description: string;
  created_at: string;
};

export type TicketDetail = Complaint & {
  assign_intent?: string;
  messages: TicketMessage[];
  timeline: TicketLog[];
};

export type AssignIntentKey = "investigate" | "resolve" | "follow_up" | "escalate";

export type PromotionRuleInput = {
  ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

  triggerCategoryId?: number | null;
  triggerProductIds?: number[];
  triggerVariantIds?: number[];
  triggerSize?: string | null;
  triggerQty: number;

  rewardCategoryId?: number | null;
  rewardProductIds?: number[];
  rewardVariantIds?: number[];
  rewardSize?: string | null;
  rewardQty: number;

  allowCustomerChoice?: boolean;
};

export type MarketingOffer = {
  id: number;
  code: string;
  name: string;
  kind: "PROMOTION" | "VOUCHER_REWARD";
  status: "active" | "inactive" | "expired" | "scheduled";
  isActive: boolean;
  isPublic: boolean;
  startAt?: string | null;
  endAt?: string | null;
  minOrderAmount: number;

  benefitType: "DISCOUNT" | "GIFT";

  discountType: "FIXED" | "PERCENT" | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;

  pointsCost?: number | null;
  stampsRequired?: number | null;
  allowWithVoucher?: boolean | null;
  allowWithPromotion?: boolean | null;
  totalQuantity?: number | null;
  redeemedQuantity?: number | null;
  requiresGiftSelection?: boolean | null;

  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicMarketingHomeOffer = {
  id: number;
  code: string;
  name: string;
  kind: "PROMOTION" | "VOUCHER_REWARD";
  title: string;
  description: string;
  imageUrl: string | null;
  publishedAt: string | null;
  startAt: string | null;
  endAt: string | null;
  to: string;
};

export type MarketingContentPayload = {
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  type: MarketingContentType;
  status: MarketingContentStatus;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  targetType: MarketingContentTargetType;
  targetRefId: number | null;
  badgeLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  displayStartAt: string | null;
  displayEndAt: string | null;
};

/* ─── Menu Management Types ─── */
export type MarketingMenuCategory = {
  id: number;
  name: string;
  description?: string | null;
};

export type MarketingMenuVariant = {
  id: number;
  productId: number;
  sku?: string | null;
  size: string;
  price: number;
  costPrice: number;
  isActive: boolean;
  createdAt?: string | null;
};

export type MarketingMenuListItem = {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  isSoldOut: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  variantCount: number;
  activeVariantCount: number;
  createdAt?: string | null;
};

export type MarketingMenuProductDetail = {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  isSoldOut: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  createdAt?: string | null;
  variants: MarketingMenuVariant[];
};

/* ─── Fixed Combo Management Types ─── */
export type MarketingFixedComboListItem = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  itemCount: number;
  createdAt?: string | null;
};

export type MarketingFixedComboItem = {
  id: number;
  comboId: number;
  productVariantId: number;
  quantity: number;
  isRequired: boolean;
  sku?: string | null;
  size?: string | null;
  variantActive: boolean;
  productId?: number | null;
  productName?: string | null;
  productActive: boolean;
  categoryId?: number | null;
  categoryName?: string | null;
};

export type MarketingFixedComboDetail = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  createdAt?: string | null;
  items: MarketingFixedComboItem[];
};

export type MarketingFixedComboVariantOption = {
  productVariantId: number;
  productId: number;
  productName: string;
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  size: string;
  price: number;
};

/* ─── Combo Rule Management Types ─── */
export type MarketingComboRuleListItem = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  autoApply: boolean;
  groupCount: number;
  createdAt?: string | null;
};

export type MarketingComboRuleGroup = {
  id: number;
  comboRuleId: number;
  groupNo: number;
  groupName?: string | null;
  quantityRequired: number;
  matchType: "category" | "product" | "variant";
  categoryId?: number | null;
  productId?: number | null;
  productVariantId?: number | null;
  requiredSize?: string | null;
  categoryName?: string | null;
  productName?: string | null;
  variantLabel?: string | null;
};

export type MarketingComboRuleDetail = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive: boolean;
  priority: number;
  autoApply: boolean;
  createdAt?: string | null;
  groups: MarketingComboRuleGroup[];
};

export type ComboCategoryLookup = {
  id: number;
  name: string;
};

export type ComboProductLookup = {
  id: number;
  name: string;
  categoryId?: number | null;
  categoryName?: string | null;
};

export type ComboVariantLookup = {
  id: number;
  productId: number;
  productName: string;
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  size?: string | null;
  price: number;
};

export const marketingApi = {
  getOffers: () =>
    api
      .get<{ data: MarketingOffer[] }>("/marketing/offers")
      .then((r) => r.data.data),

  getPublicHomeOffers: (limit = 6) =>
    api
      .get<{ data: PublicMarketingHomeOffer[] }>("/marketing/public/home-offers", {
        params: { limit },
      })
      .then((r) => r.data.data),

  createCampaign: (body: {
    code: string;
    name: string;
    description?: string | null;
    benefitType: "DISCOUNT" | "GIFT";
    promotionType:
      | "ORDER_FIXED"
      | "ORDER_PERCENT"
      | "BUY_X_GET_Y"
      | "GIFT_WITH_PURCHASE";
    discountAmount?: number | null;
    discountPercent?: number | null;
    maxDiscountAmount?: number | null;
    minOrderAmount?: number;
    isAllStores?: boolean;
    storeIds?: number[];
    excludedStoreIds?: number[];
    allowWithVoucher?: boolean;
    startAt: string;
    endAt: string;
    isActive?: boolean;
    isPublic?: boolean;
    bannerTitle?: string | null;
    bannerImageUrl?: string | null;
    bannerContent?: string | null;
    rule?: PromotionRuleInput;
  }) => api.post("/marketing/campaigns", body).then((r) => r.data.data),

  createVoucherReward: (body: {
    code: string;
    name: string;
    description?: string | null;
    benefitType: "DISCOUNT" | "GIFT";
    rewardType?: "FIXED" | "PERCENT";
    discountAmount?: number | null;
    discountPercent?: number | null;
    maxDiscountAmount?: number | null;
    minOrderAmount?: number;
    pointsCost: number;
    stampsRequired?: number | null;
    allowWithPromotion?: boolean;
    validDays?: number | null;
    fixedStartAt?: string | null;
    fixedEndAt?: string | null;
    totalQuantity?: number | null;
    isActive?: boolean;
    isPublic?: boolean;
    isAllStores?: boolean;
    storeIds?: number[];
    excludedStoreIds?: number[];
    bannerTitle?: string | null;
    bannerImageUrl?: string | null;
    bannerContent?: string | null;
    rule?: PromotionRuleInput;
  }) => api.post("/marketing/voucher-rewards", body).then((r) => r.data.data),

  toggleCampaign: (id: number, is_active: boolean) =>
    api.patch(`/marketing/campaigns/${id}/toggle`, { is_active }).then((r) => r.data.data),

  toggleVoucherReward: (id: number, is_active: boolean) =>
    api.patch(`/marketing/voucher-rewards/${id}/toggle`, { is_active }).then((r) => r.data.data),

  switchStampVoucherByCode: (code: string) =>
    api.put("/marketing/stamp-vouchers/code", { code }).then((r) => r.data.data),

  deleteCampaign: (id: number) =>
    api.delete(`/marketing/campaigns/${id}`).then((r) => r.data.data),

  deleteVoucherReward: (id: number) =>
    api.delete(`/marketing/voucher-rewards/${id}`).then((r) => r.data.data),

  // ── Complaints (Helpdesk) ─────────────────────────────────────
  getComplaints: () =>
    api.get<{ data: Complaint[] }>("/marketing/complaints").then((r) => r.data.data),

  getComplaintDetail: (id: number) =>
    api.get<{ data: TicketDetail }>(`/marketing/complaints/${id}`).then((r) => r.data.data),

  updateComplaint: (id: number, body: { priority?: string; customer_reply?: string }) =>
    api.patch<{ data: Complaint }>(`/marketing/complaints/${id}`, body).then((r) => r.data.data),

  assignComplaint: (id: number, body: { sm_id: number; assign_intent?: string; note?: string }) =>
    api
      .patch<{
        data: {
          id: number;
          status: string;
          assigned_to: number;
          assigned_at: string;
          assigned_to_name: string;
          assign_intent?: string;
        };
      }>(`/marketing/complaints/${id}/assign`, body)
      .then((r) => r.data.data),

  closeComplaint: (id: number, body: { resolution_reason: string; internal_note?: string }) =>
    api
      .patch<{ data: { id: number; status: string; closed_at: string } }>(
        `/marketing/complaints/${id}/close`,
        body,
      )
      .then((r) => r.data.data),

  replyToTicket: (id: number, body: { message: string; is_internal: boolean }) =>
    api
      .post<{ data: TicketMessage }>(`/marketing/complaints/${id}/messages`, body)
      .then((r) => r.data.data),

  getStoreManagers: (storeId: number) =>
    api.get<{ data: StoreSM[] }>(`/marketing/stores/${storeId}/managers`).then((r) => r.data.data),

  getAllManagers: () =>
    api.get<{ data: StoreSM[] }>("/marketing/managers").then((r) => r.data.data),

  // ── Marketing Contents ─────────────────────────────────────
  getHomeMarketingContents: (params?: {
    featuredLimit?: number;
    latestLimit?: number;
    sectionLimit?: number;
  }) =>
    api
      .get<{ data: PublicMarketingHomeResponse }>("/marketing/public/home-contents", {
        params,
      })
      .then((r) => r.data.data),

  getPublicMarketingContents: (params?: {
    keyword?: string;
    type?: string;
    featuredOnly?: boolean;
    limit?: number;
    page?: number;
  }) =>
    api
      .get<{ data: MarketingContentListResponse<PublicMarketingContent> }>(
        "/marketing/public/contents",
        { params },
      )
      .then((r) => r.data.data),

  getPublicMarketingContentDetail: (slug: string) =>
    api
      .get<{ data: PublicMarketingDetailResponse }>(`/marketing/public/contents/${slug}`)
      .then((r) => r.data.data),

  adminListMarketingContents: (params?: {
    keyword?: string;
    type?: string;
    status?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) =>
    api
      .get<{ data: MarketingContentListResponse<MarketingContentBase> }>(
        "/marketing/contents",
        { params },
      )
      .then((r) => r.data.data),

  adminGetMarketingContentDetail: (id: number) =>
    api
      .get<{ data: MarketingContentBase }>(`/marketing/contents/${id}`)
      .then((r) => r.data.data),

  adminCreateMarketingContent: (body: MarketingContentPayload) =>
    api.post<{ data: MarketingContentBase }>("/marketing/contents", body).then((r) => r.data.data),

  adminUpdateMarketingContent: (id: number, body: MarketingContentPayload) =>
    api.put<{ data: MarketingContentBase }>(`/marketing/contents/${id}`, body).then((r) => r.data.data),

  adminUpdateMarketingContentStatus: (
    id: number,
    body: { status: string; publishedAt?: string | null },
  ) =>
    api
      .patch<{ data: MarketingContentBase }>(`/marketing/contents/${id}/status`, body)
      .then((r) => r.data.data),

  adminToggleMarketingContentActive: (id: number, isActive: boolean) =>
    api
      .patch<{ data: MarketingContentBase }>(`/marketing/contents/${id}/toggle-active`, {
        isActive,
      })
      .then((r) => r.data.data),

  adminFeatureMarketingContent: (
    id: number,
    body: { isFeatured: boolean; sortOrder: number },
  ) =>
    api
      .patch<{ data: MarketingContentBase }>(`/marketing/contents/${id}/feature`, body)
      .then((r) => r.data.data),

  adminDeleteMarketingContent: (id: number) =>
    api.delete<{ data: { id: number } }>(`/marketing/contents/${id}`).then((r) => r.data.data),

  // ── Menu Management ─────────────────────────────────────
  listMenuCategories: () =>
    api
      .get<{ data: MarketingMenuCategory[] }>("/marketing/menu/categories")
      .then((r) => r.data.data),

  listMenuProducts: (params?: {
    keyword?: string;
    categoryId?: number;
    isActive?: boolean;
    isSoldOut?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{
        data: {
          items: MarketingMenuListItem[];
          pagination: { limit: number; offset: number; total: number };
        };
      }>("/marketing/menu/products", { params })
      .then((r) => r.data.data),

  getMenuProductDetail: (id: number) =>
    api
      .get<{ data: MarketingMenuProductDetail }>(`/marketing/menu/products/${id}`)
      .then((r) => r.data.data),

  updateMenuProduct: (
    id: number,
    body: {
      categoryId?: number | null;
      name?: string;
      imageUrl?: string | null;
      isActive?: boolean;
      isSoldOut?: boolean;
      isNew?: boolean;
      isBestSeller?: boolean;
    },
  ) =>
    api
      .patch<{ data: any }>(`/marketing/menu/products/${id}`, body)
      .then((r) => r.data.data),

  toggleMenuProductActive: (id: number, isActive: boolean) =>
    api
      .patch<{ data: any }>(`/marketing/menu/products/${id}/toggle-active`, { isActive })
      .then((r) => r.data.data),

  toggleMenuProductSoldOut: (id: number, isSoldOut: boolean) =>
    api
      .patch<{ data: any }>(`/marketing/menu/products/${id}/toggle-sold-out`, { isSoldOut })
      .then((r) => r.data.data),

  updateMenuVariant: (
    id: number,
    body: {
      size?: string;
      price?: number;
      isActive?: boolean;
    },
  ) =>
    api
      .patch<{ data: any }>(`/marketing/menu/variants/${id}`, body)
      .then((r) => r.data.data),

  toggleMenuVariantActive: (id: number, isActive: boolean) =>
    api
      .patch<{ data: any }>(`/marketing/menu/variants/${id}/toggle-active`, { isActive })
      .then((r) => r.data.data),

  // ── Fixed Combo Management ─────────────────────────────────────
  listFixedCombos: (params?: {
    keyword?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{
        data: {
          items: MarketingFixedComboListItem[];
          pagination: { limit: number; offset: number; total: number };
        };
      }>("/marketing/menu/combos", { params })
      .then((r) => r.data.data),

  getFixedComboDetail: (id: number) =>
    api
      .get<{ data: MarketingFixedComboDetail }>(`/marketing/menu/combos/${id}`)
      .then((r) => r.data.data),

  listFixedComboVariantLookups: (params?: { keyword?: string; limit?: number }) =>
    api
      .get<{ data: MarketingFixedComboVariantOption[] }>(
        "/marketing/menu/combos/lookups/variants",
        {
          params,
        },
      )
      .then((r) => r.data.data),

  updateFixedCombo: (
    id: number,
    body: {
      code?: string;
      name?: string;
      description?: string | null;
      comboPrice?: number;
      isActive?: boolean;
      priority?: number;
    },
  ) =>
    api
      .patch<{ data: any }>(`/marketing/menu/combos/${id}`, body)
      .then((r) => r.data.data),

  replaceFixedComboItems: (
    id: number,
    body: {
      items: Array<{
        productVariantId: number;
        quantity: number;
        isRequired?: boolean;
      }>;
    },
  ) =>
    api
      .put<{ data: any }>(`/marketing/menu/combos/${id}/items`, body)
      .then((r) => r.data.data),

  // ── Combo Rule Management ─────────────────────────────────────
  listComboRules: (params?: {
    keyword?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{
        data: {
          items: MarketingComboRuleListItem[];
          pagination: { limit: number; offset: number; total: number };
        };
      }>("/marketing/combo-rules", { params })
      .then((r) => r.data.data),

  getComboRuleDetail: (id: number) =>
    api
      .get<{ data: MarketingComboRuleDetail }>(`/marketing/combo-rules/${id}`)
      .then((r) => r.data.data),

  listComboRuleCategories: () =>
    api
      .get<{ data: ComboCategoryLookup[] }>("/marketing/combo-rules/lookups/categories")
      .then((r) => r.data.data),

  listComboRuleProducts: (params?: { keyword?: string; limit?: number }) =>
    api
      .get<{ data: ComboProductLookup[] }>("/marketing/combo-rules/lookups/products", {
        params,
      })
      .then((r) => r.data.data),

  listComboRuleVariants: (params?: { keyword?: string; limit?: number }) =>
    api
      .get<{ data: ComboVariantLookup[] }>("/marketing/combo-rules/lookups/variants", {
        params,
      })
      .then((r) => r.data.data),

  createComboRule: (body: {
    code: string;
    name: string;
    description?: string | null;
    comboPrice: number;
    isActive?: boolean;
    priority?: number;
    autoApply?: boolean;
    groups: Array<{
      groupNo: number;
      groupName?: string | null;
      matchType: "category" | "product" | "variant";
      categoryId?: number | null;
      productId?: number | null;
      productVariantId?: number | null;
      requiredSize?: string | null;
    }>;
  }) =>
    api
      .post<{ data: { id: number } }>("/marketing/combo-rules", body)
      .then((r) => r.data.data),

  updateComboRule: (
    id: number,
    body: {
      code?: string;
      name?: string;
      description?: string | null;
      comboPrice?: number;
      isActive?: boolean;
      priority?: number;
      autoApply?: boolean;
    },
  ) =>
    api
      .patch<{ data: any }>(`/marketing/combo-rules/${id}`, body)
      .then((r) => r.data.data),

  toggleComboRuleActive: (id: number, isActive: boolean) =>
    api
      .patch<{ data: any }>(`/marketing/combo-rules/${id}/toggle-active`, { isActive })
      .then((r) => r.data.data),

  replaceComboRuleGroups: (
    id: number,
    body: {
      groups: Array<{
        groupNo: number;
        groupName?: string | null;
        matchType: "category" | "product" | "variant";
        categoryId?: number | null;
        productId?: number | null;
        productVariantId?: number | null;
        requiredSize?: string | null;
      }>;
    },
  ) =>
    api
      .put<{ data: any }>(`/marketing/combo-rules/${id}/groups`, body)
      .then((r) => r.data.data),
};