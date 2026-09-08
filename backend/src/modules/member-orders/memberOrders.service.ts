import { ApiError } from "../../utils/apiError";
import { previewPosOrderPricing, createMemberOnlineOrder } from "../orders/orders.service";
import {
  listOrdersByCustomer,
  getOrderByIdForCustomer,
  getOrderDetails,
  getOrderPayments,
  getOrderRewardSummary,
  getOrderDiscountApplications,
  getOrderReviewByCustomer,
  upsertOrderReview,
  getLatestPendingOrderForCustomer,
  getLatestPickupPostponeNotice,
  insertPickupPostponeRequest,
} from "./memberOrders.repo";
import {
  createCustomerOrderIssue,
  listCustomerOrderIssues,
} from "../order-issues/orderIssues.service";
import { initVietqrPayment } from "../payments/payments.service";

const VN_TZ = "Asia/Ho_Chi_Minh";

function formatInstantVietnam(value: unknown): string {
  if (value == null || value === "") return "-";

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: VN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "-";

    const hasTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s) || /[+-]\d{2}$/.test(s);

    if (hasTz) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return formatDate(d);
    }

    const sNoMs = s.replace(/\.\d+$/, "");
    const m = sNoMs.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    if (m) {
      const d = new Date(`${m[1]}T${m[2]}Z`);
      if (!Number.isNaN(d.getTime())) return formatDate(d);
    }

    return sNoMs.replace("T", " ");
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return formatDate(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDate(d);
  }

  return String(value);
}

function assertOrderReviewRatings(...values: number[]) {
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new ApiError(400, "Điểm đánh giá phải là số nguyên từ 1 đến 5");
    }
  }
}

function mapPickupDelayNotice(row: any) {
  if (!row) return null;

  const expectedArrivalAt =
    row.requested_pickup_time != null ? formatInstantVietnam(row.requested_pickup_time) : null;

  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    reason: String(row.reason ?? ""),
    expectedArrivalAt,
    expectedPickupVisitAt: expectedArrivalAt,
    requestedPickupTime: expectedArrivalAt,
    createdAt: formatInstantVietnam(row.created_at),
  };
}

export async function previewMemberOrderPricing(params: {
  storeId: number;
  customerId: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: Array<{ productVariantId: number; quantity: number; note?: string }>;
  items: Array<{ productVariantId: number; quantity: number; note?: string }>;
  combos?: Array<{ comboId: number; quantity: number }>;
  appliedComboRules?: Array<{
    comboRuleId: number;
    selectedItems: Array<{ productVariantId: number; quantity: number }>;
  }>;
}) {
  return previewPosOrderPricing({
    storeId: params.storeId,
    customerId: params.customerId,
    voucherCode: params.voucherCode,
    promotionCode: params.promotionCode,
    selectedGiftItems: params.selectedGiftItems,
    items: params.items,
    combos: params.combos || [],
    appliedComboRules: params.appliedComboRules || [],
    softOfferValidation: true,
  });
}

export async function createMemberOrder(params: {
  storeId: number;
  customerId: number;
  voucherCode?: string;
  promotionCode?: string;
  selectedGiftItems?: Array<{ productVariantId: number; quantity: number; note?: string }>;
  items: Array<{ productVariantId: number; quantity: number; note?: string }>;
  combos?: Array<{ comboId: number; quantity: number }>;
  appliedComboRules?: Array<{
    comboRuleId: number;
    selectedItems: Array<{ productVariantId: number; quantity: number }>;
  }>;
  paymentReferenceCode?: string;
}) {
  return createMemberOnlineOrder({
    storeId: params.storeId,
    customerId: params.customerId,
    voucherCode: params.voucherCode,
    promotionCode: params.promotionCode,
    selectedGiftItems: params.selectedGiftItems,
    items: params.items,
    combos: params.combos || [],
    appliedComboRules: params.appliedComboRules || [],
    paymentReferenceCode: params.paymentReferenceCode,
  });
}

const STATUS_MAP: Record<string, string[]> = {
  all: [],
  pending: ["pending"],
  paid: ["paid"],
  completed: ["completed"],
  voided: ["voided"],
  refunded: ["refunded"],
};

