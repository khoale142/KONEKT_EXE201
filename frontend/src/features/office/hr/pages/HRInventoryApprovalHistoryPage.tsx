import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTodayVN } from "../../../shared/utils/formatDateTime";
import { listOfficeStoresForHr, searchBatchesForHr } from "../api/hrInventory.api";
import type { InventoryBatch } from "../../../staff/api/inventoryAudit.api";
import { batchStatusLabelHr } from "../utils/inventoryLabels";
import HrPageHeader from "../components/HrPageHeader";

const border = "1px solid #e2e8f0";

export default function HRInventoryApprovalHistoryPage() {
  const [workDate, setWorkDate] = useState(getTodayVN());
  const [storeId, setStoreId] = useState<number | "">("");
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [items, setItems] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listOfficeStoresForHr()
      .then((s) => {
        setStores(s);
        if (s.length === 1) setStoreId(s[0].id);
      })
      .catch(() => setStores([]));
  }, []);

  async function load() {
    if (!storeId) {
      setError("Chọn cửa hàng để tra cứu.");
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await searchBatchesForHr({
        storeId: Number(storeId),
        workDate,
      });
      const raw = res as { items?: InventoryBatch[] };
      let list = Array.isArray(raw.items) ? raw.items : [];
      if (statusFilter !== "all") {
        list = list.filter((b) => String(b.status) === statusFilter);
      }
      setItems(list);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg || "Không tải được lịch sử");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <HrPageHeader
        title="Lịch sử kiểm kê (HR)"
        description="Chọn ngày và cửa hàng để xem các đợt kiểm (đã duyệt, từ chối hoặc các trạng thái khác). Mở chi tiết để xem lại toàn bộ phiếu."
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 20,
          padding: 16,
          background: "#fff",
          border: border,
          borderRadius: 10,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Ngày làm việc
          </label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: border }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Cửa hàng
          </label>
          <select
            value={storeId === "" ? "" : String(storeId)}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "8px 10px", borderRadius: 8, border: border, minWidth: 220 }}
          >
            <option value="">— Chọn —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Lọc trạng thái
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: border, minWidth: 200 }}
          >
            <option value="all">Tất cả</option>
            <option value="approved_final">Đã duyệt cuối</option>
            <option value="submitted_to_dm">Chờ HR</option>
            <option value="rejected_by_dm">Từ chối cấp văn phòng</option>
            <option value="submitted_to_store_manager">Chờ cửa hàng</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#2d3748",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Đang tải…" : "Tra cứu"}
        </button>
      </div>

      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      <div style={{ background: "#fff", border: border, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Ngày</th>
              <th style={{ padding: 12 }}>Lần</th>
              <th style={{ padding: 12 }}>Trạng thái</th>
              <th style={{ padding: 12 }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, color: "#718096" }}>
                  Chưa có dữ liệu — chọn cửa hàng và tra cứu.
                </td>
              </tr>
            ) : null}
            {items.map((row) => {
              const id = Number(row.batch_id || row.id);
              return (
                <tr key={id} style={{ borderTop: border }}>
                  <td style={{ padding: 12 }}>{row.work_date}</td>
                  <td style={{ padding: 12 }}>{row.cycle_no ?? "—"}</td>
                  <td style={{ padding: 12 }}>{batchStatusLabelHr(row.status)}</td>
                  <td style={{ padding: 12 }}>
                    <Link
                      to={`/office/hr/inventory-approvals/${id}`}
                      style={{ color: "#3182ce", fontWeight: 600 }}
                    >
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
