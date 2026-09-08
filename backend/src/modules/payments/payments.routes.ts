import { Router } from "express";
import {
  cassoWebhookHandler,
  vietqrInitPaymentHandler,
  vietqrManualConfirmHandler,
  getPaymentStatusHandler,
} from "./payments.controller";

const router = Router();

router.post("/vietqr/init", vietqrInitPaymentHandler);
router.post("/vietqr/:orderId/manual-confirm", vietqrManualConfirmHandler);
router.post("/casso/webhook", cassoWebhookHandler);
router.get("/:orderId/status", getPaymentStatusHandler);

export default router;
