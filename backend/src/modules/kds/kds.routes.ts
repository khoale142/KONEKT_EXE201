import { Router, Request, Response, NextFunction } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { roleGuard } from "../../middlewares/roleGuard";
import { kdsListOrders, kdsUpdateStatus } from "./kds.controller";

const router = Router();

router.use(authGuard);

function roleGuardOrPos(roles: string[]) {
  const guard = roleGuard(roles);
  return (req: Request, res: Response, next: NextFunction) => {
    const u = req.user;
    if (u?.portal === "POS") return next();
    return guard(req, res, next);
  };
}

router.get("/orders", portalGuard(["POS", "STORE"]), kdsListOrders);

// Update status: chỉ STORE (barista/shift/store_manager) được thao tác
router.patch(
  "/orders/:id/status",
  portalGuard(["POS", "STORE"]),
  roleGuardOrPos(["staff", "shift_leader", "store_manager"]),
  kdsUpdateStatus
);

export default router;