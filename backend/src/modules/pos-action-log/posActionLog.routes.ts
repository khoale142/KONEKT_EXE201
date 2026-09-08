import { Router } from "express";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { listPosActionLogs } from "./posActionLog.controller";

const router = Router();

router.use(authGuard, portalGuard(["POS"]));

router.get("/", listPosActionLogs);

export default router;