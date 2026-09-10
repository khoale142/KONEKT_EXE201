import { db } from '../../db';
import {
  productCategories,
  products,
  productVariants,
  ingredients,
  productRecipes,
  semiFinishedRecipes,
} from '../../db/schema';
import { eq, and, desc, asc, ilike, sql } from 'drizzle-orm';
import { ApiError } from '../../utils/apiError';
import {
  CategoryDto,
  ProductListItemDto,
  ProductDetailDto,
  CreateProductInput,
  UpdateProductInput,
  IngredientDto,
  RecipeItemDto,
  RecipeMatrixRow,
  VariantRecipeSummary,
  SemiFinishedRecipeDto,
  SemiFinishedRecipeItemDto,
} from './ownerMenu.types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CATEGORIES (Hierarchical & Scoped)
// ─────────────────────────────────────────────────────────────────────────────

export async function listCategories(
  tenantId: number,
  query?: { scope?: 'product' | 'raw_material' | 'semi_finished' }
): Promise<CategoryDto[]> {
  const conditions = [eq(productCategories.tenantId, tenantId)];
  if (query?.scope) {
    conditions.push(eq(productCategories.scope, query.scope));
  }

  const cats = await db.query.productCategories.findMany({
    where: and(...conditions),
    orderBy: [asc(productCategories.sortOrder), asc(productCategories.id)],
    with: {
      parent: true,
      children: {
        orderBy: [asc(productCategories.sortOrder), asc(productCategories.id)],
      },
      products: {
        columns: { id: true },
      },
    },
  });

  return cats.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    parentName: c.parent?.name || null,
    scope: (c.scope as any) || 'product',
    name: c.name,
    description: c.description,
    sortOrder: c.sortOrder ?? 0,
    isActive: c.isActive,
    productCount: c.products?.length ?? 0,
    subCategories: (c.children || []).map((child) => ({
      id: child.id,
      parentId: child.parentId,
      parentName: c.name,
      scope: (child.scope as any) || 'product',
      name: child.name,
      description: child.description,
      sortOrder: child.sortOrder ?? 0,
      isActive: child.isActive,
    })),
  }));
}

export async function createCategory(
  tenantId: number,
  data: {
    name: string;
    description?: string | null;
    sortOrder?: number;
    parentId?: number | null;
    scope?: 'product' | 'raw_material' | 'semi_finished';
  }
): Promise<CategoryDto> {
  const [created] = await db
    .insert(productCategories)
    .values({
      tenantId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
      parentId: data.parentId || null,
      scope: data.scope || 'product',
      isActive: true,
    })
    .returning();

  return {
    id: created.id,
    parentId: created.parentId,
    scope: (created.scope as any) || 'product',
    name: created.name,
    description: created.description,
    sortOrder: created.sortOrder ?? 0,
    isActive: created.isActive,
    productCount: 0,
  };
}

export async function updateCategory(
  tenantId: number,
  categoryId: number,
  data: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    parentId?: number | null;
    scope?: 'product' | 'raw_material' | 'semi_finished';
  }
): Promise<CategoryDto> {
  const [existing] = await db
    .select()
    .from(productCategories)
    .where(and(eq(productCategories.id, categoryId), eq(productCategories.tenantId, tenantId)));

  if (!existing) {
    throw new ApiError(404, 'Danh mục không tồn tại');
  }

  const updateFields: Partial<typeof productCategories.$inferInsert> = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.description !== undefined) updateFields.description = data.description?.trim() || null;
  if (data.sortOrder !== undefined) updateFields.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;
  if (data.parentId !== undefined) updateFields.parentId = data.parentId || null;
  if (data.scope !== undefined) updateFields.scope = data.scope;

  const [updated] = await db
    .update(productCategories)
    .set(updateFields)
    .where(and(eq(productCategories.id, categoryId), eq(productCategories.tenantId, tenantId)))
    .returning();

  return {
    id: updated.id,
    parentId: updated.parentId,
    scope: (updated.scope as any) || 'product',
    name: updated.name,
    description: updated.description,
    sortOrder: updated.sortOrder ?? 0,
    isActive: updated.isActive,
  };
}

