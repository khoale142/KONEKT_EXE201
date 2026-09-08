import api from "../../../lib/http/axios";

export type StoreReportSummary = {
  totalOrders: number;
  recognizedOrders: number;
  paidOrders: number;
  completedOrders: number;
  voidedOrders: number;
  refundedOrders: number;

  grossSales: number;
  discountTotal: number;
  netSales: number;

  itemsSold: number;
  averageOrderValue: number;
  itemsPerRecognizedOrder: number;

  memberOrders: number;
  memberSales: number;
  memberOrderSharePct: number;

  guestOrders: number;
  guestSales: number;
  guestOrderSharePct: number;

  completionRatePct: number;
  avgCompletedMinutes: number | null;

  preparingOver15m: number;
  preparingOver30m: number;

  paymentMixTotal: number;
  paymentMixAvailable: boolean;

  peakHourLabel: string | null;
  peakHourOrders: number;
  peakHourRevenue: number;

  topPaymentMethod: string | null;
  topPaymentAmount: number;

  itemsSoldNormal: number;
  itemsSoldSpecial: number;
  itemsSoldTotal: number;

  specialOrders: number;
  specialValue: number;
  specialDiscountTotal: number;
  specialRatePct: number;
  specialTestOrders: number;
  specialFreeOrders: number;
  specialInternalOrders: number;
  specialGuestOrders: number;
  specialCompensationOrders: number;
  topSpecialOrderType: string | null;
};

export type StoreReportResponse = {
  ok: boolean;
  store: {
    id: number;
    code: string;
    name: string;
    address?: string | null;
  };
  filters: {
    storeId: number;
    dateFrom: string;
    dateTo: string;
    topN: number;
  };
  summary: StoreReportSummary;

  statusBreakdown: Array<{
    status: string;
    orderCount: number;
    amount: number;
  }>;

  paymentMix: Array<{
    method: string;
    transactionCount: number;
    amount: number;
  }>;

  orderTypeBreakdown: Array<{
    orderType: string;
    orderCount: number;
    subtotalValue: number;
    finalAmount: number;
  }>;

  topProducts: Array<{
    productId: number;
    productName: string;
    orderCount: number;
    quantitySold: number;
    revenue: number;
  }>;

  topSpecialProducts: Array<{
    productId: number;
    productName: string;
    orderCount: number;
    quantitySold: number;
    valueAmount: number;
  }>;

  hourlySales: Array<{
    hour: number;
    orderCount: number;
    normalOrderCount: number;
    specialOrderCount: number;
    revenue: number;
    specialValue: number;
    totalItems: number;
    avgProcessMinutes: number | null;
  }>;

  memberSplit: {
    memberOrders: number;
    memberSales: number;
    memberAov: number;
    guestOrders: number;
    guestSales: number;
    guestAov: number;
  };

  slowOrders: Array<{
    orderId: number;
    orderCode: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
    processMinutes: number | null;
    itemCount: number;
    finalAmount: number;
    orderType?: string;
    specialNote?: string | null;
  }>;

  recentSpecialOrders: Array<{
    orderId: number;
    orderCode: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
    pickupNumber?: number | null;
    staffId?: number | null;
    orderType: string;
    specialNote?: string | null;
    subtotalAmount: number;
    finalAmount: number;
  }>;

  alerts: string[];
  insights: string[];
};

export async function getTodayStoreReport() {
  const r = await api.get("/store-reports/today");
  return r.data as StoreReportResponse;
}

export async function getStoreReportOverview(params: {
  dateFrom: string;
  dateTo: string;
  topN?: number;
}) {
  const r = await api.get("/store-reports/overview", { params });
  return r.data as StoreReportResponse;
}