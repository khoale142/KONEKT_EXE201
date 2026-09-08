import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  confirmOnlineOrderSchema,
  createPosOrderForGatewaySchema,
  createPosOrderSchema,
  createVoidRequestSchema,
  getOrdersQuerySchema,
  holdPosOrderSchema,
  listAvailablePromotionsSchema,
  listHeldOrdersQuerySchema,
  listOnlinePendingOrdersQuerySchema,
  listPaidOrdersQuerySchema,
  listVoidRequestsQuerySchema,
  payHeldOrderSchema,
  previewPosOrderPricingSchema,
  refundOrderSchema,
} from "./orders.schema";
import {
  posListOrderIssuesQuerySchema,
  posUpdateOrderIssueSchema,
} from "../order-issues/orderIssues.schema";
import {
  confirmPosOnlineOrder,
  createPosOrder,
  createPosOrderForGateway,
  createPosOrderVoidRequest,
  getPosHeldOrderSnapshot,
  getPosOrderDetail,
  holdPosOrder,
  listHeldPosOrders,
  listPaidPosOrders,
  listPosAvailablePromotions,
  listPosOnlinePendingOrders,
  listPosOrderVoidRequests,
  listPosOrders,
  payHeldPosOrder,
  previewPosOrderPricing,
  refundPosOrder,
  voidHeldPosOrder,
  getPublicPickupBoard,
} from "./orders.service";
import {
  listStoreOrderIssues,
  updateStoreOrderIssueStatus,
} from "../order-issues/orderIssues.service";

function getStoreIdFromReq(req: Request): number {
  const u = req.user;
  if (!u) throw new ApiError(401, "Unauthorized");
  if (u.portal !== "POS") throw new ApiError(403, "Forbidden (portal)");
  if (!u.storeId) throw new ApiError(400, "POS missing storeId");
  return Number(u.storeId);
}

function getActorUserId(req: Request): number {
  const u = req.user;
  if (!u?.sub) throw new ApiError(401, "Unauthorized");
  return Number(u.sub);
}

export const posPreviewOrderPricing = asyncHandler(
  async (req: Request, res: Response) => {
    const body = previewPosOrderPricingSchema.parse(req.body);

    const result = await previewPosOrderPricing({
      storeId: getStoreIdFromReq(req),
      customerId: body.customerId,
      voucherCode: body.voucherCode,
      promotionCode: body.promotionCode,
      selectedGiftItems: body.selectedGiftItems,
      items: body.items,
      combos: body.combos,
      appliedComboRules: body.appliedComboRules,
      orderType: body.orderType,
      specialNote: body.specialNote,
    });

    res.json(result);
  },
);

export const posCreateOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createPosOrderSchema.parse(req.body);

    const result = await createPosOrder({
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      pickupNumber: body.pickupNumber,
      customerId: body.customerId,
      voucherCode: body.voucherCode,
      promotionCode: body.promotionCode,
      selectedGiftItems: body.selectedGiftItems,
      items: body.items,
      combos: body.combos,
      appliedComboRules: body.appliedComboRules,
      orderType: body.orderType,
      specialNote: body.specialNote,
      payment: body.payment,
      serviceMode: body.serviceMode,
    });

    res.json(result);
  },
);

export const posCreateOrderForGateway = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createPosOrderForGatewaySchema.parse(req.body);

    const result = await createPosOrderForGateway({
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      pickupNumber: body.pickupNumber,
      customerId: body.customerId,
      voucherCode: body.voucherCode,
      promotionCode: body.promotionCode,
      selectedGiftItems: body.selectedGiftItems,
      items: body.items,
      combos: body.combos,
      appliedComboRules: body.appliedComboRules,
      orderType: body.orderType,
      specialNote: body.specialNote,
      payment: { method: "gateway" },
      serviceMode: body.serviceMode,
    });

    res.json(result);
  },
);

export const posHoldOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const body = holdPosOrderSchema.parse(req.body);

    const result = await holdPosOrder({
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      pickupNumber: body.pickupNumber,
      customerId: body.customerId,
      voucherCode: body.voucherCode,
      promotionCode: body.promotionCode,
      selectedGiftItems: body.selectedGiftItems,
      items: body.items,
      combos: body.combos,
      appliedComboRules: body.appliedComboRules,
      orderType: body.orderType,
      specialNote: body.specialNote,
      snapshot: body.snapshot,
      serviceMode: body.serviceMode,
    });

    res.json(result);
  },
);

