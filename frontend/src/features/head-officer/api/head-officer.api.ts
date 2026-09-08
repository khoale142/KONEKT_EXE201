import api from "../../../lib/http/axios";

export type RevenueRow = {
  store_id: number;
  store_name: string;
  revenue: number;
  operating_expense: number;
  maintenance_expense: number;
  other_expense: number;
  payroll_cost: number;
  waste_expense: number;
  total_expense: number;
  profit: number;
};

export type RevenueReportResult = {
  current: RevenueRow[];
  prev: RevenueRow[];
  prevPeriod: { prevFrom: string; prevTo: string } | null;
  period: { dateFrom: string | null; dateTo: string | null };
};

export type ActionInsight = {
  priority: "high" | "medium" | "low";
  status_text: string;
  main_issue: string;
  root_cause: string;
  next_action: string;
};

export type RevenueStoreAnalysis = {
  store_id: number;
  store_name: string;
  margin_pct: number;
  payroll_ratio: number;
  expense_ratio: number;
  warnings: string[];
  suggestions: string[];
  action_insights: ActionInsight[];
};

export type RevenueAnalysis = {
  chain: {
    total_revenue: number;
    total_expense: number;
    total_profit: number;
    chain_margin_pct: number;
    store_count: number;
    best_store:  { store_id: number; store_name: string; profit: number } | null;
    worst_store: { store_id: number; store_name: string; profit: number } | null;
  };
  stores: RevenueStoreAnalysis[];
};

export type WasteRow = {
  store_id: number;
  store_name: string;
  waste_count: number;
  waste_cost: number;
  waste_rate_pct: number;
};

export type PayrollRow = {
  store_id: number;
  store_name: string;
  staff_count: number;
  actual_payroll: number;
};

export type StaffRequest = {
  id: number;
  store_id: number;
  store_name: string;
  request_type: "hire" | "fire";
  position: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  created_at: string;
  reject_reason?: string | null;
  processed_account?: {
    username?: string | null;
    tempPassword?: string | null;
    employeeId?: number | null;
  } | null;
};

export type Complaint = {
  id: number;
  store_id: number;
  store_name: string;
  customer_name: string;
  customer_phone: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  channel?: string;
  created_at: string;
  resolved_at?: string;
  assigned_to?: number;
  assigned_at?: string;
  assigned_to_name?: string;
  internal_note?: string;
  customer_reply?: string;
  attachment_url?: string | null;
  customer_email?: string;
  assign_note?: string | null;
  incident_time?: string | null;
  feedback_type?: string | null;
};

export type StoreDetail = {
  store: { id: number; name: string; address: string };
  revenue: {
    completed_orders: number;
    pending_orders: number;
    total_revenue: number;
    avg_order_value: number;
    max_order_value: number;
    orders_last_7d: number;
    revenue_last_7d: number;
    voucher_orders: number;
    total_discount: number;
  };
  staff: {
    total: number;
    list: { id: number; full_name: string; role_name: string; employment_type: string; hourly_wage: number; monthly_salary: number }[];
  };
  stock: {
    total_items: number;
    total_value: number;
    positive_value: number;
    deficit_value: number;
    deficit_items: number;
    items: { name: string; category: string; storage_unit: string; quantity: number; cost_per_unit: number; stock_value: number }[];
  };
  shifts: {
    attendance: {
      total_sessions: number;
      on_time_count: number;
      late_count: number;
      absent_count: number;
      total_hours: number;
      active_staff: number;
      on_time_pct: number;
    };
    configs: { id: number; name: string; start_time: string; end_time: string; late_grace_minutes: number }[];
    pending_requests: {
      id: number;
      requester_name: string;
      request_type: string;
      request_date: string;
      note: string;
      shift_name: string;
      status: string;
      created_at: string;
    }[];
  };
  all_products: { product_name: string; qty_sold: number; revenue: number }[];
};

export type StaffMember = {
  id: number;
  full_name: string;
  role_name: string;
  employment_type: string;
  hourly_wage: number;
  monthly_salary: number;
};

export type HrEmployeeDirectoryRow = {
  user_id: number;
  store_id: number;
  store_name: string;
  full_name: string;
  role_name: string;
  employment_type: string;
  hourly_wage: number;
  monthly_salary: number;
};

export type WasteItem = {
  ingredient_id: number;
  ingredient_name: string;
  storage_unit: string;
  quantity: number;
  cost_per_unit: number;
  item_cost: number;
};

export type WasteReportDetail = {
  id: number;
  created_at: string;
  reported_by: string;
  item_count: number;
  total_cost: number;
  items: WasteItem[];
};

