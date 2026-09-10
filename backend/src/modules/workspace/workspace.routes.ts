import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
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
} from "./workspace.controller";

const router = Router();

// Multi-tenant & Workspace endpoints
router.get("/tenants", authGuard, getWorkspacesHandler);
router.post("/create-tenant", authGuard, createTenantHandler);
router.post("/verify-store-invite", verifyStoreInviteHandler);
router.post("/join-store-request", joinStoreRequestHandler);
router.post("/select-tenant", authGuard, switchWorkspaceHandler);
router.get("/permissions", getPermissionDefinitionsHandler);

// Staff Join Requests for Owner/Manager
router.get("/staff-requests", authGuard, listStoreJoinRequestsHandler);
router.post("/staff-requests/:id/approve", authGuard, approveStoreJoinRequestHandler);
router.post("/staff-requests/:id/reject", authGuard, rejectStoreJoinRequestHandler);

export default router;
