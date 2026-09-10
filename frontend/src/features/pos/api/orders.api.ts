import api from "../../../lib/http/axios";

export type PosOrderType =
  | "NORMAL"
  | "TEST"
  | "FREE"
  | "INTERNAL"
  | "GUEST"
  | "COMPENSATION";

export type PosServiceMode = "TAKE_AWAY" | "IN_STORE";

export type PosCreateOrderItem = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

export type PosCreateOrderCombo = {
  comboId: number;
  quantity: number;
};

export type PosAppliedComboRule = {
  comboRuleId: number;
  selectedItems: Array<{
    productVariantId: number;
    quantity: number;
  }>;
};

export type PosSelectedGiftItem = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

export type PosCreateOrderPayment = {
  method: "cash" | "transfer" | "card" | "gateway";
  amount?: number;
  referenceCode?: string;
};

export type PosAvailablePromotion = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  promotionType: string;
  discountPercent?: number | null;
  discountAmount?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  startAt: string;
  endAt: string;
  eligible: boolean;
  reason: string | null;
  estimatedDiscountAmount?: number | null;
  requiresGiftSelection?: boolean;
};

export type PosOrderPricing = {
  subtotalAmount: number;
  directTotalAmount: number;
  fixedComboTotalAmount: number;
  ruleComboTotalAmount: number;
  promotionDiscountAmount: number;
  voucherDiscountAmount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  appliedVoucher: {
    id: number;
    voucherCode: string;
    rewardName: string;
    rewardType: "FIXED" | "PERCENT" | null;
    benefitType?: "DISCOUNT" | "GIFT";
  } | null;
  appliedPromotion?: {
    id: number;
    code: string;
    name: string;
    promotionType: string;
  } | null;
  giftSelection?: {
    required: boolean;
    ruleId: number | null;
    expectedQty: number;
    eligibleVariants: Array<{
      productVariantId: number;
      productName: string;
      size: string;
      price: number;
      categoryId: number | null;
      categoryName: string | null;
    }>;
  } | null;
  materializedGiftItems?: Array<{
    productVariantId: number;
    quantity: number;
    note?: string | null;
    unitPrice: number;
  }>;
};

export type PosCreateOrderResponse = {
  ok: boolean;
  order: {
    id: number;
    orderCode: string;
    status: "pending" | "paid" | "completed" | "voided" | "refunded";
    createdAt: string;
    pickupNumber: number;
    finalAmount: number;
    orderType?: PosOrderType;
    serviceMode?: PosServiceMode;
    specialNote?: string | null;
  };
  payment?: {
    method: string;
    amount: number;
    referenceCode?: string | null;
  };
  pricing?: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
  };
  appliedVoucher?: {
    id: number;
    voucherCode: string;
    rewardName: string;
    rewardType?: "FIXED" | "PERCENT" | null;
    benefitType?: "DISCOUNT" | "GIFT";
  } | null;
  appliedPromotion?: {
    id: number;
    code: string;
    name: string;
    promotionType: string;
  } | null;
  giftSelection?: {
    required: boolean;
    ruleId: number | null;
    expectedQty: number;
    eligibleVariants: Array<{
      productVariantId: number;
      productName: string;
      size: string;
      price: number;
      categoryId: number | null;
      categoryName: string | null;
    }>;
  } | null;
  materializedGiftItems?: Array<{
    productVariantId: number;
    quantity: number;
    note?: string | null;
    unitPrice: number;
  }>;
  earnedPoints?: number;
  shiftWarning?: {
    code: string;
    message: string;
    overdueMinutes?: number;
    scheduledEndAt?: string;
  } | null;
};

export type PosPaidOrderListItem = {
  id: number;
  storeId: number;
  orderCode: string;
  status: "paid" | "completed";
  createdAt: string;
  completedAt?: string | null;
  pickupNumber?: number | null;
  finalAmount: number;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAt?: string | null;
  refundedAmount: number;
  refundStatus: "none" | "partial" | "full";
  lastRefundedAt?: string | null;
  orderType?: PosOrderType;
  serviceMode?: PosServiceMode;
  specialNote?: string | null;
};

