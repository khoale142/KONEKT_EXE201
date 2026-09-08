import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { hrRequestsApi, type HRStaffRequest } from "../api/hrRequests.api";

export default function HRRequestsIndexPage() {
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
          (request.request_type === "hire" || request.request_type === "fire")
      ).length,
    [requests]
  );

  const roleUpdatePendingCount = useMemo(
    () =>
      requests.filter(
        (request) => request.status === "pending" && request.request_type === "staff_update"
      ).length,
    [requests]
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>
        Duyệt yêu cầu nhân sự
      </h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Chọn một luồng xử lý bên dưới để HR duyệt đúng loại yêu cầu, tránh trộn tuyển dụng với cập nhật vai
        trò.
      </p>

      {loading ? <p style={{ color: "#64748b" }}>Đang tải...</p> : null}
      {errorMessage ? <p style={{ color: "#c53030" }}>{errorMessage}</p> : null}

      <div style={gridStyle}>
        <Link to="/office/hr/requests/staffing" style={cardLinkStyle}>
          <div style={cardTopStyle}>
            <span style={countPillStyle}>{staffingPendingCount} chờ duyệt</span>
          </div>
          <h2 style={cardTitleStyle}>Duyệt tuyển / sa thải nhân sự</h2>
          <p style={cardDescStyle}>
            Xem và xử lý các yêu cầu tuyển mới hoặc nghỉ việc do Store Manager gửi lên.
          </p>
        </Link>

        <Link to="/office/hr/requests/role-updates" style={cardLinkStyle}>
          <div style={cardTopStyle}>
            <span style={countPillStyle}>{roleUpdatePendingCount} chờ duyệt</span>
          </div>
          <h2 style={cardTitleStyle}>Cập nhật vai trò</h2>
          <p style={cardDescStyle}>
            Duyệt yêu cầu chuyển staff lên Shift Leader hoặc chuyển nhân sự bán thời gian sang toàn thời gian.
          </p>
        </Link>
      </div>
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20,
};

const cardLinkStyle: CSSProperties = {
  display: "block",
  padding: 24,
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e2e8f0",
  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
  textDecoration: "none",
};

const cardTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const countPillStyle: CSSProperties = {
  padding: "5px 12px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 800,
};

const cardTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
};

const cardDescStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
};
