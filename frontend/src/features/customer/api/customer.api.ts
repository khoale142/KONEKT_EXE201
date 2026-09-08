import api from "../../../lib/http/axios";

export type CustomerTicket = {
  id: number;
  subject: string;
  content: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "high" | "medium" | "low";
  store_name: string;
  order_id: number | null;
  feedback_type: string | null;
  incident_time: string | null;
  attachment_url: string | null;
  customer_reply: string | null;
  internal_note: string | null;
  created_at: string;
  closed_at: string | null;
};

export type TicketMessage = {
  id: number;
  sender_type: "staff" | "customer" | "system";
  sender_id: number | null;
  message: string;
  is_internal: boolean;
  created_at: string;
  sender_name: string;
};

export type CustomerTicketDetail = CustomerTicket & {
  description: string;
  messages: TicketMessage[];
  waiting_for: "customer" | "staff" | "none";
};

export type StoreOption = {
  id: number;
  name: string;
  address: string;
};

export const customerApi = {
  getStores: () =>
    api.get<{ stores: StoreOption[] }>("/stores").then((r) => r.data.stores),

  createTicket: (data: {
    store_id: number;
    subject: string;
    content: string;
    order_id?: number | null;
    feedback_type?: string | null;
    incident_time?: string | null;
    attachment?: File | null;
  }) => {
    const fd = new FormData();
    fd.append("store_id", String(data.store_id));
    fd.append("subject", data.subject);
    fd.append("content", data.content);
    if (data.order_id) fd.append("order_id", String(data.order_id));
    if (data.feedback_type) fd.append("feedback_type", data.feedback_type);
    if (data.incident_time) fd.append("incident_time", data.incident_time);
    if (data.attachment) fd.append("attachment", data.attachment);
    return api
      .post<{ ticket: CustomerTicket; message: string }>("/auth/customer/tickets", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  getMyTickets: () =>
    api
      .get<{ tickets: CustomerTicket[] }>("/auth/customer/tickets")
      .then((r) => r.data.tickets),

  getTicketDetail: (id: number) =>
    api
      .get<{ data: CustomerTicketDetail }>(`/auth/customer/tickets/${id}`)
      .then((r) => r.data.data),

  sendMessage: (id: number, message: string) =>
    api
      .post<{ data: TicketMessage }>(`/auth/customer/tickets/${id}/messages`, { message })
      .then((r) => r.data.data),
};
