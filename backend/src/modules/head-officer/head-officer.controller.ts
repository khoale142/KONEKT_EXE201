import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { pool } from "../../config/db";
import { sendTicketClosedEmail } from "../../utils/mail.service";
import {
  notifyTicketReply,
  notifyTicketClosed,
  resetTicketReplySpamGuard,
} from "../notifications/notifications.service";
import {
  getRevenueReport,
  getRevenueAnalysis,
  getWasteReport,
  getPayrollReport,
  getStaffRequests,
  approveStaffRequest,
  rejectStaffRequest,
  getComplaints,
  getProfileEditRequests,
  createProfileEditRequest,
  getStoreDetail,
  getStoreStaff,
  getHrEmployees,
  updateStaffWage,
  getWasteDetail,
  getStoreIngredients,
  createWasteReport,
  // New DM modules
  getPayrollReportV2,
  updatePtPayrollPct,
  getInventoryWasteSummary,
  getStoreWasteDetail,
  assignComplaint,
  getStoreManagers,
  getRevenueTargets,
  setRevenueTarget,
  // Phase 1: Trend + Alerts
  getRevenueTrend,
  getWasteTrend,
  getComplaintAlerts,
  // Task 1 & 2
  getRevenueStats,
  getDashboardInsights,
  // Task 3 — per-store granular endpoints
  getStoreFinance,
  getStoreStockPaged,
  getStoreProductsPaged,
  // Marketing complaint management
  updateComplaintForMarketing,
  resolveComplaintBySM,
  closeComplaintByMarketing,
  getAssignedComplaints,
  // Enterprise ticket management
  getComplaintDetail,
  assignComplaintByMarketing,
  replyToTicket,
  getAllStoreManagers,
  // TASK 1: Customer chat portal
  customerReplyToTicket,
  getCustomerTicketDetail,
} from "./head-officer.service";

/* ─── Helpers ─── */
function extractStoreIds(req: Request): number[] | undefined {
  const u = (req as any).user;
  return u?.storeIds?.length ? u.storeIds : undefined;
}

function getActorId(req: Request): number {
  return Number((req as any).user.sub);
}

/* ═══ 1. Doanh thu / chi tiêu ═══ */
export const revenueReport = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getRevenueReport(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo === "string" ? dateTo : undefined,
  );
  res.json({ data });
});

export const revenueAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getRevenueAnalysis(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo === "string" ? dateTo : undefined,
  );
  res.json({ data });
});

/* ═══ 2. Hủy hàng ═══ */
export const wasteReport = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getWasteReport(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo === "string" ? dateTo : undefined,
  );
  res.json({ data });
});

/* ╕╕╕ 3. Quỹ lương / nhân sự ╕╕╕ */
export const payrollReport = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getPayrollReport(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo === "string" ? dateTo : undefined,
  );
  res.json({ data });
});

/* ═══ 4. Request tuyển dụng / sa thải ═══ */
export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await getStaffRequests(extractStoreIds(req));
  res.json({ data });
});

export const listHrRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await getStaffRequests(extractStoreIds(req), { includeStaffUpdate: true });
  res.json({ data });
});

export const approveRequest = asyncHandler(async (req: Request, res: Response) => {
  const requestId = Number(req.params.id);
  const result = await approveStaffRequest(requestId, getActorId(req), (req as any).user);
  res.json({ data: result });
});

export const approveHrRequest = asyncHandler(async (req: Request, res: Response) => {
  const requestId = Number(req.params.id);
  const result = await approveStaffRequest(requestId, getActorId(req), (req as any).user, {
    allowStaffUpdate: true,
  });
  res.json({ data: result });
});

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const requestId = Number(req.params.id);
  const result = await rejectStaffRequest(requestId, getActorId(req), req.body?.reason, (req as any).user);
  res.json({ data: result });
});

export const rejectHrRequest = asyncHandler(async (req: Request, res: Response) => {
  const requestId = Number(req.params.id);
  const result = await rejectStaffRequest(
    requestId,
    getActorId(req),
    req.body?.reason,
    (req as any).user,
    { allowStaffUpdate: true },
  );
  res.json({ data: result });
});

/* ═══ 5. Complaints ═══ */
export const listComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getComplaints(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
  );
  res.json({ data });
});

/* ═══ 6. Profile Edit Requests ═══ */
export const listProfileEditRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await getProfileEditRequests(extractStoreIds(req));
  res.json({ data });
});

export const submitProfileEditRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const user_id = Number(user.sub);
  const store_id = req.body.store_id || user.storeIds?.[0];
  if (!store_id) {
    res.status(400).json({ message: "Thiếu store_id" });
    return;
  }
  const note = typeof req.body.note === "string"
    ? req.body.note
    : JSON.stringify(req.body.changes ?? req.body);
  const data = await createProfileEditRequest({ user_id, store_id: Number(store_id), note });
  res.status(201).json({ data });
});

