import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from "./notifications.schema";
import {
  getUnreadCount,
  listMyNotifications,
  markAllMyNotificationsAsRead,
  markMyNotificationAsRead,
} from "./notifications.service";

function getCustomerId(req: Request): number {
  const u = req.user;
  if (!u?.sub) throw new ApiError(401, "Unauthorized");
  if (u.portal !== "CUSTOMER") throw new ApiError(403, "Forbidden (CUSTOMER only)");
  return Number(u.sub);
}

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = getCustomerId(req);
  const query = listNotificationsQuerySchema.parse(req.query);
  const result = await listMyNotifications(userId, {
    page: query.page,
    limit: query.limit,
  });
  res.json(result);
});

export const getMyUnreadNotificationCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = getCustomerId(req);
  const result = await getUnreadCount(userId);
  res.json(result);
});

export const markMyNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = getCustomerId(req);
  const params = notificationIdParamSchema.parse(req.params);
  const result = await markMyNotificationAsRead(userId, params.id);
  res.json(result);
});

export const markAllMyNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = getCustomerId(req);
  const result = await markAllMyNotificationsAsRead(userId);
  res.json(result);
});