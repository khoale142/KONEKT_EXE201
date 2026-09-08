import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  approveDisposalOrderSchema,
  cancelDisposalOrderSchema,
  cancelDisposalReportSchema,
  createDisposalOrderSchema,
  createDisposalReportSchema,
  listDisposalOrdersQuerySchema,
  listDisposalReportsQuerySchema,
  markDuplicateDisposalReportSchema,
  releaseBackToStockSchema,
  returnDisposalOrderSchema,
} from "./inventoryDisposals.schema";
import {
  approveDisposalOrder,
  cancelDisposalOrder,
  cancelDisposalReportBySm,
  createDisposalOrder,
  createDisposalReport,
  getDisposalOrderDetail,
  listDisposalOrders,
  listMyDisposalReports,
  listStoreDisposalReports,
  markDisposalReportDuplicate,
  markDisposalReportVerified,
  releaseDisposalReportBackToStock,
  returnDisposalOrderToSm,
  submitDisposalOrder,
  searchDisposalIngredients,
  searchDisposalProductVariants,
} from "./inventoryDisposals.service";

function getStoreContext(req: Request) {
  const u: any = req.user;
  if (!u?.sub) throw new ApiError(401, "Unauthorized");

  // POS portal: có sẵn 1 storeId
  if (u.portal === "POS" && u.storeId) {
    return {
      actorUserId: Number(u.sub),
      storeId: Number(u.storeId),
      portal: String(u.portal),
      roles: Array.isArray(u.roles) ? u.roles : [],
    };
  }

  const storeIds = Array.isArray(u.storeIds)
    ? u.storeIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x))
    : [];

  if (!storeIds.length) {
    throw new ApiError(403, "User khong duoc gan cua hang nao");
  }

  // STORE/OFFICE: nếu chỉ có 1 store thì tự lấy
  if (storeIds.length === 1) {
    return {
      actorUserId: Number(u.sub),
      storeId: Number(storeIds[0]),
      portal: String(u.portal),
      roles: Array.isArray(u.roles) ? u.roles : [],
    };
  }

  const rawStoreId =
    req.body?.storeId ??
    req.query?.storeId ??
    req.params?.storeId;

  const selectedStoreId = Number(rawStoreId);
  if (!selectedStoreId) {
    throw new ApiError(400, "Missing storeId");
  }

  if (!storeIds.includes(selectedStoreId)) {
    throw new ApiError(403, "Khong co quyen voi cua hang nay");
  }

  return {
    actorUserId: Number(u.sub),
    storeId: selectedStoreId,
    portal: String(u.portal),
    roles: Array.isArray(u.roles) ? u.roles : [],
  };
}

export const createInventoryDisposalReport = asyncHandler(async (req: Request, res: Response) => {
  const body = createDisposalReportSchema.parse(req.body || {});
  const ctx = getStoreContext(req);

  const result = await createDisposalReport({
    ...ctx,
    reportType: body.reportType,
    physicalState: body.physicalState,
    reasonCode: body.reasonCode,
    relatedOrderId: body.relatedOrderId,
    description: body.description,
    lines: body.lines,
  });

  res.json(result);
});

export const listMyInventoryDisposalReports = asyncHandler(async (req: Request, res: Response) => {
  const q = listDisposalReportsQuerySchema.parse(req.query || {});
  const ctx = getStoreContext(req);

  const result = await listMyDisposalReports({
    ...ctx,
    ...q,
  });

  res.json(result);
});

export const listStoreInventoryDisposalReports = asyncHandler(async (req: Request, res: Response) => {
  const q = listDisposalReportsQuerySchema.parse(req.query || {});
  const ctx = getStoreContext(req);

  const result = await listStoreDisposalReports({
    storeId: ctx.storeId,
    ...q,
  });

  res.json(result);
});

export const cancelInventoryDisposalReport = asyncHandler(async (req: Request, res: Response) => {
  const body = cancelDisposalReportSchema.parse(req.body || {});
  const reportId = Number(req.params.id);
  if (!reportId) throw new ApiError(400, "Invalid report id");

  const ctx = getStoreContext(req);

  const result = await cancelDisposalReportBySm({
    reportId,
    ...ctx,
    note: body.note,
  });

  res.json(result);
});

