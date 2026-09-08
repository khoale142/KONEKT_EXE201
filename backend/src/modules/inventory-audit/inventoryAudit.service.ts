import { ApiError } from "../../utils/apiError";
import * as repo from "./inventoryAudit.repo";

function getActor(reqUser: any): number | null {
  const raw = reqUser?.id ?? reqUser?.userId ?? reqUser?.sub;

  if (raw == null || raw === "") return null;

  const actorId = Number(raw);
  if (!Number.isFinite(actorId) || actorId <= 0) return null;

  return actorId;
}

function getActorRoles(reqUser: any): string[] {
  return Array.isArray(reqUser?.roles) ? reqUser.roles.map((x: any) => String(x)) : [];
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

function hasRole(reqUser: any, allowed: string[]) {
  const roles = getActorRoles(reqUser);
  return roles.some((r: string) => allowed.includes(String(r)));
}

function assertRole(reqUser: any, allowed: string[], message: string) {
  if (!hasRole(reqUser, allowed)) {
    throw new ApiError(403, message);
  }
}

function isDistrictManager(reqUser: any) {
  return hasRole(reqUser, ["district_manager"]) && !hasRole(reqUser, ["admin"]);
}

function isAdmin(reqUser: any) {
  return hasRole(reqUser, ["admin"]);
}

function assertStoreAccess(reqUser: any, storeId: number, message = "Bạn không có quyền xem dữ liệu quán này") {
  if (isAdmin(reqUser)) return;

  const actorStoreIds = getActorStoreIds(reqUser);
  if (!actorStoreIds.includes(Number(storeId))) {
    throw new ApiError(403, message);
  }
}

async function assertBatchAccess(reqUser: any, batchId: number, message = "Bạn không có quyền thao tác đợt kiểm của quán này") {
  const batch = await repo.getBatchById(batchId);
  if (!batch) throw new ApiError(404, "Batch not found");

  assertStoreAccess(reqUser, Number(batch.store_id), message);
}

async function assertSheetAccess(reqUser: any, sheetId: number, message = "Bạn không có quyền xem phiếu kiểm của quán này") {
  const sheet = await repo.getSheetById(sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");

  assertStoreAccess(reqUser, Number(sheet.store_id), message);
}

function canEditDraftStatus(status: string) {
  return [
    "draft",
    "rejected_by_shift_leader",
    "rejected_by_store_manager",
    "rejected_by_dm",
  ].includes(String(status));
}

function buildSummary(items: any[]) {
  return {
    normal: items.filter((x: any) => x.audit_status === "normal").length,
    audit: items.filter((x: any) => x.audit_status === "audit").length,
    critical: items.filter((x: any) => x.audit_status === "critical").length,
  };
}

function assertBatchCreator(reqUser: any) {
  assertRole(
    reqUser,
    ["staff", "shift_leader", "store_manager"],
    "Chi nhan vien thuong hoac truong ca moi duoc tao va sua phieu kiem hang",
  );
}

function assertShiftLeaderApprover(reqUser: any) {
  assertRole(reqUser, ["shift_leader"], "Chi truong ca moi duoc xac nhan cap 1");
}

function assertStoreManagerApprover(reqUser: any) {
  assertRole(reqUser, ["store_manager"], "Chi quan ly cua hang moi duoc duyet cap 2");
}

function canEditBatchStatus(status?: string) {
  return [
    "draft",
    "rejected_by_shift_leader",
    "rejected_by_store_manager",
    "rejected_by_dm",
  ].includes(String(status || ""));
}

function canRecallBatchStatus(status?: string) {
  return String(status || "") === "submitted_to_shift_leader";
}

function getDefaultSheetTitle(sheetType: string) {
  switch (sheetType) {
    case "bakery":
      return "Phiếu bánh";
    case "ingredient_liquid":
      return "Phiếu nguyên liệu nước";
    case "ingredient_dry":
      return "Phiếu nguyên liệu khô / topping";
    case "consumable":
      return "Phiếu vật phẩm tiêu hao";
    case "merchandise":
      return "Phiếu merchandise";
    default:
      return "Phiếu kiểm";
  }
}

function buildBatchSummary(sheets: any[]) {
  return {
    totalSheets: sheets.length,
    totalLines: sheets.reduce((acc, x) => acc + Number(x.total_lines || 0), 0),
    totalEstimatedValue: sheets.reduce(
      (acc, x) => acc + Number(x.total_estimated_value || 0),
      0,
    ),
    auditLines: sheets.reduce((acc, x) => acc + Number(x.audit_lines || 0), 0),
    criticalLines: sheets.reduce(
      (acc, x) => acc + Number(x.critical_lines || 0),
      0,
    ),
  };
}

function shouldHideShiftLeaderAuditDetail(reqUser: any, batchStatus?: string) {
  return (
    hasRole(reqUser, ["shift_leader"]) &&
    !hasRole(reqUser, ["store_manager", "district_manager", "admin"]) &&
    String(batchStatus || "") === "submitted_to_shift_leader"
  );
}

function sanitizeBatchDetailForShiftLeader(detail: any) {
  const sheets = Array.isArray(detail?.sheets)
    ? detail.sheets.map((sheet: any) => ({
        ...sheet,
        audit_lines: 0,
        critical_lines: 0,
        total_estimated_variance_value: 0,
        items: Array.isArray(sheet?.items)
          ? sheet.items.map((item: any) => ({
              ...item,
              theoretical_used_qty: null,
              theoretical_closing_qty: null,
              variance_qty: null,
              variance_percent: null,
              threshold_percent: null,
              flagged: false,
              audit_status: null,
              estimated_line_value: null,
            }))
          : [],
      }))
    : [];

  return {
    ...detail,
    sheets,
    summary: {
      totalSheets: sheets.length,
      totalLines: sheets.reduce(
        (acc: number, x: any) => acc + (Array.isArray(x.items) ? x.items.length : Number(x.total_lines || 0)),
        0,
      ),
      totalEstimatedValue: 0,
      auditLines: 0,
      criticalLines: 0,
    },
  };
}

export async function openInventorySession(params: {
  reqUser: any;
  storeId: number;
  shiftId?: number | null;
  workDate: string;
  note?: string | null;
}) {
  const { reqUser, storeId, shiftId, workDate, note } = params;

  assertRole(
    reqUser,
    ["staff", "shift_leader", "store_manager"],
    "Chi nhan vien cua cua hang moi duoc mo phien kiem hang",
  );

  const existing = await repo.findCurrentSession({
    storeId,
    shiftId,
    workDate,
  });
  if (existing) return existing;

  const session = await repo.createSession({
    storeId,
    shiftId,
    workDate,
    openedBy: getActor(reqUser),
    note,
  });

  await repo.snapshotOpeningStock(Number(session.id), storeId);

  return repo.getSessionById(Number(session.id));
}

export async function getCurrentInventorySession(params: {
  reqUser?: any;
  storeId: number;
  shiftId?: number | null;
  workDate: string;
}) {
  if (params.reqUser) {
    assertStoreAccess(params.reqUser, params.storeId);
  }

  const session = await repo.findCurrentSession({
    storeId: params.storeId,
    shiftId: params.shiftId,
    workDate: params.workDate,
  });

  if (!session) return null;

  const items = await repo.getSessionItems(Number(session.id));
  return { session, items };
}

export async function calculateInventorySession(sessionId: number) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (session.status === "approved_final") {
    throw new ApiError(400, "Session already approved");
  }

  await repo.calculateTheoreticalUsage(sessionId);

  const freshSession = await repo.getSessionById(sessionId);
  const items = await repo.getSessionItems(sessionId);
  return { session: freshSession, items };
}

export async function saveDraftInventorySession(params: {
  reqUser: any;
  sessionId: number;
  note?: string | null;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  const { reqUser, sessionId, note, items } = params;

  assertRole(
    reqUser,
    ["staff", "shift_leader", "store_manager"],
    "Chi nhan vien cua cua hang moi duoc sua phieu kiem hang",
  );

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (!canEditDraftStatus(String(session.status))) {
    throw new ApiError(400, "Session dang cho duyet, khong the sua draft");
  }

  await repo.calculateTheoreticalUsage(sessionId);
  await repo.updateActualClosingItems({ sessionId, items });
  await repo.finalizeVariance(sessionId);
  await repo.updateSessionNote({ sessionId, note });

  const freshSession = await repo.getSessionById(sessionId);
  const freshItems = await repo.getSessionItems(sessionId);

  return {
    session: freshSession,
    items: freshItems,
    summary: buildSummary(freshItems),
  };
}

export async function submitInventorySession(params: {
  reqUser: any;
  sessionId: number;
  note?: string | null;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  const { reqUser, sessionId, note, items } = params;

  assertRole(
    reqUser,
    ["staff", "shift_leader", "store_manager"],
    "Chi nhan vien cua cua hang moi duoc gui phieu kiem hang",
  );

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (!canEditDraftStatus(String(session.status))) {
    throw new ApiError(400, "Session da gui duyet hoac da duoc phe duyet");
  }

  await repo.calculateTheoreticalUsage(sessionId);
  await repo.updateActualClosingItems({ sessionId, items });
  await repo.finalizeVariance(sessionId);

  const submitted = await repo.submitSession({
    sessionId,
    submittedBy: getActor(reqUser),
    note,
  });

  const reportItems = await repo.getSessionItems(sessionId);

  return {
    session: submitted,
    items: reportItems,
    summary: buildSummary(reportItems),
  };
}

export async function approveInventorySessionByShiftLeader(params: {
  reqUser: any;
  sessionId: number;
  note?: string | null;
}) {
  const { reqUser, sessionId, note } = params;

  assertRole(reqUser, ["shift_leader"], "Chi truong ca moi duoc duyet cap 1");

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (session.status !== "submitted_to_shift_leader") {
    throw new ApiError(
      400,
      "Session khong dung trang thai cho truong ca duyet",
    );
  }

  const approved = await repo.approveByShiftLeader({
    sessionId,
    actorUserId: getActor(reqUser),
    note,
  });

  const items = await repo.getSessionItems(sessionId);
  return {
    session: approved,
    items,
    summary: buildSummary(items),
  };
}

export async function approveInventorySessionByStoreManager(params: {
  reqUser: any;
  sessionId: number;
  note?: string | null;
}) {
  const { reqUser, sessionId, note } = params;

  assertRole(
    reqUser,
    ["store_manager"],
    "Chi store manager moi duoc duyet cap 2",
  );

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (session.status !== "submitted_to_store_manager") {
    throw new ApiError(
      400,
      "Session khong dung trang thai cho store manager duyet",
    );
  }

  const approved = await repo.approveByStoreManager({
    sessionId,
    actorUserId: getActor(reqUser),
    note,
  });

  const items = await repo.getSessionItems(sessionId);
  return {
    session: approved,
    items,
    summary: buildSummary(items),
  };
}

export async function approveInventorySessionByDm(params: {
  reqUser: any;
  sessionId: number;
  note?: string | null;
}) {
  const { reqUser, sessionId, note } = params;

  assertRole(
    reqUser,
    ["district_manager", "admin"],
    "Chi district manager hoac admin moi duoc duyet cuoi",
  );

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  if (session.status !== "submitted_to_dm") {
    throw new ApiError(400, "Session khong dung trang thai cho DM duyet");
  }

  if (isDistrictManager(reqUser)) {
    assertStoreAccess(reqUser, Number(session.store_id), "Bạn không có quyền duyệt phiên kiểm của quán này");
  }

  const approved = await repo.approveByDm({
    sessionId,
    actorUserId: getActor(reqUser),
    note,
  });

  const items = await repo.getSessionItems(sessionId);
  return {
    session: approved,
    items,
    summary: buildSummary(items),
  };
}

export async function rejectInventorySession(params: {
  reqUser: any;
  sessionId: number;
  note: string;
}) {
  const { reqUser, sessionId, note } = params;

  const rejectionNote = String(note || "").trim();
  if (!rejectionNote) {
    throw new ApiError(400, "rejection note is required");
  }

  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");

  let rejectedStatus = "";
  const status = String(session.status);

  if (status === "submitted_to_shift_leader") {
    assertRole(
      reqUser,
      ["shift_leader"],
      "Chi truong ca moi duoc reject o cap nay",
    );
    rejectedStatus = "rejected_by_shift_leader";
  } else if (status === "submitted_to_store_manager") {
    assertRole(
      reqUser,
      ["store_manager"],
      "Chi store manager moi duoc reject o cap nay",
    );
    rejectedStatus = "rejected_by_store_manager";
  } else if (status === "submitted_to_dm") {
    assertRole(
      reqUser,
      ["district_manager", "admin"],
      "Chi district manager hoac admin moi duoc reject o cap nay",
    );
    if (isDistrictManager(reqUser)) {
      assertStoreAccess(reqUser, Number(session.store_id), "Bạn không có quyền trả phiên kiểm của quán này");
    }
    rejectedStatus = "rejected_by_dm";
  } else {
    throw new ApiError(400, "Session khong o trang thai co the reject");
  }

  const rejected = await repo.rejectSession({
    sessionId,
    rejectedStatus,
    actorUserId: getActor(reqUser),
    rejectionNote,
  });

  const items = await repo.getSessionItems(sessionId);
  return {
    session: rejected,
    items,
    summary: buildSummary(items),
  };
}

export async function listPendingDmSessions(storeId?: number) {
  return repo.getSessionsPendingDm(storeId);
}

export async function getInventorySessionReport(sessionId: number) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw new ApiError(404, "Session not found");

  const items = await repo.getSessionItems(sessionId);

  return {
    session,
    items,
    summary: buildSummary(items),
  };
}

export async function openInventoryBatch(params: {
  reqUser: any;
  storeId: number;
  shiftId?: number | null;
  workDate: string;
  note?: string | null;
}) {
  assertBatchCreator(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen mo dot kiem cho quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, params.storeId, "Bạn không có quyền mở đợt kiểm cho quán này");
  }

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  const existingOpenBatch = await repo.findLatestOpenBatch({
    storeId: params.storeId,
    shiftId: params.shiftId,
    workDate: params.workDate,
  });

  if (existingOpenBatch) {
    return repo.getBatchById(Number(existingOpenBatch.batch_id || existingOpenBatch.id));
  }

  const batch = await repo.createBatch({
    storeId: params.storeId,
    shiftId: params.shiftId,
    workDate: params.workDate,
    createdBy: actor,
    note: params.note,
  });

  return repo.getBatchById(Number(batch.id));
}

export async function getLatestInventoryBatch(params: {
  reqUser?: any;
  storeId: number;
  shiftId?: number | null;
  workDate: string;
}) {
  if (params.reqUser) {
    assertStoreAccess(params.reqUser, params.storeId);
  }

  const batch = await repo.findLatestOpenBatch({
    storeId: params.storeId,
    shiftId: params.shiftId,
    workDate: params.workDate,
  });

  if (!batch) return null;

  const sheets = await repo.listBatchSheets(Number(batch.id));
  return {
    batch,
    sheets,
    summary: buildBatchSummary(sheets),
  };
}

export async function searchInventoryBatches(params: {
  reqUser: any;
  storeId: number;
  workDate: string;
}) {
  assertRole(
    params.reqUser,
    ["district_manager", "admin", "store_manager", "shift_leader", "staff"],
    "Khong co quyen xem dot kiem hang",
  );
  assertStoreAccess(params.reqUser, params.storeId);

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, params.storeId);
  }

  const items = await repo.listBatchesByStoreAndDate({
    storeId: params.storeId,
    workDate: params.workDate,
  });

  return { items };
}

