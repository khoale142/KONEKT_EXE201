import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  memberPreviewPricingSchema,
  memberCreateOrderSchema,
  memberListOrdersQuerySchema,
  memberOrderReviewBodySchema,
  memberPickupPostponeBodySchema,
} from "./memberOrders.schema";
import {
  customerCreateOrderIssueSchema,
  customerListOrderIssuesQuerySchema,
} from "../order-issues/orderIssues.schema";
import {
  previewMemberOrderPricing,
  createMemberOrder,
  listMemberOrders,
  getMemberOrderDetail,
  createOrUpdateMemberOrderReview,
  listMemberIssues,
  createMemberOrderIssue,
  getMemberResumeOrderSummary,
  createMemberPickupPostponeRequest,
  resumeMemberOrderPayment as resumeMemberOrderPaymentService,
} from "./memberOrders.service";
import { previewEligibleComboRules } from "../combo-rules/comboRule.service";

function getCustomerId(req: Request): number {
  const u = req.user;
  if (!u?.sub) throw new ApiError(401, "Unauthorized");
  if (u.portal !== "CUSTOMER") throw new ApiError(403, "Forbidden (CUSTOMER only)");
  return Number(u.sub);
}

export const memberPreviewPricing = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const body = memberPreviewPricingSchema.parse(req.body);

  const result = await previewMemberOrderPricing({
    storeId: body.storeId,
    customerId,
    voucherCode: body.voucherCode,
    promotionCode: body.promotionCode,
    selectedGiftItems: body.selectedGiftItems,
    items: body.items,
    combos: body.combos,
    appliedComboRules: body.appliedComboRules,
  });

  res.json(result);
});
export const memberPreviewComboRules = asyncHandler(async (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const data = await previewEligibleComboRules({
    items: items.map((x: any) => ({
      productVariantId: Number(x.productVariantId),
      quantity: Number(x.quantity),
    })),
  });

  res.json(data);
});

export const memberCreateOrder = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const body = memberCreateOrderSchema.parse(req.body);

  const result = await createMemberOrder({
    storeId: body.storeId,
    customerId,
    voucherCode: body.voucherCode,
    promotionCode: body.promotionCode,
    selectedGiftItems: body.selectedGiftItems,
    items: body.items,
    combos: body.combos,
    appliedComboRules: body.appliedComboRules,
    paymentReferenceCode: body.paymentReferenceCode,
  });

  res.json(result);
});
export const memberListOrders = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const query = memberListOrdersQuerySchema.parse(req.query);

  const result = await listMemberOrders({
    customerId,
    status: query.status,
    storeId: query.storeId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit,
    offset: query.offset,
  });

  res.json(result);
});

export const memberResumeOrderSummary = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const result = await getMemberResumeOrderSummary(customerId);
  res.json(result);
});

export const memberResumeOrderPayment = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const result = await resumeMemberOrderPaymentService({
    orderId,
    customerId,
  });
  res.json(result);
});

export const memberListOrderIssues = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const query = customerListOrderIssuesQuerySchema.parse(req.query || {});

  const result = await listMemberIssues({
    customerId,
    status: query.status,
    issueType: query.issueType,
    search: query.search,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit,
    offset: query.offset,
  });

  res.json(result);
});

export const memberGetOrderDetail = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const result = await getMemberOrderDetail({ orderId, customerId });
  res.json(result);
});

export const memberCreateOrderReview = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const body = memberOrderReviewBodySchema.parse(req.body);

  const result = await createOrUpdateMemberOrderReview({
    orderId,
    customerId,
    rating: body.rating,
    comment: (body.comment ?? "").trim(),
    serviceRating: body.serviceRating,
    foodRating: body.foodRating,
  });

  res.json(result);
});

export const memberCreatePickupPostponeRequest = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const body = memberPickupPostponeBodySchema.parse(req.body || {});

  const result = await createMemberPickupPostponeRequest({
    orderId,
    customerId,
    reason: body.reason,
    expectedArrivalAt: body.expectedArrivalAt ?? body.expectedPickupVisitAt ?? body.requestedPickupTime ?? null,
  });

  res.status(201).json(result);
});

export const memberCreateIssueForOrder = asyncHandler(async (req: Request, res: Response) => {
  const customerId = getCustomerId(req);
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const body = customerCreateOrderIssueSchema.parse(req.body || {});

  const result = await createMemberOrderIssue({
    orderId,
    customerId,
    issueType: body.issueType,
    description: body.description,
  });

  res.status(201).json(result);
});
