import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listMyVouchers,
  listPublicPromotions,
  listPublicVoucherRewardDefs,
  redeemVoucherReward,
} from "./promotions.service";
import {
  getStampHistoryForCustomer,
  getStampProgressForCustomer,
} from "../stamps/stamps.service";

const redeemVoucherSchema = z.object({
  rewardDefId: z.number().int().positive(),
});

export const getPublicPromotions = asyncHandler(async (_req: Request, res: Response) => {
  const result = await listPublicPromotions();
  res.json(result);
});

export const getPublicVoucherRewards = asyncHandler(async (_req: Request, res: Response) => {
  const result = await listPublicVoucherRewardDefs();
  res.json(result);
});

export const postRedeemVoucher = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const body = redeemVoucherSchema.parse(req.body);

  const result = await redeemVoucherReward({
    customerId,
    rewardDefId: body.rewardDefId,
  });

  res.json(result);
});

export const getMyVouchers = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const result = await listMyVouchers(customerId);
  res.json(result);
});

export const getMyStamps = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const stamps = await getStampProgressForCustomer(customerId);
  res.json({ ok: true, stamps });
});

export const getMyStampHistory = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const qLimit = Number(req.query.limit || 20);
  const items = await getStampHistoryForCustomer(customerId, qLimit);
  res.json({ ok: true, items });
});
