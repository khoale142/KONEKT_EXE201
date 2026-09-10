import { Router } from 'express';
import { authGuard } from '../../middlewares/authGuard';
import { portalGuard } from '../../middlewares/portalGuard';
import { roleGuard } from '../../middlewares/roleGuard';
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  listProductsHandler,
  getProductDetailHandler,
  createProductHandler,
  updateProductHandler,
  toggleProductStatusHandler,
  deleteProductHandler,
  listIngredientsHandler,
  createIngredientHandler,
  updateIngredientHandler,
  deleteIngredientHandler,
  saveProductRecipesHandler,
  getSemiFinishedRecipeHandler,
  saveSemiFinishedRecipeHandler,
} from './ownerMenu.controller';

const router = Router();

router.use(
  authGuard,
  portalGuard(['OFFICE', 'POS']),
  roleGuard(['owner', 'store_manager', 'admin', 'platform_admin'])
);

// Categories (Hierarchical & Scoped: product, raw_material, semi_finished)
router.get('/categories', listCategoriesHandler);
router.post('/categories', createCategoryHandler);
router.put('/categories/:id', updateCategoryHandler);
router.delete('/categories/:id', deleteCategoryHandler);

// Products & Variants & Integrated BOM
router.get('/products', listProductsHandler);
router.get('/products/:id', getProductDetailHandler);
router.post('/products', createProductHandler);
router.put('/products/:id', updateProductHandler);
router.patch('/products/:id/toggle-status', toggleProductStatusHandler);
router.delete('/products/:id', deleteProductHandler);
router.put('/products/:id/recipes', saveProductRecipesHandler);

// Ingredients (Raw Materials & Semi-Finished)
router.get('/ingredients', listIngredientsHandler);
router.post('/ingredients', createIngredientHandler);
router.put('/ingredients/:id', updateIngredientHandler);
router.delete('/ingredients/:id', deleteIngredientHandler);

// Semi-Finished Sub-BOM Recipes
router.get('/ingredients/:id/recipe', getSemiFinishedRecipeHandler);
router.put('/ingredients/:id/recipe', saveSemiFinishedRecipeHandler);

export default router;
