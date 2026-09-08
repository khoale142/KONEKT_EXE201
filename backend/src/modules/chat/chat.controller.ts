import { Request, Response } from "express";
import { customerChat, getCustomerMessages } from "./chat.service";
import { asyncHandler } from "../../utils/asyncHandler";

export const getCustomerMessagesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user as { sub?: string; id?: number; portal?: string } | undefined;
    if (user?.portal !== "CUSTOMER") {
      return res.status(403).json({ message: "Chat chỉ dành cho khách hàng đã đăng nhập" });
    }
    const customerId = user?.sub ?? user?.id?.toString();
    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized: Customer ID is required" });
    }

    const messages = await getCustomerMessages(customerId);
    res.json({ messages });
  }
);

export const customerChatHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { message } = req.body;

    // Validation
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Message is required and must be a string" });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (trimmedMessage.length > 2000) {
      return res.status(400).json({ message: "Message is too long (max 2000 characters)" });
    }

    const user = (req as any).user as { sub?: string; id?: number; portal?: string } | undefined;
    if (user?.portal !== "CUSTOMER") {
      return res.status(403).json({ message: "Chat chỉ dành cho khách hàng đã đăng nhập" });
    }
    const customerId = user?.sub ?? user?.id?.toString();
    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized: Customer ID is required" });
    }

    // Log request để debug
    console.log("[Chat Request]", {
      customerId,
      messageLength: trimmedMessage.length,
      messagePreview: trimmedMessage.substring(0, 50),
    });

    // asyncHandler sẽ catch error và pass vào errorHandler middleware
    const result = await customerChat(trimmedMessage, customerId);
    
    // Response format: { answer, conversationId, intentCode?, metadata? }
    res.json({
      answer: result.answer,
      conversationId: result.conversationId,
      intentCode: result.intentCode,
      ...(result.metadata && { metadata: result.metadata }),
    });
  }
);
