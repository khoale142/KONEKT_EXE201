import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { getMeCheckin, postMeCheckin } from "./rewards.controller";

const router = Router();

router.use(authGuard, portalGuard(["CUSTOMER"]));

router.get("/me/checkin", getMeCheckin);
router.post("/me/checkin", postMeCheckin);

export default router;
