import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "./notifications.controller";

const router = Router();

router.use(authGuard, portalGuard(["CUSTOMER"]));

router.get("/", getMyNotifications);
router.get("/unread-count", getMyUnreadNotificationCount);
router.patch("/:id/read", markMyNotificationRead);
router.patch("/read-all", markAllMyNotificationsRead);

export default router;