import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  listReceiptIngredients,
  openInventoryReceipt,
  getCurrentInventoryReceipt,
  getReceiptWorkspaceList,
  createInventoryReceiptSheet,
  getReceiptSheetDetail,
  saveInventoryReceiptSheetDraft,
  submitInventoryReceiptSheet,
  getInventoryReceiptReport,
  submitInventoryReceipt,
  approveInventoryReceiptByShiftLeader,
  approveInventoryReceiptByStoreManager,
  rejectInventoryReceipt,
  searchInventoryReceipts,
  getPendingShiftLeaderReceipts,
  getPendingStoreManagerReceipts,
} from "./inventoryReceipt.service";

function getStoreIdFromReq(req: Request): number | null {
  const user = (req as any).user as any;
  if (user?.portal === "POS" && user?.storeId) return Number(user.storeId);
  const bodyStoreId = req.body?.storeId ? Number(req.body.storeId) : null;
  const queryStoreId = req.query?.storeId ? Number(req.query.storeId) : null;
  return bodyStoreId || queryStoreId || null;
}

export const getIngredients = asyncHandler(async (req: Request, res: Response) => {
  const items = await listReceiptIngredients({
    sheetType: req.query?.sheetType ? String(req.query.sheetType) : null,
  });
  res.json({ ok: true, items });
});

export const openReceipt = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const receiptDate = String(req.body?.receiptDate || "").trim();
  if (!receiptDate) throw new ApiError(400, "receiptDate is required");

  const data = await openInventoryReceipt({
    reqUser: (req as any).user,
    storeId,
    shiftId: req.body?.shiftId ? Number(req.body.shiftId) : null,
    receiptDate,
    receiptType: req.body?.receiptType ? String(req.body.receiptType) : undefined,
    supplierName: req.body?.supplierName ? String(req.body.supplierName) : null,
    referenceNo: req.body?.referenceNo ? String(req.body.referenceNo) : null,
    note: req.body?.note ? String(req.body.note) : null,
  });

  res.json({ ok: true, receipt: data });
});

export const getCurrentReceipt = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const receiptDate = String(req.query?.receiptDate || "").trim();
  if (!receiptDate) throw new ApiError(400, "receiptDate is required");

  const data = await getCurrentInventoryReceipt({
    reqUser: (req as any).user,
    storeId,
    shiftId: req.query?.shiftId ? Number(req.query.shiftId) : null,
    receiptDate,
  });

  res.json({ ok: true, data });
});

export const getReceiptWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const receiptDate = String(req.query?.receiptDate || "").trim();
  if (!receiptDate) throw new ApiError(400, "receiptDate is required");

  const scope = String(req.query?.scope || "drafts") as "drafts" | "history";
  const items = await getReceiptWorkspaceList({
    reqUser: (req as any).user,
    storeId,
    receiptDate,
    scope,
  });

  res.json({ ok: true, items });
});

export const createSheet = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.receiptId);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");

  const sheetType = String(req.body?.sheetType || "").trim();
  if (!sheetType) throw new ApiError(400, "sheetType is required");

  const sheet = await createInventoryReceiptSheet({
    reqUser: (req as any).user,
    receiptId,
    sheetType,
    title: req.body?.title ? String(req.body.title) : null,
    responsibleUserId: req.body?.responsibleUserId ? Number(req.body.responsibleUserId) : null,
  });

  res.json({ ok: true, sheet });
});

export const getSheetDetail = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const data = await getReceiptSheetDetail({ reqUser: (req as any).user, sheetId });
  res.json({ ok: true, ...data });
});

export const saveDraftSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const data = await saveInventoryReceiptSheetDraft({
    reqUser: (req as any).user,
    sheetId,
    note: req.body?.note ? String(req.body.note) : null,
    items: items.map((x: any) => ({
      ingredientId: Number(x.ingredientId),
      receivedQtyStorage: x.receivedQtyStorage == null || x.receivedQtyStorage === "" ? null : Number(x.receivedQtyStorage),
      note: x.note ? String(x.note) : null,
    })),
  });

  res.json({ ok: true, ...data });
});

export const submitSheet = asyncHandler(async (req: Request, res: Response) => {
  const sheetId = Number(req.params.id);
  if (!sheetId) throw new ApiError(400, "Invalid sheet id");

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const data = await submitInventoryReceiptSheet({
    reqUser: (req as any).user,
    sheetId,
    note: req.body?.note ? String(req.body.note) : null,
    items: items.map((x: any) => ({
      ingredientId: Number(x.ingredientId),
      receivedQtyStorage: x.receivedQtyStorage == null || x.receivedQtyStorage === "" ? null : Number(x.receivedQtyStorage),
      note: x.note ? String(x.note) : null,
    })),
  });

  res.json({ ok: true, ...data });
});

export const getReceiptReport = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.id);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");
  const data = await getInventoryReceiptReport({ reqUser: (req as any).user, receiptId });
  res.json({ ok: true, ...data });
});

export const submitReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.id);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");

  const data = await submitInventoryReceipt({
    reqUser: (req as any).user,
    receiptId,
    note: req.body?.note ? String(req.body.note) : null,
  });

  res.json({ ok: true, ...data });
});

export const approveShiftLeaderReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.id);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");

  const data = await approveInventoryReceiptByShiftLeader({
    reqUser: (req as any).user,
    receiptId,
    note: req.body?.note ? String(req.body.note) : null,
  });

  res.json({ ok: true, ...data });
});

export const approveStoreManagerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.id);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");

  const data = await approveInventoryReceiptByStoreManager({
    reqUser: (req as any).user,
    receiptId,
    note: req.body?.note ? String(req.body.note) : null,
  });

  res.json({ ok: true, ...data });
});

export const rejectReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receiptId = Number(req.params.id);
  if (!receiptId) throw new ApiError(400, "Invalid receipt id");

  const note = String(req.body?.note || "").trim();
  if (!note) throw new ApiError(400, "note is required");

  const data = await rejectInventoryReceipt({
    reqUser: (req as any).user,
    receiptId,
    note,
  });

  res.json({ ok: true, ...data });
});

export const searchReceipts = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const items = await searchInventoryReceipts({
    reqUser: (req as any).user,
    storeId,
    receiptDate: req.query?.receiptDate ? String(req.query.receiptDate) : null,
    status: req.query?.status ? String(req.query.status) : null,
  });

  res.json({ ok: true, items });
});

export const getPendingShiftLeaderList = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const items = await getPendingShiftLeaderReceipts({
    reqUser: (req as any).user,
    storeId,
    receiptDate: req.query?.receiptDate ? String(req.query.receiptDate) : null,
  });

  res.json({ ok: true, items });
});

export const getPendingStoreManagerList = asyncHandler(async (req: Request, res: Response) => {
  const storeId = getStoreIdFromReq(req);
  if (!storeId) throw new ApiError(400, "Missing storeId");

  const items = await getPendingStoreManagerReceipts({
    reqUser: (req as any).user,
    storeId,
    receiptDate: req.query?.receiptDate ? String(req.query.receiptDate) : null,
  });

  res.json({ ok: true, items });
});
