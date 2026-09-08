import api from "../../../lib/http/axios";

/* ═══════════════════════════════════════════════════════════
   TYPES — Chỉ giữ Financial + Inventory Audit
   ═══════════════════════════════════════════════════════════ */

export type StoreAuditSummary = {
  store_id: number;
  store_name: string;
  total_revenue: number;
  total_expense: number;
  total_orders: number;
  waste_count: number;
  waste_cost: number;
  inventory_warnings: number;
  last_audit_date: string | null;
};

export type AuditFlag = {
  id: number;
  store_id: number;
  store_name: string;
  flag_type: "financial" | "inventory";
  flag_key: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  metric: Record<string, number>;
  detected_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
};

/* ── Checklist JSONB Model ── */
export type ChecklistRating = "HIGH" | "MEDIUM" | "LOW";

export type ChecklistItem = {
  criterion: string;            // Tên tiêu chí
  rating: ChecklistRating;      // Mức đánh giá
  note?: string;                // Ghi chú giải trình (bắt buộc nếu LOW)
  financial_loss?: number;      // Số tiền thất thoát (chỉ SALES)
};

export type AuditReportType = "QUALITY" | "SALES";
export type AuditReportStatus = "SUBMITTED" | "ACKNOWLEDGED_BY_SM";

export type AuditReport = {
  id: number;
  store_id: number;
  store_name: string;
  auditor_id: number;
  auditor_name: string;
  type: AuditReportType;
  checklist_data: ChecklistItem[];
  status: AuditReportStatus;
  discrepancy_note: string;
  attachment_url: string | null;
  created_at: string;
};

/* ── Tiêu chí cứng cho mỗi loại kiểm toán ── */
export const QUALITY_CRITERIA = [
  "Vệ sinh quầy pha chế",
  "Vệ sinh khu vực khách ngồi",
  "Thái độ nhân viên",
  "Đồng phục & tác phong",
  "Chất lượng đồ uống (pha chế chuẩn SOP)",
  "Bảo quản nguyên liệu",
];

export const SALES_CRITERIA = [
  "Khớp tiền mặt cuối ca",
  "Lệch kho nguyên liệu",
  "Đối chiếu đơn hàng / hệ thống POS",
  "Hàng hủy / Waste hợp lệ",
  "Chi phí vận hành trong ngưỡng",
];

/* ═══════════════════════════════════════════════════════════
   API — Financial + Inventory Audit only
   ═══════════════════════════════════════════════════════════ */
export const auditApi = {
  // 1. Đối chiếu dữ liệu quán (Dashboard)
  getStoreData: (params?: { storeId?: number; startDate?: string; endDate?: string }) =>
    api
      .get<{ data: StoreAuditSummary[] }>("/audit/stores", {
        params: {
          ...(params?.storeId    ? { store_id:  params.storeId    } : {}),
          ...(params?.startDate  ? { startDate: params.startDate  } : {}),
          ...(params?.endDate    ? { endDate:   params.endDate    } : {}),
        },
      })
      .then((r) => r.data.data),

  // 2. Audit Flags — cờ cảnh báo tự động (Financial + Inventory)
  getFlags: (storeId?: number) =>
    api.get<{ data: AuditFlag[] }>("/audit/flags", { params: storeId ? { store_id: storeId } : {} }).then((r) => r.data.data),
  resolveFlag: (data: { store_id: number; flag_type: string; flag_key: string }) =>
    api.patch(`/audit/flags/resolve`, data).then((r) => r.data.data),

  // 3. Báo cáo Audit — FINANCIAL hoặc INVENTORY (FormData hỗ trợ upload ảnh)
  getReports: (storeId?: number) =>
    api.get<{ data: AuditReport[] }>("/audit/reports", { params: storeId ? { store_id: storeId } : {} }).then((r) => r.data.data),
  createReport: (formData: FormData) =>
    api.post<{ data: AuditReport }>("/audit/reports", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data.data),

  // 4. SM xác nhận tiếp nhận báo cáo
  acknowledgeReport: (id: number) =>
    api.patch<{ data: AuditReport }>(`/audit/reports/${id}/acknowledge`).then((r) => r.data.data),
};
