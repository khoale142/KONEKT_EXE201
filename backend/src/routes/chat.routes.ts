import { Router } from "express";
import { customerChatHandler, getCustomerMessagesHandler } from "../modules/chat/chat.controller";
import { authGuard } from "../middlewares/authGuard";
import { portalGuard } from "../middlewares/portalGuard";

const router = Router();

// Get customer chat history - requires authentication and CUSTOMER portal
router.get("/customer/messages", authGuard, portalGuard(["CUSTOMER"]), getCustomerMessagesHandler);

// Customer chat - requires authentication and CUSTOMER portal
router.post(
  "/customer",
  authGuard,
  portalGuard(["CUSTOMER"]),
  customerChatHandler
);

export default router;