export async function createInventorySheet(params: {
  reqUser: any;
  batchId: number;
  sheetType:
    | "bakery"
    | "ingredient_liquid"
    | "ingredient_dry"
    | "consumable"
    | "merchandise";
  title?: string | null;
  responsibleUserId?: number | null;
  note?: string | null;
}) {
  assertBatchCreator(params.reqUser);

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(batch.store_id), "Ban khong co quyen tao phieu cho dot kiem cua quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(batch.store_id), "Bạn không có quyền tạo phiếu cho đợt kiểm của quán này");
  }

  if (!canEditBatchStatus(batch.status)) {
    throw new ApiError(400, "Batch dang cho duyet, khong the tao them phieu");
  }

  const sheet = await repo.createSheet({
    batchId: params.batchId,
    sheetType: params.sheetType,
    title: params.title?.trim() || getDefaultSheetTitle(params.sheetType),
    responsibleUserId: Number(params.responsibleUserId || actor),
    createdBy: actor,
    note: params.note,
  });

  await repo.snapshotSheetItems(
    Number(sheet.id),
    Number(batch.store_id),
    params.sheetType,
  );

  const freshSheet = await repo.getSheetById(Number(sheet.id));
  const items = await repo.getSheetItems(Number(sheet.id));
  return { sheet: freshSheet, items };
}

