import api from "../../../lib/http/axios";

export type MemberOrderItem = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

export type MemberOrderCombo = {
  comboId: number;
  quantity: number;
};

export type MemberAppliedComboRule = {
  comboRuleId: number;
  selectedItems: Array<{
    productVariantId: number;
    quantity: number;
  }>;
};

export type MemberComboRulePreview = {
  comboRuleId: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  maxApplicable: number;
  totalSaving: number;
  applications: Array<{
    selectedItems: Array<{
      groupNo: number;
      productVariantId: number;
      productName: string;
      size?: string | null;
      unitPrice: number;
    }>;
  }>;
};

export type MemberPreviewPricingRequest = {
  storeId: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: Array<{ productVariantId: number; quantity: number; note?: string }>;
  items: MemberOrderItem[];
  combos?: MemberOrderCombo[];
  appliedComboRules?: MemberAppliedComboRule[];
};

export type MemberPreviewPricingResponse = {
  ok: boolean;
  pricing: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;

    giftSelection?: {
      required: boolean;
      ruleId: number | null;
      expectedQty: number;
      eligibleVariants: Array<{
        productVariantId: number;
        productName: string;
        size: string;
        price: number;
      }>;
    } | null;

    materializedGiftItems?: Array<{
      productVariantId: number;
      quantity: number;
      unitPrice: number;
    }>;

    offerValidation?: {
      sourceType: "PROMOTION" | "VOUCHER";
      isEligible: boolean;
      status: "APPLIED" | "INELIGIBLE" | "GIFT_SELECTION_REQUIRED";
      message: string;
    } | null;

    appliedVoucher?: {
      id: number;
      voucherCode: string;
      rewardName: string;
      rewardType?: string | null;
      benefitType: string;
    } | null;

    appliedPromotion?: {
      id: number;
      code: string;
      name: string;
      promotionType: string;
    } | null;
  };
};

export type MemberCreateOrderRequest = {
  storeId: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: Array<{ productVariantId: number; quantity: number; note?: string }>;
  items: MemberOrderItem[];
  combos?: MemberOrderCombo[];
  appliedComboRules?: MemberAppliedComboRule[];
  paymentReferenceCode?: string;
};

export type MemberCreateOrderResponse = {
  ok: boolean;
  order: {
    id: number;
    orderCode: string;
    status: string;
    createdAt: string;
    pickupNumber: number;
    finalAmount: number;
  };
  pricing: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
  };
  earnedPoints?: number;
};

export type MemberOrderListItem = {
  id: number;
  storeId: number;
  orderCode: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  pickupNumber: number | null;
  finalAmount: number;
  storeName: string | null;
  paymentMethod: string | null;
};

export type MemberOrderDetailResponse = {
  ok: boolean;
  order: {
    id: number;
    storeId: number;
    orderCode: string;
    status: string;
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    createdAt: string;
    completedAt: string | null;
    pickupNumber: number | null;
    storeName: string | null;
    storeAddress: string | null;
    specialNote: string | null;
  };
  discountApplications?: Array<{
    sourceType: string;
    sourceCode: string | null;
    sourceName: string | null;
    discountAmount: number;
  }>;
  orderReview?: {
    id: number;
    rating: number;
    serviceRating: number;
    foodRating: number;
    comment: string;
    createdAt: string;
    updatedAt?: string | null;
  } | null;
  pickupDelayNotice?: {
    id: number;
    orderId: number;
    reason: string;
    expectedArrivalAt: string | null;
    expectedPickupVisitAt: string | null;
    requestedPickupTime: string | null;
    createdAt: string;
  } | null;
  pickupPostpone?: {
    hasPendingRequest: boolean;
    latestNotice?: {
      id: number;
      orderId: number;
      reason: string;
      expectedArrivalAt: string | null;
      expectedPickupVisitAt: string | null;
      requestedPickupTime: string | null;
      createdAt: string;
    } | null;
  } | null;
  issues?: Array<{
    id: number;
    orderId: number;
    storeId: number;
    customerId: number;
    issueType: string;
    status: string;
    description: string;
    customerNote: string | null;
    resolutionNote: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  }>;
  items: Array<{
    id: number;
    productVariantId: number;
    quantity: number;
    unitPrice: number;
    note: string | null;
    productName: string | null;
    variantSize: string | null;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    referenceCode: string | null;
    paidAt: string | null;
  }>;
  rewardSummary?: {
    earnedPoints: number;
    pointsBalance: number;
  };
};