export const posListAvailablePromotions = asyncHandler(
  async (req: Request, res: Response) => {
    const body = listAvailablePromotionsSchema.parse(req.body || {});

    const result = await listPosAvailablePromotions({
      storeId: getStoreIdFromReq(req),
      customerId: body.customerId,
      items: body.items,
      combos: body.combos,
      appliedComboRules: body.appliedComboRules,
    });

    res.json(result);
  },
);

export const posPayHeldOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const body = payHeldOrderSchema.parse(req.body);

    const result = await payHeldPosOrder({
      orderId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      payment: body.payment,
      orderType: body.orderType,
      specialNote: body.specialNote,
      serviceMode: body.serviceMode,
    });

    res.json(result);
  },
);

export const posVoidHeldOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await voidHeldPosOrder({
      orderId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
    });

    res.json(result);
  },
);

export const posGetHeldOrderSnapshot = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await getPosHeldOrderSnapshot({
      orderId,
      storeId: getStoreIdFromReq(req),
    });

    res.json(result);
  },
);

export const posCreateVoidRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const body = createVoidRequestSchema.parse(req.body);

    const result = await createPosOrderVoidRequest({
      orderId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      reason: body.reason,
    });

    res.status(201).json(result);
  },
);

export const posListHeldOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listHeldOrdersQuerySchema.parse(req.query);

    const result = await listHeldPosOrders({
      storeId: getStoreIdFromReq(req),
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const posListVoidRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listVoidRequestsQuerySchema.parse(req.query);

    const result = await listPosOrderVoidRequests({
      storeId: getStoreIdFromReq(req),
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const posListPaidOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listPaidOrdersQuerySchema.parse(req.query || {});

    const result = await listPaidPosOrders({
      storeId: getStoreIdFromReq(req),
      orderCode: q.orderCode,
      pickupNumber: q.pickupNumber,
      memberPhone: q.memberPhone,
      refundStatus: q.refundStatus,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const posListOnlinePendingOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listOnlinePendingOrdersQuerySchema.parse(req.query || {});

    const result = await listPosOnlinePendingOrders({
      storeId: getStoreIdFromReq(req),
      orderCode: q.orderCode,
      memberPhone: q.memberPhone,
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const posConfirmOnlineOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const body = confirmOnlineOrderSchema.parse(req.body);

    const result = await confirmPosOnlineOrder({
      orderId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      pickupNumber: body.pickupNumber,
      serviceMode: body.serviceMode,
    });

    res.json(result);
  },
);

export const posListOrderIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const q = posListOrderIssuesQuerySchema.parse(req.query || {});

    const result = await listStoreOrderIssues({
      storeId: getStoreIdFromReq(req),
      status: q.status,
      issueType: q.issueType,
      search: q.search,
      orderCode: q.orderCode,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const posUpdateOrderIssueStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketId = Number(req.params.ticketId);
    if (!ticketId) throw new ApiError(400, "Invalid ticket id");

    const body = posUpdateOrderIssueSchema.parse(req.body || {});

    const result = await updateStoreOrderIssueStatus({
      ticketId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      status: body.status,
      internalNote: body.internalNote,
      resolutionNote: body.resolutionNote,
    });

    res.json(result);
  },
);

export const posGetOrderDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await getPosOrderDetail({
      orderId,
      storeId: getStoreIdFromReq(req),
    });

    res.json(result);
  },
);

export const posRefundOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const body = refundOrderSchema.parse(req.body);

    const result = await refundPosOrder({
      orderId,
      storeId: getStoreIdFromReq(req),
      actorUserId: getActorUserId(req),
      refundType: body.refundType,
      reason: body.reason,
      items: body.items || [],
    });

    res.json(result);
  },
);

export const posListOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const q = getOrdersQuerySchema.parse(req.query);

    const result = await listPosOrders({
      storeId: getStoreIdFromReq(req),
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });

    res.json(result);
  },
);

export const publicGetPickupBoard = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = Number(req.params.storeId);
    if (!Number.isFinite(storeId) || storeId <= 0) {
      throw new ApiError(400, "Invalid storeId");
    }

    const rawLimit = req.query?.limit ? Number(req.query.limit) : 80;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 80;

    const result = await getPublicPickupBoard({
      storeId,
      limit,
    });

    res.json(result);
  },
);