export async function listMemberOrders(params: {
  customerId: number;
  status?: string;
  storeId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const statuses = STATUS_MAP[params.status || "all"] || [];
  const rows = await listOrdersByCustomer({
    customerId: params.customerId,
    statuses,
    storeId: params.storeId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
  });

  return {
    ok: true,
    orders: rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      storeId: Number(row.store_id),
      orderCode: String(row.order_code),
      status: String(row.status),
      createdAt: formatInstantVietnam(row.created_at),
      completedAt: row.completed_at != null ? formatInstantVietnam(row.completed_at) : null,
      pickupNumber: row.pickup_number ?? null,
      finalAmount: Number(row.final_amount ?? 0),
      storeName: row.store_name ?? null,
      paymentMethod: row.payment_method_label ?? null,
    })),
  };
}

export async function getMemberOrderDetail(params: { orderId: number; customerId: number }) {
  const order = await getOrderByIdForCustomer({
    orderId: params.orderId,
    customerId: params.customerId,
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  const [details, payments, rewardSummaryRow, discountApplications, orderReview, pickupDelayNoticeRow] = await Promise.all([
    getOrderDetails(Number(order.id)),
    getOrderPayments(Number(order.id)),
    getOrderRewardSummary(Number(order.id), params.customerId),
    getOrderDiscountApplications(Number(order.id)),
    getOrderReviewByCustomer(Number(order.id), params.customerId),
    getLatestPickupPostponeNotice(Number(order.id)),
  ]);
  const pickupDelayNotice = mapPickupDelayNotice(pickupDelayNoticeRow);

  return {
    ok: true,
    order: {
      id: Number(order.id),
      storeId: Number(order.store_id),
      orderCode: String(order.order_code),
      status: String(order.status),
      totalAmount: Number(order.total_amount ?? 0),
      discountAmount: Number(order.discount_amount ?? 0),
      finalAmount: Number(order.final_amount ?? 0),
      createdAt: formatInstantVietnam(order.created_at),
      completedAt: order.completed_at != null ? formatInstantVietnam(order.completed_at) : null,
      pickupNumber: order.pickup_number ?? null,
      storeName: order.store_name ?? null,
      storeAddress: order.store_address ?? null,
      specialNote: order.special_note ?? null,
    },
    discountApplications: discountApplications.map((d: any) => ({
      sourceType: String(d.source_type),
      sourceCode: d.source_code ?? null,
      sourceName: d.source_name ?? null,
      discountAmount: Number(d.discount_amount_applied ?? 0),
    })),
    items: details.map((d: any) => ({
      id: Number(d.id),
      productVariantId: Number(d.product_variant_id),
      quantity: Number(d.quantity),
      unitPrice: Number(d.unit_price),
      note: d.note ?? null,
      productName: d.product_name ?? null,
      variantSize: d.variant_size ?? null,
    })),
    payments: payments.map((p: any) => ({
      method: String(p.method),
      amount: Number(p.amount),
      referenceCode: p.reference_code ?? null,
      paidAt: p.paid_at != null ? formatInstantVietnam(p.paid_at) : null,
    })),
    rewardSummary: {
      earnedPoints: Number(rewardSummaryRow.earned_points ?? 0),
      pointsBalance: Number(rewardSummaryRow.points_balance ?? 0),
    },
    orderReview: orderReview
      ? {
        id: Number(orderReview.id),
        rating: Number(orderReview.rating),
        serviceRating: Number(orderReview.service_rating ?? orderReview.rating),
        foodRating: Number(orderReview.food_rating ?? orderReview.rating),
        comment: String(orderReview.comment ?? ""),
        createdAt: formatInstantVietnam(orderReview.created_at),
        updatedAt: orderReview.updated_at != null ? formatInstantVietnam(orderReview.updated_at) : null,
      }
      : null,
    pickupDelayNotice,
    pickupPostpone:
      String(order.status) === "paid"
        ? { hasPendingRequest: Boolean(pickupDelayNotice), latestNotice: pickupDelayNotice }
        : null,
  };
}

export async function createOrUpdateMemberOrderReview(params: {
  orderId: number;
  customerId: number;
  rating: number;
  comment: string;
  serviceRating: number;
  foodRating: number;
}) {
  const order = await getOrderByIdForCustomer({
    orderId: params.orderId,
    customerId: params.customerId,
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  const status = String(order.status);
  if (status !== "completed") {
    throw new ApiError(400, "Chỉ được đánh giá đơn hàng đã hoàn thành");
  }

  assertOrderReviewRatings(params.rating, params.serviceRating, params.foodRating);

  const row = await upsertOrderReview({
    orderId: params.orderId,
    customerId: params.customerId,
    rating: params.rating,
    comment: (params.comment || "").trim(),
    serviceRating: params.serviceRating,
    foodRating: params.foodRating,
  });

  return {
    ok: true,
    review: {
      id: Number(row.id),
      rating: Number(row.rating),
      serviceRating: Number(row.service_rating ?? row.rating),
      foodRating: Number(row.food_rating ?? row.rating),
      comment: String(row.comment ?? ""),
      createdAt: formatInstantVietnam(row.created_at),
      updatedAt: row.updated_at != null ? formatInstantVietnam(row.updated_at) : null,
    },
  };
}

export async function getMemberResumeOrderSummary(customerId: number) {
  const row = await getLatestPendingOrderForCustomer(customerId);
  if (!row) {
    return { ok: true, pendingOrder: null as null };
  }

  const gwStatus = row.gateway_status != null ? String(row.gateway_status) : null;
  const expRaw = row.gateway_expired_at != null ? String(row.gateway_expired_at) : null;
  const expired = expRaw ? new Date(expRaw).getTime() < Date.now() : false;

  const canResumePayment =
    gwStatus == null ||
    gwStatus === "" ||
    gwStatus === "PENDING" ||
    gwStatus === "FAILED" ||
    gwStatus === "EXPIRED";

  return {
    ok: true,
    pendingOrder: {
      id: Number(row.id),
      storeId: Number(row.store_id),
      orderCode: String(row.order_code),
      status: String(row.status),
      finalAmount: Number(row.final_amount ?? 0),
      createdAt: formatInstantVietnam(row.created_at),
      storeName: row.store_name != null ? String(row.store_name) : null,
      canResumePayment,
      paymentExpired: expired && gwStatus === "PENDING",
    },
  };
}

export async function resumeMemberOrderPayment(params: {
  orderId: number;
  customerId: number;
}) {
  const order = await getOrderByIdForCustomer({
    orderId: params.orderId,
    customerId: params.customerId,
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng cần tiếp tục thanh toán");
  }

  const status = String(order.status || "");
  if (status === "paid" || status === "completed") {
    throw new ApiError(400, "Đơn hàng này đã thanh toán xong");
  }

  if (status === "voided" || status === "refunded") {
    throw new ApiError(400, "Đơn hàng này không còn hợp lệ để tiếp tục thanh toán");
  }

  if (status !== "pending") {
    throw new ApiError(400, "Đơn hàng này hiện không thể tiếp tục thanh toán");
  }

  return initVietqrPayment(params.orderId);
}

export async function createMemberPickupPostponeRequest(params: {
  orderId: number;
  customerId: number;
  expectedArrivalAt?: string | null;
  reason: string;
}) {
  const order = await getOrderByIdForCustomer({
    orderId: params.orderId,
    customerId: params.customerId,
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  const status = String(order.status);
  if (status !== "paid") {
    throw new ApiError(400, "Chỉ có thể báo bận khi đơn đã thanh toán và đang chờ đến lấy");
  }

  if (!order.has_gateway_payment) {
    throw new ApiError(400, "Chỉ áp dụng cho đơn online tự đến lấy");
  }

  if (order.pickup_number != null || order.staff_id != null) {
    throw new ApiError(400, "Đơn này đã được quán xác nhận, không thể gửi thêm thông báo báo bận");
  }

  const reason = (params.reason || "").trim();
  if (reason.length < 5) {
    throw new ApiError(400, "Vui lòng nhập lý do (ít nhất 5 ký tự)");
  }

  const rawExpectedArrivalAt = String(params.expectedArrivalAt || "").trim();
  const expectedArrivalAt = rawExpectedArrivalAt ? new Date(rawExpectedArrivalAt) : null;

  if (expectedArrivalAt && Number.isNaN(expectedArrivalAt.getTime())) {
    throw new ApiError(400, "Thời điểm dự kiến ghé lấy không hợp lệ");
  }

  if (expectedArrivalAt && expectedArrivalAt.getTime() <= Date.now()) {
    throw new ApiError(400, "Thời điểm dự kiến ghé lấy phải sau thời điểm hiện tại");
  }

  const row = await insertPickupPostponeRequest({
    orderId: params.orderId,
    customerId: params.customerId,
    requestedPickupTime: expectedArrivalAt,
    reason,
  });

  const notice = mapPickupDelayNotice(row);

  return {
    ok: true,
    message: "Đã gửi thông báo cho quán.",
    notice,
    request: {
      ...notice,
      status: String(row.status),
    },
  };
}
export async function listMemberIssues(params: {
  customerId: number;
  status?: string;
  issueType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  return listCustomerOrderIssues(params);
}

export async function createMemberOrderIssue(params: {
  orderId: number;
  customerId: number;
  issueType: string;
  description: string;
}) {
  return createCustomerOrderIssue(params);
}

