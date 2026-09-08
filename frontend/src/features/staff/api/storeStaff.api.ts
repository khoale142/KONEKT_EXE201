import api from "../../../lib/http/axios";

export type HireFireRequest = {
  id: number;
  store_id: number;
  request_type: "hire" | "fire";
  position: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
};

export type StoreListItem = {
  id: number;
  name: string;
};

export type StoreListResponse = {
  stores: StoreListItem[];
};

export const storeStaffApi = {
  getMyStores: () =>
    api.get<StoreListResponse>("/staff-attendance/store/my-stores").then((r) => r.data),

  getStoreStaff: (storeId: number) =>
    api
      .get("/staff-attendance/store/staff", {
        params: { storeId },
      })
      .then((r) => r.data),

  getStoreShifts: (storeId: number) =>
    api
      .get("/staff-attendance/store/shifts", {
        params: { storeId },
      })
      .then((r) => r.data),

  createHireFireRequest: (data: {
    storeId: number;
    requestType: "hire" | "fire";
    position: string;
    reason: string;
  }) =>
    api
      .post<{ data: HireFireRequest }>("/staff-attendance/store/hire-fire-requests", data)
      .then((r) => r.data.data),

  listMyHireFireRequests: (storeId: number) =>
    api
      .get<{ data: HireFireRequest[] }>("/staff-attendance/store/hire-fire-requests", {
        params: { storeId },
      })
      .then((r) => r.data.data),
};