import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  openInventorySession,
  getCurrentInventorySession,
  calculateInventorySession,
  saveDraftInventorySession,
  submitInventorySession,
  approveInventorySessionByShiftLeader,
  approveInventorySessionByStoreManager,
  approveInventorySessionByDm,
  rejectInventorySession,
  getInventorySessionReport,
  openInventoryBatch,
  getLatestInventoryBatch,
  searchInventoryBatches,
  createInventorySheet,
  getInventorySheetDetail,
  saveInventorySheetDraft,
  submitInventorySheet,
  getInventoryBatchDetail,
  submitInventoryBatch,
  recallInventoryBatch,
  approveInventoryBatchByShiftLeader,
  approveInventoryBatchByStoreManager,
  approveInventoryBatchByDm,
  rejectInventoryBatch,
  getInventoryBatchWorkspace,
  getShiftLeaderApprovalQueue,
  getStoreManagerApprovalQueue,
  getDmApprovalQueue,
} from "./inventoryAudit.service";

function getStoreIdFromReq(req: Request): number | null {
  const user = (req as any).user as any;

  if (user?.portal === "POS" && user?.storeId) {
    return Number(user.storeId);
  }

  const bodyStoreId = req.body?.storeId ? Number(req.body.storeId) : null;
  const queryStoreId = req.query?.storeId ? Number(req.query.storeId) : null;

  if (bodyStoreId) return bodyStoreId;
  if (queryStoreId) return queryStoreId;

  return null;
}

function mapItems(bodyItems: any[]) {
  return bodyItems.map((x: any) => ({
    ingredientId: Number(x.ingredientId),
    actualClosingQty:
      x.actualClosingQty == null || x.actualClosingQty === ""
        ? null
        : Number(x.actualClosingQty),
    note: x.note ? String(x.note) : null,
  }));
}

export const openSession = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const shiftId = req.body?.shiftId ? Number(req.body.shiftId) : null;
  const workDate = String(req.body?.workDate || "").trim();
  const note = req.body?.note ? String(req.body.note) : null;

  if (!workDate) throw new ApiError(400, "workDate is required");

  const data = await openInventorySession({
    reqUser: (req as any).user,
    storeId,
    shiftId,
    workDate,
    note,
  });

  res.json({ ok: true, session: data });
});

export const getCurrentSession = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const shiftId = req.query?.shiftId ? Number(req.query.shiftId) : null;
  const workDate = String(req.query?.workDate || "").trim();

  if (!workDate) throw new ApiError(400, "workDate is required");

  const data = await getCurrentInventorySession({
    reqUser: (req as any).user,
    storeId,
    shiftId,
    workDate,
  });

  res.json({ ok: true, data });
});

export const calculateSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const data = await calculateInventorySession(sessionId);
  res.json({ ok: true, ...data });
});

export const saveDraftSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = req.body?.note ? String(req.body.note) : null;

  const data = await saveDraftInventorySession({
    reqUser: (req as any).user,
    sessionId,
    note,
    items: mapItems(items),
  });

  res.json({ ok: true, ...data });
});

export const submitSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = req.body?.note ? String(req.body.note) : null;

  const data = await submitInventorySession({
    reqUser: (req as any).user,
    sessionId,
    note,
    items: mapItems(items),
  });

  res.json({ ok: true, ...data });
});

export const approveShiftLeaderSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventorySessionByShiftLeader({
    reqUser: (req as any).user,
    sessionId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const approveStoreManagerSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventorySessionByStoreManager({
    reqUser: (req as any).user,
    sessionId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const approveDmSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventorySessionByDm({
    reqUser: (req as any).user,
    sessionId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const rejectSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const note = String(req.body?.note || "").trim();
  if (!note) throw new ApiError(400, "note is required");

  const data = await rejectInventorySession({
    reqUser: (req as any).user,
    sessionId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const getSessionReport = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) throw new ApiError(400, "Invalid session id");

  const data = await getInventorySessionReport(sessionId);
  res.json({ ok: true, ...data });
});

export const openBatch = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const shiftId = req.body?.shiftId ? Number(req.body.shiftId) : null;
  const workDate = String(req.body?.workDate || "").trim();
  const note = req.body?.note ? String(req.body.note) : null;

  if (!workDate) throw new ApiError(400, "workDate is required");

  const data = await openInventoryBatch({
    reqUser: (req as any).user,
    storeId,
    shiftId,
    workDate,
    note,
  });

  res.json({ ok: true, batch: data });
});

export const getCurrentBatch = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const shiftId = req.query?.shiftId ? Number(req.query.shiftId) : null;
  const workDate = String(req.query?.workDate || "").trim();

  if (!workDate) throw new ApiError(400, "workDate is required");

  const data = await getLatestInventoryBatch({
    reqUser: (req as any).user,
    storeId,
    shiftId,
    workDate,
  });

  res.json({ ok: true, data });
});

export const getBatchWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const workDate = req.query?.workDate ? String(req.query.workDate).trim() : null;
  const scope = req.query?.scope ? String(req.query.scope).trim() : "drafts";

  const data = await getInventoryBatchWorkspace({
    reqUser: (req as any).user,
    storeId,
    workDate,
    scope: scope === "history" ? "history" : "drafts",
  });

  res.json({ ok: true, ...data });
});

