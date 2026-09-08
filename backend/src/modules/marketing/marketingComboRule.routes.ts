import { Router } from "express";
import {
  getMarketingComboRuleById,
  getMarketingComboRuleCategories,
  getMarketingComboRuleProducts,
  getMarketingComboRules,
  getMarketingComboRuleVariants,
  patchMarketingComboRule,
  patchMarketingComboRuleToggleActive,
  postMarketingComboRule,
  putMarketingComboRuleGroups,
} from "./marketingComboRule.controller";

const router = Router();

router.get("/", getMarketingComboRules);
router.get("/lookups/categories", getMarketingComboRuleCategories);
router.get("/lookups/products", getMarketingComboRuleProducts);
router.get("/lookups/variants", getMarketingComboRuleVariants);
router.get("/:id", getMarketingComboRuleById);
router.post("/", postMarketingComboRule);
router.patch("/:id", patchMarketingComboRule);
router.patch("/:id/toggle-active", patchMarketingComboRuleToggleActive);
router.put("/:id/groups", putMarketingComboRuleGroups);

export default router;
