import api from "../../../../lib/http/axios";

export type HRStaffUpdateTarget = {
  staffId?: number | null;
  staffName?: string | null;
  currentRole?: string | null;
  targetRole?: "shift_leader" | null;
  currentEmploymentType?: "full_time" | "part_time" | string | null;
  targetEmploymentType?: "full_time" | null;
};

export type HRStaffSnapshot = {
  staffId?: number | null;
  staffName?: string | null;
  role?: string | null;
  employmentType?: "full_time" | "part_time" | string | null;
  hireDate?: string | null;
  tenureDays?: number | null;
  tenureLabel?: string | null;
  capturedAt?: string | null;
};

export type HRSystemExperience = {
  review_from?: string | null;
  review_to?: string | null;
  total_assigned_shifts?: number | null;
  checked_in_shifts?: number | null;
  completed_shifts?: number | null;
  late_checkins?: number | null;
  absent_shifts?: number | null;
  missed_checkouts?: number | null;
  total_work_hours?: number | null;
  attendance_rate_percent?: number | null;
};

export type HRStaffRequest = {
  id: number;
  store_id: number;
  store_name: string;
  employment_type?: "full_time" | "part_time" | string | null;
  request_type: "hire" | "fire" | "staff_update";
  position: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  created_at: string;
  target?: HRStaffUpdateTarget | null;
  staff_snapshot?: HRStaffSnapshot | null;
  system_experience?: HRSystemExperience | null;
  manager_experience_note?: string | null;
  reject_reason?: string | null;
  processed_account?: {
    username?: string | null;
    tempPassword?: string | null;
    employeeId?: number | null;
  } | null;
};

export const hrRequestsApi = {
  list: () => api.get<{ data: HRStaffRequest[] }>("/head-officer/hr/requests").then((r) => r.data.data),

  approve: (id: number) =>
    api.patch<{ data: HRStaffRequest }>(`/head-officer/hr/requests/${id}/approve`).then((r) => r.data.data),

  reject: (id: number, reason?: string) =>
    api
      .patch<{ data: HRStaffRequest }>(`/head-officer/hr/requests/${id}/reject`, { reason })
      .then((r) => r.data.data),
};
