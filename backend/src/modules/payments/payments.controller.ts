import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { createVietqrPaymentSchema } from "./payments.schema";
import {
  initVietqrPayment,
  getPaymentStatus,
  manualConfirmVietqrPayment,
} from "./payments.service";
import { handleCassoWebhook } from "./payments.reconcile.service";

export const vietqrInitPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = createVietqrPaymentSchema.parse(req.body);
  const result = await initVietqrPayment(body.orderId);
  res.json(result);
});

export const vietqrManualConfirmHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) {
    res.status(400).json({ message: "Invalid orderId" });
    return;
  }
  const result = await manualConfirmVietqrPayment(orderId);
  res.json(result);
});

export const cassoWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await handleCassoWebhook({
    secureToken: req.header("secure-token"),
    body: req.body,
  });
  res.json(result);
});

export const getPaymentStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) {
    res.status(400).json({ message: "Invalid orderId" });
    return;
  }
  const result = await getPaymentStatus(orderId);
  if (!result) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json(result);
});