export async function getInventorySheetDetail(params: {
  reqUser: any;
  sheetId: number;
}) {
  const sheet = await repo.getSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");
  assertStoreAccess(params.reqUser, Number(sheet.store_id), "Ban khong co quyen xem phieu kiem cua quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(sheet.store_id), "Bạn không có quyền xem phiếu kiểm của quán này");
  }

  const items = await repo.getSheetItems(params.sheetId);

  return {
    sheet,
    items,
    summary: buildSummary(items),
  };
}

export async function saveInventorySheetDraft(params: {
  reqUser: any;
  sheetId: number;
  note?: string | null;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  assertBatchCreator(params.reqUser);

  const sheet = await repo.getSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");
  assertStoreAccess(params.reqUser, Number(sheet.store_id), "Ban khong co quyen sua phieu kiem cua quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(sheet.store_id), "Bạn không có quyền sửa phiếu kiểm của quán này");
  }

  if (!canEditBatchStatus(sheet.batch_status)) {
    throw new ApiError(400, "Batch dang cho duyet, khong the sua phieu");
  }

  await repo.calculateSheetTheoreticalUsage(params.sheetId, new Date());
  await repo.updateSheetActualItems({
    sheetId: params.sheetId,
    items: params.items,
  });
  await repo.finalizeSheetVariance(params.sheetId);
  await repo.saveSheetDraft({
    sheetId: params.sheetId,
    note: params.note,
  });

  const freshSheet = await repo.getSheetById(params.sheetId);
  const freshItems = await repo.getSheetItems(params.sheetId);

  return {
    sheet: freshSheet,
    items: freshItems,
    summary: buildSummary(freshItems),
  };
}

export async function submitInventorySheet(params: {
  reqUser: any;
  sheetId: number;
  note?: string | null;
  items: Array<{
    ingredientId: number;
    actualClosingQty: number | null;
    note?: string | null;
  }>;
}) {
  assertBatchCreator(params.reqUser);

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  const sheet = await repo.getSheetById(params.sheetId);
  if (!sheet) throw new ApiError(404, "Sheet not found");
  assertStoreAccess(params.reqUser, Number(sheet.store_id), "Ban khong co quyen submit phieu kiem cua quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(sheet.store_id), "Bạn không có quyền submit phiếu kiểm của quán này");
  }

  if (!canEditBatchStatus(sheet.batch_status)) {
    throw new ApiError(400, "Batch dang cho duyet, khong the submit phieu");
  }

  await repo.calculateSheetTheoreticalUsage(params.sheetId, new Date());
  await repo.updateSheetActualItems({
    sheetId: params.sheetId,
    items: params.items,
  });
  await repo.finalizeSheetVariance(params.sheetId);

  const submitted = await repo.submitSheet({
    sheetId: params.sheetId,
    note: params.note,
    submittedBy: actor,
  });

  const freshItems = await repo.getSheetItems(params.sheetId);

  return {
    sheet: submitted,
    items: freshItems,
    summary: buildSummary(freshItems),
  };
}

export async function getInventoryBatchDetail(params: {
  reqUser: any;
  batchId: number;
}) {
  const detail = await repo.getBatchDetail(params.batchId);
  if (!detail) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(detail.batch.store_id), "Ban khong co quyen xem dot kiem cua quan nay");

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(detail.batch.store_id), "Bạn không có quyền xem đợt kiểm của quán này");
  }

  const result = {
    ...detail,
    summary: buildBatchSummary(detail.sheets),
  };

  if (shouldHideShiftLeaderAuditDetail(params.reqUser, detail.batch?.status)) {
    return sanitizeBatchDetailForShiftLeader(result);
  }

  return result;
}

