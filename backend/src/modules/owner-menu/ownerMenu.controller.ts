import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/apiError';
import * as ownerMenuService from './ownerMenu.service';

function getTenantId(req: Request): number {
  const user = (req as any).user;
  const tenantId = user?.tenantId;
  if (!tenantId) {
    throw new ApiError(400, 'Vui lòng chọn không gian thương hiệu để thao tác thực đơn');
  }
  return Number(tenantId);
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export const listCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const scope = req.query.scope ? (String(req.query.scope) as any) : undefined;
  const data = await ownerMenuService.listCategories(tenantId, { scope });
  res.json({ success: true, data });
});

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { name, description, sortOrder, parentId, scope } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Tên danh mục không được để trống');
  }
  const data = await ownerMenuService.createCategory(tenantId, {
    name,
    description,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
    parentId: parentId ? Number(parentId) : null,
    scope,
  });
  res.status(201).json({ success: true, data });
});

export const updateCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const categoryId = Number(req.params.id);
  const { name, description, sortOrder, isActive, parentId, scope } = req.body;
  const data = await ownerMenuService.updateCategory(tenantId, categoryId, {
    name,
    description,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
    isActive,
    parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : undefined,
    scope,
  });
  res.json({ success: true, data });
});

export const deleteCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const categoryId = Number(req.params.id);
  await ownerMenuService.deleteCategory(tenantId, categoryId);
  res.json({ success: true, message: 'Đã xóa danh mục thành công' });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

export const listProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const isAvailable = req.query.isAvailable !== undefined ? req.query.isAvailable === 'true' : undefined;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;

  const data = await ownerMenuService.listProducts(tenantId, { categoryId, isAvailable, keyword });
  res.json({ success: true, data });
});

export const getProductDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const productId = Number(req.params.id);
  const data = await ownerMenuService.getProductDetail(tenantId, productId);
  res.json({ success: true, data });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { name, categoryId, description, basePrice, imageUrl, isAvailable, variants, recipes } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Tên món không được để trống');
  }
  if (basePrice === undefined || Number(basePrice) < 0) {
    throw new ApiError(400, 'Giá bán không hợp lệ');
  }

  const data = await ownerMenuService.createProduct(tenantId, {
    name,
    categoryId: categoryId ? Number(categoryId) : null,
    description,
    basePrice: Number(basePrice),
    imageUrl,
    isAvailable,
    variants,
    recipes,
  });
  res.status(201).json({ success: true, data });
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const productId = Number(req.params.id);
  const data = await ownerMenuService.updateProduct(tenantId, productId, req.body);
  res.json({ success: true, data });
});

export const toggleProductStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const productId = Number(req.params.id);
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') {
    throw new ApiError(400, 'Trạng thái isAvailable phải là boolean');
  }
  const data = await ownerMenuService.toggleProductStatus(tenantId, productId, isAvailable);
  res.json({ success: true, data });
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const productId = Number(req.params.id);
  await ownerMenuService.deleteProduct(tenantId, productId);
  res.json({ success: true, message: 'Đã xóa món ăn thành công' });
});

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENTS (Raw & Semi-Finished)
// ─────────────────────────────────────────────────────────────────────────────

export const listIngredientsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const itemType = req.query.itemType ? (String(req.query.itemType) as any) : undefined;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;

  const data = await ownerMenuService.listIngredients(tenantId, { itemType, categoryId, keyword });
  res.json({ success: true, data });
});

export const createIngredientHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { name, code, unit, costPerUnit, categoryId, itemType, batchYield, currentStock, minThreshold } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Tên nguyên vật liệu không được để trống');
  }
  if (!unit || !unit.trim()) {
    throw new ApiError(400, 'Đơn vị tính không được để trống');
  }
  const data = await ownerMenuService.createIngredient(tenantId, {
    name,
    code,
    unit,
    costPerUnit: Number(costPerUnit || 0),
    categoryId: categoryId ? Number(categoryId) : null,
    itemType: itemType || 'raw',
    batchYield: batchYield ? Number(batchYield) : 1,
    currentStock: Number(currentStock || 0),
    minThreshold: Number(minThreshold || 0),
  });
  res.status(201).json({ success: true, data });
});

export const updateIngredientHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const ingredientId = Number(req.params.id);
  const data = await ownerMenuService.updateIngredient(tenantId, ingredientId, req.body);
  res.json({ success: true, data });
});

export const deleteIngredientHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const ingredientId = Number(req.params.id);
  await ownerMenuService.deleteIngredient(tenantId, ingredientId);
  res.json({ success: true, message: 'Đã xóa nguyên vật liệu thành công' });
});

export const saveProductRecipesHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const productId = Number(req.params.id);
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) {
    throw new ApiError(400, 'Danh sách công thức không hợp lệ');
  }
  const data = await ownerMenuService.saveProductRecipes(tenantId, productId, recipes);
  res.json({ success: true, data });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEMI-FINISHED SUB-BOM
// ─────────────────────────────────────────────────────────────────────────────

export const getSemiFinishedRecipeHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const semiFinishedId = Number(req.params.id);
  const data = await ownerMenuService.getSemiFinishedRecipe(tenantId, semiFinishedId);
  res.json({ success: true, data });
});

export const saveSemiFinishedRecipeHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const semiFinishedId = Number(req.params.id);
  const { batchYield, items } = req.body;
  if (!Array.isArray(items)) {
    throw new ApiError(400, 'Danh sách nguyên liệu thành phần không hợp lệ');
  }
  const data = await ownerMenuService.saveSemiFinishedRecipe(tenantId, semiFinishedId, {
    batchYield: Number(batchYield || 1),
    items,
  });
  res.json({ success: true, data });
});
