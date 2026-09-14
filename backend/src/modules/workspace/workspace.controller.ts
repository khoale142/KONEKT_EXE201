import * as onboarding from './staffOnboarding.service';
import { ensureStoreInviteCode } from './storeInvite.service';
import { requireKonekt } from '../auth/konektSession.service';
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import * as workspaceService from "./workspace.service";
import { PERMISSION_DEFINITIONS } from "./workspace.types";
import { users } from "../../db/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { issueCanonicalWorkspaceSession, listCanonicalWorkspaces } from '../auth/canonicalWorkspaceSession.service';
import { canonicalWorkspaceSelectionSchema } from './workspace.schema';
import { canonicalJoinDecisionSchema, canonicalMembershipStoreAccessSchema, canonicalTenantCreateSchema, canonicalTenantJoinSchema } from './workspace.schema';
import * as canonicalLifecycle from './canonicalTenantLifecycle.service';
import * as canonicalEmployment from './canonicalEmployment.service';
import { canonicalEmploymentSchema } from './workspace.schema';

async function getEmailFromRequest(req: Request): Promise<string> {
  const u = (req as any).user;
  if (u?.email) return u.email;

  if (u?.sub) {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, Number(u.sub)),
    });
    if (userRecord?.email) return userRecord.email;
  }


  throw new ApiError(401, "Không xác định được danh tính người dùng");
}

/**
 * Canonical review is primary, but an Owner holding a still-valid legacy
 * KONEKT session may reach the existing HR screen during staged rollout.
 * The lifecycle service rechecks canonical Owner membership from the database;
 * this helper merely derives the Account/Tenant context without trusting client
 * input or legacy role claims.
 */
function getOwnerReviewContext(req: Request) {
  const accountId = req.user?.authMode === 'canonical' ? req.user.accountId : Number(req.user?.sub);
  const tenantId = req.user?.tenantId;
  if (!accountId || !tenantId) throw new ApiError(403, 'Cần Owner workspace để duyệt yêu cầu');
  return { accountId, tenantId };
}

export const getWorkspacesHandler = asyncHandler(async (req: Request, res: Response) => {
  const claims = req.user!;
  const data = claims.authMode === 'canonical' && claims.accountId
    ? await listCanonicalWorkspaces(claims.accountId)
    : await workspaceService.getUserWorkspaces(claims);
  res.json({ success: true, data });
});

export const createTenantHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.authMode === 'canonical' && req.user.accountId) {
    const created = await canonicalLifecycle.createCanonicalTenant(req.user.accountId, canonicalTenantCreateSchema.parse({ name: req.body?.brandName, address: req.body?.address, phone: req.body?.phone }));
    const session = await issueCanonicalWorkspaceSession(req.user.accountId, { membershipId: created.membership.id, tenantId: created.tenant.id, storeId: created.store.id });
    res.status(201).json({ success: true, data: { tenant: created.tenant, store: created.store, ...session } });
    return;
  }
  const email = await getEmailFromRequest(req);
  const { brandName, address, phone, fullName } = req.body;
  const data = await workspaceService.createTenantWorkspace(req.user!, {
    brandName,
    address,
    phone,
    fullName,
  });
  res.status(201).json({ success: true, data });
});

