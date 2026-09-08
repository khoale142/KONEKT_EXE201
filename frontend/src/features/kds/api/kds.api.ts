import api from "../../../lib/http/axios";

export type KdsOrderItem = {
  id: number;
  productVariantId: number;
  quantity: number;
  unitPrice?: number;
  note?: string | null;
  variantName?: string | null;
  productName?: string | null;
};

export type KdsOrder = {
  id: number;
  storeId: number;
  orderCode: string;
  status: "paid" | "completed" | "voided" | "refunded";
  createdAt: string;
  completedAt?: string | null;
  pickupNumber?: number | null;
  totalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  customerId?: number | null;
  orderType?: "NORMAL" | "TEST" | "FREE" | "INTERNAL" | "GUEST" | "COMPENSATION";
  specialNote?: string | null;
  items: KdsOrderItem[];
  serviceMode?: "TAKE_AWAY" | "IN_STORE";
};

export async function kdsListOrders(params?: {
  date?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const r = await api.get("/kds/orders", { params });
  return r.data as {
    ok: boolean;
    filters: {
      storeId: number;
      date: string;
      statuses: string[];
    };
    orders: KdsOrder[];
  };
}

export async function kdsUpdateStatus(
  orderId: number,
  status: "completed"
) {
  const r = await api.patch(`/kds/orders/${orderId}/status`, { status });
  return r.data as {
    ok: boolean;
    order: { id: number; status: string; completedAt?: string | null };
  };
}