export async function submitInventoryBatch(params: {
  reqUser: any;
  batchId: number;
  note?: string | null;
}) {
  assertBatchCreator(params.reqUser);

  const detail = await repo.getBatchDetail(params.batchId);
  if (!detail) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(detail.batch.store_id), "Ban khong co quyen gui dot kiem cua quan nay");
  if (!canEditBatchStatus(detail.batch.status)) {
    throw new ApiError(400, "Batch da gui duyet hoac da duoc phe duyet");
  }
  if (!detail.sheets.length) {
    throw new ApiError(400, "Batch chua co phieu nao");
  }

  const notSubmitted = detail.sheets.filter(
    (x: any) => x.status !== "submitted",
  );
  if (notSubmitted.length > 0) {
    throw new ApiError(400, "Con phieu chua submit, khong the gui ca batch");
  }

  const updated = await repo.updateBatchStatus({
    batchId: params.batchId,
    status: "submitted_to_shift_leader",
    actorUserId: getActor(params.reqUser),
    note: params.note,
  });

  return {
    batch: await repo.getBatchById(Number(updated?.id || params.batchId)),
    sheets: await repo.listBatchSheets(params.batchId),
  };
}

export async function recallInventoryBatch(params: {
  reqUser: any;
  batchId: number;
  note?: string | null;
}) {
  assertBatchCreator(params.reqUser);

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(batch.store_id), "Ban khong co quyen thu hoi dot kiem cua quan nay");

  if (!canRecallBatchStatus(batch.status)) {
    throw new ApiError(400, "Chỉ được thu hồi batch đang chờ trưởng ca duyệt");
  }

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");

  if (Number(batch.created_by) !== Number(actor)) {
    throw new ApiError(403, "Chỉ người tạo batch mới được thu hồi để sửa");
  }

  await repo.updateBatchStatus({
    batchId: params.batchId,
    status: "draft",
    actorUserId: actor,
    note: params.note ?? batch.note ?? null,
  });

  return getInventoryBatchDetail({
    reqUser: params.reqUser,
    batchId: params.batchId,
  });
}

