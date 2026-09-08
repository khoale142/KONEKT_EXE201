import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore, type AuthStoreItem } from "../../../app/store/auth.store";
import {
  inventoryReceiptApi,
  type InventoryReceipt,
  type InventoryReceiptItem,
  type InventoryReceiptSheet,
} from "../../staff/api/inventoryReceipt.api";

type StoreOption = { id: number; code?: string; name: string };

function todayLocalYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeStoreOptions(rawStores?: AuthStoreItem[], storeIds?: number[], singleStoreId?: number, singleStoreName?: string) {
  const unique = new Map<number, StoreOption>();
  if (Array.isArray(rawStores)) {
    for (const item of rawStores) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      unique.set(id, { id, code: item?.code ? String(item.code).trim() : undefined, name: String(item?.name || "").trim() || `Store #${id}` });
    }
  }
  if (Array.isArray(storeIds)) {
    for (const rawId of storeIds) {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!unique.has(id)) unique.set(id, { id, name: `Store #${id}` });
    }
  }
  if (singleStoreId) {
    const id = Number(singleStoreId);
    if (!unique.has(id)) unique.set(id, { id, name: String(singleStoreName || "").trim() || `Store #${id}` });
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function getStoreDisplay(store: StoreOption) {
  return store.code ? `${store.name} (${store.code})` : store.name;
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN");
}

function fmtQty(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return `${n.toLocaleString("vi-VN")} đ`;
}

function fmtRate(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function getConvertedStockText(item: InventoryReceiptItem) {
  const usageQty = Number(item.received_qty_usage || 0);
  const usageUnit = item.usage_unit || "--";
  return `${fmtQty(usageQty)} ${usageUnit}`;
}

function getStorageText(item: InventoryReceiptItem) {
  const storageQty = Number(item.received_qty_storage || 0);
  const storageUnit = item.storage_unit || "--";
  return `${fmtQty(storageQty)} ${storageUnit}`;
}

function getConversionText(item: InventoryReceiptItem) {
  const ratio = Number(item.conversion_ratio || 0);
  if (!ratio || Number.isNaN(ratio)) return "--";
  const storageUnit = item.storage_unit || "đv kho";
  const usageUnit = item.usage_unit || "đv dùng";
  return `1 ${storageUnit} = ${fmtRate(ratio)} ${usageUnit}`;
}

function getReceiptStatusLabel(status?: string, stockAppliedAt?: string | null) {
  switch (String(status || "")) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca xác nhận";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng duyệt";
    case "approved_final":
      return stockAppliedAt
        ? "Đã duyệt cuối / đã cộng kho"
        : "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Bị trưởng ca trả lại";
    case "rejected_by_store_manager":
      return "Bị quản lý cửa hàng trả lại";
    case "cancelled":
      return "Đã hủy";
    default:
      return status || "--";
  }
}

function getReceiptTypeLabel(type?: string) {
  switch (String(type || "")) {
    case "purchase": return "Nhập từ NCC";
    case "manual_stock_in": return "Nhập bổ sung";
    case "warehouse_transfer": return "Nhập chuyển kho";
    case "other": return "Khác";
    default: return type || "--";
  }
}

export default function InventoryReceiptReportPage({ isEmbedded = false }: { isEmbedded?: boolean } = {}) {
  const user = useAuthStore((s) => s.user);
  const storeOptions = useMemo(() => normalizeStoreOptions(user?.stores, user?.storeIds, user?.storeId, user?.storeName), [user]);

  const [selectedStoreId, setSelectedStoreId] = useState<number | "">("");
  const [receiptDate, setReceiptDate] = useState(todayLocalYmd());
  const [statusFilter, setStatusFilter] = useState("approved_final");
  const [items, setItems] = useState<InventoryReceipt[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
  const [sheets, setSheets] = useState<Array<InventoryReceiptSheet & { items: InventoryReceiptItem[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (storeOptions.length === 1) setSelectedStoreId(storeOptions[0].id);
  }, [storeOptions]);

  useEffect(() => {
    if (!selectedStoreId) return;
    void loadReceipts();
  }, [selectedStoreId, receiptDate, statusFilter]);

  const selectedStore = useMemo(() => storeOptions.find((x) => Number(x.id) === Number(selectedStoreId)) || null, [storeOptions, selectedStoreId]);

  const summary = useMemo(() => ({
    totalReceipts: items.length,
    approvedCount: items.filter((x) => x.status === "approved_final").length,
    rejectedCount: items.filter((x) => String(x.status).startsWith("rejected_")).length,
    pendingCount: items.filter((x) => ["submitted_to_shift_leader", "submitted_to_store_manager"].includes(String(x.status))).length,
    totalLines: items.reduce((acc, x) => acc + Number(x.total_lines || 0), 0),
    totalEstimatedValue: items.reduce((acc, x) => acc + Number(x.total_estimated_value || 0), 0),
  }), [items]);

  async function loadReceipts() {
    if (!selectedStoreId) return;
    try {
      setLoading(true);
      setError("");
      const res = await inventoryReceiptApi.search({
        storeId: Number(selectedStoreId),
        receiptDate: receiptDate || undefined,
        status: statusFilter || undefined,
      });
      const next = Array.isArray(res.items) ? res.items : [];
      setItems(next);
      const nextId = next.find((x) => Number(x.id) === Number(selectedReceiptId))?.id ?? next[0]?.id ?? null;
      setSelectedReceiptId(nextId ? Number(nextId) : null);
      if (nextId) await openDetail(Number(nextId));
      else {
        setReceipt(null);
        setSheets([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được báo cáo nhập kho");
      setItems([]);
      setReceipt(null);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(receiptId: number) {
    try {
      setDetailLoading(true);
      setError("");
      const res = await inventoryReceiptApi.getReceiptReport(receiptId);
      setSelectedReceiptId(receiptId);
      setReceipt(res.receipt || null);
      setSheets(res.sheets || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được chi tiết phiếu nhập kho");
      setReceipt(null);
      setSheets([]);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div style={{ padding: isEmbedded ? 0 : 24 }}>
      {!isEmbedded && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Báo cáo nhập kho - DM</h1>
          <Link to="/office/dm" style={{ padding: "10px 14px", borderRadius: 10, textDecoration: "none", border: "1px solid #d9d9d9", color: "#333" }}>
            ← Về dashboard
          </Link>
        </div>
      )}

      <div className="cafe-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(3, minmax(180px, 1fr)) auto", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Quán</span>
            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Chọn quán</option>
              {storeOptions.map((store) => <option key={store.id} value={store.id}>{getStoreDisplay(store)}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Ngày nhập</span>
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Trạng thái</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="approved_final">Đã duyệt cuối</option>
              <option value="submitted_to_shift_leader">Chờ trưởng ca</option>
              <option value="submitted_to_store_manager">Chờ quản lý cửa hàng</option>
              <option value="rejected_by_shift_leader">Bị trưởng ca trả lại</option>
              <option value="rejected_by_store_manager">Bị quản lý cửa hàng trả lại</option>
              <option value="draft">Nháp</option>
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>Đang chọn</span>
            <div style={{ minHeight: 38, display: "flex", alignItems: "center" }}>{selectedStore ? getStoreDisplay(selectedStore) : "--"}</div>
          </div>
          <button onClick={() => void loadReceipts()} disabled={!selectedStoreId || loading}>{loading ? "Đang tải..." : "Tải báo cáo"}</button>
        </div>
      </div>

      {error ? <div className="cafe-card" style={{ padding: 12, marginBottom: 16, color: "#b91c1c" }}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="cafe-card" style={{ padding: 16 }}><div style={{ color: "#6b7280", marginBottom: 6 }}>Tổng số phiếu</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmtQty(summary.totalReceipts)}</div></div>
        <div className="cafe-card" style={{ padding: 16 }}><div style={{ color: "#6b7280", marginBottom: 6 }}>Tổng dòng hàng</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmtQty(summary.totalLines)}</div></div>
        <div className="cafe-card" style={{ padding: 16 }}><div style={{ color: "#6b7280", marginBottom: 6 }}>Đã duyệt cuối</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmtQty(summary.approvedCount)}</div></div>
        <div className="cafe-card" style={{ padding: 16 }}><div style={{ color: "#6b7280", marginBottom: 6 }}>Tổng giá trị dự kiến</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmtMoney(summary.totalEstimatedValue)}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>
        <div className="cafe-card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Danh sách phiếu</h3>
          <div style={{ color: "#6b7280", marginBottom: 12 }}>Đã duyệt: {summary.approvedCount} · Chờ xử lý: {summary.pendingCount} · Bị trả: {summary.rejectedCount}</div>
          {items.length === 0 ? <div style={{ color: "#6b7280" }}>Không có phiếu nào khớp bộ lọc.</div> : items.map((x) => {
            const active = Number(x.id) === Number(selectedReceiptId);
            return (
              <button key={x.id} onClick={() => void openDetail(Number(x.id))} style={{ width: "100%", textAlign: "left", border: `1px solid ${active ? "#6366f1" : "#e5e7eb"}`, background: active ? "#eef2ff" : "#fff", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{x.code || `Receipt #${x.id}`}</div>
                <div style={{ color: "#6b7280" }}>{getReceiptTypeLabel(x.receipt_type)}</div>
                <div style={{ color: "#6b7280" }}>{getReceiptStatusLabel(x.status, x.stock_applied_at)}</div>
                <div style={{ color: "#6b7280" }}>{fmtMoney(x.total_estimated_value)}</div>
              </button>
            );
          })}
        </div>

        <div className="cafe-card" style={{ padding: 16 }}>
          {!receipt ? <div style={{ color: "#6b7280" }}>{detailLoading ? "Đang tải..." : "Chọn phiếu để xem chi tiết."}</div> : (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 12 }}>{receipt.code || `Receipt #${receipt.id}`}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
                <div><strong>Quán:</strong> {receipt.store_name || `Store #${receipt.store_id}`}</div>
                <div><strong>Ngày nhập:</strong> {formatDate(receipt.receipt_date)}</div>
                <div><strong>Loại nhập:</strong> {getReceiptTypeLabel(receipt.receipt_type)}</div>
                <div><strong>Trạng thái:</strong> {getReceiptStatusLabel(receipt.status, receipt.stock_applied_at)}</div>
                <div><strong>Nhà cung cấp:</strong> {receipt.supplier_name || "--"}</div>
                <div><strong>Số chứng từ:</strong> {receipt.reference_no || "--"}</div>
                <div><strong>Người tạo:</strong> {receipt.created_by_name || "--"}</div>
                <div><strong>Người submit:</strong> {receipt.submitted_by_name || "--"}</div>
                <div><strong>Trưởng ca xác nhận:</strong> {receipt.shift_leader_approved_by_name || "--"}</div>
                <div><strong>Store Manager duyệt:</strong> {receipt.store_manager_approved_by_name || "--"}</div>
                <div><strong>SM duyệt lúc:</strong> {formatDateTime(receipt.store_manager_approved_at)}</div>
                <div><strong>Cộng kho lúc:</strong> {formatDateTime(receipt.stock_applied_at)}</div>
                <div><strong>Tổng giá trị:</strong> {fmtMoney(receipt.total_estimated_value)}</div>
              </div>

              {receipt.status === "approved_final" ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    borderRadius: 10,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1e3a8a",
                    lineHeight: 1.6,
                  }}
                >
                  Phiếu nhập đã cộng kho. Hệ thống cộng vào tồn theo <strong>số lượng quy đổi</strong> (
                  <code>received_qty_usage</code> / đơn vị sử dụng), không cộng trực tiếp theo số lượng nhập kho
                  ban đầu (<code>received_qty_storage</code>).
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 16 }}>
                {sheets.map((sheet) => (
                  <div key={sheet.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                      <strong>{sheet.title}</strong>
                      <div style={{ color: "#6b7280" }}>{sheet.total_lines || 0} dòng · {fmtMoney(sheet.total_estimated_value)}</div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 10 }}>Mã</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Tên</th>
                            <th style={{ textAlign: "left", padding: 10 }}>SL nhập kho</th>
                            <th style={{ textAlign: "left", padding: 10 }}>SL quy đổi cộng tồn</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Quy đổi</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Giá trị</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.items.map((item) => (
                            <tr key={item.ingredient_id}>
                              <td style={{ padding: 10 }}>{item.ingredient_code}</td>
                              <td style={{ padding: 10 }}>{item.ingredient_name}</td>
                              <td style={{ padding: 10 }}>{getStorageText(item)}</td>
                              <td style={{ padding: 10 }}>{getConvertedStockText(item)}</td>
                              <td style={{ padding: 10 }}>{getConversionText(item)}</td>
                              <td style={{ padding: 10 }}>{fmtMoney(item.estimated_line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}