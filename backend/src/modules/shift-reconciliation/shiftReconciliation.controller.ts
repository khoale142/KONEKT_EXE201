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

function getStoreIdFromReq(req: Request): number {
  const u = req.user;
  if (!u) throw new ApiError(401, "Unauthorized");
  const isCrossPortal = (u.roles || []).some((r: string) => ["owner", "platform_admin"].includes(r));
  if (u.portal !== "POS" && !isCrossPortal) throw new ApiError(403, "Forbidden (portal)");
  const sid = u.storeId || (isCrossPortal && u.storeIds && u.storeIds[0]);
  if (!sid) throw new ApiError(400, "POS missing storeId");
  return Number(sid);
}

export const openPosShiftReconciliation = asyncHandler(
  async (req: Request, res: Response) => {
    const body = openShiftReconciliationSchema.parse(req.body);

    const result = await openShiftReconciliation({
      reqUser: req.user,
      storeId: getStoreIdFromReq(req),
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
    const result = await getCurrentShiftReconciliation({
      storeId: getStoreIdFromReq(req),
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

    const result = await getShiftReconciliationDetail({
      id,
      storeId: getStoreIdFromReq(req),
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

    const body = verifyShiftCloseSchema.parse(req.body);

    const result = await verifyShiftClose({
      id,
      storeId: getStoreIdFromReq(req),
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

    const body = closeShiftReconciliationSchema.parse(req.body);

    const result = await closeShiftReconciliation({
      reqUser: req.user,
      id,
      storeId: getStoreIdFromReq(req),
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
    const q = listShiftReconciliationsQuerySchema.parse(req.query);

    const result = await listShiftReconciliations({
      storeId: getStoreIdFromReq(req),
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