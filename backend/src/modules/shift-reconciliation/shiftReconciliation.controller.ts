import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  closeShiftReconciliationSchema,
  listShiftReconciliationsQuerySchema,
  openShiftReconciliationSchema,
  verifyShiftCloseSchema,
} from "./shiftReconciliation.schema";
import {
  closeShiftReconciliation,
  getCurrentShiftReconciliation,
  getShiftReconciliationDetail,
  listShiftReconciliations,
  openShiftReconciliation,
  verifyShiftClose,
} from "./shiftReconciliation.service";

/**
 * Trích xuất an toàn tenantId và storeId từ JWT context hoặc request headers/params
 */
function getContextFromReq(req: Request): { tenantId: number; storeId: number } {
  const u = (req as any).user;
  if (!u) throw new ApiError(401, "Unauthorized");

  const tenantId = Number(u.tenantId);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new ApiError(403, "Tenant context is required");
  }

  const headerStore = req.headers["x-store-id"] ? Number(req.headers["x-store-id"]) : null;
  const queryStore = req.query.storeId ? Number(req.query.storeId) : null;
  const bodyStore = req.body && req.body.storeId ? Number(req.body.storeId) : null;

  const storeId = headerStore || queryStore || bodyStore || u.storeId;
  if (!Number.isInteger(Number(storeId)) || Number(storeId) <= 0) {
    throw new ApiError(400, "STORE_SELECTION_REQUIRED");
  }

  return { tenantId, storeId: Number(storeId) };
}

export const openPosShiftReconciliation = asyncHandler(
  async (req: Request, res: Response) => {
    const { tenantId, storeId } = getContextFromReq(req);
    const body = openShiftReconciliationSchema.parse(req.body);

    const result = await openShiftReconciliation({
      reqUser: req.user,
      tenantId,
      storeId,
      workDate: body.workDate,
      shiftCode: body.shiftCode,
      openingCashAmount: body.openingCashAmount,
      shiftSessionId: body.shiftSessionId,
      note: body.note,
    });

    res.json({
      ok: true,
      ...result,
    });
  }
);

export const getCurrentPosShiftReconciliation = asyncHandler(
  async (req: Request, res: Response) => {
    const { tenantId, storeId } = getContextFromReq(req);
    const result = await getCurrentShiftReconciliation({
      tenantId,
      storeId,
    });

    res.json({
      ok: true,
      current: result,
    });
  }
);

export const getPosShiftReconciliationDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ApiError(400, "Invalid reconciliation id");

    const { tenantId, storeId } = getContextFromReq(req);

    const result = await getShiftReconciliationDetail({
      id,
      tenantId,
      storeId,
    });

    res.json({
      ok: true,
      ...result,
    });
  }
);

export const verifyPosShiftClose = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ApiError(400, "Invalid reconciliation id");

    const { tenantId, storeId } = getContextFromReq(req);
    const body = verifyShiftCloseSchema.parse(req.body);

    const result = await verifyShiftClose({
      id,
      tenantId,
      storeId,
      actualCashAmount: body.actualCashAmount,
    });

    res.json({
      ok: true,
      ...result,
    });
  }
);

export const closePosShiftReconciliation = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ApiError(400, "Invalid reconciliation id");

    const { tenantId, storeId } = getContextFromReq(req);
    const body = closeShiftReconciliationSchema.parse(req.body);

    const result = await closeShiftReconciliation({
      reqUser: req.user,
      id,
      tenantId,
      storeId,
      actualCashAmount: body.actualCashAmount,
      confirmActualCashAmount: body.confirmActualCashAmount,
      confirmText: body.confirmText,
      note: body.note,
    });

    res.json({
      ok: true,
      ...result,
    });
  }
);

export const listPosShiftReconciliations = asyncHandler(
  async (req: Request, res: Response) => {
    const { tenantId, storeId } = getContextFromReq(req);
    const q = listShiftReconciliationsQuerySchema.parse(req.query);

    const result = await listShiftReconciliations({
      tenantId,
      storeId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      status: q.status,
      shiftCode: q.shiftCode,
      limit: q.limit,
      offset: q.offset,
    });

    res.json({
      ok: true,
      ...result,
    });
  }
);