/* ── New DM Module Types ──────────────────────────────────────── */
export type PayrollRowV2 = {
  store_id: number;
  store_name: string;
  pt_payroll_pct: number;
  revenue: number;
  pt_fund_target: number;
  pt_payroll_actual: number;
  ft_payroll_actual: number;
  pt_count: number;
  ft_count: number;
};

export type InventoryWasteRow = {
  store_id: number;
  store_name: string;
  total_items: number;
  total_stock_value: number;
  deficit_items: number;
  deficit_value: number;
  waste_reports_count: number;
  waste_cost: number;
  revenue: number;
  waste_rate_pct: number;
  trend_pct: number | null;
};

export type StoreWasteDeficitItem = {
  ingredient_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  deficit_value: number;
};

export type StoreWasteTopItem = {
  ingredient_name: string;
  unit: string;
  total_quantity: number;
  total_cost: number;
};

export type StoreWasteDetailResult = {
  deficit_items: StoreWasteDeficitItem[];
  top_waste_items: StoreWasteTopItem[];
};

export type StoreSM = {
  id: number;
  full_name: string;
  phone: string;
  role_name: string;
};

export type RevenueTarget = {
  store_id: number;
  store_name: string;
  target: number;
  actual: number;
  progress_pct: number | null;
};

export type RevenueTrendStore = {
  store_id: number;
  store_name: string;
  revenue_cur: number;
  revenue_prev: number;
  change_pct: number | null;
};

export type RevenueTrend = {
  stores: RevenueTrendStore[];
  chain: { revenue_cur: number; revenue_prev: number; change_pct: number | null };
  period: { dateFrom: string; dateTo: string; prevFrom: string; prevTo: string };
};

export type WasteTrendStore = {
  store_id: number;
  store_name: string;
  waste_cost_cur: number;
  waste_cost_prev: number;
  waste_reports_cur: number;
  change_pct: number | null;
};

export type WasteTrend = {
  stores: WasteTrendStore[];
  chain: { waste_cost_cur: number; waste_cost_prev: number; change_pct: number | null };
  period: { dateFrom: string; dateTo: string; prevFrom: string; prevTo: string };
};

export type ComplaintAlerts = {
  total_open: number;
  high_open: number;
  medium_open: number;
  resolved: number;
};

/* ── Task 1: Revenue Stats MoM ────────────────────────────────── */
export type RevenueStats = {
  current_month_revenue: number;
  previous_month_revenue: number;
  change_pct: number | null;
  period: {
    current:  { from: string; to: string; month: number; year: number };
    previous: { from: string; to: string; month: number; year: number };
  };
  store_id: number | null;
};

/* ── Task 2: Dashboard Insights ───────────────────────────────── */
export type Insight = {
  type: string;
  text: string;
};

export type StoreInsights = {
  store_id: number;
  store_name: string;
  insights: Insight[];
};

export type DashboardInsights = {
  stores: StoreInsights[];
  summary: {
    total_high: number;
    total_medium: number;
    total_low: number;
    stores_with_waste_warning: number;
  };
  period: { month: number; year: number };
};

/* ── Task 3: Per-store granular types ─────────────────────────── */
export type StoreFinance = {
  revenue: number;
  operating_expense: number;
  maintenance_expense: number;
  other_expense: number;
  payroll_cost: number;
  waste_expense: number;
  total_expense: number;
  profit: number;
  margin_pct: number;
  completed_orders: number;
};

export type StoreStockItem = {
  name: string;
  category: string;
  storage_unit: string;
  quantity: number;
  cost_per_unit: number;
  stock_value: number;
};

export type PagedStoreStock = {
  items: StoreStockItem[];
  total: number;
  page: number;
  limit: number;
};

export type StoreProductItem = {
  product_name: string;
  qty_sold: number;
  revenue: number;
};

export type PagedStoreProducts = {
  items: StoreProductItem[];
  total: number;
  page: number;
  limit: number;
};