/* ═══ 7. Chi tiết cơ sở ═══ */
export const storeDetail = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) {
    res.status(400).json({ message: "store_id không hợp lệ" });
    return;
  }
  const data = await getStoreDetail(storeId, extractStoreIds(req));
  res.json({ data });
});

export const listHrEmployeesHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getHrEmployees(extractStoreIds(req));
  res.json({ data });
});

/* ═══ MODULE 1 — Quỹ lương PT/FT ═══ */
export const payrollReportV2 = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getPayrollReportV2(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
  );
  res.json({ data });
});

export const updatePtPct = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  const pct = Number(req.body?.pct);
  if (isNaN(pct)) { res.status(400).json({ message: "pct không hợp lệ" }); return; }
  const data = await updatePtPayrollPct(storeId, pct, extractStoreIds(req));
  res.json({ data });
});

/* ═══ MODULE 2 — Tồn kho & Hủy hàng ═══ */
export const inventoryWasteSummary = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, month, year } = req.query;

  let df = typeof dateFrom === "string" ? dateFrom : undefined;
  let dt = typeof dateTo   === "string" ? dateTo   : undefined;

  // Support ?month=3&year=2026 shorthand
  if (!df && month && year) {
    const m = parseInt(month as string, 10);
    const y = parseInt(year  as string, 10);
    if (m >= 1 && m <= 12 && y >= 2000) {
      const lastDay = new Date(y, m, 0).getDate();
      df = `${y}-${String(m).padStart(2, "0")}-01`;
      dt = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  const data = await getInventoryWasteSummary(extractStoreIds(req), df, dt);
  res.json({ data });
});

export const storeWasteDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  const { dateFrom, dateTo } = req.query;
  if (isNaN(storeId)) { res.status(400).json({ message: "storeId không hợp lệ" }); return; }
  const data = await getStoreWasteDetail(
    storeId,
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
    extractStoreIds(req),
  );
  res.json({ data });
});

/* ═══ MODULE 3 — Assign khiếu nại ═══ */
export const assignComplaintHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const smUserId = Number(req.body?.sm_id);
  if (!smUserId) { res.status(400).json({ message: "Thiếu sm_id" }); return; }
  const data = await assignComplaint(ticketId, smUserId, getActorId(req), extractStoreIds(req));
  res.json({ data });
});

export const getStoreManagersHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  const data = await getStoreManagers(storeId, extractStoreIds(req));
  res.json({ data });
});

export const getAllStoreManagersHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAllStoreManagers();
  res.json({ data });
});

/* ═══ MODULE 4 — Target doanh thu ═══ */
export const revenueTargetsHandler = asyncHandler(async (req: Request, res: Response) => {
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const data = await getRevenueTargets(extractStoreIds(req), month);
  res.json({ data });
});

export const setRevenueTargetHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  const target  = Number(req.body?.target);
  if (isNaN(target)) { res.status(400).json({ message: "target không hợp lệ" }); return; }
  const data = await setRevenueTarget(storeId, target, extractStoreIds(req));
  res.json({ data });
});

/* ═══ Phase 1: Trend APIs ═══ */
export const revenueTrendHandler = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getRevenueTrend(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
  );
  res.json({ data });
});

export const wasteTrendHandler = asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;
  const data = await getWasteTrend(
    extractStoreIds(req),
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
  );
  res.json({ data });
});

export const complaintAlertsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getComplaintAlerts(extractStoreIds(req));
  res.json({ data });
});

/* ═══ Task 1: Revenue Stats MoM ═══ */
export const revenueStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const month   = req.query.month   ? Number(req.query.month)   : now.getMonth() + 1;
  const year    = req.query.year    ? Number(req.query.year)    : now.getFullYear();
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (isNaN(month) || month < 1 || month > 12) { res.status(400).json({ message: "month không hợp lệ (1-12)" }); return; }
  if (isNaN(year)  || year < 2020)              { res.status(400).json({ message: "year không hợp lệ" }); return; }

  let scopedStoreId: number | undefined = undefined;
  const storeIds = extractStoreIds(req);
  if (storeId && !isNaN(storeId)) {
    if (storeIds && !storeIds.includes(storeId)) {
      res.status(403).json({ message: "Không có quyền truy cập cơ sở này" });
      return;
    }
    scopedStoreId = storeId;
  }
  const data = await getRevenueStats(month, year, scopedStoreId);
  res.json({ data });
});

