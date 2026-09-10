export interface CategoryDto {
  id: number;
  parentId?: number | null;
  parentName?: string | null;
  scope: 'product' | 'raw_material' | 'semi_finished';
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  subCategories?: CategoryDto[];
}

export interface VariantDto {
  id?: number;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  sortOrder?: number;
}

export interface RecipeItemDto {
  id?: number;
  variantId?: number | null;
  variantName?: string | null;
  ingredientId: number;
  ingredientName?: string;
  ingredientCode?: string;
  quantity: number;
  unit: string;
  costPerUnit?: number;
  totalCost?: number;
  wasteRatePercent?: number;
}

export interface ProductListItemDto {
  id: number;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryParentId?: number | null;
  categoryParentName?: string | null;
  name: string;
  description?: string | null;
  basePrice: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  variantCount: number;
  variants: VariantDto[];
  recipeItemCount: number;
  estimatedCostPrice: number;
  marginPercent: number;
  recipes?: RecipeItemDto[];
}

export interface VariantRecipeSummary {
  variantId: number;
  variantName: string;
  priceAdjustment: number;
  finalPrice: number;
  estimatedCostPrice: number;
  marginPercent: number;
}

export interface RecipeMatrixRow {
  ingredientId: number;
  ingredientName: string;
  ingredientCode?: string;
  unit: string;
  costPerUnit: number;
  wasteRatePercent: number;
  // Map of variantId -> quantity
  quantities: { [variantId: number]: number };
  // Map of variantId -> cost
  costs: { [variantId: number]: number };
}

export interface ProductDetailDto extends ProductListItemDto {
  recipes: RecipeItemDto[];
  recipeMatrix?: {
    variants: VariantRecipeSummary[];
    rows: RecipeMatrixRow[];
  };
}

export interface CreateProductInput {
  name: string;
  categoryId?: number | null;
  description?: string | null;
  basePrice: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  variants?: Array<{
    name: string;
    priceAdjustment: number;
    isAvailable?: boolean;
  }>;
  recipes?: Array<{
    variantId?: number | null;
    ingredientId: number;
    quantity: number;
    unit: string;
    wasteRatePercent?: number;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: number | null;
  description?: string | null;
  basePrice?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  variants?: Array<{
    id?: number;
    name: string;
    priceAdjustment: number;
    isAvailable?: boolean;
  }>;
}

export interface IngredientDto {
  id: number;
  categoryId?: number | null;
  categoryName?: string | null;
  itemType: 'raw' | 'semi_finished';
  name: string;
  code?: string | null;
  unit: string;
  costPerUnit: number;
  batchYield: number;
  currentStock: number;
  minThreshold: number;
  isActive: boolean;
  hasRecipe?: boolean;
  recipeItemCount?: number;
}

export interface SemiFinishedRecipeItemDto {
  id?: number;
  ingredientId: number;
  ingredientName: string;
  ingredientCode?: string;
  unit: string;
  costPerUnit: number;
  quantity: number;
  wasteRatePercent: number;
  totalCost: number;
}

export interface SemiFinishedRecipeDto {
  semiFinishedId: number;
  semiFinishedName: string;
  semiFinishedCode?: string;
  unit: string;
  batchYield: number;
  totalBatchCost: number;
  costPerUnit: number;
  items: SemiFinishedRecipeItemDto[];
}
