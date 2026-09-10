import api from "../../../lib/http/axios";

export interface CategoryItem {
  id: number;
  parentId?: number | null;
  parentName?: string | null;
  scope?: "product" | "raw_material" | "semi_finished";
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  subCategories?: CategoryItem[];
}

export interface VariantItem {
  id?: number;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  sortOrder?: number;
}

export interface RecipeItem {
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
  quantities: { [variantId: number]: number };
  costs: { [variantId: number]: number };
}

export interface ProductItem {
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
  variants: VariantItem[];
  recipeItemCount: number;
  estimatedCostPrice: number;
  marginPercent: number;
  recipes?: RecipeItem[];
  recipeMatrix?: {
    variants: VariantRecipeSummary[];
    rows: RecipeMatrixRow[];
  };
}

export interface IngredientItem {
  id: number;
  categoryId?: number | null;
  categoryName?: string | null;
  itemType: "raw" | "semi_finished";
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

export interface SemiFinishedRecipeItem {
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
  items: SemiFinishedRecipeItem[];
}

export const ownerMenuApi = {
  // Categories (Scoped & Hierarchical)
  async listCategories(params?: { scope?: string }): Promise<CategoryItem[]> {
    const res = await api.get("/owner/menu/categories", { params });
    return res.data.data;
  },

  async createCategory(data: {
    name: string;
    description?: string;
    sortOrder?: number;
    parentId?: number | null;
    scope?: string;
  }): Promise<CategoryItem> {
    const res = await api.post("/owner/menu/categories", data);
    return res.data.data;
  },

  async updateCategory(
    id: number,
    data: {
      name?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      parentId?: number | null;
      scope?: string;
    }
  ): Promise<CategoryItem> {
    const res = await api.put(`/owner/menu/categories/${id}`, data);
    return res.data.data;
  },

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/owner/menu/categories/${id}`);
  },

  // Products
  async listProducts(params?: {
    categoryId?: number;
    isAvailable?: boolean;
    keyword?: string;
  }): Promise<ProductItem[]> {
    const res = await api.get("/owner/menu/products", { params });
    return res.data.data;
  },

  async getProductDetail(id: number): Promise<ProductItem> {
    const res = await api.get(`/owner/menu/products/${id}`);
    return res.data.data;
  },

  async createProduct(data: {
    name: string;
    categoryId?: number | null;
    description?: string;
    basePrice: number;
    imageUrl?: string;
    isAvailable?: boolean;
    variants?: Array<{ name: string; priceAdjustment: number; isAvailable?: boolean }>;
    recipes?: Array<{
      variantId?: number | null;
      ingredientId: number;
      quantity: number;
      unit: string;
      wasteRatePercent?: number;
    }>;
  }): Promise<ProductItem> {
    const res = await api.post("/owner/menu/products", data);
    return res.data.data;
  },

  async updateProduct(
    id: number,
    data: {
      name?: string;
      categoryId?: number | null;
      description?: string;
      basePrice?: number;
      imageUrl?: string;
      isAvailable?: boolean;
      variants?: Array<{ id?: number; name: string; priceAdjustment: number; isAvailable?: boolean }>;
    }
  ): Promise<ProductItem> {
    const res = await api.put(`/owner/menu/products/${id}`, data);
    return res.data.data;
  },

  async toggleProductStatus(id: number, isAvailable: boolean): Promise<{ id: number; isAvailable: boolean }> {
    const res = await api.patch(`/owner/menu/products/${id}/toggle-status`, { isAvailable });
    return res.data.data;
  },

  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/owner/menu/products/${id}`);
  },

  // Ingredients (Raw & Semi-Finished)
  async listIngredients(params?: {
    itemType?: "raw" | "semi_finished";
    categoryId?: number;
    keyword?: string;
  }): Promise<IngredientItem[]> {
    const res = await api.get("/owner/menu/ingredients", { params });
    return res.data.data;
  },

  async createIngredient(data: {
    name: string;
    code?: string | null;
    unit: string;
    costPerUnit?: number;
    categoryId?: number | null;
    itemType?: "raw" | "semi_finished";
    batchYield?: number;
    currentStock?: number;
    minThreshold?: number;
  }): Promise<IngredientItem> {
    const res = await api.post("/owner/menu/ingredients", data);
    return res.data.data;
  },

  async updateIngredient(
    id: number,
    data: {
      name?: string;
      code?: string | null;
      unit?: string;
      costPerUnit?: number;
      categoryId?: number | null;
      itemType?: "raw" | "semi_finished";
      batchYield?: number;
      currentStock?: number;
      minThreshold?: number;
      isActive?: boolean;
    }
  ): Promise<IngredientItem> {
    const res = await api.put(`/owner/menu/ingredients/${id}`, data);
    return res.data.data;
  },

  async deleteIngredient(id: number): Promise<void> {
    await api.delete(`/owner/menu/ingredients/${id}`);
  },

  async saveProductRecipes(
    productId: number,
    recipes: Array<{
      variantId?: number | null;
      ingredientId: number;
      quantity: number;
      unit: string;
      wasteRatePercent?: number;
    }>
  ): Promise<ProductItem> {
    const res = await api.put(`/owner/menu/products/${productId}/recipes`, { recipes });
    return res.data.data;
  },

  // Semi-Finished Sub-BOM
  async getSemiFinishedRecipe(id: number): Promise<SemiFinishedRecipeDto> {
    const res = await api.get(`/owner/menu/ingredients/${id}/recipe`);
    return res.data.data;
  },

  async saveSemiFinishedRecipe(
    id: number,
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
    const res = await api.put(`/owner/menu/ingredients/${id}/recipe`, data);
    return res.data.data;
  },
};
