import api from "../../../lib/http/axios";

export type DisposalReportType = "ingredient" | "finished_product";
export type DisposalPhysicalState = "already_disposed" | "quarantined";
export type DisposalReasonCode =
  | "wrong_item"
  | "wrong_recipe"
  | "overproduction"
  | "damaged"
  | "spoilage"
  | "expired"
  | "customer_remake"
  | "contamination"
  | "other";

export type DisposalReportStatus =
  | "submitted"
  | "under_sm_review"
  | "returned_for_explanation"
  | "verified_by_sm"
  | "included_in_disposal_order"
  | "duplicate_closed"
  | "released_back_to_stock"
  | "finalized";

export type DisposalOrderStatus =
  | "draft"
  | "submitted_to_dm"
  | "returned_to_sm"
  | "approved"
  | "cancelled";

export type DisposalReportLine = {
  id: number;
  reportId: number;
  lineNo: number;
  ingredientId: number | null;
  productVariantId: number | null;
  itemNameSnapshot: string;
  unitName: string;
  quantityReported: number;
  estimatedCost: number | null;
  note: string | null;
  evidenceUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export type DisposalReport = {
  id: number;
  code: string;
  storeId: number;
  reportType: DisposalReportType;
  physicalState: DisposalPhysicalState;
  reasonCode: DisposalReasonCode;
  status: DisposalReportStatus;
  relatedOrderId: number | null;
  description: string | null;
  createdByUserId: number;
  submittedAt: string;
  smReviewedByUserId: number | null;
  smReviewedAt: string | null;
  smReviewNote: string | null;
  returnedForExplanationByUserId: number | null;
  returnedForExplanationAt: string | null;
  returnExplanationRequiredNote: string | null;
  reporterExplanationNote: string | null;
  reporterExplainedByUserId: number | null;
  reporterExplainedAt: string | null;
  duplicateOfReportId: number | null;
  releasedBackByUserId: number | null;
  releasedBackAt: string | null;
  releasedBackNote: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: DisposalReportLine[];
};

export type DisposalOrderLine = {
  id: number;
  disposalOrderId: number;
  lineNo: number;
  sourceReportId: number | null;
  sourceReportLineId: number | null;
  sourceItemType: "ingredient" | "finished_product";
  sourceProductVariantId: number | null;
  ingredientId: number;
  ingredientNameSnapshot: string;
  deductionUnit: string;
  quantityToDeduct: number;
  unitCost: number | null;
  lineTotalCost: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisposalOrder = {
  id: number;
  code: string;
  storeId: number;
  status: DisposalOrderStatus;
  createdByUserId: number;
  submittedByUserId: number | null;
  submittedAt: string | null;
  dmReviewedByUserId: number | null;
  dmReviewedAt: string | null;
  dmReviewNote: string | null;
  returnedToSmNote: string | null;
  cancelledByUserId: number | null;
  cancelledAt: string | null;
  cancelledNote: string | null;
  stockApplied: boolean;
  stockAppliedAt: string | null;
  stockAppliedByUserId: number | null;
  stockApplyError: string | null;
  totalEstimatedCost: number;
  createdAt: string;
  updatedAt: string;
  reportCount?: number;
  lineCount?: number;
  reports?: DisposalReport[];
  lines?: DisposalOrderLine[];
};

export type DisposalIngredientOption = {
  id: number;
  code: string | null;
  name: string;
  category: string | null;
  storageUnit: string | null;
  usageUnit: string | null;
  conversionRatio: number | null;
  label: string;
};

export type DisposalVariantOption = {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  size: string | null;
  costPrice: number | null;
  label: string;
};

export const inventoryDisposalsApi = {
  createReport: (payload: {
    storeId: number;
    reportType: DisposalReportType;
    physicalState: DisposalPhysicalState;
    reasonCode: DisposalReasonCode;
    relatedOrderId?: number;
    description?: string;
    lines: Array<{
      ingredientId?: number;
      productVariantId?: number;
      unitName?: string;
      quantityReported: number;
      estimatedCost?: number;
      note?: string;
      evidenceUrls?: string[];
    }>;
  }) =>
    api
      .post<{
        ok: boolean;
        report: DisposalReport;
      }>("/inventory-disposals/reports", payload)
      .then((r) => r.data),

  listMyReports: (params: {
    storeId: number;
    status?: DisposalReportStatus;
    reasonCode?: DisposalReasonCode;
    reportType?: DisposalReportType;
    physicalState?: DisposalPhysicalState;
    search?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{
        ok: boolean;
        reports: DisposalReport[];
      }>("/inventory-disposals/reports/my", { params })
      .then((r) => r.data),

  listIngredientOptions: (params?: { q?: string; limit?: number }) =>
    api
      .get<{
        ok: boolean;
        items: DisposalIngredientOption[];
      }>("/inventory-disposals/lookups/ingredients", { params })
      .then((r) => r.data),

  listVariantOptions: (params?: { q?: string; limit?: number }) =>
    api
      .get<{
        ok: boolean;
        items: DisposalVariantOption[];
      }>("/inventory-disposals/lookups/variants", { params })
      .then((r) => r.data),

  listStoreReports: (params: {
    storeId: number;
    status?: DisposalReportStatus;
    reasonCode?: DisposalReasonCode;
    reportType?: DisposalReportType;
    physicalState?: DisposalPhysicalState;
    search?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{ ok: boolean; reports: DisposalReport[] }>(
        "/inventory-disposals/reports/store-review",
        {
          params,
        },
      )
      .then((r) => r.data),

  returnForExplanation: (
    reportId: number,
    payload: { storeId: number; note: string },
  ) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/return-for-explanation`, payload)
      .then((r) => r.data),

  explainReport: (
    reportId: number,
    payload: { storeId: number; explanationNote: string },
  ) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/explain`, payload)
      .then((r) => r.data),

  cancelReport: (reportId: number, payload: { storeId: number; note: string }) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/cancel`, payload)
      .then((r) => r.data),

  markVerified: (reportId: number, payload: { storeId: number }) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/mark-verified`, payload)
      .then((r) => r.data),

  markDuplicate: (
    reportId: number,
    payload: { storeId: number; duplicateOfReportId: number; note?: string },
  ) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/mark-duplicate`, payload)
      .then((r) => r.data),

  releaseBack: (reportId: number, payload: { storeId: number; note: string }) =>
    api
      .patch<{
        ok: boolean;
        report: DisposalReport;
      }>(`/inventory-disposals/reports/${reportId}/release-back`, payload)
      .then((r) => r.data),

  createOrder: (payload: { storeId: number; reportIds: number[] }) =>
    api
      .post<{
        ok: boolean;
        order: DisposalOrder;
      }>("/inventory-disposals/orders", payload)
      .then((r) => r.data),

  listOrders: (params: {
    storeId: number;
    status?: DisposalOrderStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{
        ok: boolean;
        orders: DisposalOrder[];
      }>("/inventory-disposals/orders", { params })
      .then((r) => r.data),

  getOrderDetail: (orderId: number, params: { storeId: number }) =>
    api
      .get<{
        ok: boolean;
        order: DisposalOrder;
      }>(`/inventory-disposals/orders/${orderId}`, { params })
      .then((r) => r.data),

  submitOrder: (orderId: number, payload: { storeId: number }) =>
    api
      .post<{
        ok: boolean;
        order: DisposalOrder;
      }>(`/inventory-disposals/orders/${orderId}/submit`, payload)
      .then((r) => r.data),

  cancelOrder: (orderId: number, payload: { storeId: number; note: string }) =>
    api
      .post<{
        ok: boolean;
        order: DisposalOrder;
      }>(`/inventory-disposals/orders/${orderId}/cancel`, payload)
      .then((r) => r.data),

  returnOrder: (orderId: number, payload: { storeId: number; note: string }) =>
    api
      .post<{
        ok: boolean;
        order: DisposalOrder;
      }>(`/inventory-disposals/orders/${orderId}/return`, payload)
      .then((r) => r.data),

  approveOrder: (
    orderId: number,
    payload: { storeId: number; note?: string },
  ) =>
    api
      .post<{
        ok: boolean;
        order: DisposalOrder;
      }>(`/inventory-disposals/orders/${orderId}/approve`, payload)
      .then((r) => r.data),
};