export type PosPaidOrderDetailResponse = {
  ok: boolean;
  order: {
    id: number;
    storeId: number;
    orderCode: string;
    staffId?: number | null;
    customerId?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    status: "paid" | "completed" | "voided" | "pending";
    createdAt: string;
    completedAt?: string | null;
    pickupNumber?: number | null;
    notifiedAt?: string | null;
    orderType?: PosOrderType;
    serviceMode?: PosServiceMode;
    specialNote?: string | null;
    refund: {
      refundStatus: "none" | "partial" | "full";
      refundedAmount: number;
      remainingRefundableAmount: number;
      lastRefundedAt?: string | null;
    };
    items: Array<{
      id: number;
      productVariantId: number;
      quantity: number;
      unitPrice: number;
      note?: string | null;
      variantName?: string | null;
      productName?: string | null;
      refund: {
        refundedQty: number;
        refundedAmount: number;
        remainingQty: number;
        remainingAmount: number;
      };
    }>;
    payments: Array<{
      id: number;
      method: string;
      amount: number;
      referenceCode?: string | null;
      paidAt: string;
    }>;
    refunds: Array<{
      id: number;
      refundType: "full" | "partial";
      refundStatus: string;
      reason: string;
      refundAmount: number;
      processedByUserId: number;
      createdAt: string;
      items: Array<{
        id: number;
        orderDetailId: number;
        quantity: number;
        lineRefundAmount: number;
      }>;
    }>;
  };
};

export async function posPreviewOrderPricing(payload: {
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: PosSelectedGiftItem[];
  items: PosCreateOrderItem[];
  combos?: PosCreateOrderCombo[];
  appliedComboRules?: PosAppliedComboRule[];
  orderType?: PosOrderType;
  specialNote?: string;
}) {
  const r = await api.post("/pos/orders/preview-pricing", payload);
  return r.data as {
    ok: boolean;
    pricing: PosOrderPricing;
  };
}

export async function posCreateOrder(payload: {
  pickupNumber?: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: PosSelectedGiftItem[];
  items: PosCreateOrderItem[];
  combos?: PosCreateOrderCombo[];
  appliedComboRules?: PosAppliedComboRule[];
  payment: PosCreateOrderPayment;
  orderType?: string;
  serviceMode?: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  discountAmount?: number;
  discountReason?: string;
  specialNote?: string;
}) {
  const r = await api.post("/pos/orders", payload);
  return r.data as PosCreateOrderResponse;
}

/** Tạo đơn pending cho thanh toán gateway (VietQR). Trả về orderId để gọi POST /payments/vietqr/init. */
export async function posCreateOrderForGateway(payload: {
  pickupNumber?: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: PosSelectedGiftItem[];
  items: PosCreateOrderItem[];
  combos?: PosCreateOrderCombo[];
  appliedComboRules?: PosAppliedComboRule[];
  orderType?: string;
  serviceMode?: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  discountAmount?: number;
  discountReason?: string;
  specialNote?: string;
}) {
  const r = await api.post("/pos/orders/create-for-gateway", {
    ...payload,
    payment: { method: "gateway" as const },
  });
  return r.data as {
    ok: boolean;
    order: {
      id: number;
      orderCode: string;
      status: string;
      pickupNumber: number;
      finalAmount: number;
      serviceMode?: PosServiceMode;
    };
    shiftWarning?: { code: string; message: string } | null;
  };
}

export async function posHoldOrder(payload: {
  pickupNumber?: number;
  customerId?: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: PosSelectedGiftItem[];
  items: PosCreateOrderItem[];
  combos?: PosCreateOrderCombo[];
  appliedComboRules?: PosAppliedComboRule[];
  snapshot?: any;
  orderType?: string;
  serviceMode?: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  specialNote?: string;
}) {
  const r = await api.post("/pos/orders/hold", payload);
  return r.data as PosCreateOrderResponse;
}

export async function posPayHeldOrder(
  orderId: number,
  payload: {
    payment: PosCreateOrderPayment;
    orderType?: PosOrderType;
    serviceMode?: string;
    serviceIdentifier?: string;
    customerName?: string;
    customerPhone?: string;
    discountReason?: string;
    discountAmount?: number;
    specialNote?: string;
  },
) {
  const r = await api.post(`/pos/orders/${orderId}/pay`, payload);
  return r.data as PosCreateOrderResponse;
}

