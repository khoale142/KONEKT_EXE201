import api from "../../../lib/http/axios";

export type PosActionLogItem = {
  id: number;
  storeId: number;
  reconciliationId?: number | null;
  actionType: string;
  actorType: string;
  actorId?: number | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  orderId?: number | null;
  orderCode?: string | null;
  memberId?: number | null;
  memberName?: string | null;
  memberPhone?: string | null;
  cardNumber?: string | null;
  pickupNumber?: number | null;
  note?: string | null;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
  createdAt: string;
};

export type PosActionLogListResponse = {
  ok: true;
  filters: {
    storeId: number;
    dateFrom?: string | null;
    dateTo?: string | null;
    reconciliationId?: number | null;
    actionType?: string | null;
    orderCode?: string | null;
    actorId?: number | null;
    limit: number;
    offset: number;
  };
  total: number;
  logs: PosActionLogItem[];
};

export async function posGetActionLogs(params: {
  storeId?: number;
  dateFrom?: string;
  dateTo?: string;
  reconciliationId?: number;
  actionType?: string;
  orderCode?: string;
  actorId?: number;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get<PosActionLogListResponse>("/pos/action-logs", {
    params,
  });
  return data;
}