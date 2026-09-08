import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  getMarketingMenuProductDetail,
  listMarketingMenuCategories,
  listMarketingMenuProducts,
  toggleMarketingMenuProductActive,
  toggleMarketingMenuVariantActive,
  updateMarketingMenuProduct,
  updateMarketingMenuVariant,
} from "./marketingMenu.service";

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export const getMarketingMenuCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listMarketingMenuCategories();
  res.json({ data });
});

export const getMarketingMenuProducts = asyncHandler(async (req: Request, res: Response) => {
  const categoryId =
    req.query.categoryId != null && String(req.query.categoryId).trim() !== ""
      ? Number(req.query.categoryId)
      : undefined;

  const limit =
    req.query.limit != null && String(req.query.limit).trim() !== ""
      ? Number(req.query.limit)
      : undefined;

  const offset =
    req.query.offset != null && String(req.query.offset).trim() !== ""
      ? Number(req.query.offset)
      : undefined;

  const data = await listMarketingMenuProducts({
    keyword: req.query.keyword ? String(req.query.keyword) : undefined,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    isActive: parseOptionalBoolean(req.query.isActive),
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });

  res.json({ data });
});

export const getMarketingMenuProductById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await getMarketingMenuProductDetail(id);
  res.json({ data });
});

export const patchMarketingMenuProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await updateMarketingMenuProduct(id, {
    categoryId:
      req.body.categoryId === null || req.body.category_id === null
        ? null
        : req.body.categoryId != null
          ? Number(req.body.categoryId)
          : req.body.category_id != null
            ? Number(req.body.category_id)
            : undefined,
    name: req.body.name,
    imageUrl: req.body.imageUrl ?? req.body.image_url,
    isActive:
      typeof req.body.isActive === "boolean"
        ? req.body.isActive
        : typeof req.body.is_active === "boolean"
          ? req.body.is_active
          : undefined,
  });

  res.json({ data });
});

export const patchMarketingMenuProductToggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isActive =
    req.body.isActive === true ||
    req.body.isActive === "true" ||
    req.body.is_active === true ||
    req.body.is_active === "true";

  const data = await toggleMarketingMenuProductActive(id, isActive);
  res.json({ data });
});

export const patchMarketingMenuVariant = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await updateMarketingMenuVariant(id, {
    size: req.body.size,
    price: req.body.price != null ? Number(req.body.price) : undefined,
    isActive:
      typeof req.body.isActive === "boolean"
        ? req.body.isActive
        : typeof req.body.is_active === "boolean"
          ? req.body.is_active
          : undefined,
  });

  res.json({ data });
});

export const patchMarketingMenuVariantToggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isActive =
    req.body.isActive === true ||
    req.body.isActive === "true" ||
    req.body.is_active === true ||
    req.body.is_active === "true";

  const data = await toggleMarketingMenuVariantActive(id, isActive);
  res.json({ data });
});
