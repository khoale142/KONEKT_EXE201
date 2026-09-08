import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import {
  listOpsNotificationsQuerySchema,
  opsNotificationIdParamSchema,
} from "./opsNotifications.schema";
import {
  getMyOpsUnreadCount,
  listMyOpsNotifications,
  markAllMyOpsNotificationsAsRead,
  markMyOpsNotificationAsRead,
} from "./opsNotifications.service";

function getActorId(req: Request): number {
  const u = req.user;
  if (!u?.sub) throw new ApiError(401, "Unauthorized");
  const userId = Number(u.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ApiError(401, "Unauthorized");
  }
  return userId;
}

export const getMyOpsNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getActorId(req);
    const query = listOpsNotificationsQuerySchema.parse(req.query);
    const result = await listMyOpsNotifications(userId, {
      page: query.page,
      limit: query.limit,
    });
    res.json(result);
  },
);

export const getMyOpsUnreadNotificationCount = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getActorId(req);
    const result = await getMyOpsUnreadCount(userId);
    res.json(result);
  },
);

export const markMyOpsNotificationRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getActorId(req);
    const params = opsNotificationIdParamSchema.parse(req.params);
    const result = await markMyOpsNotificationAsRead(userId, params.id);
    res.json(result);
  },
);

export const markAllMyOpsNotificationsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getActorId(req);
    const result = await markAllMyOpsNotificationsAsRead(userId);
    res.json(result);
  },
);
