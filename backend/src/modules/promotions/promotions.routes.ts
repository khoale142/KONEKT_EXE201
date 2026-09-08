import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
  getMyStampHistory,
  getMyStamps,
  getMyVouchers,
  getPublicPromotions,
  getPublicVoucherRewards,
  postRedeemVoucher,
} from "./promotions.controller";

const router = Router();

router.get("/public/campaigns", getPublicPromotions);
router.get("/public/voucher-rewards", getPublicVoucherRewards);

router.use(authGuard, portalGuard(["CUSTOMER"]));

router.get("/me/vouchers", getMyVouchers);
router.get("/me/stamps", getMyStamps);
router.get("/me/stamps/history", getMyStampHistory);
router.post("/me/vouchers/redeem", postRedeemVoucher);

export default router;