export async function posCancelHeldOrder(orderId: number) {
  const r = await api.post(`/pos/orders/${orderId}/cancel-hold`);
  return r.data as {
    ok: boolean;
    order: {
      id: number;
      status: "voided";
      orderCode: string;
    };
  };
}

export async function posGetHeldOrderSnapshot(orderId: number) {
  const r = await api.get(`/pos/orders/${orderId}/hold-snapshot`);
  return r.data as {
    ok: boolean;
    order: {
      id: number;
      orderCode: string;
      status: "pending";
      pickupNumber: number;
      finalAmount: number;
      subtotalAmount: number;
      promotionDiscountAmount: number;
      voucherDiscountAmount: number;
      totalDiscountAmount: number;
      createdAt: string;
      orderType?: PosOrderType;
      serviceMode?: PosServiceMode;
      specialNote?: string | null;
    };
    snapshot: any;
  };
}

export async function posCreateVoidRequest(
  orderId: number,
  payload: { reason: string },
) {
  const r = await api.post(`/pos/orders/${orderId}/void-request`, payload);
  return r.data as {
    ok: boolean;
    request: {
      id: number;
      orderId: number;
      storeId: number;
      requestedByUserId: number;
      reason: string;
      status: "pending" | "approved" | "rejected" | "cancelled";
      createdAt: string;
    };
    order: {
      id: number;
      orderCode: string;
      status: string;
    };
  };
}

export async function posListVoidRequests(params?: {
  status?: "pending" | "approved" | "rejected" | "cancelled";
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/orders/void-requests", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      status: string | null;
      limit: number;
      offset: number;
    };
    requests: Array<{
      id: number;
      orderId: number;
      orderCode: string;
      orderStatus: string;
      storeId: number;
      requestedByUserId: number;
      reason: string;
      status: "pending" | "approved" | "rejected" | "cancelled";
      approvedByUserId: number | null;
      approvedAt: string | null;
      rejectedByUserId: number | null;
      rejectedAt: string | null;
      decisionNote: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

export async function posGetOrderDetail(orderId: number) {
  const r = await api.get(`/pos/orders/${orderId}`);
  return r.data as PosPaidOrderDetailResponse;
}

export async function posListOrders(params?: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  orderType?: PosOrderType;
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/orders", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      dateFrom: string;
      dateTo: string;
      statuses: string[];
      limit: number;
      offset: number;
    };
    orders: Array<{
      id: number;
      storeId: number;
      orderCode: string;
      status: string;
      createdAt: string;
      completedAt?: string | null;
      pickupNumber?: number | null;
      totalAmount: number;
      discountAmount: number;
      finalAmount: number;
      customerId?: number | null;
      orderType?: PosOrderType;
      serviceMode?: PosServiceMode;
      specialNote?: string | null;
      refundedAmount?: number;
      refundStatus?: "none" | "partial" | "full";
      lastRefundedAt?: string | null;
      items: Array<{
        id: number;
        productVariantId: number;
        quantity: number;
        unitPrice: number;
        note?: string | null;
        variantName?: string | null;
        productName?: string | null;
      }>;
    }>;
  };
}

export async function posListHeldOrders(params?: {
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/orders/held", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      limit: number;
      offset: number;
    };
    orders: Array<{
      id: number;
      storeId: number;
      orderCode: string;
      status: "pending";
      createdAt: string;
      completedAt?: string | null;
      pickupNumber?: number | null;
      totalAmount: number;
      discountAmount: number;
      finalAmount: number;
      customerId?: number | null;
      orderType?: PosOrderType;
      serviceMode?: PosServiceMode;
      specialNote?: string | null;
      items: Array<{
        id: number;
        productVariantId: number;
        quantity: number;
        unitPrice: number;
        note?: string | null;
        variantName?: string | null;
        productName?: string | null;
      }>;
    }>;
  };
}

export async function posListPaidOrders(params?: {
  orderCode?: string;
  pickupNumber?: number;
  memberPhone?: string;
  dateFrom?: string;
  dateTo?: string;
  refundStatus?: "none" | "partial" | "full";
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/orders/paid-search", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      orderCode: string | null;
      pickupNumber: number | null;
      memberPhone: string | null;
      refundStatus: "none" | "partial" | "full" | null;
      dateFrom: string;
      dateTo: string;
      limit: number;
      offset: number;
    };
    orders: PosPaidOrderListItem[];
  };
}

