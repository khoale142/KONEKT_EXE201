import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { hrRequestsApi, type HRStaffRequest } from "../api/hrRequests.api";
import HrPageHeader from "../components/HrPageHeader";
import { dash } from "../../../shared/dashboard/dashboardUi";

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
};

const cardLinkStyle: React.CSSProperties = {
  display: "block",
  padding: 24,
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbf7 100%)",
  border: "1px solid #dfe7de",
  boxShadow: "0 14px 36px rgba(47, 93, 58, 0.08)",
  textDecoration: "none",
  color: "inherit",
};

const countPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 800,
};

export default function HRRequestsWorkspacePage() {
  const [requests, setRequests] = useState<HRStaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    hrRequestsApi
      .list()
      .then((res) => setRequests(res))
      .catch((error) => setErrorMessage(error?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  const staffingPendingCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === "pending" &&
          (request.request_type === "hire" || request.request_type === "fire"),
      ).length,
    [requests],
  );

  const roleUpdatePendingCount = useMemo(
    () =>
      requests.filter(
        (request) => request.status === "pending" && request.request_type === "staff_update",
      ).length,
    [requests],
  );

  return (
    <div>
      <HrPageHeader
        title="Yêu cầu tuyển dụng và điều chuyển"
        description="Tách rõ từng luồng duyệt để HR xử lý request nhanh hơn, ít nhầm giữa tuyển mới, nghỉ việc và cập nhật vai trò."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <Metric label="Tuyển / sa thải" value={loading ? "—" : staffingPendingCount} />
          <Metric label="Cập nhật vai trò" value={loading ? "—" : roleUpdatePendingCount} />
        </div>
      </HrPageHeader>

      {loading ? <p style={{ color: dash.muted }}>Đang tải...</p> : null}
      {errorMessage ? <p style={{ color: "#c53030" }}>{errorMessage}</p> : null}

      <div style={gridStyle}>
        <Link to="/office/hr/requests/staffing" style={cardLinkStyle}>
          <div style={{ marginBottom: 16 }}>
            <span style={countPillStyle}>{staffingPendingCount} chờ duyệt</span>
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#16301f" }}>
            Tuyển / sa thải nhân sự
          </h2>
          <p style={{ margin: 0, color: dash.muted, fontSize: 14, lineHeight: 1.65 }}>
            Xem và xử lý các request tuyển mới hoặc nghỉ việc do Store Manager gửi lên.
          </p>
        </Link>

        <Link to="/office/hr/requests/role-updates" style={cardLinkStyle}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...countPillStyle, background: "#dbeafe", color: "#1d4ed8" }}>
              {roleUpdatePendingCount} chờ duyệt
            </span>
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#16301f" }}>
            Cập nhật vai trò
          </h2>
          <p style={{ margin: 0, color: dash.muted, fontSize: 14, lineHeight: 1.65 }}>
            Duyệt yêu cầu chuyển staff lên shift leader hoặc thay đổi loại hình làm việc.
          </p>
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: dash.radiusMd,
        padding: "14px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "0.72rem", opacity: 0.84, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}
