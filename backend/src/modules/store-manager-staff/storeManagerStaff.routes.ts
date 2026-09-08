import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  createStoreManagerStaffHandler,
  listStoreManagerStaffHandler,
  submitFireStaffRequestHandler,
  submitHireStaffRequestHandler,
  submitStaffUpdateRequestHandler,
  updateStoreManagerStaffAvatarHandler,
  terminateStoreManagerStaffHandler,
} from "./storeManagerStaff.controller";

const router = Router();

router.use(authGuard);
router.use(portalGuard(["STORE"]));

router.get("/staff", roleGuard(["store_manager"]), listStoreManagerStaffHandler);
router.post("/staff", roleGuard(["store_manager"]), createStoreManagerStaffHandler);
router.patch("/staff/:id/terminate", roleGuard(["store_manager"]), terminateStoreManagerStaffHandler);
router.post("/staff/requests/hire", roleGuard(["store_manager"]), submitHireStaffRequestHandler);
router.patch("/staff/:id/requests/fire", roleGuard(["store_manager"]), submitFireStaffRequestHandler);
router.post("/staff/:id/requests/update", roleGuard(["store_manager"]), submitStaffUpdateRequestHandler);
router.patch("/staff/:id/avatar", roleGuard(["store_manager"]), updateStoreManagerStaffAvatarHandler);

export default router;

