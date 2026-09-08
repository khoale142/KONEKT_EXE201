import { Router } from "express";
import {
  getMarketingMenuCategories,
  getMarketingMenuProductById,
  getMarketingMenuProducts,
  patchMarketingMenuProduct,
  patchMarketingMenuProductToggleActive,
  patchMarketingMenuVariant,
  patchMarketingMenuVariantToggleActive,
} from "./marketingMenu.controller";

const router = Router();

router.get("/categories", getMarketingMenuCategories);
router.get("/products", getMarketingMenuProducts);
router.get("/products/:id", getMarketingMenuProductById);
router.patch("/products/:id", patchMarketingMenuProduct);
router.patch("/products/:id/toggle-active", patchMarketingMenuProductToggleActive);

router.patch("/variants/:id", patchMarketingMenuVariant);
router.patch("/variants/:id/toggle-active", patchMarketingMenuVariantToggleActive);

export default router;
