import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createMyShiftChangeRequestSchema,
  checkInSchema,
  checkOutSchema,
  deleteScheduleParamsSchema,
  listMyScheduleQuerySchema,
  listScheduleAuditLogsQuerySchema,
  listStoreAttendanceQuerySchema,
  listStoreScheduleQuerySchema,
  scheduleChangeRequestSchema,
  storeDashboardInsightsQuerySchema,
  updateScheduleBodySchema,
  updateScheduleParamsSchema,
  upsertScheduleSchema,
  upsertSchedulesBatchSchema,
} from "./staffAttendance.schema";
import {
  checkIn,
  checkOut,
  deleteSchedule,
  getStoreManagerDashboardInsights,
  getStoreReconciliation,
  getTodayAttendanceStatus,
  listMySchedules,
  listMyStores,
  listStoreAttendance,
  listStoreSchedules,
  listScheduleAuditLogs,
  listStoreStaff,
  listStoreShifts,
  submitScheduleChangeRequest,
  createMyShiftChangeRequest,
  listMyScheduleChangeRequests,
  listStoreScheduleChangeRequests,
  processScheduleChangeRequest,
  updateSchedule,
  upsertSchedule,
  upsertSchedulesBatch,
  createHireFireRequest,
  listMyHireFireRequests,
} from "./staffAttendance.service";

const DEBUG_SCHEDULE = process.env.DEBUG_SCHEDULE === "1";

export const upsertStaffScheduleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rawBody = req.body;
    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][single][rawBody]", rawBody);
    }

    const body = upsertScheduleSchema.parse(rawBody);

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][single][payload]", body);
    }

    const result = await upsertSchedule({
      reqUser: req.user,
      storeId: body.storeId,
      userId: body.userId,
      workDate: body.workDate,
      shiftType: body.shiftType,
      shiftId: body.shiftId,
      shiftLabel: body.shiftLabel,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
    });

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][single][result]", result);
    }

    res.json(result);
  }
);

export const upsertSchedulesBatchHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const rawBody = req.body;
    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][batch][rawBody]", rawBody);
    }

    const body = upsertSchedulesBatchSchema.parse(rawBody);

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][batch][payload]", body);
    }

    const result = await upsertSchedulesBatch({
      reqUser: req.user,
      storeId: body.storeId,
      userId: body.userId,
      shiftType: body.shiftType,
      schedules: body.schedules,
      note: body.note,
    });

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][assign][batch][result]", result);
    }

    res.json(result);
  }
);

export const listMySchedulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listMyScheduleQuerySchema.parse(req.query);

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][view][staff][query]", q);
    }

    const result = await listMySchedules({
      reqUser: req.user,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });

    if (DEBUG_SCHEDULE) {
      console.log(
        "[DEBUG_SCHEDULE][view][staff][result_count]",
        Array.isArray(result?.schedules) ? result.schedules.length : 0
      );
    }

    res.json(result);
  }
);

export const listMyStoresHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listMyStores({ reqUser: req.user });
    res.json(result);
  }
);

export const listStoreStaffHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    if (!Number.isFinite(storeId) || storeId < 1) {
      return res.status(400).json({ message: "storeId required" });
    }
    const result = await listStoreStaff({
      reqUser: req.user,
      storeId,
    });
    res.json(result);
  }
);

export const listStoreShiftsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    if (!Number.isFinite(storeId) || storeId < 1) {
      return res.status(400).json({ message: "storeId required" });
    }
    const result = await listStoreShifts({
      reqUser: req.user,
      storeId,
    });
    res.json(result);
  }
);

export const listStoreSchedulesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listStoreScheduleQuerySchema.parse(req.query);

    if (DEBUG_SCHEDULE) {
      console.log("[DEBUG_SCHEDULE][view][manager][query]", q);
    }

    const result = await listStoreSchedules({
      reqUser: req.user,
      storeId: q.storeId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });

    if (DEBUG_SCHEDULE) {
      console.log(
        "[DEBUG_SCHEDULE][view][manager][result_count]",
        Array.isArray(result?.schedules) ? result.schedules.length : 0
      );
    }

    res.json(result);
  }
);

export const listScheduleAuditLogsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listScheduleAuditLogsQuerySchema.parse(req.query);
    const result = await listScheduleAuditLogs({
      reqUser: req.user,
      storeId: q.storeId,
      userId: q.userId,
      workDate: q.workDate,
    });
    res.json(result);
  }
);

