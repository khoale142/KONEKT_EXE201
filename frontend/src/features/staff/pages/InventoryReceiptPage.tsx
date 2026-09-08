import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  inventoryReceiptApi,
  type InventoryReceipt,
  type InventoryReceiptItem,
  type InventoryReceiptSheet,
  type ReceiptIngredient,
} from "../api/inventoryReceipt.api";

function todayLocalYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getReceiptStatusLabel(status?: string) {
  switch (String(status || "")) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca xác nhận";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng duyệt";
    case "approved_final":
      return "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Bị trưởng ca trả lại";
    case "rejected_by_store_manager":
      return "Bị quản lý cửa hàng trả lại";
    default:
      return status || "--";
  }
}

function getSheetTypeLabel(type?: string) {
  switch (String(type || "")) {
    case "bakery":
      return "Bánh";
    case "ingredient_liquid":
      return "Nguyên liệu nước";
    case "ingredient_dry":
      return "Nguyên liệu khô / topping";
    case "consumable":
      return "Vật phẩm tiêu hao";
    case "merchandise":
      return "Merchandise";
    default:
      return "Khác";
  }
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return `${n.toLocaleString("vi-VN")} đ`;
}

type DraftRow = {
  receivedQtyStorage: string;
  note: string;
};

type SheetDraftMap = Record<number, Record<number, DraftRow>>;

const ALL_SHEET_TYPES = ["bakery", "ingredient_liquid", "ingredient_dry", "consumable", "merchandise", "other"] as const;

function canEditReceipt(status?: string) {
  return ["draft", "rejected_by_shift_leader", "rejected_by_store_manager"].includes(String(status || ""));
}

function canSubmitReceipt(status?: string) {
  return canEditReceipt(status);
}

