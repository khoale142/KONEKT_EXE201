import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { previewCombos } from "./comboRule.controller";

const router = Router();

router.use(authGuard, portalGuard(["POS"]));

router.post("/preview", previewCombos);

export default router;