export const createCanonicalJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.authMode !== 'canonical' || !req.user.accountId) throw new ApiError(403, 'Yêu cầu canonical cần Account session');
  const payload = canonicalTenantJoinSchema.parse(req.body);
  if (payload.storeInviteCode) {
    const request = await canonicalLifecycle.requestCanonicalStoreJoin(req.user.accountId, payload.storeInviteCode);
    // A Store code identifies the requested workplace only. It cannot issue a
    // business session or grant a role before Owner review and approval.
    res.status(201).json({ success: true, data: request });
    return;
  }
  const data = await canonicalLifecycle.requestCanonicalTenantJoin(req.user.accountId, payload.joinCode!);
  res.status(201).json({ success: true, data });
});
export const listCanonicalJoinRequestsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accountId, tenantId } = getOwnerReviewContext(req);
  res.json({ success: true, data: await canonicalLifecycle.listCanonicalJoinRequests(accountId, tenantId) });
});
export const approveCanonicalJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accountId, tenantId } = getOwnerReviewContext(req);
  const payload = canonicalJoinDecisionSchema.parse(req.body);
  res.json({ success: true, data: await canonicalLifecycle.decideCanonicalJoinRequest(accountId, tenantId, Number(req.params.id), 'approved', payload.role, payload.storeIds) });
});
export const rejectCanonicalJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accountId, tenantId } = getOwnerReviewContext(req);
  res.json({ success: true, data: await canonicalLifecycle.decideCanonicalJoinRequest(accountId, tenantId, Number(req.params.id), 'rejected') });
});
export const cancelCanonicalJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.authMode !== 'canonical' || !req.user.accountId) throw new ApiError(403, 'Yêu cầu canonical cần Account session');
  res.json({ success: true, data: await canonicalLifecycle.cancelCanonicalJoinRequest(req.user.accountId, Number(req.params.id)) });
});
export const setCanonicalMembershipStoreAccessHandler = asyncHandler(async (req: Request, res: Response) => {
  const { accountId, tenantId } = getOwnerReviewContext(req);
  const payload = canonicalMembershipStoreAccessSchema.parse(req.body);
  res.json({ success: true, data: await canonicalLifecycle.setCanonicalMembershipStoreAccess(accountId, tenantId, Number(req.params.membershipId), payload.storeIds) });
});
export const getMyCanonicalEmploymentHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await canonicalEmployment.getMyCanonicalEmployment(req.user!) });
});
export const getCanonicalEmploymentHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await canonicalEmployment.getCanonicalEmploymentForMembership(req.user!, Number(req.params.membershipId)) });
});
export const upsertCanonicalEmploymentHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await canonicalEmployment.upsertCanonicalEmployment(req.user!, Number(req.params.membershipId), canonicalEmploymentSchema.parse(req.body)) });
});

export const verifyStoreInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  requireKonekt(req.user!);
  const code = req.body?.code || req.query?.code;
  if (!code) throw new ApiError(400, "Vui lòng cung cấp mã mời của cửa hàng");
  const data = req.user?.authMode === 'canonical' && req.user.accountId
    ? await canonicalLifecycle.resolveCanonicalStoreInvite(String(code))
    : await workspaceService.verifyStoreInviteCode(String(code));
  res.json({ success: true, data });
});

export const joinStoreRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  requireKonekt(req.user!);
  const data = await onboarding.submitJoin(Number(req.user!.sub), req.body);
  res.status(201).json({ success: true, data });
});

export const switchWorkspaceHandler = asyncHandler(async (req: Request, res: Response) => {
  const claims = req.user!;
  if (claims.authMode === 'canonical' && claims.accountId) {
    const selection = canonicalWorkspaceSelectionSchema.parse(req.body);
    const data = await issueCanonicalWorkspaceSession(claims.accountId, selection);
    res.json({ success: true, data });
    return;
  }
  const { tenantId, storeId } = req.body;
  if (!tenantId) throw new ApiError(400, "Vui lòng chọn thương hiệu làm việc");
  const data = await workspaceService.switchWorkspaceTenant(
    claims,
    Number(tenantId),
    storeId ? Number(storeId) : undefined
  );
  res.json({ success: true, data });
});

export const listStoreJoinRequestsHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");
  const data = await onboarding.listRequests(Number(tenantId), req.query);
  res.json({ success: true, data });
});

export const approveStoreJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  const approverUserId = Number(u?.sub);
  const requestId = Number(req.params.id);

  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");

  const data = await onboarding.decideJoin(requestId, approverUserId, Number(tenantId), 'approved', req.body);
  res.json({ success: true, data });
});

export const rejectStoreJoinRequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const u = (req as any).user;
  const tenantId = u?.tenantId;
  const approverUserId = Number(u?.sub);
  const requestId = Number(req.params.id);

  if (!tenantId) throw new ApiError(400, "Không xác định được thương hiệu");

  const data = await onboarding.decideJoin(requestId, approverUserId, Number(tenantId), 'rejected', req.body);
  res.json({ success: true, data });
});

export const getPermissionDefinitionsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: PERMISSION_DEFINITIONS });
});

export const myJoinStatusHandler = asyncHandler(async (req, res) => {
  requireKonekt(req.user!);
  res.json({ success: true, data: await onboarding.myJoinStatus(Number(req.user!.sub)) });
});
export const listStoresHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await onboarding.listOwnerStores(req.user!.tenantId!) });
});
export const createStoreHandler = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await onboarding.createStore(req.user!.tenantId!, req.body) });
});
export const ensureInviteHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ensureStoreInviteCode(req.user!.tenantId!, Number(req.params.id)) });
});
export const listStaffHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await onboarding.listStaff(req.user!.tenantId!, req.query) });
});
