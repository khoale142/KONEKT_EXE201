import api from "../../../lib/http/axios";

export type MemberOrderIssueType =
  | "missing_item"
  | "wrong_item"
  | "damaged_item"
  | "quality_issue"
  | "long_wait"
  | "other";

export type MemberOrderIssueStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "rejected"
  | "cancelled";

export type MemberOrderIssue = {
  id: number;
  orderId: number;
  orderCode: string | null;
  storeId: number;
  storeName: string | null;
  storeAddress: string | null;
  customerId: number;
  issueType: MemberOrderIssueType;
  status: MemberOrderIssueStatus;
  description: string;
  customerNote: string | null;
  resolutionNote: string | null;
  pickupNumber: number | null;
  orderCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export const memberOrderIssuesApi = {
  listIssues: (params?: {
    status?: MemberOrderIssueStatus;
    issueType?: MemberOrderIssueType;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) =>
    api
      .get<{ ok: boolean; issues: MemberOrderIssue[] }>("/member-orders/issues", { params })
      .then((r) => r.data),

  createIssue: (orderId: number, data: { issueType: MemberOrderIssueType; description: string }) =>
    api
      .post<{ ok: boolean; issue: MemberOrderIssue }>(`/member-orders/${orderId}/issues`, data)
      .then((r) => r.data),
};