import api from "../../../lib/http/axios";

export type PickupBoardItem = {
  orderId: number;
  orderCode: string;
  pickupNumber: number | null;
  status: "paid" | "completed";
  createdAt: string | null;
  completedAt: string | null;
};

export const publicPickupBoardApi = {
  getBoard: (storeId: number) =>
    api
      .get<{
        ok: boolean;
        storeId: number;
        preparing: PickupBoardItem[];
        ready: PickupBoardItem[];
        generatedAt: string;
      }>(`/pos/orders/pickup-board/${storeId}`)
      .then((r) => r.data),
};
