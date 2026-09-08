import api from "../../../lib/http/axios";
import type { Complaint } from "../../head-officer/api/head-officer.api";

export const storeComplaintsApi = {
  /** Danh sách ticket được giao cho SM đang đăng nhập, status = in_progress */
  getAssigned: () =>
    api
      .get<{ data: Complaint[] }>("/staff-attendance/complaints")
      .then((r) => r.data.data),

  /** SM nhập báo cáo giải trình → tự động chuyển status → resolved */
  resolve: (id: number, internal_note: string) =>
    api
      .patch<{ data: { id: number; status: string; internal_note: string } }>(
        `/staff-attendance/complaints/${id}/resolve`,
        { internal_note },
      )
      .then((r) => r.data.data),
};
