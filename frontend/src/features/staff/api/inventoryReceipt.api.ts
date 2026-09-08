import api from "../../../lib/http/axios";

export type InventoryReceipt = {
  id: number;
  code?: string | null;
  store_id: number;
  store_code?: string | null;
  store_name?: string | null;
  shift_id?: number | null;
  receipt_date: string;
  receipt_type: "purchase" | "manual_stock_in" | "warehouse_transfer" | "other" | string;
  supplier_name?: string | null;
  reference_no?: string | null;
  note?: string | null;
  status: string;
  created_by?: number;
  created_by_name?: string | null;
  submitted_by?: number | null;
  submitted_by_name?: string | null;
  shift_leader_approved_by?: number | null;
  shift_leader_approved_by_name?: string | null;
  store_manager_approved_by?: number | null;
  store_manager_approved_by_name?: string | null;
  stock_applied_by?: number | null;
  stock_applied_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  shift_leader_approved_at?: string | null;
  store_manager_approved_at?: string | null;
  rejected_at?: string | null;
  stock_applied_at?: string | null;
  rejection_note?: string | null;
  total_sheets?: number;
  total_lines?: number;
  total_received_qty_storage?: number;
  total_received_qty_usage?: number;
  total_estimated_value?: number;
};

export type InventoryReceiptSheet = {
  id: number;
  receipt_id: number;
  sheet_type: "bakery" | "ingredient_liquid" | "ingredient_dry" | "consumable" | "merchandise" | "other" | string;
  title: string;
  responsible_user_id?: number | null;
  responsible_user_name?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  submitted_by?: number | null;
  submitted_by_name?: string | null;
  status: "draft" | "submitted" | string;
  note?: string | null;
  submitted_at?: string | null;
  total_lines?: number;
  total_received_qty_storage?: number;
  total_received_qty_usage?: number;
  total_estimated_value?: number;
  store_id?: number;
  store_code?: string | null;
  store_name?: string | null;
  receipt_date?: string;
  shift_id?: number | null;
  receipt_type?: string;
};

export type InventoryReceiptItem = {
  id?: number;
  sheet_id?: number;
  receipt_id?: number;
  ingredient_id: number;
  ingredient_code: string;
  ingredient_name: string;
  category?: string | null;
  count_sheet_type?: string | null;
  storage_unit?: string | null;
  usage_unit?: string | null;
  conversion_ratio?: number | null;
  received_qty_storage: number;
  received_qty_usage: number;
  estimated_cost_per_storage_unit: number;
  estimated_line_total: number;
  note?: string | null;
};

export type ReceiptIngredient = {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  count_sheet_type?: string | null;
  storage_unit?: string | null;
  usage_unit?: string | null;
  conversion_ratio?: number | null;
  cost_per_storage_unit?: number | null;
};

export const inventoryReceiptApi = {
  getIngredients: (params?: { sheetType?: string }) =>
    api.get("/inventory-receipts/ingredients", { params }).then((r) => r.data as { ok: boolean; items: ReceiptIngredient[] }),

  openReceipt: (payload: {
    storeId: number;
    shiftId?: number | null;
    receiptDate: string;
    receiptType?: string;
    supplierName?: string | null;
    referenceNo?: string | null;
    note?: string | null;
  }) => api.post("/inventory-receipts/receipts/open", payload).then((r) => r.data as { ok: boolean; receipt: InventoryReceipt }),

  getCurrentReceipt: (params: { storeId: number; shiftId?: number | null; receiptDate: string }) =>
    api.get("/inventory-receipts/receipts/current", { params }).then((r) => r.data as {
      ok: boolean;
      data: null | { receipt: InventoryReceipt; sheets: InventoryReceiptSheet[] };
    }),

  getReceiptWorkspace: (params: { storeId: number; receiptDate: string; scope: "drafts" | "history" }) =>
    api.get("/inventory-receipts/receipts/workspace", { params }).then((r) => r.data as {
      ok: boolean;
      items: InventoryReceipt[];
    }),

  createSheet: (payload: { receiptId: number; sheetType: string; title?: string; responsibleUserId?: number | null }) =>
    api.post(`/inventory-receipts/receipts/${payload.receiptId}/sheets`, {
      sheetType: payload.sheetType,
      title: payload.title ?? null,
      responsibleUserId: payload.responsibleUserId ?? null,
    }).then((r) => r.data as { ok: boolean; sheet: InventoryReceiptSheet }),

  getSheetDetail: (sheetId: number) =>
    api.get(`/inventory-receipts/sheets/${sheetId}`).then((r) => r.data as {
      ok: boolean;
      sheet: InventoryReceiptSheet;
      items: InventoryReceiptItem[];
    }),

  saveDraftSheet: (payload: {
    sheetId: number;
    note?: string | null;
    items: Array<{ ingredientId: number; receivedQtyStorage: number | null; note?: string | null }>;
  }) => api.post(`/inventory-receipts/sheets/${payload.sheetId}/save-draft`, {
    note: payload.note ?? null,
    items: payload.items,
  }).then((r) => r.data as {
    ok: boolean;
    sheet: InventoryReceiptSheet;
    items: InventoryReceiptItem[];
  }),

  submitSheet: (payload: {
    sheetId: number;
    note?: string | null;
    items: Array<{ ingredientId: number; receivedQtyStorage: number | null; note?: string | null }>;
  }) => api.post(`/inventory-receipts/sheets/${payload.sheetId}/submit`, {
    note: payload.note ?? null,
    items: payload.items,
  }).then((r) => r.data as {
    ok: boolean;
    sheet: InventoryReceiptSheet;
    items: InventoryReceiptItem[];
  }),

  getReceiptReport: (receiptId: number) =>
    api.get(`/inventory-receipts/receipts/${receiptId}/report`).then((r) => r.data as {
      ok: boolean;
      receipt: InventoryReceipt;
      sheets: Array<InventoryReceiptSheet & { items: InventoryReceiptItem[] }>;
      summary: {
        totalSheets: number;
        totalLines: number;
        totalReceivedQtyStorage: number;
        totalEstimatedValue: number;
      };
    }),

  submitReceipt: (receiptId: number, note?: string | null) =>
    api.post(`/inventory-receipts/receipts/${receiptId}/submit`, { note: note ?? null }).then((r) => r.data),

  approveShiftLeader: (receiptId: number, note?: string | null) =>
    api.post(`/inventory-receipts/receipts/${receiptId}/approve-shift-leader`, { note: note ?? null }).then((r) => r.data),

  approveStoreManager: (receiptId: number, note?: string | null) =>
    api.post(`/inventory-receipts/receipts/${receiptId}/approve-store-manager`, { note: note ?? null }).then((r) => r.data),

  reject: (receiptId: number, note: string) =>
    api.post(`/inventory-receipts/receipts/${receiptId}/reject`, { note }).then((r) => r.data),

  search: (params: { storeId: number; receiptDate?: string; status?: string }) =>
    api.get("/inventory-receipts/receipts/search", { params }).then((r) => r.data as { ok: boolean; items: InventoryReceipt[] }),

  getPendingShiftLeader: (params: { storeId: number; receiptDate?: string }) =>
    api.get("/inventory-receipts/receipts/pending-shift-leader", { params }).then((r) => r.data as { ok: boolean; items: InventoryReceipt[] }),

  getPendingStoreManager: (params: { storeId: number; receiptDate?: string }) =>
    api.get("/inventory-receipts/receipts/pending-store-manager", { params }).then((r) => r.data as { ok: boolean; items: InventoryReceipt[] }),
};