export async function deleteCategory(tenantId: number, categoryId: number): Promise<void> {
  const prods = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.tenantId, tenantId)))
    .limit(1);

  if (prods.length > 0) {
    throw new ApiError(400, 'Không thể xóa danh mục đang chứa món. Vui lòng chuyển các món sang danh mục khác trước.');
  }

  const ings = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.categoryId, categoryId), eq(ingredients.tenantId, tenantId)))
    .limit(1);

  if (ings.length > 0) {
    throw new ApiError(400, 'Không thể xóa danh mục đang chứa nguyên vật liệu.');
  }

  await db
    .delete(productCategories)
    .where(and(eq(productCategories.id, categoryId), eq(productCategories.tenantId, tenantId)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRODUCTS & RECIPES
// ─────────────────────────────────────────────────────────────────────────────

export async function listProducts(
  tenantId: number,
  query?: { categoryId?: number; isAvailable?: boolean; keyword?: string }
): Promise<ProductListItemDto[]> {
  const conditions = [eq(products.tenantId, tenantId)];

  if (query?.categoryId) {
    conditions.push(eq(products.categoryId, query.categoryId));
  }
  if (query?.isAvailable !== undefined) {
    conditions.push(eq(products.isAvailable, query.isAvailable));
  }
  if (query?.keyword && query.keyword.trim()) {
    conditions.push(ilike(products.name, `%${query.keyword.trim()}%`));
  }

  const prods = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: [asc(products.sortOrder), desc(products.id)],
    with: {
      category: {
        with: {
          parent: true,
        },
      },
      variants: {
        orderBy: [asc(productVariants.sortOrder), asc(productVariants.id)],
      },
      recipes: {
        with: {
          ingredient: true,
          variant: true,
        },
      },
    },
  });

  return prods.map((p) => {
    const recipes: RecipeItemDto[] = (p.recipes || []).map((r: any) => {
      const unitCost = Number(r.ingredient?.costPerUnit ?? 0);
      const qty = Number(r.quantity ?? 0);
      const waste = Number(r.wasteRatePercent ?? 0);
      const totalCost = Math.round(unitCost * qty * (1 + waste / 100));

      return {
        id: r.id,
        variantId: r.variantId,
        variantName: r.variant?.name || 'Tất cả size',
        ingredientId: r.ingredientId,
        ingredientName: r.ingredient?.name || '',
        ingredientCode: r.ingredient?.code || '',
        quantity: qty,
        unit: r.unit,
        costPerUnit: unitCost,
        totalCost,
        wasteRatePercent: waste,
      };
    });

    let estimatedCostPrice = 0;
    for (const r of recipes) {
      estimatedCostPrice += r.totalCost || 0;
    }
    estimatedCostPrice = Math.round(estimatedCostPrice);

    const basePrice = Number(p.basePrice ?? 0);
    const marginPercent = (basePrice > 0 && estimatedCostPrice > 0)
      ? Math.round(((basePrice - estimatedCostPrice) / basePrice) * 100)
      : 0;

    return {
      id: p.id,
      categoryId: p.categoryId,
      categoryName: p.category?.name || 'Khác',
      categoryParentId: p.category?.parentId || null,
      categoryParentName: (p.category as any)?.parent?.name || null,
      name: p.name,
      description: p.description,
      basePrice,
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
      sortOrder: p.sortOrder ?? 0,
      variantCount: p.variants?.length ?? 0,
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        name: v.name,
        priceAdjustment: Number(v.priceAdjustment ?? 0),
        isAvailable: v.isAvailable,
        sortOrder: v.sortOrder ?? 0,
      })),
      recipeItemCount: recipes.length,
      estimatedCostPrice,
      marginPercent,
      recipes,
    };
  });
}

