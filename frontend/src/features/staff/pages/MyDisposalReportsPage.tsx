import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  inventoryDisposalsApi,
  type DisposalReport,
  type DisposalReportStatus,
} from "../api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import {
  labelOf,
  REPORT_TYPE_LABEL,
  REASON_LABEL,
  REPORT_STATUS_LABEL,
  PHYSICAL_STATE_LABEL,
} from "../../shared/utils/disposalLabels";

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  cursor: "pointer",
  background: "#fff",
};

export default function MyDisposalReportsPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<DisposalReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stores = useMemo(() => getUserStores(user), [user]);

  const allowed = hasAnyRole(user, ["staff", "shift_leader", "store_manager"]);

  const getBackPath = () => {
    if (hasAnyRole(user, ["store_manager"])) return "/store/manager";
    return "/store/staff";
  };

  const loadReports = async (targetStoreId: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await inventoryDisposalsApi.listMyReports({
        storeId: targetStoreId,
        status: (status || undefined) as DisposalReportStatus | undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      setReports(r.reports || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisposalUser()
      .then((u) => {
        setUser(u);
        const s = getDefaultStoreId(u);
        setStoreId(s);
        if (s) loadReports(s);
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, []);

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "STORE" || !allowed) {
    return <div style={{ padding: 16 }}>Bạn không có quyền vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Report hủy hàng của tôi</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Staff / Leader / SM theo dõi report đã gửi trên trang riêng.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => nav(getBackPath(), { replace: true })}>
            Về dashboard
          </button>

          <button
            type="button"
            style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
            onClick={() => nav("/inventory/disposals/create")}
          >
            Tạo report mới
          </button>
        </div>
      </div>

      {error && <div style={{ ...box, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={box}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>Cửa hàng</div>
            <select style={input} value={storeId} onChange={(e) => setStoreId(Number(e.target.value))}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Trạng thái</div>
            <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="submitted">Đã gửi</option>
              <option value="verified_by_sm">Đã SM xác nhận</option>
              <option value="included_in_disposal_order">Đã vào lệnh hủy</option>
              <option value="duplicate_closed">Đóng do trùng</option>
              <option value="released_back_to_stock">Đã trả lại kho</option>
              <option value="cancelled_by_sm">Đã SM hủy phiếu</option>
              <option value="finalized">Hoàn tất</option>
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Tìm kiếm</div>
            <input
              style={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc mô tả"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
            onClick={() => loadReports(storeId)}
          >
            {loading ? "Đang tải..." : "Tải danh sách"}
          </button>
          <button type="button" style={btn} onClick={() => { setStatus(""); setSearch(""); }}>
            Xóa lọc
          </button>
        </div>
      </div>

      <div style={box}>
        {!reports.length && <div>Chưa có report nào.</div>}

        {reports.map((report) => (
          <div
            key={report.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {report.code} • {labelOf(REPORT_STATUS_LABEL, report.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              {labelOf(REPORT_TYPE_LABEL, report.reportType)} • {labelOf(REASON_LABEL, report.reasonCode)} •{" "}
              {labelOf(REPORT_STATUS_LABEL, report.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              Trạng thái vật lý: {labelOf(PHYSICAL_STATE_LABEL, report.physicalState)}
            </div>
            {report.description && <div style={{ marginTop: 8 }}>{report.description}</div>}
            <div style={{ marginTop: 10 }}>
              {report.lines.map((line) => (
                <div key={line.id} style={{ color: "#6b7280", marginBottom: 6 }}>
                  • {line.itemNameSnapshot} — {line.quantityReported} {line.unitName}
                  {line.note ? ` — ${line.note}` : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