export const getPendingShiftLeaderBatches = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const workDate = req.query?.workDate ? String(req.query.workDate).trim() : null;

  const data = await getShiftLeaderApprovalQueue({
    reqUser: (req as any).user,
    storeId,
    workDate,
  });

  res.json({ ok: true, ...data });
});

export const getPendingStoreManagerBatches = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const workDate = req.query?.workDate ? String(req.query.workDate).trim() : null;

  const data = await getStoreManagerApprovalQueue({
    reqUser: (req as any).user,
    storeId,
    workDate,
  });

  res.json({ ok: true, ...data });
});

export const getPendingDmBatches = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const workDate = req.query?.workDate ? String(req.query.workDate).trim() : null;

  const data = await getDmApprovalQueue({
    reqUser: (req as any).user,
    storeId,
    workDate,
  });

  res.json({ ok: true, ...data });
});

export const searchBatches = asyncHandler(async (req: Request, res: Response) => {
  const storeId = req.query?.storeId ? Number(req.query.storeId) : null;
  const workDate = String(req.query?.workDate || "").trim();

  if (!storeId) throw new ApiError(400, "storeId is required");
  if (!workDate) throw new ApiError(400, "workDate is required");

  const data = await searchInventoryBatches({
    reqUser: (req as any).user,
    storeId,
    workDate,
  });

  res.json({ ok: true, ...data });
});

export const createSheet = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.batchId);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const sheetType = String(req.body?.sheetType || "").trim() as
    | "bakery"
    | "ingredient_liquid"
    | "ingredient_dry"
    | "consumable"
    | "merchandise";

  if (
    !["bakery", "ingredient_liquid", "ingredient_dry", "consumable", "merchandise"].includes(
      sheetType,
    )
  ) {
    throw new ApiError(400, "Invalid sheetType");
  }

  const title = req.body?.title ? String(req.body.title) : null;
  const responsibleUserId = req.body?.responsibleUserId
    ? Number(req.body.responsibleUserId)
    : null;
  const note = req.body?.note ? String(req.body.note) : null;

  const data = await createInventorySheet({
    reqUser: (req as any).user,
    batchId,
    sheetType,
    title,
    responsibleUserId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const getSheetDetail = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const data = await getInventorySheetDetail({
    reqUser: (req as any).user,
    sheetId,
  });
  res.json({ ok: true, ...data });
});

export const saveDraftSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = req.body?.note ? String(req.body.note) : null;

  const data = await saveInventorySheetDraft({
    reqUser: (req as any).user,
    sheetId,
    note,
    items: mapItems(items),
  });

  res.json({ ok: true, ...data });
});

export const submitSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = req.body?.note ? String(req.body.note) : null;

  const data = await submitInventorySheet({
    reqUser: (req as any).user,
    sheetId,
    note,
    items: mapItems(items),
  });

  res.json({ ok: true, ...data });
});

export const getBatchReport = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const data = await getInventoryBatchDetail({
    reqUser: (req as any).user,
    batchId,
  });
  res.json({ ok: true, ...data });
});

export const submitBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await submitInventoryBatch({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const recallBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await recallInventoryBatch({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const approveShiftLeaderBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventoryBatchByShiftLeader({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const approveStoreManagerBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventoryBatchByStoreManager({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const approveDmBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = req.body?.note ? String(req.body.note) : null;

  const data = await approveInventoryBatchByDm({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const rejectBatch = asyncHandler(async (req: Request, res: Response) => {
  const batchId = Number(req.params.id);
  if (!batchId) throw new ApiError(400, "Invalid batch id");

  const note = String(req.body?.note || "").trim();
  if (!note) throw new ApiError(400, "note is required");

  const data = await rejectInventoryBatch({
    reqUser: (req as any).user,
    batchId,
    note,
  });

  res.json({ ok: true, ...data });
});
