import api from "../../../lib/http/axios";

export type PosOrderIssueType =
  | "missing_item"
  | "wrong_item"
  | "damaged_item"
  | "quality_issue"
  | "long_wait"
  | "other";

export type PosOrderIssueStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "rejected"
  | "cancelled";

export type PosOrderIssue = {
  id: number;
  orderId: number;
  orderCode: string | null;
  storeId: number;
  storeName: string | null;
  customerId: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  issueType: PosOrderIssueType;
  status: PosOrderIssueStatus;
  description: string;
  internalNote: string | null;
  resolutionNote: string | null;
  pickupNumber: number | null;
  orderCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  handledByUserId: number | null;
};

export const posOrderIssuesApi = {
  listIssues: (params?: {
    status?: PosOrderIssueStatus;
    issueType?: PosOrderIssueType;
    search?: string;
    orderCode?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{ ok: boolean; issues: PosOrderIssue[] }>("/pos/orders/issues", { params })
      .then((r) => r.data),

  updateStatus: (
    ticketId: number,
    data: {
      status: Extract<PosOrderIssueStatus, "in_progress" | "resolved" | "rejected">;
      internalNote?: string;
      resolutionNote?: string;
    }
  ) =>
    api
      .patch<{ ok: boolean; issue: PosOrderIssue }>(
        `/pos/orders/issues/${ticketId}/status`,
        data
      )
      .then((r) => r.data),
};
