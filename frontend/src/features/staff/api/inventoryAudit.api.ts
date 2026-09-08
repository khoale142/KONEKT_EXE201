import api from "../../../lib/http/axios";

export type InventoryBatch = {
  batch_id?: number;
  id?: number;
  store_id: number;
  store_code?: string;
  store_name?: string;
  shift_id: number | null;
  work_date: string;
  cycle_no: number;
  status: string;
  note?: string | null;
  rejection_note?: string | null;
  created_by?: number;
  created_by_name?: string | null;
  submitted_by?: number | null;
  submitted_by_name?: string | null;
  shift_leader_approved_by?: number | null;
  shift_leader_approved_by_name?: string | null;
  store_manager_approved_by?: number | null;
  store_manager_approved_by_name?: string | null;
  dm_approved_by?: number | null;
  dm_approved_by_name?: string | null;
  created_at?: string;
  submitted_at?: string | null;
  shift_leader_approved_at?: string | null;
  store_manager_approved_at?: string | null;
  dm_approved_at?: string | null;
  total_sheets?: number;
  total_lines?: number;
  total_estimated_value?: number;
  total_estimated_variance_value?: number;
  audit_lines?: number;
  critical_lines?: number;
};

export type InventorySheet = {
  id: number;
  batch_id: number;
  sheet_type:
    | "bakery"
    | "ingredient_liquid"
    | "ingredient_dry"
    | "consumable"
    | "merchandise"
    | string;
  title: string;
  responsible_user_id: number;
  responsible_user_name?: string | null;
  created_by: number;
  created_by_name?: string | null;
  submitted_by?: number | null;
  submitted_by_name?: string | null;
  status: "draft" | "submitted" | string;
  note?: string | null;
  submitted_at?: string | null;
  total_lines?: number;
  total_estimated_value?: number;
  audit_lines?: number;
  critical_lines?: number;
  batch_status?: string;
  store_id?: number;
  store_code?: string;
  store_name?: string;
  work_date?: string;
  shift_id?: number | null;
};

/** Session chờ duyệt (tùy module shift) — cấu trúc mở rộng theo backend */
export type InventorySheetItem = {
  id: number;
  sheet_id: number;
  ingredient_id: number;
  ingredient_code: string;
  ingredient_name: string;
  category?: string | null;
  storage_unit?: string | null;
  usage_unit?: string | null;
  conversion_ratio?: number | null;
  opening_qty: number;
  theoretical_used_qty: number;
  theoretical_closing_qty: number;
  actual_closing_qty: number | null;
  variance_qty: number;
  variance_percent: number;
  threshold_percent: number;
  flagged: boolean;
  audit_status: "normal" | "audit" | "critical" | string;
  estimated_unit_cost: number;
  estimated_line_value: number;
  note: string | null;
  total_estimated_variance_value?: number;
};

export type InventoryShiftSession = {
  id: number;
  store_id: number;
  shift_id?: number | null;
  work_date: string;
  status: string;
  note?: string | null;
  opened_by?: number | null;
  opened_at?: string | null;
  submitted_at?: string | null;
  shift_leader_approved_by?: number | null;
  shift_leader_approved_at?: string | null;
  store_manager_approved_by?: number | null;
  store_manager_approved_at?: string | null;
  dm_approved_by?: number | null;
  dm_approved_at?: string | null;
  closed_at?: string | null;
};

