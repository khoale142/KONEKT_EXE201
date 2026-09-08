import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { customerUpdateProfileSchema } from "../auth/auth.schema";
import {
  getCustomerProfile,
  updateCustomerProfile,
  createCustomerTicket,
  getCustomerTickets,
} from "./members.service";
import { sendTicketCreatedEmail } from "../../utils/mail.service";
import { notifyTicketCreated } from "../notifications/notifications.service";
import { pool } from "../../config/db";

export const meCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const result = await getCustomerProfile(customerId);
  res.json(result);
});

export const updateMeCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const body = customerUpdateProfileSchema.parse(req.body);
  const result = await updateCustomerProfile({
    customerId,
    fullName: body.fullName,
    phone: body.phone,
    gender: body.gender,
    birthday: body.birthday,
    city: body.city,
  });
  res.json(result);
});

export const createTicketHandler = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const { store_id, subject, content, order_id, feedback_type, incident_time } = req.body ?? {};

  // Multer file (optional)
  const file = (req as any).file as Express.Multer.File | undefined;
  const attachmentUrl = file ? `/uploads/tickets/${file.filename}` : null;

  const result = await createCustomerTicket({
    customerId,
    storeId: Number(store_id),
    subject: String(subject ?? ""),
    content: String(content ?? ""),
    orderId: order_id ? Number(order_id) : null,
    feedbackType: feedback_type ? String(feedback_type) : null,
    incidentTime: incident_time ? String(incident_time) : null,
    attachmentUrl,
  });

  // Send confirmation email (fire-and-forget, never break the API)
  try {
    const emailR = await pool.query(`SELECT email FROM customers WHERE id = $1`, [customerId]);
    const customerEmail = emailR.rows[0]?.email;
    if (customerEmail) {
      await sendTicketCreatedEmail(customerEmail, result.ticket.id);
    }
  } catch (_emailErr) {
    // Silently ignore – email is best-effort
  }

  // Trạm 1 — TICKET_CREATED notification (fire-and-forget)
  notifyTicketCreated({
    customerId,
    ticketId: result.ticket.id,
  }).catch((err) => {
    console.error(`[createTicketHandler] Lỗi TICKET_CREATED notification cho ticket #${result.ticket.id}:`, err);
  });

  res.status(201).json(result);
});

export const getMyTicketsHandler = asyncHandler(async (req: Request, res: Response) => {
  const customerId = Number((req as any).user.sub);
  const result = await getCustomerTickets(customerId);
  res.json(result);
});