export async function getProductDetail(tenantId: number, productId: number): Promise<ProductDetailDto> {
  const p = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    with: {
      category: {
        with: {
          parent: true,
        },
      },
      variants: {
        orderBy: [asc(productVariants.sortOrder), asc(productVariants.id)],
      },
      recipes: {
        with: {
          ingredient: true,
          variant: true,
        },
      },
    },
  });

  if (!p) {
    throw new ApiError(404, 'Món ăn không tồn tại trong thương hiệu');
  }

  const recipes: RecipeItemDto[] = ((p as any).recipes || []).map((r: any) => {
    const unitCost = Number(r.ingredient?.costPerUnit ?? 0);
    const qty = Number(r.quantity ?? 0);
    const waste = Number(r.wasteRatePercent ?? 0);
    const totalCost = Math.round(unitCost * qty * (1 + waste / 100));

    return {
      id: r.id,
      variantId: r.variantId,
      variantName: r.variant?.name || 'Tất cả size',
      ingredientId: r.ingredientId,
      ingredientName: r.ingredient?.name || '',
      ingredientCode: r.ingredient?.code || '',
      quantity: qty,
      unit: r.unit,
      costPerUnit: unitCost,
      totalCost,
      wasteRatePercent: waste,
    };
  });

  const estimatedCostPrice = recipes.reduce((sum: number, r: RecipeItemDto) => sum + (r.totalCost || 0), 0);
  const basePrice = Number(p.basePrice ?? 0);
  const marginPercent = (basePrice > 0 && estimatedCostPrice > 0)
    ? Math.round(((basePrice - estimatedCostPrice) / basePrice) * 100)
    : 0;

  return {
    id: p.id,
    categoryId: p.categoryId,
    categoryName: p.category?.name || 'Khác',
    categoryParentId: p.category?.parentId || null,
    categoryParentName: (p.category as any)?.parent?.name || null,
    name: p.name,
    description: p.description,
    basePrice,
    imageUrl: p.imageUrl,
    isAvailable: p.isAvailable,
    sortOrder: p.sortOrder ?? 0,
    variantCount: p.variants?.length ?? 0,
    variants: (p.variants || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      priceAdjustment: Number(v.priceAdjustment ?? 0),
      isAvailable: v.isAvailable,
      sortOrder: v.sortOrder ?? 0,
    })),
    recipeItemCount: recipes.length,
    estimatedCostPrice,
    marginPercent,
    recipes,
    recipeMatrix: (() => {
      const variantSummaries: VariantRecipeSummary[] = (p.variants || []).map((v: any) => {
        const adj = Number(v.priceAdjustment ?? 0);
        const finalPrice = basePrice + adj;
        return {
          variantId: v.id,
          variantName: v.name,
          priceAdjustment: adj,
          finalPrice,
          estimatedCostPrice: 0,
          marginPercent: 0,
        };
      });

      const matrixMap = new Map<number, RecipeMatrixRow>();
      for (const r of recipes) {
        if (!matrixMap.has(r.ingredientId)) {
          matrixMap.set(r.ingredientId, {
            ingredientId: r.ingredientId,
            ingredientName: r.ingredientName || '',
            ingredientCode: r.ingredientCode || '',
            unit: r.unit,
            costPerUnit: r.costPerUnit || 0,
            wasteRatePercent: r.wasteRatePercent || 0,
            quantities: {},
            costs: {},
          });
        }
        const row = matrixMap.get(r.ingredientId)!;
        if (r.variantId) {
          row.quantities[r.variantId] = r.quantity;
          row.costs[r.variantId] = r.totalCost || 0;
        } else {
          for (const v of p.variants || []) {
            row.quantities[v.id] = r.quantity;
            row.costs[v.id] = r.totalCost || 0;
          }
        }
      }

      for (const summary of variantSummaries) {
        let vCost = 0;
        for (const row of matrixMap.values()) {
          vCost += row.costs[summary.variantId] || 0;
        }
        summary.estimatedCostPrice = Math.round(vCost);
        summary.marginPercent = (summary.finalPrice > 0 && summary.estimatedCostPrice > 0)
          ? Math.round(((summary.finalPrice - summary.estimatedCostPrice) / summary.finalPrice) * 100)
          : 0;
      }

      return {
        variants: variantSummaries,
        rows: Array.from(matrixMap.values()),
      };
    })(),
  };
}

export async function createProduct(tenantId: number, data: CreateProductInput): Promise<ProductDetailDto> {
  const [created] = await db
    .insert(products)
    .values({
      tenantId,
      name: data.name.trim(),
      categoryId: data.categoryId || null,
      description: data.description?.trim() || null,
      basePrice: String(data.basePrice),
      imageUrl: data.imageUrl?.trim() || null,
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      sortOrder: 0,
    })
    .returning();

  if (data.variants && data.variants.length > 0) {
    await db.insert(productVariants).values(
      data.variants.map((v, idx) => ({
        productId: created.id,
        name: v.name.trim(),
        priceAdjustment: String(v.priceAdjustment || 0),
        isAvailable: v.isAvailable !== undefined ? v.isAvailable : true,
        sortOrder: idx,
      }))
    );
  } else {
    await db.insert(productVariants).values({
      productId: created.id,
      name: 'Tiêu chuẩn',
      priceAdjustment: '0',
      isAvailable: true,
      sortOrder: 0,
    });
  }

  if (data.recipes && data.recipes.length > 0) {
    await db.insert(productRecipes).values(
      data.recipes.map((r) => ({
        tenantId,
        productId: created.id,
        variantId: r.variantId || null,
        ingredientId: r.ingredientId,
        quantity: String(r.quantity),
        unit: r.unit.trim(),
        wasteRatePercent: String(r.wasteRatePercent || 0),
      }))
    );
  }

  return getProductDetail(tenantId, created.id);
}

