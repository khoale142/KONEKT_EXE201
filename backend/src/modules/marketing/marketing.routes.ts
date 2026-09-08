import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  getOffers,
  getPublicHomeOffers,
  addPromotionCampaign,
  addVoucherRewardDef,
  putStampRewardCode,
  patchToggleCampaign,
  patchToggleReward,
  removeCampaign,
  removeReward,
} from "./marketing.controller";
import {
  marketingListComplaintsHandler,
  updateComplaintHandler,
  closeComplaintHandler,
  assignComplaintHandler,
  getStoreManagersHandler,
  getAllStoreManagersHandler,
  complaintDetailHandler,
  assignComplaintByMarketingHandler,
  replyToTicketHandler,
} from "../head-officer/head-officer.controller";
import {
  deleteMarketingContentHandler,
  getMarketingContentById,
  getMarketingContentList,
  getPublicHomeMarketingContentGroups,
  getPublicMarketingContentBySlug,
  getPublicMarketingContentList,
  patchMarketingContentFeature,
  patchMarketingContentStatus,
  patchMarketingContentToggleActive,
  postMarketingContent,
  putMarketingContent,
} from "./marketingContents.controller";
import marketingMenuRoutes from "./marketingMenu.routes";
import marketingComboRuleRoutes from "./marketingComboRule.routes";

const router = Router();

router.get("/public/home-offers", getPublicHomeOffers);
router.get("/public/home-contents", getPublicHomeMarketingContentGroups);
router.get("/public/home-marketing", getPublicHomeMarketingContentGroups);
router.get("/public/contents", getPublicMarketingContentList);
router.get("/public/contents/:slug", getPublicMarketingContentBySlug);

router.use(authGuard, portalGuard(["OFFICE"]), roleGuard(["marketing_sale", "admin"]));

router.get("/offers", getOffers);
router.get("/contents", getMarketingContentList);
router.get("/contents/:id", getMarketingContentById);

router.post("/contents", postMarketingContent);
router.put("/contents/:id", putMarketingContent);
router.patch("/contents/:id/status", patchMarketingContentStatus);
router.patch("/contents/:id/toggle-active", patchMarketingContentToggleActive);
router.patch("/contents/:id/feature", patchMarketingContentFeature);
router.delete("/contents/:id", deleteMarketingContentHandler);

router.post("/campaigns", addPromotionCampaign);
router.patch("/campaigns/:id/toggle", patchToggleCampaign);
router.delete("/campaigns/:id", removeCampaign);

router.post("/voucher-rewards", addVoucherRewardDef);
router.patch("/voucher-rewards/:id/toggle", patchToggleReward);
router.delete("/voucher-rewards/:id", removeReward);
router.put("/stamp-vouchers/code", putStampRewardCode);

// ── Complaint management (Helpdesk) ──
router.get("/complaints", marketingListComplaintsHandler);
router.get("/complaints/:id", complaintDetailHandler);
router.patch("/complaints/:id", updateComplaintHandler);
router.patch("/complaints/:id/assign", assignComplaintByMarketingHandler);
router.patch("/complaints/:id/close", closeComplaintHandler);
router.post("/complaints/:id/messages", replyToTicketHandler);
router.get("/stores/:storeId/managers", getStoreManagersHandler);
router.get("/managers", getAllStoreManagersHandler);
router.use("/menu", marketingMenuRoutes);
router.use("/combo-rules", marketingComboRuleRoutes);


export default router;
