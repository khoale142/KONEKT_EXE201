import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { getOverview, getTodayOverview } from "./storeReport.controller";

const router = Router();

router.use(authGuard);
router.use(portalGuard(["POS", "STORE", "OFFICE"]));

router.get("/today", getTodayOverview);
router.get("/overview", getOverview);

export default router;