export const markInventoryDisposalReportVerified = asyncHandler(async (req: Request, res: Response) => {
  const reportId = Number(req.params.id);
  if (!reportId) throw new ApiError(400, "Invalid report id");

  const ctx = getStoreContext(req);

  const result = await markDisposalReportVerified({
    reportId,
    ...ctx,
  });

  res.json(result);
});

export const markInventoryDisposalReportDuplicate = asyncHandler(async (req: Request, res: Response) => {
  const body = markDuplicateDisposalReportSchema.parse(req.body || {});
  const reportId = Number(req.params.id);
  if (!reportId) throw new ApiError(400, "Invalid report id");

  const ctx = getStoreContext(req);

  const result = await markDisposalReportDuplicate({
    reportId,
    ...ctx,
    duplicateOfReportId: body.duplicateOfReportId,
    note: body.note,
  });

  res.json(result);
});

export const releaseInventoryDisposalReportBackToStock = asyncHandler(async (req: Request, res: Response) => {
  const body = releaseBackToStockSchema.parse(req.body || {});
  const reportId = Number(req.params.id);
  if (!reportId) throw new ApiError(400, "Invalid report id");

  const ctx = getStoreContext(req);

  const result = await releaseDisposalReportBackToStock({
    reportId,
    ...ctx,
    note: body.note,
  });

  res.json(result);
});

export const createInventoryDisposalOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = createDisposalOrderSchema.parse(req.body || {});
  const ctx = getStoreContext(req);

  const result = await createDisposalOrder({
    ...ctx,
    reportIds: body.reportIds,
  });

  res.json(result);
});

export const listInventoryDisposalOrders = asyncHandler(async (req: Request, res: Response) => {
  const q = listDisposalOrdersQuerySchema.parse(req.query || {});
  const ctx = getStoreContext(req);

  const result = await listDisposalOrders({
    storeId: ctx.storeId,
    ...q,
  });

  res.json(result);
});

export const getInventoryDisposalOrderDetail = asyncHandler(async (req: Request, res: Response) => {
  const disposalOrderId = Number(req.params.id);
  if (!disposalOrderId) throw new ApiError(400, "Invalid disposal order id");

  const ctx = getStoreContext(req);

  const result = await getDisposalOrderDetail({
    disposalOrderId,
    storeId: ctx.storeId,
  });

  res.json(result);
});

export const submitInventoryDisposalOrder = asyncHandler(async (req: Request, res: Response) => {
  const disposalOrderId = Number(req.params.id);
  if (!disposalOrderId) throw new ApiError(400, "Invalid disposal order id");

  const ctx = getStoreContext(req);

  const result = await submitDisposalOrder({
    disposalOrderId,
    ...ctx,
  });

  res.json(result);
});

export const returnInventoryDisposalOrderToSm = asyncHandler(async (req: Request, res: Response) => {
  const body = returnDisposalOrderSchema.parse(req.body || {});
  const disposalOrderId = Number(req.params.id);
  if (!disposalOrderId) throw new ApiError(400, "Invalid disposal order id");

  const ctx = getStoreContext(req);

  const result = await returnDisposalOrderToSm({
    disposalOrderId,
    ...ctx,
    note: body.note,
  });

  res.json(result);
});

export const cancelInventoryDisposalOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = cancelDisposalOrderSchema.parse(req.body || {});
  const disposalOrderId = Number(req.params.id);
  if (!disposalOrderId) throw new ApiError(400, "Invalid disposal order id");

  const ctx = getStoreContext(req);

  const result = await cancelDisposalOrder({
    disposalOrderId,
    ...ctx,
    note: body.note,
  });

  res.json(result);
});

export const approveInventoryDisposalOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = approveDisposalOrderSchema.parse(req.body || {});
  const disposalOrderId = Number(req.params.id);
  if (!disposalOrderId) throw new ApiError(400, "Invalid disposal order id");

  const ctx = getStoreContext(req);

  const result = await approveDisposalOrder({
    disposalOrderId,
    ...ctx,
    note: body.note,
  });

  res.json(result);
});

export const listInventoryDisposalIngredientOptions = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || "");
  const limit = Number(req.query.limit || 20);

  const result = await searchDisposalIngredients({ q, limit });
  res.json(result);
});

export const listInventoryDisposalProductVariantOptions = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || "");
  const limit = Number(req.query.limit || 20);

  const result = await searchDisposalProductVariants({ q, limit });
  res.json(result);
});