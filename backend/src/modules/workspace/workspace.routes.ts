import { workspaceOwnerGuard } from '../../middlewares/workspaceOwnerGuard';
import { myJoinStatusHandler, listStoresHandler, createStoreHandler, ensureInviteHandler, listStaffHandler } from './workspace.controller';
import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { requirePermission } from '../../middlewares/canonicalAuthorizationGuard';
import {
  getWorkspacesHandler,
  createTenantHandler,
  verifyStoreInviteHandler,
  joinStoreRequestHandler,
  switchWorkspaceHandler,
  listStoreJoinRequestsHandler,
  approveStoreJoinRequestHandler,
  rejectStoreJoinRequestHandler,
  getPermissionDefinitionsHandler,
  createCanonicalJoinRequestHandler,
  listCanonicalJoinRequestsHandler,
  approveCanonicalJoinRequestHandler,
  rejectCanonicalJoinRequestHandler,
  cancelCanonicalJoinRequestHandler,
  setCanonicalMembershipStoreAccessHandler,
  getMyCanonicalEmploymentHandler,
  getCanonicalEmploymentHandler,
  upsertCanonicalEmploymentHandler,
} from "./workspace.controller";

const router = Router();

// Multi-tenant & Workspace endpoints
router.get("/tenants", authGuard, getWorkspacesHandler);
router.post("/create-tenant", authGuard, createTenantHandler);
router.post('/tenant-join-requests', authGuard, createCanonicalJoinRequestHandler);
router.get('/tenant-join-requests', authGuard, requirePermission('member.manage'), listCanonicalJoinRequestsHandler);
router.post('/tenant-join-requests/:id/approve', authGuard, requirePermission('member.manage'), approveCanonicalJoinRequestHandler);
router.post('/tenant-join-requests/:id/reject', authGuard, requirePermission('member.manage'), rejectCanonicalJoinRequestHandler);
router.post('/tenant-join-requests/:id/cancel', authGuard, cancelCanonicalJoinRequestHandler);
router.put('/members/:membershipId/store-access', authGuard, requirePermission('member.manage'), setCanonicalMembershipStoreAccessHandler);
router.get('/employment/me', authGuard, getMyCanonicalEmploymentHandler);
router.get('/employment/:membershipId', authGuard, requirePermission('member.manage'), getCanonicalEmploymentHandler);
router.put('/employment/:membershipId', authGuard, requirePermission('member.manage'), upsertCanonicalEmploymentHandler);
router.post("/verify-store-invite", authGuard, verifyStoreInviteHandler);
router.post("/join-store-request", authGuard, joinStoreRequestHandler);
router.post("/select-tenant", authGuard, switchWorkspaceHandler);
router.get("/permissions", getPermissionDefinitionsHandler);

// Staff Join Requests for Owner/Manager
router.get("/staff-requests", authGuard, workspaceOwnerGuard, listStoreJoinRequestsHandler);
router.post("/staff-requests/:id/approve", authGuard, workspaceOwnerGuard, approveStoreJoinRequestHandler);
router.post("/staff-requests/:id/reject", authGuard, workspaceOwnerGuard, rejectStoreJoinRequestHandler);

router.get('/my-store-join-status', authGuard, myJoinStatusHandler);
router.get('/stores', authGuard, requirePermission('store.manage'), workspaceOwnerGuard, listStoresHandler);
router.post('/stores', authGuard, requirePermission('store.manage'), workspaceOwnerGuard, createStoreHandler);
router.post('/stores/:id/invite-code', authGuard, requirePermission('store.manage'), workspaceOwnerGuard, ensureInviteHandler);
router.get('/staff', authGuard, requirePermission('member.manage'), workspaceOwnerGuard, listStaffHandler);
export default router;
