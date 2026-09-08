import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import { listProfileRequestsForHr } from "../api/hrProfile.api";
import { fetchHrEmployeeDirectory } from "../api/hrEmployeeDirectory.api";
import HrPageHeader from "../components/HrPageHeader";
import {
  DashboardSection,
  dash,
} from "../../../shared/dashboard/dashboardUi";

type DashboardSnapshot = {
  storeCount: number;
  pendingProfiles: number;
  totalEmployees: number;
  partTimeCount: number;
  fullTimeCount: number;
  pendingRequests: number;
};

const statGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  marginBottom: 28,
};

const statCardStyle: React.CSSProperties = {
  background: "#fffdf9",
  borderRadius: dash.radiusMd,
  border: "1px solid #ddd8cc",
  padding: "18px 18px 16px",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const insightCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: dash.radiusMd,
  border: `1px solid ${dash.border}`,
  boxShadow: dash.shadow,
  padding: "16px 18px",
};

const quickLinkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const quickLinkCardStyle: React.CSSProperties = {
  display: "block",
  background: "#fffdf9",
  borderRadius: dash.radiusMd,
  border: "1px solid #ddd8cc",
  padding: "18px 18px 16px",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
  textDecoration: "none",
  color: "inherit",
};

export default function HRDashboardWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    storeCount: 0,
    pendingProfiles: 0,
    totalEmployees: 0,
    partTimeCount: 0,
    fullTimeCount: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const [insights, profileRequests, employees, staffRequests] = await Promise.all([
          headOfficerApi.getDashboardInsights({
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          }),
          listProfileRequestsForHr().catch(() => []),
          fetchHrEmployeeDirectory().catch(() => []),
          headOfficerApi.getStaffRequests().catch(() => []),
        ]);

        if (cancelled) return;

        setSnapshot({
          storeCount: insights.stores.length,
          pendingProfiles: profileRequests.length,
          totalEmployees: employees.length,
          partTimeCount: employees.filter((employee) => employee.employmentType === "part_time").length,
          fullTimeCount: employees.filter((employee) => employee.employmentType === "full_time").length,
          pendingRequests: staffRequests.filter((request) => request.status === "pending").length,
        });
      } catch {
        if (!cancelled) {
          setError("Không tải được số liệu HR. Vui lòng thử làm mới trang.");
          setSnapshot({
            storeCount: 0,
            pendingProfiles: 0,
            totalEmployees: 0,
            partTimeCount: 0,
            fullTimeCount: 0,
            pendingRequests: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = useMemo(
    () => [
      {
        label: "Tổng nhân viên",
        value: loading ? "—" : snapshot.totalEmployees,
        note: "Toàn bộ nhân sự đang hiển thị trong chuỗi",
        color: "#1f2937",
      },
      {
        label: "Part-time / Full-time",
        value: loading ? "—" : `${snapshot.partTimeCount} / ${snapshot.fullTimeCount}`,
        note: "Tương quan loại hợp đồng đang hoạt động",
        color: "#35543c",
      },
      {
        label: "Cửa hàng",
        value: loading ? "—" : snapshot.storeCount,
        note: "Số quán có dữ liệu HR đang theo dõi",
        color: "#2b6cb0",
      },
      {
        label: "Hồ sơ chờ duyệt",
        value: loading ? "—" : snapshot.pendingProfiles,
        note: "Yêu cầu chỉnh hồ sơ đang nằm ở HR",
        color: snapshot.pendingProfiles > 0 ? "#c05621" : "#1f2937",
      },
      {
        label: "Tuyển / sa thải chờ duyệt",
        value: loading ? "—" : snapshot.pendingRequests,
        note: "Các request nhân sự đang đợi quyết định",
        color: snapshot.pendingRequests > 0 ? "#c53030" : "#1f2937",
      },
    ],
    [loading, snapshot],
  );

  const quickLinks = [
    {
      to: "/office/hr/profile-requests",
      title: "Yêu cầu chỉnh hồ sơ",
      description: "Kiểm tra hồ sơ được cửa hàng chuyển lên và chốt vòng duyệt cuối cùng.",
      featured: true,
    },
    {
      to: "/office/hr/employees",
      title: "Nhân sự toàn chuỗi",
      description: "Tra cứu nhân viên theo cửa hàng, vai trò, loại hình và mở hồ sơ chi tiết.",
      featured: true,
    },
      {
        to: "/office/hr/payroll",
        title: "Quỹ lương",
        description: "Xem báo cáo chi phí nhân sự PT/FT theo từng cửa hàng.",
        featured: false,
      },
    {
      to: "/office/hr/requests",
      title: "Yêu cầu tuyển / sa thải",
      description: "Tách riêng luồng tuyển mới, nghỉ việc và cập nhật vai trò để duyệt nhanh hơn.",
      featured: true,
    },
      {
        to: "/office/hr/attendance",
        title: "Giám sát chấm công",
        description: "Theo dõi tỷ lệ đúng giờ, ca trễ, vắng mặt và thời lượng đi muộn.",
        featured: false,
      },
      {
        to: "/office/hr/schedules",
        title: "Lịch làm việc",
        description: "Giám sát lịch ca toàn chuỗi theo khoảng ngày và cửa hàng.",
        featured: false,
      },
  ] as const;

  return (
    <div>
      <HrPageHeader
        title="Bảng điều khiển HR"
        description="Không gian điều phối nhân sự toàn chuỗi với cùng nhịp nhìn và thao tác như portal cửa hàng."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <HeaderMetric label="Nhân sự" value={loading ? "—" : snapshot.totalEmployees} />
          <HeaderMetric label="Hồ sơ chờ" value={loading ? "—" : snapshot.pendingProfiles} />
          <HeaderMetric label="Request chờ" value={loading ? "—" : snapshot.pendingRequests} />
        </div>
      </HrPageHeader>

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff5f5",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={statGridStyle}>
        {statCards.map((item) => (
          <div key={item.label} style={statCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}>
              {item.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{item.note}</div>
          </div>
        ))}
      </div>

      <DashboardSection
        title="Truy cập nhanh"
        description="Các module HR chính được gom lại theo cùng mô hình card thao tác của staff và store manager."
        emphasized
      >
        <div style={quickLinkGridStyle}>
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                ...quickLinkCardStyle,
                borderColor: item.featured ? "#cfdccc" : "#ddd8cc",
                background: item.featured ? "#ffffff" : "#fffdf9",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                  marginBottom: 10,
                }}
              >
                {item.featured ? "Ưu tiên" : "Module"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#16301f", marginBottom: 8 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: dash.muted }}>
                {item.description}
              </div>
            </Link>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Nhịp vận hành"
        description="Tóm tắt nhanh để nhìn ra chỗ nào cần xử lý trước trong ngày."
      >
        <div style={infoGridStyle}>
          <InsightCard
            title="Ưu tiên duyệt"
            value={loading ? "Đang tải..." : `${snapshot.pendingProfiles + snapshot.pendingRequests} đầu việc`}
            description="Gồm yêu cầu chỉnh hồ sơ và các request nhân sự đang chờ HR quyết định."
          />
          <InsightCard
            title="Cơ cấu hợp đồng"
            value={loading ? "Đang tải..." : `${snapshot.partTimeCount} PT • ${snapshot.fullTimeCount} FT`}
            description="Giúp HR nhìn nhanh tương quan bán thời gian và toàn thời gian giữa các quán."
          />
          <InsightCard
            title="Độ phủ dữ liệu"
            value={loading ? "Đang tải..." : `${snapshot.storeCount} cửa hàng`}
            description="Số điểm bán đang có dữ liệu HR để theo dõi chấm công, lịch làm và quỹ lương."
          />
        </div>
      </DashboardSection>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string | number }) {
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

function InsightCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div style={insightCardStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: dash.muted }}>
        {title}
      </div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: dash.muted }}>{description}</div>
    </div>
  );
}
