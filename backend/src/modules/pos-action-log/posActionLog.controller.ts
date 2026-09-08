import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPosActionLogs } from "./posActionLog.service";
import { ApiError } from "../../utils/apiError";

export const listPosActionLogs = asyncHandler(async (req: Request, res: Response) => {
  const storeIdRaw =
    req.query.storeId ??
    (req.user as any)?.storeId ??
    (req.user as any)?.branchId;

  const storeId = Number(storeIdRaw);

  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new ApiError(400, "storeId khong hop le");
  }

  const result = await getPosActionLogs({
    storeId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    reconciliationId: req.query.reconciliationId
      ? Number(req.query.reconciliationId)
      : undefined,
    actionType: req.query.actionType ? String(req.query.actionType) : undefined,
    orderCode: req.query.orderCode ? String(req.query.orderCode) : undefined,
    actorId: req.query.actorId ? Number(req.query.actorId) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });

  res.json(result);
});