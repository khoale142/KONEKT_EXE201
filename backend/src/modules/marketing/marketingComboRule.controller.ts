import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createMarketingComboRule,
  getMarketingComboRuleDetail,
  listMarketingComboRuleCategories,
  listMarketingComboRuleProducts,
  listMarketingComboRuleVariants,
  listMarketingComboRules,
  replaceMarketingComboRuleGroups,
  toggleMarketingComboRuleActive,
  updateMarketingComboRule,
} from "./marketingComboRule.service";

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export const getMarketingComboRuleCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listMarketingComboRuleCategories();
  res.json({ data });
});

export const getMarketingComboRuleProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit =
    req.query.limit != null && String(req.query.limit).trim() !== ""
      ? Number(req.query.limit)
      : undefined;

  const data = await listMarketingComboRuleProducts({
    keyword: req.query.keyword ? String(req.query.keyword) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  res.json({ data });
});

export const getMarketingComboRuleVariants = asyncHandler(async (req: Request, res: Response) => {
  const limit =
    req.query.limit != null && String(req.query.limit).trim() !== ""
      ? Number(req.query.limit)
      : undefined;

  const data = await listMarketingComboRuleVariants({
    keyword: req.query.keyword ? String(req.query.keyword) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  res.json({ data });
});

export const getMarketingComboRules = asyncHandler(async (req: Request, res: Response) => {
  const limit =
    req.query.limit != null && String(req.query.limit).trim() !== ""
      ? Number(req.query.limit)
      : undefined;

  const offset =
    req.query.offset != null && String(req.query.offset).trim() !== ""
      ? Number(req.query.offset)
      : undefined;

  const data = await listMarketingComboRules({
    keyword: req.query.keyword ? String(req.query.keyword) : undefined,
    isActive: parseOptionalBoolean(req.query.isActive),
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });

  res.json({ data });
});

export const getMarketingComboRuleById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await getMarketingComboRuleDetail(id);
  res.json({ data });
});

export const postMarketingComboRule = asyncHandler(async (req: Request, res: Response) => {
  const data = await createMarketingComboRule({
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    comboPrice:
      req.body.comboPrice != null
        ? Number(req.body.comboPrice)
        : req.body.combo_price != null
          ? Number(req.body.combo_price)
          : 0,
    isActive:
      typeof req.body.isActive === "boolean"
        ? req.body.isActive
        : typeof req.body.is_active === "boolean"
          ? req.body.is_active
          : true,
    priority:
      req.body.priority != null
        ? Number(req.body.priority)
        : 0,
    autoApply:
      typeof req.body.autoApply === "boolean"
        ? req.body.autoApply
        : typeof req.body.auto_apply === "boolean"
          ? req.body.auto_apply
          : false,
    groups: Array.isArray(req.body?.groups) ? req.body.groups : [],
  });

  res.status(201).json({ data });
});

export const patchMarketingComboRule = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const data = await updateMarketingComboRule(id, {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    comboPrice:
      req.body.comboPrice != null
        ? Number(req.body.comboPrice)
        : req.body.combo_price != null
          ? Number(req.body.combo_price)
          : undefined,
    isActive:
      typeof req.body.isActive === "boolean"
        ? req.body.isActive
        : typeof req.body.is_active === "boolean"
          ? req.body.is_active
          : undefined,
    priority:
      req.body.priority != null
        ? Number(req.body.priority)
        : undefined,
    autoApply:
      typeof req.body.autoApply === "boolean"
        ? req.body.autoApply
        : typeof req.body.auto_apply === "boolean"
          ? req.body.auto_apply
          : undefined,
  });

  res.json({ data });
});

export const patchMarketingComboRuleToggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isActive =
    req.body.isActive === true ||
    req.body.isActive === "true" ||
    req.body.is_active === true ||
    req.body.is_active === "true";

  const data = await toggleMarketingComboRuleActive(id, isActive);
  res.json({ data });
});

export const putMarketingComboRuleGroups = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];

  const data = await replaceMarketingComboRuleGroups(
    id,
    groups.map((group: any) => ({
      groupNo: Number(group.groupNo),
      groupName: group.groupName,
      quantityRequired: 1,
      matchType: String(group.matchType || "").trim().toLowerCase(),
      categoryId:
        group.categoryId != null && String(group.categoryId).trim() !== ""
          ? Number(group.categoryId)
          : null,
      productId:
        group.productId != null && String(group.productId).trim() !== ""
          ? Number(group.productId)
          : null,
      productVariantId:
        group.productVariantId != null && String(group.productVariantId).trim() !== ""
          ? Number(group.productVariantId)
          : null,
      requiredSize: group.requiredSize,
    })),
  );

  res.json({ data });
});