export async function updateProduct(
  tenantId: number,
  productId: number,
  data: UpdateProductInput
): Promise<ProductDetailDto> {
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

  if (!existing) {
    throw new ApiError(404, 'Món ăn không tồn tại');
  }

  const updateFields: Partial<typeof products.$inferInsert> = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.categoryId !== undefined) updateFields.categoryId = data.categoryId;
  if (data.description !== undefined) updateFields.description = data.description?.trim() || null;
  if (data.basePrice !== undefined) updateFields.basePrice = String(data.basePrice);
  if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl?.trim() || null;
  if (data.isAvailable !== undefined) updateFields.isAvailable = data.isAvailable;
  updateFields.updatedAt = new Date();

  await db
    .update(products)
    .set(updateFields)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

  if (data.variants) {
    await db.delete(productVariants).where(eq(productVariants.productId, productId));
    if (data.variants.length > 0) {
      await db.insert(productVariants).values(
        data.variants.map((v, idx) => ({
          productId,
          name: v.name.trim(),
          priceAdjustment: String(v.priceAdjustment || 0),
          isAvailable: v.isAvailable !== undefined ? v.isAvailable : true,
          sortOrder: idx,
        }))
      );
    }
  }

  return getProductDetail(tenantId, productId);
}

export async function toggleProductStatus(
  tenantId: number,
  productId: number,
  isAvailable: boolean
): Promise<{ id: number; isAvailable: boolean }> {
  const [updated] = await db
    .update(products)
    .set({ isAvailable, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new ApiError(404, 'Món ăn không tồn tại');
  }

  return { id: updated.id, isAvailable: updated.isAvailable };
}

export async function deleteProduct(tenantId: number, productId: number): Promise<void> {
  await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INGREDIENTS (Raw & Semi-Finished)
// ─────────────────────────────────────────────────────────────────────────────

export async function listIngredients(
  tenantId: number,
  query?: { itemType?: 'raw' | 'semi_finished'; categoryId?: number; keyword?: string }
): Promise<IngredientDto[]> {
  const conditions = [eq(ingredients.tenantId, tenantId)];

  if (query?.itemType) {
    conditions.push(eq(ingredients.itemType, query.itemType));
  }
  if (query?.categoryId) {
    conditions.push(eq(ingredients.categoryId, query.categoryId));
  }
  if (query?.keyword && query.keyword.trim()) {
    conditions.push(ilike(ingredients.name, `%${query.keyword.trim()}%`));
  }

  const items = await db.query.ingredients.findMany({
    where: and(...conditions),
    orderBy: [desc(ingredients.id)],
    with: {
      category: true,
      subRecipes: true,
    },
  });

  return items.map((i) => ({
    id: i.id,
    categoryId: i.categoryId,
    categoryName: i.category?.name || null,
    itemType: (i.itemType as any) || 'raw',
    name: i.name,
    code: i.code,
    unit: i.unit,
    costPerUnit: Number(i.costPerUnit ?? 0),
    batchYield: Number(i.batchYield ?? 1),
    currentStock: Number(i.currentStock ?? 0),
    minThreshold: Number(i.minThreshold ?? 0),
    isActive: i.isActive,
    hasRecipe: (i.subRecipes?.length ?? 0) > 0,
    recipeItemCount: i.subRecipes?.length ?? 0,
  }));
}

export async function createIngredient(
  tenantId: number,
  data: {
    name: string;
    code?: string | null;
    unit: string;
    costPerUnit?: number;
    categoryId?: number | null;
    itemType?: 'raw' | 'semi_finished';
    batchYield?: number;
    currentStock?: number;
    minThreshold?: number;
  }
): Promise<IngredientDto> {
  const [created] = await db
    .insert(ingredients)
    .values({
      tenantId,
      categoryId: data.categoryId || null,
      itemType: data.itemType || 'raw',
      name: data.name.trim(),
      code: data.code?.trim() || null,
      unit: data.unit.trim(),
      costPerUnit: String(data.costPerUnit || 0),
      batchYield: String(data.batchYield && data.batchYield > 0 ? data.batchYield : 1),
      currentStock: String(data.currentStock || 0),
      minThreshold: String(data.minThreshold || 0),
      isActive: true,
    })
    .returning();

  return {
    id: created.id,
    categoryId: created.categoryId,
    itemType: (created.itemType as any) || 'raw',
    name: created.name,
    code: created.code,
    unit: created.unit,
    costPerUnit: Number(created.costPerUnit ?? 0),
    batchYield: Number(created.batchYield ?? 1),
    currentStock: Number(created.currentStock ?? 0),
    minThreshold: Number(created.minThreshold ?? 0),
    isActive: created.isActive,
  };
}

export async function updateIngredient(
  tenantId: number,
  ingredientId: number,
  data: {
    name?: string;
    code?: string | null;
    unit?: string;
    costPerUnit?: number;
    categoryId?: number | null;
    itemType?: 'raw' | 'semi_finished';
    batchYield?: number;
    currentStock?: number;
    minThreshold?: number;
    isActive?: boolean;
  }
): Promise<IngredientDto> {
  const updateFields: Partial<typeof ingredients.$inferInsert> = {};
  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.code !== undefined) updateFields.code = data.code?.trim() || null;
  if (data.unit !== undefined) updateFields.unit = data.unit.trim();
  if (data.costPerUnit !== undefined) updateFields.costPerUnit = String(data.costPerUnit);
  if (data.categoryId !== undefined) updateFields.categoryId = data.categoryId;
  if (data.itemType !== undefined) updateFields.itemType = data.itemType;
  if (data.batchYield !== undefined && data.batchYield > 0) updateFields.batchYield = String(data.batchYield);
  if (data.currentStock !== undefined) updateFields.currentStock = String(data.currentStock);
  if (data.minThreshold !== undefined) updateFields.minThreshold = String(data.minThreshold);
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;

  updateFields.updatedAt = new Date();

  const [updated] = await db
    .update(ingredients)
    .set(updateFields)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new ApiError(404, 'Nguyên vật liệu không tồn tại');
  }

  return {
    id: updated.id,
    categoryId: updated.categoryId,
    itemType: (updated.itemType as any) || 'raw',
    name: updated.name,
    code: updated.code,
    unit: updated.unit,
    costPerUnit: Number(updated.costPerUnit ?? 0),
    batchYield: Number(updated.batchYield ?? 1),
    currentStock: Number(updated.currentStock ?? 0),
    minThreshold: Number(updated.minThreshold ?? 0),
    isActive: updated.isActive,
  };
}

