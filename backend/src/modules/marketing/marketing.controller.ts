import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listOffers,
  listPublicHomeOffers,
  createPromotionCampaign,
  createVoucherRewardDef,
  switchStampRewardByCode,
  toggleCampaign,
  toggleReward,
  deleteCampaign,
  deleteReward,
} from "./marketing.service";

function getActorUserId(req: Request): number | null {
  return req.user?.sub ? Number(req.user.sub) : null;
}

export const getOffers = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listOffers();
  res.json({ data });
});

export const getPublicHomeOffers = asyncHandler(async (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit || 6);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 6;
  const data = await listPublicHomeOffers(limit);
  res.json({ data });
});

export const addPromotionCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createPromotionCampaign({
      ...req.body,
      createdBy: getActorUserId(req),
    });
    res.status(201).json({ data });
  },
);

export const addVoucherRewardDef = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createVoucherRewardDef({
      ...req.body,
      createdBy: getActorUserId(req),
    });
    res.status(201).json({ data });
  },
);

export const patchToggleCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const isActive =
      req.body.is_active === true ||
      req.body.is_active === "true" ||
      req.body.isActive === true ||
      req.body.isActive === "true";
    const data = await toggleCampaign(id, isActive, getActorUserId(req));
    res.json({ data });
  },
);

export const patchToggleReward = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const isActive =
      req.body.is_active === true ||
      req.body.is_active === "true" ||
      req.body.isActive === true ||
      req.body.isActive === "true";
    const data = await toggleReward(id, isActive, getActorUserId(req));
    res.json({ data });
  },
);

export const putStampRewardCode = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await switchStampRewardByCode({
      code: req.body.code,
      updatedBy: getActorUserId(req),
    });
    res.json({ data });
  },
);

export const removeCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const data = await deleteCampaign(id);
    res.json({ data });
  },
);

export const removeReward = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const data = await deleteReward(id);
    res.json({ data });
  },
);