export const deleteScheduleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const p = deleteScheduleParamsSchema.parse(req.params);

    const result = await deleteSchedule({
      reqUser: req.user,
      id: p.id,
    });

    res.json(result);
  }
);

export const updateScheduleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const p = updateScheduleParamsSchema.parse(req.params);
    const body = updateScheduleBodySchema.parse(req.body ?? {});
    const result = await updateSchedule({
      reqUser: req.user,
      id: p.id,
      shiftId: body.shiftId,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
    });
    res.json(result);
  }
);

export const submitScheduleChangeRequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = scheduleChangeRequestSchema.parse(req.body);
    const result = await submitScheduleChangeRequest({
      reqUser: req.user,
      storeId: body.storeId,
      scheduleIds: body.scheduleIds,
      reason: body.reason,
      detail: body.detail,
    });
    res.json(result);
  }
);

export const createMyShiftChangeRequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createMyShiftChangeRequestSchema.parse(req.body);
    const result = await createMyShiftChangeRequest({
      reqUser: req.user,
      storeId: body.storeId,
      scheduleId: body.scheduleId,
      requestType: body.requestType,
      reason: body.reason,
      desiredWorkDate: body.desiredWorkDate,
      desiredShiftId: body.desiredShiftId,
      desiredShiftLabel: body.desiredShiftLabel,
      desiredStartTime: body.desiredStartTime,
      desiredEndTime: body.desiredEndTime,
    });
    res.json(result);
  }
);

export const listMyScheduleChangeRequestsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listMyScheduleQuerySchema.parse(req.query);
    const result = await listMyScheduleChangeRequests({
      reqUser: req.user,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
    res.json(result);
  }
);

export const getTodayAttendanceStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getTodayAttendanceStatus({
      reqUser: req.user,
    });

    res.json(result);
  }
);

export const checkInHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = checkInSchema.parse(req.body ?? {});

    const result = await checkIn({
      reqUser: req.user,
      note: body.note,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    res.json(result);
  }
);

export const checkOutHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = checkOutSchema.parse(req.body ?? {});

    const result = await checkOut({
      reqUser: req.user,
      note: body.note,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    res.json(result);
  }
);

export const listStoreAttendanceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listStoreAttendanceQuerySchema.parse(req.query);

    const result = await listStoreAttendance({
      reqUser: req.user,
      storeId: q.storeId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });

    res.json(result);
  }
);

export const getStoreReconciliationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = listStoreAttendanceQuerySchema.parse(req.query);

    const result = await getStoreReconciliation({
      reqUser: req.user,
      storeId: q.storeId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });

    res.json(result);
  }
);

export const createHireFireRequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { storeId, requestType, position, reason } = req.body as {
      storeId: number;
      requestType: "hire" | "fire";
      position: string;
      reason: string;
    };
    if (!storeId) throw new Error("storeId is required");
    const result = await createHireFireRequest({
      reqUser: req.user,
      storeId: Number(storeId),
      requestType,
      position,
      reason,
    });
    res.status(201).json({ data: result });
  }
);

export const listMyHireFireRequestsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    if (!storeId) throw new Error("storeId is required");
    const result = await listMyHireFireRequests({
      reqUser: req.user,
      storeId,
    });
    res.json({ data: result });
  }
);
export const getStoreDashboardInsightsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = storeDashboardInsightsQuerySchema.parse(req.query);
    const result = await getStoreManagerDashboardInsights({
      reqUser: req.user,
      storeId: q.storeId,
      windowDays: q.windowDays,
    });
    res.json(result);
  }
);

export const listStoreScheduleChangeRequestsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const storeId = Number(req.query.storeId);
    if (!Number.isFinite(storeId) || storeId < 1) {
      return res.status(400).json({ message: "storeId required" });
    }
    const result = await listStoreScheduleChangeRequests({
      reqUser: req.user,
      storeId,
      status: req.query.status as string,
    });
    res.json(result);
  }
);

export const processScheduleChangeRequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId) || requestId < 1) {
      return res.status(400).json({ message: "Invalid requestId" });
    }
    const { status, note } = req.body;
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ message: "Invalid status (approved/rejected)" });
    }
    const result = await processScheduleChangeRequest({
      reqUser: req.user,
      requestId,
      status,
      note,
    });
    res.json(result);
  }
);
