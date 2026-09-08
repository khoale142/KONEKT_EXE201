import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  inventoryReceiptApi,
  type InventoryReceipt,
  type InventoryReceiptItem,
  type InventoryReceiptSheet,
} from "../api/inventoryReceipt.api";

function todayLocalYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftLeaderInventoryReceiptApprovalPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;
  const [receiptDate, setReceiptDate] = useState(todayLocalYmd());
  const [items, setItems] = useState<InventoryReceipt[]>([]);
  const [selected, setSelected] = useState<InventoryReceipt | null>(null);
  const [sheets, setSheets] = useState<Array<InventoryReceiptSheet & { items: InventoryReceiptItem[] }>>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void loadQueue(); }, [storeId, receiptDate]);

  async function loadQueue() {
    if (!storeId) return;
    try {
      setError("");
      const res = await inventoryReceiptApi.getPendingShiftLeader({ storeId: Number(storeId), receiptDate });
      setItems(Array.isArray(res.items) ? res.items : []);
      if (res.items?.length) {
        await openDetail(Number(res.items[0].id));
      } else {
        setSelected(null);
        setSheets([]);
        setSelectedSheetId(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được phiếu chờ trưởng ca");
    }
  }

  async function openDetail(id: number) {
    try {
      const res = await inventoryReceiptApi.getReceiptReport(id);
      setSelected(res.receipt);
      setSheets(res.sheets || []);
      setSelectedSheetId(res.sheets?.[0]?.id ?? null);
      setNote("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được chi tiết phiếu");
    }
  }

  async function handleApprove() {
    if (!selected) return;
    try {
      await inventoryReceiptApi.approveShiftLeader(Number(selected.id), note || null);
      await loadQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không xác nhận được phiếu");
    }
  }

  async function handleReject() {
    if (!selected || !note.trim()) return;
    try {
      await inventoryReceiptApi.reject(Number(selected.id), note.trim());
      await loadQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không trả lại được phiếu");
    }
  }

  const selectedSheet = sheets.find((x) => Number(x.id) === Number(selectedSheetId)) || null;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Xác nhận nhập kho - Trưởng ca</h1>
        <Link to="/store/staff" style={{ padding: "10px 14px", borderRadius: 10, textDecoration: "none", border: "1px solid #d9d9d9", color: "#333" }}>
          ← Về dashboard
        </Link>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        <button onClick={() => void loadQueue()}>Tải lại</button>
      </div>
      {error ? <div style={{ color: "red" }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        <div>
          <h3>Phiếu chờ xác nhận</h3>
          {items.map((x) => (
            <button key={x.id} onClick={() => void openDetail(Number(x.id))} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: 10, borderRadius: 10, border: "1px solid #ddd", background: Number(selected?.id) === Number(x.id) ? "#eef2ff" : "#fff" }}>
              <strong>{x.code || `Receipt #${x.id}`}</strong>
              <div>{x.supplier_name || "--"}</div>
            </button>
          ))}
        </div>
        <div>
          {selected ? (
            <>
              <h3>{selected.code}</h3>
              <div>Nhà cung cấp: {selected.supplier_name || "--"}</div>
              <div>Số chứng từ: {selected.reference_no || "--"}</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú / lý do trả lại" style={{ width: "100%", minHeight: 80, margin: "12px 0" }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => void handleApprove()}>Xác nhận phiếu</button>
                <button onClick={() => void handleReject()}>Trả lại phiếu</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {sheets.map((sheet) => (
                  <button key={sheet.id} onClick={() => setSelectedSheetId(Number(sheet.id))} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: Number(selectedSheetId) === Number(sheet.id) ? "#eef2ff" : "#fff" }}>
                    <strong>{sheet.title}</strong>
                    <div>{sheet.total_lines || 0} dòng</div>
                  </button>
                ))}
              </div>
              {selectedSheet ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên</th>
                      <th>SL nhập</th>
                      <th>Quy đổi</th>
                      <th>Cộng kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSheet.items.map((x) => (
                      <tr key={x.ingredient_id}>
                        <td>{x.ingredient_code}</td>
                        <td>{x.ingredient_name}</td>
                        <td>{x.received_qty_storage} {x.storage_unit || ""}</td>
                        <td>1 {x.storage_unit || ""} = {x.conversion_ratio || 1} {x.usage_unit || ""}</td>
                        <td>{x.received_qty_usage} {x.usage_unit || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
