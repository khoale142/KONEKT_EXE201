import { Router } from "express";
import { payrollController } from "./payroll.controller";
import { authGuard } from "../../middlewares/authGuard";
import { roleGuard } from "../../middlewares/roleGuard";

const router = Router();

router.get(
  "/my",
  authGuard,
  payrollController.getMyPayroll
);

// Màn hình Manager / HR
router.get(
  "/store/:storeId",
  authGuard,
  roleGuard(["store_manager", "head_officer", "hr_manager"]),
  payrollController.getStorePayrolls
);

router.post(
  "/store/:storeId/finalize",
  authGuard,
  roleGuard(["head_officer", "hr_manager"]),
  payrollController.finalizeStorePayroll
);

export default router;
