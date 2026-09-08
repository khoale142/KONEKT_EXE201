import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getCheckinStatus, postDailyCheckin } from "./rewards.service";
import { notifyDailyCheckin } from "../notifications/notifications.service";

export const getMeCheckin = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const status = await getCheckinStatus(customerId);
  res.json({ ok: true, checkin: status });
});

export const postMeCheckin = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const result = await postDailyCheckin(customerId);

  await notifyDailyCheckin({
    userId: customerId,
    pointsAwarded: result.pointsAwarded,
    streak: result.streak,
  }).catch((err: unknown) => console.error("[rewards] notifyDailyCheckin", err));

  res.json(result);
});