export const inventoryAuditApi = {
  async getCurrentBatch(params: {
    workDate: string;
    shiftId?: number | null;
    storeId?: number;
  }) {
    const res = await api.get("/inventory-audit/batches/current", {
      params: {
        workDate: params.workDate,
        shiftId: params.shiftId ?? undefined,
        storeId: params.storeId ?? undefined,
      },
    });

    return res.data as {
      ok: boolean;
      data: {
        batch: InventoryBatch;
        sheets: InventorySheet[];
        summary: {
          totalSheets: number;
          totalLines: number;
          totalEstimatedValue: number;
          auditLines: number;
          criticalLines: number;
        };
      } | null;
    };
  },

  async searchBatches(params: { storeId: number; workDate: string }) {
    const res = await api.get("/inventory-audit/batches/search", {
      params: {
        storeId: params.storeId,
        workDate: params.workDate,
      },
    });

    return res.data as {
      ok: boolean;
      items: InventoryBatch[];
    };
  },

  getBatchWorkspace: (params: {
    storeId: number;
    workDate?: string;
    scope?: "drafts" | "history";
  }) =>
    api
      .get("/inventory-audit/batches/workspace", { params })
      .then((r) => r.data),

  getPendingShiftLeaderBatches: (params: {
    storeId: number;
    workDate?: string;
  }) =>
    api
      .get("/inventory-audit/batches/pending-shift-leader", { params })
      .then((r) => r.data),

  getPendingStoreManagerBatches: (params: {
    storeId: number;
    workDate?: string;
  }) =>
    api
      .get("/inventory-audit/batches/pending-store-manager", { params })
      .then((r) => r.data),

  getPendingDmBatches: (params: { storeId: number; workDate?: string }) =>
    api
      .get("/inventory-audit/batches/pending-dm", { params })
      .then((r) => r.data),

  async openBatch(payload: {
    workDate: string;
    shiftId?: number | null;
    note?: string | null;
    storeId?: number;
  }) {
    const res = await api.post("/inventory-audit/batches/open", payload);
    return res.data as {
      ok: boolean;
      batch: InventoryBatch;
    };
  },

  async createSheet(payload: {
    batchId: number;
    sheetType:
      | "bakery"
      | "ingredient_liquid"
      | "ingredient_dry"
      | "consumable"
      | "merchandise";
    title?: string | null;
    responsibleUserId?: number | null;
    note?: string | null;
  }) {
    const res = await api.post(
      `/inventory-audit/batches/${payload.batchId}/sheets`,
      {
        sheetType: payload.sheetType,
        title: payload.title ?? null,
        responsibleUserId: payload.responsibleUserId ?? null,
        note: payload.note ?? null,
      },
    );

    return res.data as {
      ok: boolean;
      sheet: InventorySheet;
      items: InventorySheetItem[];
    };
  },

  async getSheetDetail(sheetId: number) {
    const res = await api.get(`/inventory-audit/sheets/${sheetId}`);
    return res.data as {
      ok: boolean;
      sheet: InventorySheet;
      items: InventorySheetItem[];
      summary: {
        normal: number;
        audit: number;
        critical: number;
      };
    };
  },

  async saveSheetDraft(payload: {
    sheetId: number;
    note?: string | null;
    items: Array<{
      ingredientId: number;
      actualClosingQty: number | null;
      note?: string | null;
    }>;
  }) {
    const res = await api.post(
      `/inventory-audit/sheets/${payload.sheetId}/save-draft`,
      {
        note: payload.note ?? null,
        items: payload.items,
      },
    );

    return res.data as {
      ok: boolean;
      sheet: InventorySheet;
      items: InventorySheetItem[];
      summary: {
        normal: number;
        audit: number;
        critical: number;
      };
    };
  },

  async submitSheet(payload: {
    sheetId: number;
    note?: string | null;
    items: Array<{
      ingredientId: number;
      actualClosingQty: number | null;
      note?: string | null;
    }>;
  }) {
    const res = await api.post(
      `/inventory-audit/sheets/${payload.sheetId}/submit`,
      {
        note: payload.note ?? null,
        items: payload.items,
      },
    );

    return res.data as {
      ok: boolean;
      sheet: InventorySheet;
      items: InventorySheetItem[];
      summary: {
        normal: number;
        audit: number;
        critical: number;
      };
    };
  },

  async getBatchReport(batchId: number) {
    const res = await api.get(`/inventory-audit/batches/${batchId}/report`);
    return res.data as {
      ok: boolean;
      batch: InventoryBatch;
      sheets: Array<InventorySheet & { items: InventorySheetItem[] }>;
      summary: {
        totalSheets: number;
        totalLines: number;
        totalEstimatedValue: number;
        auditLines: number;
        criticalLines: number;
      };
    };
  },

  async submitBatch(batchId: number, note?: string | null) {
    const res = await api.post(`/inventory-audit/batches/${batchId}/submit`, {
      note: note ?? null,
    });
    return res.data as {
      ok: boolean;
      batch: InventoryBatch;
      sheets: InventorySheet[];
    };
  },

  async recallBatch(batchId: number, note?: string | null) {
    const res = await api.post(`/inventory-audit/batches/${batchId}/recall`, {
      note: note ?? null,
    });

    return res.data as {
      ok: boolean;
      batch: InventoryBatch;
      sheets: Array<InventorySheet & { items: InventorySheetItem[] }>;
      summary: {
        totalSheets: number;
        totalLines: number;
        totalEstimatedValue: number;
        auditLines: number;
        criticalLines: number;
      };
    };
  },

  async approveShiftLeader(batchId: number, note?: string | null) {
    const res = await api.post(
      `/inventory-audit/batches/${batchId}/approve-shift-leader`,
      {
        note: note ?? null,
      },
    );
    return res.data;
  },

  async approveStoreManager(batchId: number, note?: string | null) {
    const res = await api.post(
      `/inventory-audit/batches/${batchId}/approve-store-manager`,
      {
        note: note ?? null,
      },
    );
    return res.data;
  },

  async approveDm(batchId: number, note?: string | null) {
    const res = await api.post(
      `/inventory-audit/batches/${batchId}/approve-dm`,
      {
        note: note ?? null,
      },
    );
    return res.data;
  },

  async rejectBatch(batchId: number, note: string) {
    const res = await api.post(`/inventory-audit/batches/${batchId}/reject`, {
      note,
    });
    return res.data;
  },

  async getPendingDmSessions(storeId?: number) {
    const res = await api.get("/inventory-audit/sessions/pending-dm", {
      params: storeId ? { storeId } : undefined,
    });
    return res.data as {
      ok: boolean;
      sessions: Array<Record<string, unknown> & { store_name?: string }>;
    };
  },
};
