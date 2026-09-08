import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authGuard } from "../middlewares/authGuard";
import { portalGuard } from "../middlewares/portalGuard";
import { roleGuard } from "../middlewares/roleGuard";
import { createUser, deactivateUser, assignStores } from "../modules/users/users.service";

const router = Router();

// CHỈ office/admin mới được thao tác HR
router.use(authGuard, portalGuard(["OFFICE"]), roleGuard(["admin", "district_manager"]));

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const actorUserId = Number((req as any).user.sub);
    const user = await createUser({ actorUserId, ...req.body });
    res.json({ user });
  })
);

router.post(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const actorUserId = Number((req as any).user.sub);
    const userId = Number(req.params.id);
    const out = await deactivateUser({ actorUserId, userId, reason: req.body?.reason });
    res.json(out);
  })
);

router.post(
  "/:id/assign-stores",
  asyncHandler(async (req, res) => {
    const actorUserId = Number((req as any).user.sub);
    const userId = Number(req.params.id);
    const out = await assignStores({ actorUserId, userId, storeIds: req.body.storeIds, primaryStoreId: req.body.primaryStoreId });
    res.json(out);
  })
);

export default router;