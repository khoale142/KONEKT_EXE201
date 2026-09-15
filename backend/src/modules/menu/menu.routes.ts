import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPosMenu } from "./menu.service";

const router = Router();

export const POS_MENU_PORTALS: Array<"POS"> = ["POS"];

// POS only
router.use(authGuard, portalGuard(POS_MENU_PORTALS));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = (req as any).user?.tenantId;
    const data = await getPosMenu(tenantId);
    res.json(data);
  })
);

export default router;