export async function deleteIngredient(tenantId: number, ingredientId: number): Promise<void> {
  // Kiểm tra xem NVL có đang nằm trong công thức món nào không
  const used = await db
    .select({ id: productRecipes.id })
    .from(productRecipes)
    .where(and(eq(productRecipes.ingredientId, ingredientId), eq(productRecipes.tenantId, tenantId)))
    .limit(1);

  if (used.length > 0) {
    throw new ApiError(400, 'Không thể xóa nguyên vật liệu đang được dùng trong công thức món');
  }

  // Kiểm tra xem NVL có nằm trong công thức BTP nào không
  const usedInSemi = await db
    .select({ id: semiFinishedRecipes.id })
    .from(semiFinishedRecipes)
    .where(and(eq(semiFinishedRecipes.ingredientId, ingredientId), eq(semiFinishedRecipes.tenantId, tenantId)))
    .limit(1);

  if (usedInSemi.length > 0) {
    throw new ApiError(400, 'Không thể xóa nguyên vật liệu đang được dùng trong công thức bán thành phẩm');
  }

  await db
    .delete(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.tenantId, tenantId)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRODUCT RECIPES (BOM)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveProductRecipes(
  tenantId: number,
  productId: number,
  recipeList: Array<{
    variantId?: number | null;
    ingredientId: number;
    quantity: number;
    unit: string;
    wasteRatePercent?: number;
  }>
): Promise<ProductDetailDto> {
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

  if (!existing) {
    throw new ApiError(404, 'Món ăn không tồn tại');
  }

  await db.delete(productRecipes).where(eq(productRecipes.productId, productId));

  if (recipeList.length > 0) {
    await db.insert(productRecipes).values(
      recipeList.map((r) => ({
        tenantId,
        productId,
        variantId: r.variantId || null,
        ingredientId: r.ingredientId,
        quantity: String(r.quantity),
        unit: r.unit.trim(),
        wasteRatePercent: String(r.wasteRatePercent || 0),
      }))
    );
  }

  return getProductDetail(tenantId, productId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SEMI-FINISHED RECIPES (Sub-BOM)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSemiFinishedRecipe(
  tenantId: number,
  semiFinishedId: number
): Promise<SemiFinishedRecipeDto> {
  const semi = await db.query.ingredients.findFirst({
    where: and(eq(ingredients.id, semiFinishedId), eq(ingredients.tenantId, tenantId)),
  });

  if (!semi) {
    throw new ApiError(404, 'Bán thành phẩm không tồn tại');
  }

  const subRecipes = await db.query.semiFinishedRecipes.findMany({
    where: and(
      eq(semiFinishedRecipes.semiFinishedId, semiFinishedId),
      eq(semiFinishedRecipes.tenantId, tenantId)
    ),
    with: {
      ingredient: true,
    },
  });

  let totalBatchCost = 0;
  const items: SemiFinishedRecipeItemDto[] = subRecipes.map((r) => {
    const unitCost = Number(r.ingredient?.costPerUnit ?? 0);
    const qty = Number(r.quantity ?? 0);
    const waste = Number(r.wasteRatePercent ?? 0);
    const total = Math.round(unitCost * qty * (1 + waste / 100));
    totalBatchCost += total;

    return {
      id: r.id,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredient?.name || '',
      ingredientCode: r.ingredient?.code || '',
      unit: r.unit,
      costPerUnit: unitCost,
      quantity: qty,
      wasteRatePercent: waste,
      totalCost: total,
    };
  });

  const batchYield = Number(semi.batchYield ?? 1) || 1;
  const costPerUnit = Math.round((totalBatchCost / batchYield) * 100) / 100;

  return {
    semiFinishedId: semi.id,
    semiFinishedName: semi.name,
    semiFinishedCode: semi.code || undefined,
    unit: semi.unit,
    batchYield,
    totalBatchCost,
    costPerUnit,
    items,
  };
}

export async function saveSemiFinishedRecipe(
  tenantId: number,
  semiFinishedId: number,
  data: {
    batchYield: number;
    items: Array<{
      ingredientId: number;
      quantity: number;
      unit: string;
      wasteRatePercent?: number;
    }>;
  }
): Promise<SemiFinishedRecipeDto> {
  const semi = await db.query.ingredients.findFirst({
    where: and(eq(ingredients.id, semiFinishedId), eq(ingredients.tenantId, tenantId)),
  });

  if (!semi) {
    throw new ApiError(404, 'Bán thành phẩm không tồn tại');
  }

  // Anti-recursion check
  for (const item of data.items) {
    if (item.ingredientId === semiFinishedId) {
      throw new ApiError(400, 'Bán thành phẩm không thể tự làm nguyên liệu cho chính nó');
    }
  }

  // Xóa công thức cũ
  await db
    .delete(semiFinishedRecipes)
    .where(and(eq(semiFinishedRecipes.semiFinishedId, semiFinishedId), eq(semiFinishedRecipes.tenantId, tenantId)));

  // Chèn công thức mới
  if (data.items.length > 0) {
    await db.insert(semiFinishedRecipes).values(
      data.items.map((i) => ({
        tenantId,
        semiFinishedId,
        ingredientId: i.ingredientId,
        quantity: String(i.quantity),
        unit: i.unit.trim(),
        wasteRatePercent: String(i.wasteRatePercent || 0),
      }))
    );
  }

  // Tính lại chi phí mẻ
  const recipe = await getSemiFinishedRecipe(tenantId, semiFinishedId);

  // Cập nhật batchYield và costPerUnit cho bán thành phẩm
  await db
    .update(ingredients)
    .set({
      batchYield: String(data.batchYield > 0 ? data.batchYield : 1),
      costPerUnit: String(recipe.costPerUnit),
      updatedAt: new Date(),
    })
    .where(and(eq(ingredients.id, semiFinishedId), eq(ingredients.tenantId, tenantId)));

  return recipe;
}
