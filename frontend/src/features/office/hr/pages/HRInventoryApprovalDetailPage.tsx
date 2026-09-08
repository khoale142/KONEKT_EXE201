import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchBatchReportForHr,
  approveHrInventoryFinal,
  rejectHrInventoryBatch,
} from "../api/hrInventory.api";
import type {
  InventoryBatch,
  InventorySheet,
  InventorySheetItem,
} from "../../../staff/api/inventoryAudit.api";
import { batchStatusLabelHr } from "../utils/inventoryLabels";
import HrPageHeader from "../components/HrPageHeader";
import InventoryBatchSheetsPanel from "../components/InventoryBatchSheetsPanel";

function batchTitle(b: InventoryBatch | null) {
  if (!b) return "—";
  return `Đợt ${b.work_date} · ${b.store_name || `Store #${b.store_id}`} · lần ${b.cycle_no ?? "—"}`;
}

export default function HRInventoryApprovalDetailPage() {
  const { id } = useParams();
  const batchId = Number(id);

  const [batch, setBatch] = useState<InventoryBatch | null>(null);
  const [sheets, setSheets] = useState<
    Array<InventorySheet & { items: InventorySheetItem[] }>
  >([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!Number.isFinite(batchId) || batchId <= 0) {
      setError("ID đợt kiểm không hợp lệ");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await fetchBatchReportForHr(batchId);
      setBatch(res.batch);
      setSheets(res.sheets || []);
      setNote(res.batch?.note || "");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg || "Không tải được chi tiết đợt kiểm");
      setBatch(null);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [batchId]);

  const canAct = batch?.status === "submitted_to_dm";

  async function handleApprove() {
    if (!batch) return;
    const bid = Number(batch.batch_id || batch.id);
    try {
      setLoading(true);
      setError("");
      await approveHrInventoryFinal(bid, note || null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg || "Không duyệt được");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!batch) return;
    if (!note.trim()) {
      setError("Vui lòng nhập lý do từ chối / trả lại.");
      return;
    }
    const bid = Number(batch.batch_id || batch.id);
    try {
      setLoading(true);
      setError("");
      await rejectHrInventoryBatch(bid, note.trim());
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg || "Không từ chối được");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/office/hr/inventory-approvals" style={{ color: "#3182ce", fontWeight: 600 }}>
          ← Quay lại hàng chờ
        </Link>
      </div>

      <HrPageHeader
        title={batch ? batchTitle(batch) : "Chi tiết đợt kiểm kê"}
        description="Xem phiếu, chênh lệch và ghi chú. Duyệt cuối hoặc từ chối khi đợt đang ở trạng thái chờ HR."
      />

      {loading && !batch ? <p>Đang tải…</p> : null}
      {error ? <p style={{ color: "#c53030", marginBottom: 12 }}>{error}</p> : null}

      {batch ? (
        <>
          <div
            style={{
              padding: 16,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              <div>
                <strong>Trạng thái:</strong> {batchStatusLabelHr(batch.status)}
              </div>
              <div>
                <strong>Quản lý cửa hàng xác nhận:</strong>{" "}
                {batch.store_manager_approved_by_name || "—"}{" "}
                {batch.store_manager_approved_at
                  ? `(${new Date(batch.store_manager_approved_at).toLocaleString("vi-VN")})`
                  : ""}
              </div>
            </div>

            <label style={{ display: "block", marginTop: 14, fontWeight: 600 }}>
              Ghi chú HR
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú khi duyệt; bắt buộc khi từ chối."
              style={{
                width: "100%",
                minHeight: 90,
                marginTop: 6,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />

            {canAct ? (
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#38a169",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Duyệt cuối (HR)
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #e53e3e",
                    background: "#fff",
                    color: "#c53030",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Từ chối / trả lại
                </button>
              </div>
            ) : (
              <p style={{ marginTop: 12, color: "#718096", fontSize: 14 }}>
                Đợt này không còn ở trạng thái chờ HR — chỉ xem được lịch sử.
              </p>
            )}
          </div>

          <InventoryBatchSheetsPanel sheets={sheets} />
        </>
      ) : null}
    </div>
  );
}
