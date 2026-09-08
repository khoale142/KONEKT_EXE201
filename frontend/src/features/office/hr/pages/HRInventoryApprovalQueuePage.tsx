import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTodayVN } from "../../../shared/utils/formatDateTime";
import {
  fetchPendingHrInventoryBatches,
  listOfficeStoresForHr,
} from "../api/hrInventory.api";
import type { HrPendingInventoryBatch } from "../types/hr.types";
import { batchStatusLabelHr } from "../utils/inventoryLabels";
import HrPageHeader from "../components/HrPageHeader";

const border = "1px solid #e2e8f0";

export default function HRInventoryApprovalQueuePage() {
  const [workDate, setWorkDate] = useState(getTodayVN());
  const [storeId, setStoreId] = useState<number | "all">("all");
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [items, setItems] = useState<HrPendingInventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listOfficeStoresForHr()
      .then(setStores)
      .catch(() => setStores([]));
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const list = await fetchPendingHrInventoryBatches({
        workDate,
        storeId,
      });
      setItems(list);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg || "Không tải được hàng chờ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [workDate, storeId]);

  return (
    <div>
      <HrPageHeader
        title="Kiểm kê chờ duyệt (HR)"
        description="Các đợt đã được cửa hàng xác nhận và gửi lên văn phòng. HR thực hiện duyệt hoặc từ chối cuối cùng."
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
            value={storeId === "all" ? "all" : String(storeId)}
            onChange={(e) =>
              setStoreId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            style={{ padding: "8px 10px", borderRadius: 8, border: border, minWidth: 200 }}
          >
            <option value="all">Tất cả cửa hàng</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
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
          {loading ? "Đang tải…" : "Tải lại"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "#c53030", marginBottom: 12 }}>{error}</p>
      ) : null}

      <div style={{ background: "#fff", border: border, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Cửa hàng</th>
              <th style={{ padding: 12 }}>Ngày</th>
              <th style={{ padding: 12 }}>Lần kiểm</th>
              <th style={{ padding: 12 }}>Trạng thái</th>
              <th style={{ padding: 12 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, color: "#718096" }}>
                  Không có đợt nào chờ HR trong bộ lọc hiện tại.
                </td>
              </tr>
            ) : null}
            {items.map((row) => {
              const id = Number(row.batch_id || row.id);
              return (
                <tr key={id} style={{ borderTop: border }}>
                  <td style={{ padding: 12 }}>{row.store_name || `Store #${row.store_id}`}</td>
                  <td style={{ padding: 12 }}>{row.work_date}</td>
                  <td style={{ padding: 12 }}>{row.cycle_no ?? "—"}</td>
                  <td style={{ padding: 12 }}>{batchStatusLabelHr(row.status)}</td>
                  <td style={{ padding: 12 }}>
                    <Link
                      to={`/office/hr/inventory-approvals/${id}`}
                      style={{ color: "#3182ce", fontWeight: 600 }}
                    >
                      Chi tiết & duyệt
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
