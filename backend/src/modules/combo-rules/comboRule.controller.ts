import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { previewEligibleComboRules } from "./comboRule.service";

export const previewCombos = asyncHandler(async (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const data = await previewEligibleComboRules({
    items: items.map((x: any) => ({
      productVariantId: Number(x.productVariantId),
      quantity: Number(x.quantity),
    })),
  });

  res.json(data);
});