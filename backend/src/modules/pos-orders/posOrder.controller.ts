import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  createPosOrderService,
  listPosOrdersService,
  getPosOrderDetailService,
  holdPosOrderService,
  listHeldOrdersService,
  deleteHeldOrderService,
  listPaidOrdersService,
  getStorePosConfigService,
  updateStorePosConfigService,
  posPreviewOrderPricingService,
  posListAvailablePromotionsService,
  posGetHeldOrderSnapshotService,
  posPayHeldOrderService,
} from "./posOrder.service";

function getStoreIdFromReq(req: Request): number {
  const u = (req as any).user;
  if (!u) throw new ApiError(401, "Unauthorized");
  const isCrossPortal = (u.roles || []).some((r: string) => ["owner", "platform_admin"].includes(r));
  if (u.portal !== "POS" && !isCrossPortal) throw new ApiError(403, "Forbidden (portal)");
  const sid = u.storeId || (isCrossPortal && u.storeIds && u.storeIds[0]) || 1;
  return Number(sid);
}

function getTenantIdFromReq(req: Request): number {
  const u = (req as any).user;
  return Number(u?.tenantId || 1);
}

function getActorUserId(req: Request): number | null {
  const u = (req as any).user;
  const raw = u?.sub ?? u?.id;
  return raw ? Number(raw) : null;
}

export const posCreateOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const cashierId = getActorUserId(req);
    const body = req.body || {};

    const result = await createPosOrderService({
      tenantId,
      storeId,
      cashierId,
      customerId: body.customerId ? Number(body.customerId) : null,
      pickupNumber: body.pickupNumber ? Number(body.pickupNumber) : undefined,
      orderType: body.orderType,
      serviceMode: body.serviceMode,
      serviceIdentifier: body.serviceIdentifier,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      discountAmount: body.discountAmount ? Number(body.discountAmount) : 0,
      discountReason: body.discountReason,
      specialNote: body.specialNote,
      items: Array.isArray(body.items) ? body.items : [],
      payment: body.payment || { method: "cash" },
    });

    res.json(result);
  }
);

export const posHoldOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const cashierId = getActorUserId(req);
    const body = req.body || {};

    const result = await holdPosOrderService({
      tenantId,
      storeId,
      cashierId,
      customerId: body.customerId ? Number(body.customerId) : null,
      orderType: body.orderType,
      serviceMode: body.serviceMode,
      serviceIdentifier: body.serviceIdentifier,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      specialNote: body.specialNote,
      items: Array.isArray(body.items) ? body.items : [],
    });

    res.json(result);
  }
);

export const posListHeldOrdersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);

    const result = await listHeldOrdersService(tenantId, storeId);
    res.json(result);
  }
);

export const posDeleteHeldOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await deleteHeldOrderService(orderId, tenantId, storeId);
    res.json(result);
  }
);

export const posListPaidOrdersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const query = req.query || {};

    const result = await listPaidOrdersService({
      tenantId,
      storeId,
      orderCode: query.orderCode ? String(query.orderCode) : undefined,
      customerPhone: query.memberPhone ? String(query.memberPhone) : undefined,
      serviceIdentifier: query.serviceIdentifier ? String(query.serviceIdentifier) : undefined,
      dateFrom: query.dateFrom ? String(query.dateFrom) : undefined,
      dateTo: query.dateTo ? String(query.dateTo) : undefined,
      limit: query.limit ? Number(query.limit) : 50,
    });

    res.json(result);
  }
);

export const posListOrdersHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);

    const result = await listPosOrdersService(tenantId, storeId);
    res.json(result);
  }
);

export const posGetOrderDetailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await getPosOrderDetailService(orderId, tenantId, storeId);
    res.json(result);
  }
);

export const posGetStoreConfigHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);

    const result = await getStorePosConfigService(storeId, tenantId);
    res.json(result);
  }
);

export const posUpdateStoreConfigHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const body = req.body || {};

    const result = await updateStorePosConfigService(storeId, tenantId, body);
    res.json(result);
  }
);

export const posPreviewOrderPricingHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const body = req.body || {};

    const result = await posPreviewOrderPricingService({
      storeId,
      tenantId,
      customerId: body.customerId ? Number(body.customerId) : undefined,
      voucherCode: body.voucherCode,
      promotionCode: body.promotionCode,
      selectedGiftItems: body.selectedGiftItems,
      items: Array.isArray(body.items) ? body.items : [],
      combos: Array.isArray(body.combos) ? body.combos : [],
      appliedComboRules: Array.isArray(body.appliedComboRules) ? body.appliedComboRules : [],
      orderType: body.orderType,
      specialNote: body.specialNote,
    });

    res.json(result);
  }
);

export const posListAvailablePromotionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = getTenantIdFromReq(req);
    const storeId = getStoreIdFromReq(req);
    const body = req.body || {};

    const result = await posListAvailablePromotionsService({
      storeId,
      tenantId,
      customerId: body.customerId ? Number(body.customerId) : undefined,
      items: Array.isArray(body.items) ? body.items : [],
      combos: Array.isArray(body.combos) ? body.combos : [],
    });

    res.json(result);
  }
);

export const posGetHeldOrderSnapshotHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = getStoreIdFromReq(req);
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");

    const result = await posGetHeldOrderSnapshotService(orderId, storeId);
    res.json(result);
  }
);

export const posPayHeldOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = getStoreIdFromReq(req);
    const cashierId = getActorUserId(req);
    const orderId = Number(req.params.id);
    if (!orderId) throw new ApiError(400, "Invalid order id");
    const body = req.body || {};

    const result = await posPayHeldOrderService({
      orderId,
      storeId,
      cashierId,
      payment: body.payment || { method: "cash" },
      orderType: body.orderType,
      specialNote: body.specialNote,
      serviceMode: body.serviceMode,
      serviceIdentifier: body.serviceIdentifier,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
    });

    res.json(result);
  }
);