export default function InventoryReceiptPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [receiptDate, setReceiptDate] = useState(todayLocalYmd());
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
  const [sheets, setSheets] = useState<InventoryReceiptSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<InventoryReceiptSheet | null>(null);
  const [ingredients, setIngredients] = useState<ReceiptIngredient[]>([]);
  const [items, setItems] = useState<InventoryReceiptItem[]>([]);
  const [draftMap, setDraftMap] = useState<SheetDraftMap>({});
  const [workspaceDrafts, setWorkspaceDrafts] = useState<InventoryReceipt[]>([]);
  const [workspaceHistory, setWorkspaceHistory] = useState<InventoryReceipt[]>([]);
  const [keyword, setKeyword] = useState("");
  const [receiptType, setReceiptType] = useState("purchase");
  const [supplierName, setSupplierName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [sheetNote, setSheetNote] = useState("");
  const [newSheetType, setNewSheetType] = useState<string>("ingredient_liquid");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState("");

  const availableSheetTypes = useMemo(() => {
    const existing = new Set(sheets.map((x) => String(x.sheet_type || "other")));
    return ALL_SHEET_TYPES.filter((x) => !existing.has(String(x)));
  }, [sheets]);

  const filteredIngredients = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((x) => [x.code, x.name, x.category, x.count_sheet_type].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [ingredients, keyword]);

  const submittedSheets = useMemo(
    () => sheets.filter((x) => String(x.status || "") === "submitted"),
    [sheets],
  );

  const hasAtLeastOneSubmittedSheet = submittedSheets.length > 0;

  function getItemDraft(sheetId: number | null | undefined, ingredientId: number) {
    if (!sheetId) return undefined;
    return draftMap[Number(sheetId)]?.[Number(ingredientId)];
  }

  function syncSheetDraftFromItems(sheetId: number, nextItems: InventoryReceiptItem[]) {
    setDraftMap((prev) => {
      const current = { ...(prev[Number(sheetId)] || {}) };
      for (const item of nextItems) {
        current[Number(item.ingredient_id)] = {
          receivedQtyStorage: item.received_qty_storage == null ? "" : String(item.received_qty_storage),
          note: item.note || "",
        };
      }
      return { ...prev, [Number(sheetId)]: current };
    });
  }

  useEffect(() => {
    void loadCurrent();
  }, [storeId, receiptDate]);

  useEffect(() => {
    void loadWorkspace();
  }, [storeId, receiptDate]);

  useEffect(() => {
    if (availableSheetTypes.length > 0 && !availableSheetTypes.includes(newSheetType as any)) {
      setNewSheetType(String(availableSheetTypes[0]));
    }
  }, [availableSheetTypes, newSheetType]);

  async function loadWorkspace() {
    if (!storeId) return;
    try {
      setWorkspaceLoading(true);
      const [draftsRes, historyRes] = await Promise.all([
        inventoryReceiptApi.getReceiptWorkspace({ storeId: Number(storeId), receiptDate, scope: "drafts" }),
        inventoryReceiptApi.getReceiptWorkspace({ storeId: Number(storeId), receiptDate, scope: "history" }),
      ]);
      setWorkspaceDrafts(Array.isArray(draftsRes.items) ? draftsRes.items : []);
      setWorkspaceHistory(Array.isArray(historyRes.items) ? historyRes.items : []);
    } catch (err) {
      console.error(err);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function loadCurrent() {
    if (!storeId) return;
    try {
      setLoading(true);
      setError("");
      const res = await inventoryReceiptApi.getCurrentReceipt({ storeId: Number(storeId), receiptDate });
      if (!res.data) {
        setReceipt(null);
        setSheets([]);
        setSelectedSheet(null);
        setSelectedSheetId(null);
        setIngredients([]);
        setItems([]);
        setDraftMap({});
        setReceiptType("purchase");
        setSupplierName("");
        setReferenceNo("");
        setReceiptNote("");
        setSheetNote("");
        setKeyword("");
        return;
      }

      setReceipt(res.data.receipt);
      setSheets(res.data.sheets || []);
      setReceiptType(res.data.receipt.receipt_type || "purchase");
      setSupplierName(res.data.receipt.supplier_name || "");
      setReferenceNo(res.data.receipt.reference_no || "");
      setReceiptNote(res.data.receipt.note || "");

      const nextSheetId = res.data.sheets?.find((x) => Number(x.id) === Number(selectedSheetId))?.id ?? res.data.sheets?.[0]?.id ?? null;
      if (nextSheetId) await loadSheetDetail(Number(nextSheetId));
      else {
        setSelectedSheet(null);
        setSelectedSheetId(null);
        setIngredients([]);
        setItems([]);
        setDraftMap({});
        setSheetNote("");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được phiếu nhập kho");
    } finally {
      setLoading(false);
    }
  }

  async function loadSheetDetail(sheetId: number) {
    try {
      const res = await inventoryReceiptApi.getSheetDetail(sheetId);
      setSelectedSheetId(sheetId);
      setSelectedSheet(res.sheet);
      setItems(Array.isArray(res.items) ? res.items : []);
      setSheetNote(res.sheet.note || "");
      syncSheetDraftFromItems(sheetId, Array.isArray(res.items) ? res.items : []);
      const ingRes = await inventoryReceiptApi.getIngredients({ sheetType: String(res.sheet.sheet_type || "other") });
      setIngredients(Array.isArray(ingRes.items) ? ingRes.items : []);
      setKeyword("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được phiếu con nhập kho");
    }
  }

  async function openExistingReceipt(id: number) {
    try {
      setLoading(true);
      setError("");
      const res = await inventoryReceiptApi.getReceiptReport(id);
      setReceipt(res.receipt);
      setSheets(res.sheets.map(({ items: _items, ...sheet }) => sheet));
      setReceiptDate(res.receipt.receipt_date);
      setReceiptType(res.receipt.receipt_type || "purchase");
      setSupplierName(res.receipt.supplier_name || "");
      setReferenceNo(res.receipt.reference_no || "");
      setReceiptNote(res.receipt.note || "");
      const first = res.sheets[0];
      if (first) {
        setSelectedSheet(first);
        setSelectedSheetId(Number(first.id));
        setItems(first.items || []);
        setSheetNote(first.note || "");
        syncSheetDraftFromItems(Number(first.id), first.items || []);
        const ingRes = await inventoryReceiptApi.getIngredients({ sheetType: String(first.sheet_type || "other") });
        setIngredients(Array.isArray(ingRes.items) ? ingRes.items : []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không mở được phiếu nhập kho");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenReceipt() {
    if (!storeId) return;
    try {
      setLoading(true);
      setError("");
      await inventoryReceiptApi.openReceipt({
        storeId: Number(storeId),
        receiptDate,
        receiptType,
        supplierName: supplierName || null,
        referenceNo: referenceNo || null,
        note: receiptNote || null,
      });
      await loadCurrent();
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không mở được phiếu nhập kho");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSheet() {
    if (!receipt?.id || !newSheetType) return;
    try {
      setSaving(true);
      setError("");
      const res = await inventoryReceiptApi.createSheet({
        receiptId: Number(receipt.id),
        sheetType: newSheetType,
      });
      const next = res.sheet;
      setSheets((prev) => [next, ...prev.filter((x) => Number(x.id) !== Number(next.id))]);
      await loadSheetDetail(Number(next.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tạo được phiếu con nhập kho");
    } finally {
      setSaving(false);
    }
  }

  function upsertDraft(ingredient: ReceiptIngredient, receivedQtyStorageRaw: string) {
    if (!selectedSheetId) return;
    setDraftMap((prev) => {
      const current = { ...(prev[Number(selectedSheetId)] || {}) };
      const existing = current[Number(ingredient.id)] || { receivedQtyStorage: "", note: "" };
      current[Number(ingredient.id)] = { ...existing, receivedQtyStorage: receivedQtyStorageRaw };
      return { ...prev, [Number(selectedSheetId)]: current };
    });
  }

  const rowsPreview = useMemo(() => {
    if (!selectedSheetId) return [] as InventoryReceiptItem[];
    return ingredients
      .map((ing) => {
        const draft = getItemDraft(selectedSheetId, Number(ing.id));
        const existing = items.find((x) => Number(x.ingredient_id) === Number(ing.id));
        const storageQty = draft?.receivedQtyStorage != null && draft.receivedQtyStorage !== "" ? Number(draft.receivedQtyStorage) : Number(existing?.received_qty_storage || 0);
        const ratio = Number(ing.conversion_ratio || existing?.conversion_ratio || 1);
        return {
          ingredient_id: Number(ing.id),
          ingredient_name: ing.name,
          storage_unit: ing.storage_unit || null,
          usage_unit: ing.usage_unit || null,
          conversion_ratio: ratio,
          received_qty_storage: storageQty,
          received_qty_usage: storageQty * ratio,
          estimated_line_total: storageQty * Number(ing.cost_per_storage_unit || 0),
        } as InventoryReceiptItem;
      })
      .filter((x) => Number(x.received_qty_storage || 0) > 0);
  }, [ingredients, items, draftMap, selectedSheetId]);

  async function handleSaveDraft() {
    if (!selectedSheetId) return;
    try {
      setSaving(true);
      setError("");
      const payloadItems = ingredients.map((ing) => {
        const draft = getItemDraft(selectedSheetId, Number(ing.id));
        const existing = items.find((x) => Number(x.ingredient_id) === Number(ing.id));
        return {
          ingredientId: Number(ing.id),
          receivedQtyStorage:
            draft?.receivedQtyStorage == null || draft.receivedQtyStorage === ""
              ? Number(existing?.received_qty_storage || 0)
              : Number(draft.receivedQtyStorage),
          note: draft?.note || existing?.note || null,
        };
      }).filter((x) => Number(x.receivedQtyStorage || 0) > 0);

      await inventoryReceiptApi.saveDraftSheet({
        sheetId: Number(selectedSheetId),
        note: sheetNote || null,
        items: payloadItems,
      });
      await loadCurrent();
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không lưu được nháp phiếu nhập");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitSheet() {
    if (!selectedSheetId) return;
    try {
      setSaving(true);
      setError("");
      const payloadItems = ingredients.map((ing) => {
        const draft = getItemDraft(selectedSheetId, Number(ing.id));
        const existing = items.find((x) => Number(x.ingredient_id) === Number(ing.id));
        return {
          ingredientId: Number(ing.id),
          receivedQtyStorage:
            draft?.receivedQtyStorage == null || draft.receivedQtyStorage === ""
              ? Number(existing?.received_qty_storage || 0)
              : Number(draft.receivedQtyStorage),
          note: draft?.note || existing?.note || null,
        };
      }).filter((x) => Number(x.receivedQtyStorage || 0) > 0);

      await inventoryReceiptApi.submitSheet({
        sheetId: Number(selectedSheetId),
        note: sheetNote || null,
        items: payloadItems,
      });
      await loadCurrent();
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không submit được phiếu con nhập kho");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitReceipt() {
    if (!receipt?.id) return;
    try {
      setSaving(true);
      setError("");
      await inventoryReceiptApi.submitReceipt(Number(receipt.id), receiptNote || null);
      await loadCurrent();
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không gửi được phiếu nhập kho cho trưởng ca");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Phiếu nhập kho</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/store/staff" style={{ padding: "10px 14px", borderRadius: 10, textDecoration: "none", border: "1px solid #d9d9d9", color: "#333" }}>
            ← Về dashboard
          </Link>
          <Link to="/store/staff/inventory-history" style={{ padding: "10px 14px", borderRadius: 10, textDecoration: "none", border: "1px solid #d9d9d9", color: "#333" }}>
            Lịch sử kiểm hàng
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        <button onClick={() => void loadCurrent()}>Tải lại</button>
        {!receipt ? <button onClick={() => void handleOpenReceipt()} disabled={loading}>Mở phiếu nhập kho</button> : null}
      </div>

      {error ? <div style={{ color: "red", marginBottom: 12 }}>{error}</div> : null}
      {loading ? <div>Đang tải...</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="cafe-card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Workspace nhập kho</h3>
            {workspaceLoading ? <div>Đang tải...</div> : null}
            <div style={{ marginBottom: 12 }}>
              <strong>Phiếu nháp / bị trả</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {workspaceDrafts.length === 0 ? <div style={{ color: "#666" }}>Không có phiếu nháp</div> : workspaceDrafts.map((x) => (
                  <button key={x.id} onClick={() => void openExistingReceipt(Number(x.id))} style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: Number(receipt?.id) === Number(x.id) ? "#eef2ff" : "#fff" }}>
                    <strong>{x.code || `Receipt #${x.id}`}</strong>
                    <div>{getReceiptStatusLabel(x.status)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <strong>Lịch sử hôm nay</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {workspaceHistory.length === 0 ? <div style={{ color: "#666" }}>Chưa có lịch sử</div> : workspaceHistory.map((x) => (
                  <button key={x.id} onClick={() => void openExistingReceipt(Number(x.id))} style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: Number(receipt?.id) === Number(x.id) ? "#eef2ff" : "#fff" }}>
                    <strong>{x.code || `Receipt #${x.id}`}</strong>
                    <div>{getReceiptStatusLabel(x.status)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          {!receipt ? (
            <div className="cafe-card" style={{ padding: 16 }}>
              Chọn ngày rồi bấm <strong>Mở phiếu nhập kho</strong> để bắt đầu.
            </div>
          ) : (
            <>
              <div className="cafe-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
                  <input value={receipt.code || ""} readOnly placeholder="Mã phiếu" />
                  <select value={receiptType} onChange={(e) => setReceiptType(e.target.value)} disabled={!canEditReceipt(receipt.status)}>
                    <option value="purchase">Nhập từ NCC</option>
                    <option value="manual_stock_in">Nhập bổ sung</option>
                    <option value="warehouse_transfer">Nhập chuyển kho</option>
                    <option value="other">Khác</option>
                  </select>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nhà cung cấp" disabled={!canEditReceipt(receipt.status)} />
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Số chứng từ" disabled={!canEditReceipt(receipt.status)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
                  <textarea value={receiptNote} onChange={(e) => setReceiptNote(e.target.value)} placeholder="Ghi chú phiếu nhập" style={{ width: "100%", minHeight: 78 }} disabled={!canEditReceipt(receipt.status)} />
                  <div>
                    <div><strong>Trạng thái:</strong> {getReceiptStatusLabel(receipt.status)}</div>
                    <div><strong>Tổng phiếu con:</strong> {sheets.length}</div>
                    <div><strong>Tổng giá trị:</strong> {fmtMoney(receipt.total_estimated_value)}</div>
                  </div>
                </div>
              </div>

              <div className="cafe-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Phiếu con nhập kho</h3>
                  {canEditReceipt(receipt.status) ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <select value={newSheetType} onChange={(e) => setNewSheetType(e.target.value)} disabled={availableSheetTypes.length === 0}>
                        {availableSheetTypes.map((x) => <option key={x} value={x}>{getSheetTypeLabel(x)}</option>)}
                      </select>
                      <button onClick={() => void handleCreateSheet()} disabled={saving || availableSheetTypes.length === 0}>
                        Tạo phiếu con
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      onClick={() => void loadSheetDetail(Number(sheet.id))}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #d9d9d9",
                        background: Number(selectedSheetId) === Number(sheet.id) ? "#eef2ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <strong>{sheet.title}</strong>
                      <div>{sheet.status === "submitted" ? "Đã submit" : "Đang nhập nháp"}</div>
                    </button>
                  ))}
                </div>

                {selectedSheet ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                      <div>
                        <strong>{selectedSheet.title}</strong>
                        <div style={{ color: "#666" }}>{getSheetTypeLabel(selectedSheet.sheet_type)} · {selectedSheet.status === "submitted" ? "Đã submit" : "Nháp"}</div>
                        {ingredients.length === 0 ? (
                          <div style={{ color: "#9a3412", marginTop: 6 }}>
                            Nhóm này chưa có mặt hàng master, có thể để nháp và bỏ qua, không bắt buộc submit.
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {canEditReceipt(receipt.status) ? (
                          <>
                            <button disabled={saving || selectedSheet.status === "submitted"} onClick={() => void handleSaveDraft()}>Lưu nháp phiếu con</button>
                            <button disabled={saving || selectedSheet.status === "submitted" || rowsPreview.length === 0} onClick={() => void handleSubmitSheet()}>Submit phiếu con</button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <textarea value={sheetNote} onChange={(e) => setSheetNote(e.target.value)} placeholder="Ghi chú phiếu con" style={{ width: "100%", minHeight: 72, marginBottom: 12 }} disabled={!canEditReceipt(receipt.status) || selectedSheet.status === "submitted"} />

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                      <div>
                        <h4 style={{ marginTop: 0 }}>Danh sách hàng theo phiếu</h4>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm nguyên liệu" style={{ width: "100%", marginBottom: 8 }} />
                        {ingredients.length === 0 ? (
                          <div style={{ marginBottom: 8, padding: 10, borderRadius: 8, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412" }}>
                            Chưa có mặt hàng nào thuộc nhóm này trong master data. Không cần nhập và cũng không bắt buộc submit phiếu này.
                          </div>
                        ) : null}
                        <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th>Mã</th>
                                <th>Tên</th>
                                <th>Đơn vị nhập</th>
                                <th>Số lượng</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredIngredients.map((ing) => {
                                const draft = getItemDraft(selectedSheetId, Number(ing.id));
                                const existing = items.find((x) => Number(x.ingredient_id) === Number(ing.id));
                                return (
                                  <tr key={ing.id}>
                                    <td>{ing.code}</td>
                                    <td>{ing.name}</td>
                                    <td>{ing.storage_unit || ing.usage_unit || "--"}</td>
                                    <td>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={draft?.receivedQtyStorage ?? (existing?.received_qty_storage == null ? "" : String(existing.received_qty_storage))}
                                        onChange={(e) => upsertDraft(ing, e.target.value)}
                                        disabled={!canEditReceipt(receipt.status) || selectedSheet.status === "submitted"}
                                        style={{ width: 110 }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ marginTop: 0 }}>Dòng đã nhập</h4>
                        <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th>Tên hàng</th>
                                <th>SL nhập</th>
                                <th>Quy đổi</th>
                                <th>Cộng kho</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rowsPreview.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: "center", color: "#666" }}>Chưa có dòng nhập nào</td>
                                </tr>
                              ) : rowsPreview.map((x) => (
                                <tr key={x.ingredient_id}>
                                  <td>{x.ingredient_name}</td>
                                  <td>{x.received_qty_storage} {x.storage_unit || ""}</td>
                                  <td>1 {x.storage_unit || ""} = {x.conversion_ratio || 1} {x.usage_unit || ""}</td>
                                  <td>{x.received_qty_usage} {x.usage_unit || ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#666" }}>Chưa có phiếu con nào. Hãy tạo phiếu con theo nhóm hàng để nhập dễ hơn.</div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: "#666" }}>
                  Chỉ những phiếu con có hàng về thực tế mới cần submit. Các phiếu chưa có hàng hoặc chưa có master data có thể giữ ở trạng thái nháp.
                  <div style={{ marginTop: 6 }}>
                    Đã submit: <strong>{submittedSheets.length}</strong> / {sheets.length} phiếu con.
                  </div>
                </div>
                <button disabled={saving || !canSubmitReceipt(receipt.status) || !hasAtLeastOneSubmittedSheet} onClick={() => void handleSubmitReceipt()}>
                  Gửi trưởng ca xác nhận
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