/* ═══ Task 2: Dashboard Insights ═══ */
export const dashboardInsightsHandler = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year  = req.query.year  ? Number(req.query.year)  : undefined;
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;

  // If a specific storeId is requested, filter to just that store
  let storeIds = extractStoreIds(req);
  if (storeId && !isNaN(storeId)) {
    // Ensure the requested store is within the user's allowed stores
    if (storeIds && !storeIds.includes(storeId)) {
      res.status(403).json({ message: "Không có quyền truy cập cơ sở này" });
      return;
    }
    storeIds = [storeId];
  }

  const data = await getDashboardInsights(storeIds, month, year);
  res.json({ data });
});

/* ═══ Per-store granular endpoints (Task 3) ═══ */
export const storeFinanceHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) { res.status(400).json({ message: "store_id không hợp lệ" }); return; }
  const { dateFrom, dateTo } = req.query;
  const data = await getStoreFinance(
    storeId,
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
    extractStoreIds(req),
  );
  res.json({ data });
});

export const storeStockPagedHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) { res.status(400).json({ message: "store_id không hợp lệ" }); return; }
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const data = await getStoreStockPaged(storeId, page, limit, extractStoreIds(req));
  res.json({ data });
});

export const storeProductsPagedHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) { res.status(400).json({ message: "store_id không hợp lệ" }); return; }
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const { dateFrom, dateTo } = req.query;
  const data = await getStoreProductsPaged(
    storeId, page, limit,
    typeof dateFrom === "string" ? dateFrom : undefined,
    typeof dateTo   === "string" ? dateTo   : undefined,
    extractStoreIds(req),
  );
  res.json({ data });
});

/* ═══ 8. Nhân sự theo cơ sở ═══ */
export const getStoreStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) {
    res.status(400).json({ message: "store_id không hợp lệ" });
    return;
  }
  const data = await getStoreStaff(storeId, extractStoreIds(req));
  res.json({ data });
});

export const updateStaffWageHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const storeId = Number(req.body.store_id);
  const wage = Number(req.body.wage);
  if (!storeId || isNaN(storeId)) { res.status(400).json({ message: "Thiếu store_id" }); return; }
  if (isNaN(userId) || userId <= 0) { res.status(400).json({ message: "userId không hợp lệ" }); return; }
  if (isNaN(wage) || wage < 0) { res.status(400).json({ message: "wage không hợp lệ" }); return; }
  const data = await updateStaffWage(userId, storeId, wage, extractStoreIds(req));
  res.json({ data });
});

/* ═══ 9. Hủy hàng chi tiết theo cơ sở ═══ */
export const getWasteDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) {
    res.status(400).json({ message: "store_id không hợp lệ" });
    return;
  }
  const data = await getWasteDetail(storeId, extractStoreIds(req));
  res.json({ data });
});

export const getStoreIngredientsHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) {
    res.status(400).json({ message: "store_id không hợp lệ" });
    return;
  }
  const data = await getStoreIngredients(storeId, extractStoreIds(req));
  res.json({ data });
});

export const createWasteReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const storeId = Number(req.params.storeId);
  if (!storeId || isNaN(storeId)) {
    res.status(400).json({ message: "store_id không hợp lệ" });
    return;
  }
  const items = req.body.items as { ingredient_id: number; quantity: number }[];
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "Cần ít nhất 1 nguyên liệu" });
    return;
  }
  const data = await createWasteReport(storeId, items, getActorId(req), extractStoreIds(req));
  res.status(201).json({ data });
});

/* ═══ Marketing: quản lý khiếu nại ═══ */
export const marketingListComplaintsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getComplaints(); // Marketing xem tất cả, không filter theo store
  res.json({ data });
});

export const updateComplaintHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) { res.status(400).json({ message: "ticketId không hợp lệ" }); return; }
  const { priority, customer_reply, assigned_to } = req.body ?? {};
  const data = await updateComplaintForMarketing(
    ticketId,
    { priority, customer_reply, assigned_to: assigned_to ? Number(assigned_to) : undefined },
    getActorId(req),
  );
  res.json({ data });
});

