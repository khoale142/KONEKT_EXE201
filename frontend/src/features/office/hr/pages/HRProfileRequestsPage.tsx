import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProfileRequestsForHr } from "../api/hrProfile.api";
import HrPageHeader from "../components/HrPageHeader";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending_hr: { bg: "#fefcbf", color: "#975a16", label: "Chờ HR duyệt" },
  approved: { bg: "#c6f6d5", color: "#276749", label: "Đã duyệt" },
  rejected: { bg: "#fed7d7", color: "#c53030", label: "Từ chối" },
  pending_sm: { bg: "#e9d8fd", color: "#553c9a", label: "Chờ Store Manager" },
};

export default function HRProfileRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: number; message: string; status?: string; created_at?: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProfileRequestsForHr()
      .then((res) => setRows(res))
      .catch((e: any) => setError(e?.response?.data?.message || "Không tải được danh sách yêu cầu"))
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = rows.filter((r) => !r.status || r.status === "pending_hr").length;

  return (
    <div>
      <HrPageHeader
        title="Yêu cầu chỉnh sửa hồ sơ (HR)"
        description={`HR duyệt bước cuối cho các yêu cầu đã được Store Manager chuyển tiếp lên. Hiện có ${pendingCount} yêu cầu đang chờ.`}
      />

      {loading ? <p>Đang tải…</p> : null}
      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      {!loading && !error ? (
        rows.length === 0 ? (
          <div
            style={{
              padding: 24,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              color: "#718096",
              textAlign: "center",
            }}
          >
            Hiện không có yêu cầu nào đang chờ HR xử lý.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status ?? "pending_hr"] ?? STATUS_BADGE.pending_hr;
              return (
                <Link
                  key={row.id}
                  to={`/office/hr/profile-requests/${row.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 18,
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    color: "#1a202c",
                    textDecoration: "none",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.message}</div>
                    <div style={{ color: "#718096", fontSize: 13 }}>
                      Mở chi tiết và xác nhận xử lý
                      {row.created_at ? ` · ${new Date(row.created_at).toLocaleDateString("vi-VN")}` : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