export type MemberResumePendingOrder = {
  id: number;
  storeId: number;
  orderCode: string;
  status: string;
  finalAmount: number;
  createdAt: string;
  storeName: string | null;
  canResumePayment: boolean;
  paymentExpired: boolean;
};

export type MemberResumeSummaryResponse = {
  ok: boolean;
  pendingOrder: MemberResumePendingOrder | null;
};

export type MemberResumePaymentResponse = {
  paymentId: number | null;
  orderId: number;
  provider: "vietqr";
  orderRef: string | null;
  content: string | null;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  providerOrderId: string | null;
  qrImageUrl: string | null;
  qrPayload: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
};

export type MemberCreatePickupPostponeRequest = {
  reason: string;
  expectedArrivalAt?: string | null;
  requestedPickupTime?: string | null;
};

export type MemberCreatePickupPostponeResponse = {
  ok: boolean;
  message?: string;
  notice?: {
    id: number;
    orderId: number;
    reason: string;
    expectedArrivalAt: string | null;
    expectedPickupVisitAt: string | null;
    requestedPickupTime: string | null;
    createdAt: string;
  };
  request: {
    id: number;
    orderId: number;
    status: string;
    expectedArrivalAt?: string | null;
    expectedPickupVisitAt?: string | null;
    requestedPickupTime: string | null;
    reason: string;
    createdAt: string;
  };
};

export const memberOrdersApi = {
  previewComboRules: (items: Array<{ productVariantId: number; quantity: number }>) =>
    api
      .post<{ ok: boolean; eligibleRules: MemberComboRulePreview[] }>("/member-orders/preview-combo-rules", { items })
      .then((r) => r.data),

  previewPricing: (data: MemberPreviewPricingRequest) =>
    api.post<MemberPreviewPricingResponse>("/member-orders/preview-pricing", data).then((r) => r.data),

  createOrder: (data: MemberCreateOrderRequest) =>
    api.post<MemberCreateOrderResponse>("/member-orders", data).then((r) => r.data),

  listOrders: (params?: {
    status?: string;
    storeId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{ ok: boolean; orders: MemberOrderListItem[] }>("/member-orders", { params })
      .then((r) => r.data),

  getResumeSummary: () =>
    api.get<MemberResumeSummaryResponse>("/member-orders/resume-summary").then((r) => r.data),

  resumePayment: (orderId: number) =>
    api.post<MemberResumePaymentResponse>(`/member-orders/${orderId}/resume-payment`).then((r) => r.data),

  getOrderDetail: (orderId: number) =>
    api.get<MemberOrderDetailResponse>(`/member-orders/${orderId}`).then((r) => r.data),

  createOrderReview: (
    orderId: number,
    data: {
      rating: number;
      serviceRating: number;
      foodRating: number;
      comment: string;
    }
  ) =>
    api
      .post<{
        ok: boolean;
        review: {
          id: number;
          rating: number;
          serviceRating: number;
          foodRating: number;
          comment: string;
          createdAt: string;
          updatedAt?: string | null;
        };
      }>(`/member-orders/${orderId}/review`, data)
      .then((r) => r.data),

  createOrderIssue: (orderId: number, data: { issueType: string; description: string }) =>
    api
      .post<{ ok: boolean; issue: NonNullable<MemberOrderDetailResponse["issues"]>[number] }>(
        `/member-orders/${orderId}/issues`,
        data
      )
      .then((r) => r.data),

  createPickupPostponeRequest: (orderId: number, data: MemberCreatePickupPostponeRequest) =>
    api
      .post<MemberCreatePickupPostponeResponse>(`/member-orders/${orderId}/pickup-postpone`, data)
      .then((r) => r.data),
};
