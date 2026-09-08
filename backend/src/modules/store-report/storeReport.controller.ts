import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { getStoreReportOverview } from "./storeReport.service";

function getStoreIdFromReq(req: Request): number {
  const u = req.user;
  if (!u) throw new ApiError(401, "Unauthorized");

  if (u.portal === "POS") {
    if (!u.storeId) throw new ApiError(400, "POS missing storeId");
    return Number(u.storeId);
  }

  const storeIds = Array.isArray(u.storeIds) ? u.storeIds.map(Number) : [];
  if (!storeIds.length) throw new ApiError(400, "User has no store access");

  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (qStoreId && storeIds.includes(qStoreId)) return qStoreId;

  return storeIds[0];
}

export const getTodayOverview = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);

  const data = await getStoreReportOverview({
    storeId,
    topN: req.query.topN ? Number(req.query.topN) : 10,
  });

  res.json({
    ok: true,
    ...data,
  });
});

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);

  const data = await getStoreReportOverview({
    storeId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    topN: req.query.topN ? Number(req.query.topN) : 10,
  });

  res.json({
    ok: true,
    ...data,
  });
});