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
  asyncHandler(async (req, res) => {
    const tenantId = (req as any).user?.tenantId;
    const data = await getPosMenu(tenantId);
    res.json(data);
  })
);

export default router;