export const headOfficerApi = {
  // Báo cáo
  getRevenueReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: RevenueRow[] }>("head-officer/reports/revenue", { params }).then((r) => r.data.data),

  getRevenueAnalysis: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: RevenueAnalysis }>("head-officer/reports/revenue/analysis", { params }).then((r) => r.data.data),

  getWasteReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: WasteRow[] }>("/head-officer/reports/waste", { params }).then((r) => r.data.data),

  getPayrollReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: PayrollRow[] }>("/head-officer/reports/payroll", { params }).then((r) => r.data.data),

  getStaffRequests: () =>
    api.get<{ data: StaffRequest[] }>("/head-officer/requests").then((r) => r.data.data),

  getHrEmployees: () =>
    api.get<{ data: HrEmployeeDirectoryRow[] }>("/head-officer/hr/employees").then((r) => r.data.data),

  approveRequest: (id: number) =>
    api.patch<{ data: StaffRequest }>(`/head-officer/requests/${id}/approve`).then((r) => r.data.data),

  rejectRequest: (id: number, reason?: string) =>
    api.patch<{ data: StaffRequest }>(`/head-officer/requests/${id}/reject`, { reason }).then((r) => r.data.data),

  // Complaints
  getComplaints: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: Complaint[] }>("/head-officer/complaints", { params }).then((r) => r.data.data),

  // Chi tiết cơ sở
  getStoreDetail: (storeId: number) =>
    api.get<{ data: StoreDetail }>(`/head-officer/stores/${storeId}/detail`).then((r) => r.data.data),

  getStoreFinance: (storeId: number, params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: StoreFinance }>(`/head-officer/stores/${storeId}/finance`, { params }).then((r) => r.data.data),

  getStoreStockPaged: (storeId: number, params?: { page?: number; limit?: number }) =>
    api.get<{ data: PagedStoreStock }>(`/head-officer/stores/${storeId}/stock`, { params }).then((r) => r.data.data),

  getStoreProductsPaged: (storeId: number, params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: PagedStoreProducts }>(`/head-officer/stores/${storeId}/products`, { params }).then((r) => r.data.data),

  getStoreStaff: (storeId: number) =>
    api.get<{ data: StaffMember[] }>(`/head-officer/stores/${storeId}/staff`).then((r) => r.data.data),

  updateStaffWage: (userId: number, storeId: number, wage: number) =>
    api
      .patch<{ data: { id: number; full_name: string; employment_type: string; hourly_wage?: number; monthly_salary?: number } }>(
        `/head-officer/staff/${userId}/wage`,
        { store_id: storeId, wage }
      )
      .then((r) => r.data.data),

  getWasteDetail: (storeId: number) =>
    api.get<{ data: WasteReportDetail[] }>(`/head-officer/stores/${storeId}/waste`).then((r) => r.data.data),

  // ── Module 1: Payroll PT/FT ──────────────────────────────────
  getPayrollReportV2: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: PayrollRowV2[] }>("/head-officer/reports/payroll-v2", { params }).then((r) => r.data.data),

  updatePtPayrollPct: (storeId: number, pct: number) =>
    api.patch<{ data: { id: number; name: string; pt_payroll_pct: number } }>(
      `/head-officer/stores/${storeId}/pt-pct`, { pct }
    ).then((r) => r.data.data),

  // ── Module 2: Inventory & Waste summary ─────────────────────
  getInventoryWaste: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: InventoryWasteRow[] }>("/head-officer/inventory-waste", { params }).then((r) => r.data.data),

  getStoreWasteDetail: (storeId: number, params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: StoreWasteDetailResult }>(`/head-officer/stores/${storeId}/waste-detail`, { params }).then((r) => r.data.data),

  // ── Module 3: Assign complaint ───────────────────────────────
  assignComplaint: (id: number, smId: number) =>
    api.patch<{ data: { id: number; status: string; assigned_at: string } }>(
      `/head-officer/complaints/${id}/assign`, { sm_id: smId }
    ).then((r) => r.data.data),

  getStoreManagers: (storeId: number) =>
    api.get<{ data: StoreSM[] }>(`/head-officer/stores/${storeId}/managers`).then((r) => r.data.data),

  // ── Module 4: Revenue targets ────────────────────────────────
  getRevenueTargets: (params?: { month?: string }) =>
    api.get<{ data: RevenueTarget[] }>("/head-officer/revenue-targets", { params }).then((r) => r.data.data),

  setRevenueTarget: (storeId: number, target: number) =>
    api.patch<{ data: RevenueTarget }>(`/head-officer/stores/${storeId}/revenue-target`, { target }).then((r) => r.data.data),

  // ── Phase 1: Trend APIs (MoM comparison) ────────────────────
  getRevenueTrend: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: RevenueTrend }>("/head-officer/reports/revenue-trend", { params }).then((r) => r.data.data),

  getWasteTrend: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<{ data: WasteTrend }>("/head-officer/reports/waste-trend", { params }).then((r) => r.data.data),

  getComplaintAlerts: () =>
    api.get<{ data: ComplaintAlerts }>("/head-officer/complaints/alerts").then((r) => r.data.data),

  // ── Task 1: Revenue Stats MoM ────────────────────────────────
  getRevenueStats: (params?: { month?: number; year?: number; storeId?: number }) =>
    api.get<{ data: RevenueStats }>("/head-officer/revenue-stats", { params }).then((r) => r.data.data),

  // ── Task 2: Dashboard Insights ───────────────────────────────
  getDashboardInsights: (params?: { month?: number; year?: number; storeId?: number }) =>
    api.get<{ data: DashboardInsights }>("/head-officer/dashboard-insights", { params }).then((r) => r.data.data),

};
