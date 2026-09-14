import { Router } from "express";
import { payrollController } from "./payroll.controller";
import { authGuard } from "../../middlewares/authGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { requirePermission, requireStoreAccess } from '../../middlewares/canonicalAuthorizationGuard';

const router = Router();

router.get(
  "/my",
  authGuard,
  requirePermission('member.manage'),
  payrollController.getMyPayroll
);

// Màn hình Manager / HR
router.get(
  "/store/:storeId",
  authGuard,
  requirePermission('member.manage'),
  requireStoreAccess((req) => Number(req.params.storeId)),
  roleGuard(["store_manager", "head_officer", "hr_manager"]),
  payrollController.getStorePayrolls
);

router.post(
  "/store/:storeId/finalize",
  authGuard,
  requirePermission('member.manage'),
  requireStoreAccess((req) => Number(req.params.storeId)),
  roleGuard(["head_officer", "hr_manager"]),
  payrollController.finalizeStorePayroll
);

export default router;
