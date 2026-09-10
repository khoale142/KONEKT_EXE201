import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import * as workspaceService from "./workspace.service";
import { PERMISSION_DEFINITIONS } from "./workspace.types";
import { users } from "../../db/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

async function getEmailFromRequest(req: Request): Promise<string> {
  const u = (req as any).user;
  if (u?.email) return u.email;

  if (u?.sub) {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, Number(u.sub)),
    });
    if (userRecord?.email) return userRecord.email;
  }

  if (req.body?.email) return String(req.body.email).trim().toLowerCase();
  throw new ApiError(401, "Không xác định được danh tính người dùng");
}

export const getWorkspacesHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = await getEmailFromRequest(req);
  const data = await workspaceService.getUserWorkspaces(email);
  res.json({ success: true, data });
});

export const createTenantHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = await getEmailFromRequest(req);
  const { brandName, address, phone, fullName } = req.body;
  const data = await workspaceService.createTenantWorkspace(email, {
    brandName,
    address,
    phone,
    fullName,
  });
  res.status(201).json({ success: true, data });
});

export const verifyStoreInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const code = req.body?.code || req.query?.code;
  if (!code) throw new ApiError(400, "Vui lòng cung cấp mã mời của cửa hàng");
  const data = await workspaceService.verifyStoreInviteCode(String(code));
  res.json({ success: true, data });
});

export const joinStoreRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  let email = req.body?.email;
  try {
    email = await getEmailFromRequest(req);
  } catch {
    // If guest, use body email
  }

  if (!email) throw new ApiError(400, "Vui lòng cung cấp địa chỉ email");

  const { storeInviteCode, fullName, phone, desiredPosition, note } = req.body;
  const data = await workspaceService.submitStoreJoinRequest({
    storeInviteCode,
    email,
    fullName,
    phone,
    desiredPosition,
    note,
  });
  res.status(201).json({ success: true, data });
});

export const switchWorkspaceHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = await getEmailFromRequest(req);
  const { tenantId, storeId } = req.body;
  if (!tenantId) throw new ApiError(400, "Vui lòng chọn thương hiệu làm việc");
  const data = await workspaceService.switchWorkspaceTenant(
    email,
    Number(tenantId),
    storeId ? Number(storeId) : undefined
  );
  res.json({ success: true, data });
});

export const listStoreJoinRequestsHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");
  const data = await workspaceService.listStoreJoinRequests(Number(tenantId));
  res.json({ success: true, data });
});

export const approveStoreJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  const approverUserId = Number(u?.sub);
  const requestId = Number(req.params.id);

  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");

  const { role, storeId, customPermissions } = req.body;
  const data = await workspaceService.approveStoreJoinRequest(
    requestId,
    approverUserId,
    Number(tenantId),
    {
      role,
      storeId: storeId ? Number(storeId) : undefined,
      customPermissions,
    }
  );
  res.json({ success: true, data });
});

export const rejectStoreJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  const approverUserId = Number(u?.sub);
  const requestId = Number(req.params.id);

  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");

  const { reason } = req.body;
  const data = await workspaceService.rejectStoreJoinRequest(
    requestId,
    approverUserId,
    Number(tenantId),
    reason
  );
  res.json({ success: true, data });
});

export const getPermissionDefinitionsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: PERMISSION_DEFINITIONS });
});