export const closeComplaintHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) { res.status(400).json({ message: "ticketId không hợp lệ" }); return; }
  const { resolution_reason, internal_note } = req.body ?? {};
  if (!resolution_reason) { res.status(400).json({ message: "Vui lòng chọn lý do đóng phiếu" }); return; }
  const data = await closeComplaintByMarketing(ticketId, getActorId(req), String(resolution_reason), internal_note ? String(internal_note) : undefined);

  // Send closed-notification email (fire-and-forget)
  try {
    const emailR = await pool.query(
      `SELECT c.email, ct.customer_id FROM customer_tickets ct JOIN customers c ON c.id = ct.customer_id WHERE ct.id = $1`,
      [ticketId],
    );
    const customerEmail = emailR.rows[0]?.email;
    const customerId = emailR.rows[0]?.customer_id;
    if (customerEmail) {
      await sendTicketClosedEmail(customerEmail, ticketId);
    }
    // Trạm 3 — TICKET_CLOSED (fire-and-forget)
    if (customerId) {
      notifyTicketClosed({
        customerId: Number(customerId),
        ticketId,
        reason: String(resolution_reason),
      }).catch((err) => {
        console.error(`[closeComplaintHandler] Lỗi TICKET_CLOSED notification cho ticket #${ticketId}:`, err);
      });
    }
  } catch (_emailErr) {
    // Silently ignore
  }

  res.json({ data });
});

/* ═══ Enterprise ticket detail + chat + assign ═══ */
export const complaintDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) { res.status(400).json({ message: "ticketId không hợp lệ" }); return; }
  const data = await getComplaintDetail(ticketId);
  res.json({ data });
});

export const assignComplaintByMarketingHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const smUserId = Number(req.body?.sm_id);
  if (!smUserId) { res.status(400).json({ message: "Thiếu sm_id" }); return; }
  const data = await assignComplaintByMarketing(
    ticketId,
    smUserId,
    getActorId(req),
    req.body?.assign_intent,
    req.body?.note,
  );
  res.json({ data });
});

export const replyToTicketHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const { message, is_internal } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ message: "Nội dung tin nhắn không được để trống" });
    return;
  }
  const data = await replyToTicket(ticketId, getActorId(req), message.trim(), !!is_internal);

  // Trạm 2 — TICKET_REPLY (chỉ gửi khi tin nhắn công khai + pass anti-spam)
  if (!is_internal) {
    pool.query(
      `SELECT ct.customer_id FROM customer_tickets ct WHERE ct.id = $1`,
      [ticketId],
    ).then((r) => {
      const customerId = r.rows[0]?.customer_id;
      if (customerId) {
        return notifyTicketReply({ customerId: Number(customerId), ticketId });
      }
    }).catch((err) => {
      console.error(`[replyToTicketHandler] Lỗi TICKET_REPLY notification cho ticket #${ticketId}:`, err);
    });
  }

  res.status(201).json({ data });
});

/* ═══ TASK 1: Customer chat portal handlers ═══ */
export const customerTicketDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) {
    res.status(400).json({ message: "ticketId không hợp lệ" });
    return;
  }
  const customerId = Number((req as any).user.sub);
  const data = await getCustomerTicketDetail(ticketId, customerId);
  res.json({ data });
});

export const customerReplyHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) {
    res.status(400).json({ message: "ticketId không hợp lệ" });
    return;
  }
  const { message } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ message: "Nội dung tin nhắn không được để trống" });
    return;
  }
  const customerId = Number((req as any).user.sub);
  const data = await customerReplyToTicket(ticketId, customerId, message.trim());

  // Reset anti-spam: customer đã reply → mark tất cả TICKET_REPLY notification cũ là đã đọc
  resetTicketReplySpamGuard(ticketId, customerId).catch((err) => {
    console.error(`[customerReplyHandler] Lỗi reset anti-spam cho ticket #${ticketId}:`, err);
  });

  res.status(201).json({ data });
});

/* ═══ Store Manager: giải trình khiếu nại ═══ */
export const smListComplaintsHandler = asyncHandler(async (req: Request, res: Response) => {
  const smUserId = getActorId(req);
  const data = await getAssignedComplaints(smUserId);
  res.json({ data });
});

export const resolveComplaintHandler = asyncHandler(async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!ticketId || isNaN(ticketId)) { res.status(400).json({ message: "ticketId không hợp lệ" }); return; }
  const internal_note = req.body?.internal_note;
  if (!internal_note || typeof internal_note !== "string" || !internal_note.trim()) {
    res.status(400).json({ message: "internal_note (nội dung giải trình) không được để trống" });
    return;
  }
  const data = await resolveComplaintBySM(ticketId, internal_note.trim(), getActorId(req));

  // Trạm 3 — TICKET_CLOSED (SM resolve = đóng phiếu, fire-and-forget)
  pool.query(
    `SELECT customer_id FROM customer_tickets WHERE id = $1`,
    [ticketId],
  ).then((r) => {
    const customerId = r.rows[0]?.customer_id;
    if (customerId) {
      return notifyTicketClosed({
        customerId: Number(customerId),
        ticketId,
        reason: "SM đã giải trình",
      });
    }
  }).catch((err) => {
    console.error(`[resolveComplaintHandler] Lỗi TICKET_CLOSED notification cho ticket #${ticketId}:`, err);
  });

  res.json({ data });
});
