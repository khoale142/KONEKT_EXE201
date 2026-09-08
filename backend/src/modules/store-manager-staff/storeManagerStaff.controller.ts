import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createStaffSchema,
  submitFireStaffRequestBodySchema,
  submitHireStaffRequestBodySchema,
  submitStaffUpdateRequestBodySchema,
  listStoreManagerStaffQuerySchema,
  terminateStaffBodySchema,
  updateStaffAvatarBodySchema,
} from "./storeManagerStaff.schema";
import * as service from "./storeManagerStaff.service";

const log = (msg: string, data?: object) => {
  console.log(`[store-manager-staff] ${msg}`, data ?? "");
};

export const listStoreManagerStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = listStoreManagerStaffQuerySchema.parse(req.query);
  const data = await service.listStoreManagerStaff({
    reqUser: req.user,
    storeId: q.storeId,
    q: q.q,
    role: q.role,
    status: q.status,
  });
  res.json(data);
});

export const createStoreManagerStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  log("createStaff received", {
    bodyKeys: Object.keys(req.body || {}),
    storeId: req.query.storeId,
    hasUser: !!req.user,
  });
  const body = createStaffSchema.parse(req.body);
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;
  log("createStaff parsed", {
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    role: body.role,
    hireDate: body.hireDate,
    storeId: qStoreId,
  });
  const data = await service.createStoreManagerStaff({
    reqUser: req.user,
    storeId: qStoreId,
    payload: {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      role: body.role,
      hireDate: body.hireDate,
      employmentType: body.employmentType,
      avatarUrl: body.avatarUrl ?? null,
      dateOfBirth: body.dateOfBirth,
      address: body.address,
      idCardNumber: body.idCardNumber,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
    },
  });

  res.status(201).json(data);
});

export const terminateStoreManagerStaffHandler = asyncHandler(async (req: Request, res: Response) => {
  const staffId = Number(req.params.id);
  if (!Number.isFinite(staffId) || staffId <= 0) {
    return res.status(400).json({ message: "staff id invalid" });
  }

  const body = terminateStaffBodySchema.parse(req.body ?? {});
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const data = await service.terminateStoreManagerStaff({
    reqUser: req.user,
    storeId: qStoreId,
    staffId,
    payload: { reason: body.reason },
  });

  res.json(data);
});

// ─────────────────────────────────────────────────────────────
// Hire/Fire request submission: create schedule_requests rows
// so HR/District manager can approve/reject from /office/hr/requests.
// ─────────────────────────────────────────────────────────────
export const submitHireStaffRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  log("submitHireStaffRequest received", {
    bodyKeys: Object.keys(req.body || {}),
    storeId: req.query.storeId,
  });

  const body = submitHireStaffRequestBodySchema.parse(req.body);
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const data = await service.submitHireStaffRequest({
    reqUser: req.user,
    storeId: qStoreId,
    payload: {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      role: body.role,
      hireDate: body.hireDate,
      employmentType: body.employmentType,
      avatarUrl: body.avatarUrl ?? null,
      dateOfBirth: body.dateOfBirth,
      address: body.address,
      idCardNumber: body.idCardNumber,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
    },
  });

  res.status(201).json(data);
});

export const submitFireStaffRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const staffId = Number(req.params.id);
  if (!Number.isFinite(staffId) || staffId <= 0) {
    return res.status(400).json({ message: "staff id invalid" });
  }

  const body = submitFireStaffRequestBodySchema.parse(req.body ?? {});
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const data = await service.submitFireStaffRequest({
    reqUser: req.user,
    storeId: qStoreId,
    staffId,
    payload: {
      reason: body.reason,
      position: body.position,
      targetRole: body.targetRole,
      targetHireDate: body.targetHireDate ?? null,
    },
  });

  res.status(201).json(data);
});

export const updateStoreManagerStaffAvatarHandler = asyncHandler(async (req: Request, res: Response) => {
  const staffId = Number(req.params.id);
  if (!Number.isFinite(staffId) || staffId <= 0) {
    return res.status(400).json({ message: "staff id invalid" });
  }

  const body = updateStaffAvatarBodySchema.parse(req.body ?? {});
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const data = await service.updateStoreManagerStaffAvatar({
    reqUser: req.user,
    storeId: qStoreId,
    staffId,
    payload: { avatarUrl: body.avatarUrl ?? null },
  });

  res.json(data);
});

export const submitStaffUpdateRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const staffId = Number(req.params.id);
  if (!Number.isFinite(staffId) || staffId <= 0) {
    return res.status(400).json({ message: "staff id invalid" });
  }

  const body = submitStaffUpdateRequestBodySchema.parse(req.body ?? {});
  const qStoreId = req.query.storeId ? Number(req.query.storeId) : undefined;

  const data = await service.submitStaffUpdateRequest({
    reqUser: req.user,
    storeId: qStoreId,
    staffId,
    payload: {
      reason: body.reason,
      targetRole: body.targetRole,
      targetEmploymentType: body.targetEmploymentType,
    },
  });

  res.status(201).json(data);
});

