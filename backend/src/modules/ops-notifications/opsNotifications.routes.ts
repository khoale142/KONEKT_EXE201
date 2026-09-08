import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  getMyOpsNotifications,
  getMyOpsUnreadNotificationCount,
  markAllMyOpsNotificationsRead,
  markMyOpsNotificationRead,
} from "./opsNotifications.controller";

const router = Router();

router.use(authGuard, portalGuard(["STORE", "OFFICE"]));

router.get("/", getMyOpsNotifications);
router.get("/unread-count", getMyOpsUnreadNotificationCount);
router.patch("/:id/read", markMyOpsNotificationRead);
router.patch("/read-all", markAllMyOpsNotificationsRead);

export default router;