export async function approveInventoryBatchByShiftLeader(params: {
  reqUser: any;
  batchId: number;
  note?: string | null;
}) {
  assertShiftLeaderApprover(params.reqUser);

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(batch.store_id), "Ban khong co quyen duyet dot kiem cua quan nay");
  if (batch.status !== "submitted_to_shift_leader") {
    throw new ApiError(400, "Batch khong dung trang thai cho truong ca duyet");
  }

  await repo.updateBatchStatus({
    batchId: params.batchId,
    status: "submitted_to_store_manager",
    actorUserId: getActor(params.reqUser),
    note: params.note,
  });

  return getInventoryBatchDetail({
    reqUser: params.reqUser,
    batchId: params.batchId,
  });
}

export async function approveInventoryBatchByStoreManager(params: {
  reqUser: any;
  batchId: number;
  note?: string | null;
}) {
  assertStoreManagerApprover(params.reqUser);

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");
  assertStoreAccess(params.reqUser, Number(batch.store_id), "Ban khong co quyen duyet dot kiem cua quan nay");
  if (batch.status !== "submitted_to_store_manager") {
    throw new ApiError(
      400,
      "Batch khong dung trang thai cho store manager duyet",
    );
  }

  await repo.updateBatchStatus({
    batchId: params.batchId,
    status: "submitted_to_dm",
    actorUserId: getActor(params.reqUser),
    note: params.note,
  });

  return getInventoryBatchDetail({
    reqUser: params.reqUser,
    batchId: params.batchId,
  });
}

