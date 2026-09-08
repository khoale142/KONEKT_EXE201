import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPosMenu } from "./menu.service";

const router = Router();

// POS only
router.use(authGuard, portalGuard(["POS"]));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await getPosMenu();
    res.json(data);
  })
);

export default router;