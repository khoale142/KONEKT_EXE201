import { ApiError } from "../../utils/apiError";
import {
  getHourlySales,
  getItemsSold,
  getMemberSplit,
  getOrderTypeBreakdown,
  getPaymentMix,
  getPreparingAging,
  getRecentSpecialOrders,
  getSlowOrders,
  getStatusBreakdown,
  getStoreMeta,
  getSummaryRow,
  getTopProducts,
  getTopSpecialProducts,
} from "./storeReport.repo";

function todayVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function normalizeDate(input?: string | null) {
  const v = String(input || "").trim();
  if (!v) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, `Invalid date format: ${v}. Expected YYYY-MM-DD`);
  }
  return v;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function safeAvg(amount: number, count: number) {
  if (count <= 0) return 0;
  return Number((amount / count).toFixed(2));
}

export async function getStoreReportOverview(params: {
  storeId: number;
  dateFrom?: string;
  dateTo?: string;
  topN?: number;
}) {
  const fallbackToday = todayVN();

  const dateFrom = normalizeDate(params.dateFrom || fallbackToday);
  const dateTo = normalizeDate(params.dateTo || dateFrom);

  if (dateFrom > dateTo) {
    throw new ApiError(400, "dateFrom must be <= dateTo");
  }

  const store = await getStoreMeta(params.storeId);
  if (!store) throw new ApiError(404, "Store not found");

  const summaryRow = await getSummaryRow({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const itemsSold = await getItemsSold({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const statusBreakdown = await getStatusBreakdown({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const orderTypeBreakdown = await getOrderTypeBreakdown({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const paymentMix = await getPaymentMix({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const topProducts = await getTopProducts({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    limit: params.topN || 10,
  });

  const topSpecialProducts = await getTopSpecialProducts({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    limit: params.topN || 10,
  });

  const hourlySales = await getHourlySales({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const preparingAging = await getPreparingAging({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const memberSplit = await getMemberSplit({
    storeId: params.storeId,
    dateFrom,
    dateTo,
  });

  const slowOrders = await getSlowOrders({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    limit: 10,
  });

  const recentSpecialOrders = await getRecentSpecialOrders({
    storeId: params.storeId,
    dateFrom,
    dateTo,
    limit: 10,
  });

  const totalOrders = Number(summaryRow?.total_orders_all || 0);
  const recognizedOrders = Number(summaryRow?.recognized_orders_normal || 0);
  const paidOrders = Number(summaryRow?.paid_orders_normal || 0);
  const completedOrders = Number(summaryRow?.completed_orders_normal || 0);
  const voidedOrders = Number(summaryRow?.voided_orders_normal || 0);
  const refundedOrders = Number(summaryRow?.refunded_orders_normal || 0);

  const grossSales = Number(summaryRow?.gross_sales_normal || 0);
  const discountTotal = Number(summaryRow?.discount_total_normal || 0);
  const netSales = Number(summaryRow?.net_sales_normal || 0);

  const specialOrders = Number(summaryRow?.special_orders || 0);
  const specialValue = Number(summaryRow?.special_value || 0);
  const specialDiscountTotal = Number(summaryRow?.special_discount_total || 0);

  const specialTestOrders = Number(summaryRow?.special_test_orders || 0);
  const specialFreeOrders = Number(summaryRow?.special_free_orders || 0);
  const specialInternalOrders = Number(summaryRow?.special_internal_orders || 0);
  const specialGuestOrders = Number(summaryRow?.special_guest_orders || 0);
  const specialCompensationOrders = Number(summaryRow?.special_compensation_orders || 0);

  const memberOrders = Number(memberSplit.memberOrders || 0);
  const memberSales = Number(memberSplit.memberSales || 0);
  const guestOrders = Number(memberSplit.guestOrders || 0);
  const guestSales = Number(memberSplit.guestSales || 0);

  const itemsSoldNormal = Number(itemsSold.itemsSoldNormal || 0);
  const itemsSoldSpecial = Number(itemsSold.itemsSoldSpecial || 0);
  const itemsSoldTotal = Number(itemsSold.itemsSoldTotal || 0);

  const averageOrderValue = safeAvg(netSales, recognizedOrders);
  const itemsPerRecognizedOrder = safeAvg(itemsSoldNormal, recognizedOrders);
  const memberOrderSharePct = pct(memberOrders, recognizedOrders);
  const guestOrderSharePct = pct(guestOrders, recognizedOrders);
  const completionRatePct = pct(completedOrders, recognizedOrders);

  const avgCompletedMinutes =
    summaryRow?.avg_completed_minutes_all != null
      ? Number(Number(summaryRow.avg_completed_minutes_all).toFixed(2))
      : 0;

  const paymentMixTotal = paymentMix.reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const peakHour = [...hourlySales].sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return b.orderCount - a.orderCount;
  })[0];

  const topPayment = [...paymentMix].sort((a, b) => b.amount - a.amount)[0];

  const topSpecialOrderType =
    [
      { key: "TEST", value: specialTestOrders },
      { key: "FREE", value: specialFreeOrders },
      { key: "INTERNAL", value: specialInternalOrders },
      { key: "GUEST", value: specialGuestOrders },
      { key: "COMPENSATION", value: specialCompensationOrders },
    ].sort((a, b) => b.value - a.value)[0]?.key || null;

  const alerts = buildAlerts({
    recognizedOrders,
    completionRatePct,
    memberOrderSharePct,
    preparingOver15m: preparingAging.paidOver15m,
    preparingOver30m: preparingAging.paidOver30m,
    avgCompletedMinutes,
    slowOrders,
    specialOrders,
    specialValue,
  });

  return {
    store: {
      id: Number(store.id),
      code: String(store.code),
      name: String(store.name),
      address: store.address || null,
    },
    filters: {
      storeId: params.storeId,
      dateFrom,
      dateTo,
      topN: params.topN || 10,
    },
    summary: {
      totalOrders,
      recognizedOrders,
      paidOrders,
      completedOrders,
      voidedOrders,
      refundedOrders,

      grossSales,
      discountTotal,
      netSales,

      itemsSold: itemsSoldNormal,
      itemsSoldNormal,
      itemsSoldSpecial,
      itemsSoldTotal,

      averageOrderValue,
      itemsPerRecognizedOrder,

      memberOrders,
      memberSales,
      memberOrderSharePct,

      guestOrders,
      guestSales,
      guestOrderSharePct,

      completionRatePct,
      avgCompletedMinutes,

      preparingOver15m: preparingAging.paidOver15m,
      preparingOver30m: preparingAging.paidOver30m,

      paymentMixTotal,
      paymentMixAvailable: paymentMix.length > 0,

      peakHourLabel: peakHour ? `${String(peakHour.hour).padStart(2, "0")}:00` : null,
      peakHourOrders: peakHour ? peakHour.orderCount : 0,
      peakHourRevenue: peakHour ? peakHour.revenue : 0,

      topPaymentMethod: topPayment ? topPayment.method : null,
      topPaymentAmount: topPayment ? topPayment.amount : 0,

      specialOrders,
      specialValue,
      specialDiscountTotal,
      specialRatePct: pct(specialOrders, totalOrders),
      specialTestOrders,
      specialFreeOrders,
      specialInternalOrders,
      specialGuestOrders,
      specialCompensationOrders,
      topSpecialOrderType,
    },
    statusBreakdown,
    orderTypeBreakdown,
    paymentMix,
    topProducts,
    topSpecialProducts,
    hourlySales,
    memberSplit: {
      memberOrders,
      memberSales,
      memberAov: safeAvg(memberSales, memberOrders),
      guestOrders,
      guestSales,
      guestAov: safeAvg(guestSales, guestOrders),
    },
    slowOrders,
    recentSpecialOrders,
    alerts,
    insights: buildInsights({
      averageOrderValue,
      memberOrderSharePct,
      completionRatePct,
      preparingOver15m: preparingAging.paidOver15m,
      preparingOver30m: preparingAging.paidOver30m,
      avgCompletedMinutes,
      topProducts,
      peakHour,
      topPayment,
      paymentMixAvailable: paymentMix.length > 0,
      specialOrders,
      specialValue,
      topSpecialOrderType,
    }),
  };
}

function buildAlerts(params: {
  recognizedOrders: number;
  completionRatePct: number;
  memberOrderSharePct: number;
  preparingOver15m: number;
  preparingOver30m: number;
  avgCompletedMinutes: number;
  slowOrders: Array<{
    orderCode: string;
    processMinutes: number | null;
  }>;
  specialOrders: number;
  specialValue: number;
}) {
  const alerts: string[] = [];

  if (params.preparingOver30m > 0) {
    alerts.push(`Có ${params.preparingOver30m} đơn đang treo quá 30 phút.`);
  }

  if (params.preparingOver15m > 0) {
    alerts.push(`Có ${params.preparingOver15m} đơn đang treo quá 15 phút.`);
  }

  if (params.recognizedOrders > 0 && params.completionRatePct < 80) {
    alerts.push(`Tỷ lệ completed chỉ đang ở ${params.completionRatePct}%.`);
  }

  if (params.recognizedOrders > 0 && params.memberOrderSharePct < 20) {
    alerts.push(`Tỷ lệ member thấp (${params.memberOrderSharePct}%), nên tăng nhắc đăng ký thành viên.`);
  }

  if (params.avgCompletedMinutes > 12) {
    alerts.push(`Thời gian hoàn tất trung bình đang cao (${params.avgCompletedMinutes} phút).`);
  }

  const slowest = params.slowOrders[0];
  if (slowest?.processMinutes && slowest.processMinutes > 20) {
    alerts.push(`Đơn chậm nhất hiện tại là ${slowest.orderCode} (${slowest.processMinutes} phút).`);
  }

  if (params.specialOrders > 0) {
    alerts.push(
      `Có ${params.specialOrders} đơn đặc biệt trong kỳ, tổng giá trị hàng xuất là ${params.specialValue.toLocaleString()}đ.`
    );
  }

  if (params.specialOrders >= 5) {
    alerts.push("Số lượng đơn đặc biệt đang khá cao, SM nên kiểm tra lý do test/free/internal.");
  }

  return alerts;
}

function buildInsights(params: {
  averageOrderValue: number;
  memberOrderSharePct: number;
  completionRatePct: number;
  preparingOver15m: number;
  preparingOver30m: number;
  avgCompletedMinutes: number;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  peakHour?: {
    hour: number;
    orderCount: number;
    revenue: number;
  };
  topPayment?: {
    method: string;
    amount: number;
  };
  paymentMixAvailable: boolean;
  specialOrders: number;
  specialValue: number;
  topSpecialOrderType?: string | null;
}) {
  const tips: string[] = [];

  if (params.preparingOver30m > 0) {
    tips.push("Có đơn treo quá 30 phút, SM nên kiểm tra bottleneck ở quầy pha chế hoặc khâu pickup.");
  } else if (params.preparingOver15m > 0) {
    tips.push("Có đơn treo quá 15 phút, nên theo dõi năng lực xử lý giờ cao điểm.");
  }

  if (params.completionRatePct < 80) {
    tips.push("Tỷ lệ completed còn thấp, nên kiểm tra quy trình từ tạo đơn đến ra món.");
  }

  if (params.avgCompletedMinutes > 12) {
    tips.push("Thời gian hoàn tất trung bình đang cao, nên cân nhắc tăng người ở khung giờ đông.");
  }

  if (params.memberOrderSharePct < 20) {
    tips.push("Tỷ trọng đơn member còn thấp, nên nhắc staff upsell đăng ký thành viên tại POS.");
  }

  if (params.averageOrderValue < 50000) {
    tips.push("AOV còn thấp, nên đẩy combo, upsize hoặc add-on.");
  }

  if (params.topProducts.length > 0) {
    const best = params.topProducts[0];
    tips.push(
      `Món đóng góp doanh thu cao nhất hiện tại là ${best.productName}, nên ưu tiên tồn kho và gợi ý bán kèm.`
    );
  }

  if (params.peakHour) {
    tips.push(
      `Khung giờ mạnh nhất là ${String(params.peakHour.hour).padStart(2, "0")}:00 với ${params.peakHour.orderCount} đơn, nên ưu tiên bố trí người trước khung này.`
    );
  }

  if (params.topPayment) {
    tips.push(
      `Phương thức thanh toán chiếm ưu thế hiện tại là ${params.topPayment.method}, nên đảm bảo flow thanh toán này luôn ổn định.`
    );
  }

  if (!params.paymentMixAvailable) {
    tips.push("Chưa có đủ dữ liệu payment mix, cần chạy thực tế thêm để theo dõi cơ cấu thanh toán.");
  }

  if (params.specialOrders > 0) {
    tips.push(
      `Có ${params.specialOrders} đơn đặc biệt, tổng giá trị hàng special là ${params.specialValue.toLocaleString()}đ.`
    );
  }

  if (params.topSpecialOrderType) {
    tips.push(
      `Loại đơn đặc biệt xuất hiện nhiều nhất là ${params.topSpecialOrderType}, SM nên rà lại mục đích sử dụng để tránh thất thoát.`
    );
  }

  return tips;
}