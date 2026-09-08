import { useEffect, useState } from "react";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  inventoryAuditApi,
  type InventoryBatch,
  type InventorySheet,
  type InventorySheetItem,
} from "../api/inventoryAudit.api";

function todayLocalYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtQty(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN") + " đ";
}

function getBatchStatusLabel(status?: string) {
  switch (String(status || "")) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca duyệt";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng duyệt";
    case "submitted_to_dm":
      return "Chờ DM duyệt";
    case "approved_final":
      return "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Bị trưởng ca trả lại";
    case "rejected_by_store_manager":
      return "Bị quản lý cửa hàng trả lại";
    case "rejected_by_dm":
      return "Bị DM trả lại";
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
      return type || "--";
  }
}

function getAuditLabel(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "Nghiêm trọng";
  if (s === "audit") return "Cần kiểm tra";
  return "Bình thường";
}

function getAuditBg(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "#dc2626";
  if (s === "audit") return "#d97706";
  return "#16a34a";
}

export default function InventoryShiftHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [workDate, setWorkDate] = useState(todayLocalYmd());
  const [items, setItems] = useState<InventoryBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [sheets, setSheets] = useState<Array<InventorySheet & { items: InventorySheetItem[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBatches() {
    if (!storeId) return;

    try {
      setLoading(true);
      setError("");
      const res = await inventoryAuditApi.searchBatches({
        storeId: Number(storeId),
        workDate,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được lịch sử kiểm hàng");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(batchId: number) {
    try {
      setLoading(true);
      setError("");
      const res = await inventoryAuditApi.getBatchReport(batchId);
      setSelectedBatch(res.batch);
      setSheets(res.sheets || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được chi tiết đợt kiểm");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBatches();
  }, [storeId, workDate]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Lịch sử kiểm hàng</h2>
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            Xem riêng các batch đã gửi / đã duyệt để không làm rối màn staff nhập tồn.
          </p>
        </div>

        <input
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
        />
      </div>

      {error ? (
        <div style={{ marginBottom: 16, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: 12, borderRadius: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Danh sách batch</div>
          {loading ? (
            <div>Đang tải...</div>
          ) : items.length === 0 ? (
            <div style={{ color: "#6b7280" }}>Không có batch nào cho ngày này</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((x) => (
                <button
                  key={Number(x.batch_id || x.id)}
                  type="button"
                  onClick={() => openDetail(Number(x.batch_id || x.id))}
                  style={{
                    textAlign: "left",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: selectedBatch && Number(selectedBatch.batch_id || selectedBatch.id) === Number(x.batch_id || x.id) ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    Phiếu tồn {x.work_date ? new Date(x.work_date).toLocaleDateString("vi-VN") : "--"} - Lần {x.cycle_no || 1}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{getBatchStatusLabel(x.status)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
          {!selectedBatch ? (
            <div style={{ color: "#6b7280" }}>Chọn một batch để xem chi tiết</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  Phiếu tồn {selectedBatch.work_date} - Lần {selectedBatch.cycle_no || 1}
                </div>
                <div style={{ marginTop: 8, color: "#6b7280" }}>
                  Trạng thái: {getBatchStatusLabel(selectedBatch.status)} | Quán: {selectedBatch.store_name || `Store #${selectedBatch.store_id}`}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {sheets.map((sheet) => (
                  <div key={sheet.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
                      <div style={{ fontWeight: 700 }}>{sheet.title}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        Loại: {getSheetTypeLabel(sheet.sheet_type)} • phụ trách: {sheet.responsible_user_name || "--"}
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
                        <thead>
                          <tr style={{ background: "#f9fafb" }}>
                            <th style={{ textAlign: "left", padding: 10 }}>Mã hàng</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Tên hàng</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Đơn vị</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Tồn đầu</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Dùng lý thuyết</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Tồn cuối lý thuyết</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Tồn thực tế</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Lệch</th>
                            <th style={{ textAlign: "right", padding: 10 }}>Giá trị</th>
                            <th style={{ textAlign: "center", padding: 10 }}>Cảnh báo</th>
                            <th style={{ textAlign: "left", padding: 10 }}>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sheet.items || []).map((item) => (
                            <tr key={item.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 10 }}>{item.ingredient_code}</td>
                              <td style={{ padding: 10 }}>{item.ingredient_name}</td>
                              <td style={{ padding: 10 }}>{item.usage_unit || "--"}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtQty(item.opening_qty)}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtQty(item.theoretical_used_qty)}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtQty(item.theoretical_closing_qty)}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtQty(item.actual_closing_qty)}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtQty(item.variance_qty)}</td>
                              <td style={{ padding: 10, textAlign: "right" }}>{fmtMoney(item.estimated_line_value)}</td>
                              <td style={{ padding: 10, textAlign: "center" }}>
                                <span style={{ background: getAuditBg(item.audit_status), color: "#fff", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>
                                  {getAuditLabel(item.audit_status)}
                                </span>
                              </td>
                              <td style={{ padding: 10 }}>{item.note || "--"}</td>
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