export async function posRefundOrder(
  orderId: number,
  payload: {
    refundType: "full" | "partial";
    reason: string;
    items?: Array<{
      orderDetailId: number;
      quantity: number;
    }>;
  },
) {
  const r = await api.post(`/pos/orders/${orderId}/refunds`, payload);
  return r.data as {
    ok: boolean;
    refund: {
      id: number;
      orderId: number;
      refundType: "full" | "partial";
      refundAmount: number;
      reason: string;
      refundStatus: "none" | "partial" | "full";
      createdAt: string;
      items: Array<{
        orderDetailId: number;
        quantity: number;
        lineRefundAmount: number;
      }>;
    };
    order: {
      id: number;
      orderCode: string;
      status: string;
      refundedAmount: number;
      refundStatus: "none" | "partial" | "full";
    };
  };
}

export async function posListAvailablePromotions(payload: {
  customerId?: number;
  items: Array<{
    productVariantId: number;
    quantity: number;
  }>;
  combos?: Array<{
    comboId: number;
    quantity: number;
  }>;
  appliedComboRules?: Array<{
    comboRuleId: number;
    selectedItems: Array<{
      productVariantId: number;
      quantity: number;
    }>;
  }>;
}) {
  const r = await api.post("/pos/orders/available-promotions", payload);
  return r.data as {
    ok: boolean;
    context: {
      storeId: number;
      customerId: number | null;
      subtotalAmount: number;
    };
    promotions: PosAvailablePromotion[];
  };
}

export type PosOnlinePendingOrderListItem = {
  id: number;
  storeId: number;
  orderCode: string;
  status: "paid";
  createdAt: string;
  completedAt?: string | null;
  pickupNumber?: number | null;
  finalAmount: number;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAt?: string | null;
  serviceMode?: PosServiceMode;
  pickupDelayNotice?: {
    id: number;
    reason: string;
    expectedArrivalAt: string | null;
    expectedPickupVisitAt: string | null;
    requestedPickupTime: string | null;
    createdAt: string | null;
  } | null;
};

export async function posListOnlinePendingOrders(params?: {
  orderCode?: string;
  memberPhone?: string;
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/pos/orders/online-pending", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      orderCode: string | null;
      memberPhone: string | null;
      limit: number;
      offset: number;
    };
    orders: PosOnlinePendingOrderListItem[];
  };
}

export async function posConfirmOnlineOrder(
  orderId: number,
  payload: { pickupNumber: number; serviceMode: PosServiceMode },
) {
  const r = await api.post(`/pos/orders/${orderId}/confirm-online`, payload);
  return r.data as {
    ok: boolean;
    order: {
      id: number;
      storeId: number;
      orderCode: string;
      status: string;
      createdAt: string;
      pickupNumber: number;
      staffId?: number | null;
      customerId?: number | null;
      finalAmount: number;
      serviceMode?: PosServiceMode;
    };
  };
}

export async function posDeleteHeldOrder(orderId: number) {
  const r = await api.delete(`/pos/orders/held/${orderId}`);
  return r.data as { ok: boolean; message: string };
}

export interface PosStoreConfigResponse {
  ok: boolean;
  config: {
    defaultOrderType: string;
    defaultServiceMode: string;
    enabledServiceModes: string[];
    autoPrintReceipt: boolean;
    storeDisplayName?: string;
    receiptAddress?: string;
    receiptPhone?: string;
    receiptFooterMessage?: string;
    paperSize?: "80mm" | "58mm";
    wifiSsid?: string;
    wifiPassword?: string;
    quickTables?: string[];
    quickDiscounts?: number[];
    defaultPaymentMethod?: "cash" | "transfer";
    printCashierName?: boolean;
    [key: string]: any;
  };
}

export async function posGetStoreConfig() {
  const r = await api.get("/pos/orders/config");
  return r.data as PosStoreConfigResponse;
}

export async function posUpdateStoreConfig(config: Partial<PosStoreConfigResponse["config"]>) {
  const r = await api.patch("/pos/orders/config", config);
  return r.data as PosStoreConfigResponse;
}