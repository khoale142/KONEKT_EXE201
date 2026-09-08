import { ApiError } from "../../utils/apiError";
import * as repo from "./inventoryReceipt.repo";

function getActor(reqUser: any): number | null {
  const raw = reqUser?.id ?? reqUser?.userId ?? reqUser?.sub;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getActorRoles(reqUser: any): string[] {
  return Array.isArray(reqUser?.roles) ? reqUser.roles.map((x: any) => String(x)) : [];
}

function hasRole(reqUser: any, allowed: string[]) {
  return getActorRoles(reqUser).some((r) => allowed.includes(r));
}

function getActorStoreIds(reqUser: any): number[] {
  const rawStoreIds = Array.isArray(reqUser?.storeIds)
    ? reqUser.storeIds
    : reqUser?.storeId != null
      ? [reqUser.storeId]
      : [];

  return rawStoreIds
    .map((x: any) => Number(x))
    .filter((x: number) => Number.isFinite(x) && x > 0);
}

function assertRole(reqUser: any, allowed: string[], message: string) {
  if (!hasRole(reqUser, allowed)) throw new ApiError(403, message);
}

function isAdmin(reqUser: any) {
  return hasRole(reqUser, ["admin"]);
}

function assertStoreAccess(reqUser: any, storeId: number, message = "Ban khong co quyen xem du lieu cua quan nay") {
  if (isAdmin(reqUser)) return;

  const actorStoreIds = getActorStoreIds(reqUser);
  if (!actorStoreIds.includes(Number(storeId))) {
    throw new ApiError(403, message);
  }
}

function assertReceiptCreator(reqUser: any) {
  assertRole(reqUser, ["staff", "shift_leader", "store_manager"], "Chi staff, truong ca hoac quan ly cua hang moi duoc tao va sua phieu nhap kho");
}

function assertShiftLeaderApprover(reqUser: any) {
  assertRole(reqUser, ["shift_leader"], "Chi truong ca moi duoc xac nhan phieu nhap kho");
}

function assertStoreManagerApprover(reqUser: any) {
  assertRole(reqUser, ["store_manager"], "Chi store manager moi duoc duyet cuoi phieu nhap kho");
}

function canEditReceiptStatus(status?: string) {
  return ["draft", "rejected_by_shift_leader", "rejected_by_store_manager"].includes(String(status || ""));
}

function canEditSheetStatus(status?: string) {
  return ["draft"].includes(String(status || ""));
}

function pickSubmittedSheetsOnlyWhenInApproval(receipt: any, sheets: any[]) {
  if (canEditReceiptStatus(receipt?.status)) return sheets;
  return sheets.filter((x: any) => String(x.status || "") === "submitted");
}

function buildReceiptSummary(sheets: any[]) {
  return {
    totalSheets: sheets.length,
    totalLines: sheets.reduce((acc, x) => acc + Number(x.total_lines || 0), 0),
    totalReceivedQtyStorage: sheets.reduce((acc, x) => acc + Number(x.total_received_qty_storage || 0), 0),
    totalEstimatedValue: sheets.reduce((acc, x) => acc + Number(x.total_estimated_value || 0), 0),
  };
}

function getDefaultSheetTitle(sheetType: string) {
  switch (sheetType) {
    case "bakery":
      return "Phiếu nhập bánh";
    case "ingredient_liquid":
      return "Phiếu nhập nguyên liệu nước";
    case "ingredient_dry":
      return "Phiếu nhập nguyên liệu khô / topping";
    case "consumable":
      return "Phiếu nhập vật phẩm tiêu hao";
    case "merchandise":
      return "Phiếu nhập merchandise";
    default:
      return "Phiếu nhập khác";
  }
}

export async function listReceiptIngredients(params?: { sheetType?: string | null }) {
  return repo.listStockableIngredients(params?.sheetType ?? null);
}

export async function openInventoryReceipt(params: {
  reqUser: any;
  storeId: number;
  shiftId?: number | null;
  receiptDate: string;
  receiptType?: string;
  supplierName?: string | null;
  referenceNo?: string | null;
  note?: string | null;
}) {
  assertReceiptCreator(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen mo phieu nhap cho quan nay");

  const existing = await repo.findLatestOpenReceipt({
    storeId: params.storeId,
    shiftId: params.shiftId,
    receiptDate: params.receiptDate,
  });

  if (existing) return existing;

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  return repo.createReceipt({
    storeId: params.storeId,
    shiftId: params.shiftId,
    receiptDate: params.receiptDate,
    receiptType: params.receiptType || "purchase",
    supplierName: params.supplierName ?? null,
    referenceNo: params.referenceNo ?? null,
    note: params.note ?? null,
    createdBy: actor,
  });
}

export async function getCurrentInventoryReceipt(params: {
  reqUser: any;
  storeId: number;
  shiftId?: number | null;
  receiptDate: string;
}) {
  assertRole(params.reqUser, ["staff", "shift_leader", "store_manager"], "Khong co quyen xem phieu nhap hien tai");
  assertStoreAccess(params.reqUser, params.storeId);

  const receipt = await repo.findLatestOpenReceipt({
    storeId: params.storeId,
    shiftId: params.shiftId,
    receiptDate: params.receiptDate,
  });

  if (!receipt) return null;

  return {
    receipt,
    sheets: await repo.listReceiptSheets(Number(receipt.id)),
  };
}

export async function getInventoryReceiptReport(params: {
  reqUser: any;
  receiptId: number;
}) {
  assertRole(
    params.reqUser,
    ["staff", "shift_leader", "store_manager", "district_manager", "admin"],
    "Khong co quyen xem bao cao nhap kho",
  );

  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen xem phieu nhap cua quan nay");

  const allSheets = await repo.listReceiptSheets(params.receiptId);
  const sheets = pickSubmittedSheetsOnlyWhenInApproval(receipt, allSheets);
  const detailSheets = [] as Array<any>;
  for (const sheet of sheets) {
    const items = await repo.getReceiptSheetItems(Number(sheet.id));
    detailSheets.push({ ...sheet, items });
  }

  return {
    receipt,
    sheets: detailSheets,
    summary: buildReceiptSummary(sheets),
  };
}

export async function getReceiptSheetDetail(params: {
  reqUser: any;
  sheetId: number;
}) {
  assertRole(
    params.reqUser,
    ["staff", "shift_leader", "store_manager", "district_manager", "admin"],
    "Khong co quyen xem phieu nhap con",
  );

  const sheet = await repo.getReceiptSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");
  assertStoreAccess(params.reqUser, Number(sheet.store_id), "Ban khong co quyen xem phieu con cua quan nay");
  const items = await repo.getReceiptSheetItems(params.sheetId);
  return { sheet, items };
}

export async function createInventoryReceiptSheet(params: {
  reqUser: any;
  receiptId: number;
  sheetType: string;
  title?: string | null;
  responsibleUserId?: number | null;
}) {
  assertReceiptCreator(params.reqUser);

  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen tao phieu con cho quan nay");
  if (!canEditReceiptStatus(receipt.status)) {
    throw new ApiError(400, "Receipt dang cho duyet hoac da duoc duyet");
  }

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  return repo.createReceiptSheet({
    receiptId: params.receiptId,
    sheetType: params.sheetType,
    title: params.title || getDefaultSheetTitle(params.sheetType),
    responsibleUserId: params.responsibleUserId ?? actor,
    createdBy: actor,
  });
}

export async function saveInventoryReceiptSheetDraft(params: {
  reqUser: any;
  sheetId: number;
  note?: string | null;
  items: Array<{ ingredientId: number; receivedQtyStorage: number | null; note?: string | null }>;
}) {
  assertReceiptCreator(params.reqUser);

  const sheet = await repo.getReceiptSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");
  assertStoreAccess(params.reqUser, Number(sheet.store_id), "Ban khong co quyen sua phieu con cua quan nay");

  const receipt = await repo.getReceiptById(Number(sheet.receipt_id));
  if (!receipt) throw new ApiError(404, "Receipt not found");
  if (!canEditReceiptStatus(receipt.status)) {
    throw new ApiError(400, "Receipt dang cho duyet hoac da duoc duyet");
  }
  if (!canEditSheetStatus(sheet.status)) {
    throw new ApiError(400, "Sheet da submit, khong the luu nhap");
  }

  await repo.updateReceiptSheetHeader({ sheetId: params.sheetId, note: params.note ?? null });
  await repo.upsertReceiptSheetItems({ sheetId: params.sheetId, items: params.items });

  return getReceiptSheetDetail({ reqUser: params.reqUser, sheetId: params.sheetId });
}

export async function submitInventoryReceiptSheet(params: {
  reqUser: any;
  sheetId: number;
  note?: string | null;
  items: Array<{ ingredientId: number; receivedQtyStorage: number | null; note?: string | null }>;
}) {
  await saveInventoryReceiptSheetDraft(params);

  const sheet = await repo.getReceiptSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");

  const items = await repo.getReceiptSheetItems(params.sheetId);
  const positive = items.filter((x: any) => Number(x.received_qty_storage || 0) > 0);
  if (!positive.length) {
    throw new ApiError(400, "Sheet chua co so luong nhap hop le");
  }

  await repo.submitReceiptSheet({
    sheetId: params.sheetId,
    actorUserId: getActor(params.reqUser),
    note: params.note ?? null,
  });

  return getReceiptSheetDetail({ reqUser: params.reqUser, sheetId: params.sheetId });
}

export async function submitInventoryReceipt(params: {
  reqUser: any;
  receiptId: number;
  note?: string | null;
}) {
  assertReceiptCreator(params.reqUser);

  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen gui phieu nhap cua quan nay");
  if (!canEditReceiptStatus(receipt.status)) {
    throw new ApiError(400, "Receipt dang cho duyet hoac da duoc duyet");
  }

  const allSheets = await repo.listReceiptSheets(params.receiptId);
  if (!allSheets.length) throw new ApiError(400, "Receipt chua co phieu con nao");

  const submittedSheets = allSheets.filter((x: any) => String(x.status) === "submitted");
  if (!submittedSheets.length) {
    throw new ApiError(400, "Phai co it nhat 1 phieu con da submit moi gui duyet duoc");
  }

  const totalLines = submittedSheets.reduce((acc, x) => acc + Number(x.total_lines || 0), 0);
  if (totalLines <= 0) throw new ApiError(400, "Chua co phieu con nao co dong hang hop le de gui duyet");

  await repo.updateReceiptStatus({
    receiptId: params.receiptId,
    status: "submitted_to_shift_leader",
    actorUserId: getActor(params.reqUser),
    note: params.note ?? null,
  });

  return getInventoryReceiptReport({ reqUser: params.reqUser, receiptId: params.receiptId });
}

export async function approveInventoryReceiptByShiftLeader(params: {
  reqUser: any;
  receiptId: number;
  note?: string | null;
}) {
  assertShiftLeaderApprover(params.reqUser);

  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen xac nhan phieu nhap cua quan nay");
  if (receipt.status !== "submitted_to_shift_leader") {
    throw new ApiError(400, "Receipt khong dung trang thai cho truong ca xac nhan");
  }

  await repo.updateReceiptStatus({
    receiptId: params.receiptId,
    status: "submitted_to_store_manager",
    actorUserId: getActor(params.reqUser),
    note: params.note ?? null,
  });

  return getInventoryReceiptReport({ reqUser: params.reqUser, receiptId: params.receiptId });
}

export async function approveInventoryReceiptByStoreManager(params: {
  reqUser: any;
  receiptId: number;
  note?: string | null;
}) {
  assertStoreManagerApprover(params.reqUser);

  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen duyet phieu nhap cua quan nay");
  if (receipt.status !== "submitted_to_store_manager") {
    throw new ApiError(400, "Receipt khong dung trang thai cho store manager duyet");
  }

  await repo.approveReceiptFinalAndApplyStock({
    receiptId: params.receiptId,
    actorUserId: getActor(params.reqUser),
    note: params.note ?? null,
  });

  return getInventoryReceiptReport({ reqUser: params.reqUser, receiptId: params.receiptId });
}

export async function rejectInventoryReceipt(params: {
  reqUser: any;
  receiptId: number;
  note: string;
}) {
  const receipt = await repo.getReceiptById(params.receiptId);
  if (!receipt) throw new ApiError(404, "Receipt not found");
  assertStoreAccess(params.reqUser, Number(receipt.store_id), "Ban khong co quyen tra lai phieu nhap cua quan nay");

  if (receipt.status === "submitted_to_shift_leader") {
    assertShiftLeaderApprover(params.reqUser);
    await repo.updateReceiptStatus({
      receiptId: params.receiptId,
      status: "rejected_by_shift_leader",
      actorUserId: getActor(params.reqUser),
      rejectionNote: params.note,
    });
  } else if (receipt.status === "submitted_to_store_manager") {
    assertStoreManagerApprover(params.reqUser);
    await repo.updateReceiptStatus({
      receiptId: params.receiptId,
      status: "rejected_by_store_manager",
      actorUserId: getActor(params.reqUser),
      rejectionNote: params.note,
    });
  } else {
    throw new ApiError(400, "Receipt khong o trang thai co the tra lai");
  }

  return getInventoryReceiptReport({ reqUser: params.reqUser, receiptId: params.receiptId });
}

export async function searchInventoryReceipts(params: {
  reqUser: any;
  storeId: number;
  receiptDate?: string | null;
  status?: string | null;
}) {
  assertRole(
    params.reqUser,
    ["staff", "shift_leader", "store_manager", "district_manager", "admin"],
    "Khong co quyen tim phieu nhap kho",
  );
  assertStoreAccess(params.reqUser, params.storeId);

  return repo.searchReceipts({
    storeId: params.storeId,
    receiptDate: params.receiptDate ?? null,
    status: params.status ?? null,
    limit: 100,
  });
}

export async function getReceiptWorkspaceList(params: {
  reqUser: any;
  storeId: number;
  receiptDate: string;
  scope: "drafts" | "history";
}) {
  assertReceiptCreator(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem workspace phieu nhap cua quan nay");

  return repo.getReceiptWorkspace({
    storeId: params.storeId,
    receiptDate: params.receiptDate,
    scope: params.scope,
  });
}

export async function getPendingShiftLeaderReceipts(params: {
  reqUser: any;
  storeId: number;
  receiptDate?: string | null;
}) {
  assertShiftLeaderApprover(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem hang cho xac nhan cua quan nay");
  return repo.getPendingShiftLeaderReceipts({
    storeId: params.storeId,
    receiptDate: params.receiptDate ?? null,
  });
}

export async function getPendingStoreManagerReceipts(params: {
  reqUser: any;
  storeId: number;
  receiptDate?: string | null;
}) {
  assertStoreManagerApprover(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem hang cho duyet cua quan nay");
  return repo.getPendingStoreManagerReceipts({
    storeId: params.storeId,
    receiptDate: params.receiptDate ?? null,
  });
}