export async function approveInventoryBatchByDm(params: {
  reqUser: any;
  batchId: number;
  note?: string | null;
}) {
  assertRole(
    params.reqUser,
    ["district_manager", "admin"],
    "Chi district manager hoac admin moi duoc duyet cuoi",
  );

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");
  if (batch.status !== "submitted_to_dm") {
    throw new ApiError(400, "Batch khong dung trang thai cho duyet cap van phong");
  }

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, Number(batch.store_id), "Bạn không có quyền duyệt đợt kiểm của quán này");
  }

  await repo.approveBatchFinalAndApplyStock({
    batchId: params.batchId,
    actorUserId: getActor(params.reqUser),
    note: params.note,
  });

  return getInventoryBatchDetail({
    reqUser: params.reqUser,
    batchId: params.batchId,
  });
}

export async function rejectInventoryBatch(params: {
  reqUser: any;
  batchId: number;
  note: string;
}) {
  const rejectionNote = String(params.note || "").trim();
  if (!rejectionNote) throw new ApiError(400, "rejection note is required");

  const batch = await repo.getBatchById(params.batchId);
  if (!batch) throw new ApiError(404, "Batch not found");

  let rejectedStatus:
    | "rejected_by_shift_leader"
    | "rejected_by_store_manager"
    | "rejected_by_dm";

  if (batch.status === "submitted_to_shift_leader") {
    assertShiftLeaderApprover(params.reqUser);
    rejectedStatus = "rejected_by_shift_leader";
  } else if (batch.status === "submitted_to_store_manager") {
    assertStoreManagerApprover(params.reqUser);
    rejectedStatus = "rejected_by_store_manager";
  } else if (batch.status === "submitted_to_dm") {
    assertRole(
      params.reqUser,
      ["district_manager", "admin"],
      "Chi district manager hoac admin moi duoc reject o cap nay",
    );
    if (isDistrictManager(params.reqUser)) {
      assertStoreAccess(params.reqUser, Number(batch.store_id), "Bạn không có quyền trả đợt kiểm của quán này");
    }
    rejectedStatus = "rejected_by_dm";
  } else {
    throw new ApiError(400, "Batch khong o trang thai co the reject");
  }

  await repo.updateBatchStatus({
    batchId: params.batchId,
    status: rejectedStatus,
    actorUserId: getActor(params.reqUser),
    rejectionNote,
  });

  return getInventoryBatchDetail({
    reqUser: params.reqUser,
    batchId: params.batchId,
  });
}

