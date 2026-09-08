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

function getBatchStatusLabel(status?: string) {
  switch (String(status || "")) {
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng";
    case "submitted_to_dm":
      return "Chờ DM duyệt";
    case "approved_final":
      return "Đã duyệt cuối";
    default:
      return status || "--";
  }
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

function getBatchDisplayName(batch?: InventoryBatch | null) {
  if (!batch) return "--";
  const storeCode = batch.store_code || "STORE";
  const dateText = batch.work_date
    ? new Date(batch.work_date).toLocaleDateString("vi-VN")
    : "--";
  return `Phiếu tồn ${dateText} - ${storeCode} - Lần ${batch.cycle_no || 1}`;
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

export default function ShiftLeaderInventoryApprovalPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [workDate, setWorkDate] = useState(todayLocalYmd());
  const [items, setItems] = useState<InventoryBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(
    null,
  );
  const [sheets, setSheets] = useState<
    Array<InventorySheet & { items: InventorySheetItem[] }>
  >([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadQueue() {
    if (!storeId) return;

    try {
      setLoading(true);
      setError("");
      const res = await inventoryAuditApi.getPendingShiftLeaderBatches({
        storeId: Number(storeId),
        workDate,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Không tải được hàng chờ trưởng ca",
      );
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
      setNote("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được chi tiết batch");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedBatch) return;
    try {
      setLoading(true);
      setError("");
      await inventoryAuditApi.approveShiftLeader(
        Number(selectedBatch.batch_id || selectedBatch.id),
        note || "",
      );
      setSelectedBatch(null);
      setSheets([]);
      setNote("");
      await loadQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không duyệt được batch");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedBatch) return;
    if (!note.trim()) {
      setError("Phải nhập lý do trả lại");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await inventoryAuditApi.rejectBatch(
        Number(selectedBatch.batch_id || selectedBatch.id),
        note.trim(),
      );
      setSelectedBatch(null);
      setSheets([]);
      setNote("");
      await loadQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không trả lại được batch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [storeId, workDate]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Xác nhận kiểm hàng - Trưởng ca</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          aria-label="Ngày làm việc"
        />
        <button onClick={loadQueue} disabled={loading}>
          Tải lại
        </button>
      </div>

      {error ? (
        <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>
      ) : null}

      <div
        style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Batch chờ xác nhận
          </div>
          {items.length === 0 ? (
            <div style={{ color: "#6b7280" }}>Không có batch nào đang chờ</div>
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
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {`Phiếu tồn ${x.work_date ? new Date(x.work_date).toLocaleDateString("vi-VN") : "--"} - ${x.store_code || "STORE"} - Lần ${x.cycle_no || 1}`}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {getBatchStatusLabel(x.status)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {!selectedBatch ? (
            <div style={{ color: "#6b7280" }}>
              Chọn một batch để xem chi tiết
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                {getBatchDisplayName(selectedBatch)}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú / lý do trả lại"
                style={{ width: "100%", minHeight: 90, marginBottom: 12 }}
              />

              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <button onClick={handleApprove} disabled={loading}>
                  Xác nhận batch
                </button>
                <button onClick={handleReject} disabled={loading}>
                  Trả lại batch
                </button>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #e5e7eb",
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{sheet.title}</div>
                      <div
                        style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}
                      >
                        {sheet.items?.length || 0} dòng • phụ trách:{" "}
                        {sheet.responsible_user_name || "--"}
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 900,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f9fafb" }}>
                            <th style={{ textAlign: "left", padding: 10 }}>
                              Mã hàng
                            </th>
                            <th style={{ textAlign: "left", padding: 10 }}>
                              Tên hàng
                            </th>
                            <th style={{ textAlign: "left", padding: 10 }}>
                              Đơn vị
                            </th>
                            <th style={{ textAlign: "right", padding: 10 }}>
                              Tồn thực tế
                            </th>
                            <th style={{ textAlign: "right", padding: 10 }}>
                              Lệch
                            </th>
                            <th style={{ textAlign: "right", padding: 10 }}>
                              Giá trị
                            </th>
                            <th style={{ textAlign: "center", padding: 10 }}>
                              Cảnh báo
                            </th>
                            <th style={{ textAlign: "left", padding: 10 }}>
                              Ghi chú
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sheet.items || []).map((item) => (
                            <tr
                              key={item.id}
                              style={{ borderTop: "1px solid #f1f5f9" }}
                            >
                              <td style={{ padding: 10 }}>
                                {item.ingredient_code}
                              </td>
                              <td style={{ padding: 10 }}>
                                {item.ingredient_name}
                              </td>
                              <td style={{ padding: 10 }}>
                                {item.storage_unit || item.usage_unit || "--"}
                              </td>
                              <td style={{ padding: 10, textAlign: "right" }}>
                                {fmtQty(item.actual_closing_qty)}
                              </td>
                              <td style={{ padding: 10, textAlign: "right" }}>
                                {fmtQty(item.variance_qty)}
                              </td>
                              <td style={{ padding: 10, textAlign: "right" }}>
                                {fmtMoney(item.estimated_line_value)}
                              </td>
                              <td style={{ padding: 10, textAlign: "center" }}>
                                <span
                                  style={{
                                    background: getAuditBg(item.audit_status),
                                    color: "#fff",
                                    borderRadius: 999,
                                    padding: "4px 8px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {getAuditLabel(item.audit_status)}
                                </span>
                              </td>
                              <td style={{ padding: 10 }}>
                                {item.note || "--"}
                              </td>
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