export async function getInventoryBatchWorkspace(params: {
  reqUser: any;
  storeId: number;
  workDate?: string | null;
  scope?: "drafts" | "history";
}) {
  assertBatchCreator(params.reqUser);

  const actor = getActor(params.reqUser);
  if (!actor) throw new ApiError(401, "Unauthorized");
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem workspace kiem ke cua quan nay");

  const items = await repo.listBatchWorkspace({
    storeId: params.storeId,
    actorUserId: actor,
    workDate: params.workDate ?? null,
    scope: params.scope === "history" ? "history" : "drafts",
  });

  return { items };
}

export async function getShiftLeaderApprovalQueue(params: {
  reqUser: any;
  storeId: number;
  workDate?: string | null;
}) {
  assertShiftLeaderApprover(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem hang cho duyet cua quan nay");

  const items = await repo.listBatchApprovalQueue({
    storeId: params.storeId,
    workDate: params.workDate ?? null,
    scope: "pending_shift_leader",
  });

  return { items };
}

export async function getStoreManagerApprovalQueue(params: {
  reqUser: any;
  storeId: number;
  workDate?: string | null;
}) {
  assertStoreManagerApprover(params.reqUser);
  assertStoreAccess(params.reqUser, params.storeId, "Ban khong co quyen xem hang cho duyet cua quan nay");

  const items = await repo.listBatchApprovalQueue({
    storeId: params.storeId,
    workDate: params.workDate ?? null,
    scope: "pending_store_manager",
  });

  return { items };
}

export async function getDmApprovalQueue(params: {
  reqUser: any;
  storeId: number;
  workDate?: string | null;
}) {
  assertRole(
    params.reqUser,
    ["district_manager", "admin"],
    "Chi district manager hoac admin moi duoc xem hang cho duyet cap van phong",
  );

  if (isDistrictManager(params.reqUser)) {
    assertStoreAccess(params.reqUser, params.storeId);
  }

  const items = await repo.listBatchApprovalQueue({
    storeId: params.storeId,
    workDate: params.workDate ?? null,
    scope: "pending_dm",
  });

  return { items };
}
