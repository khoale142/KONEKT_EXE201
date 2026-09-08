import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import { dash } from "../../../shared/dashboard/dashboardUi";
import { fetchHrEmployeeDirectory } from "../api/hrEmployeeDirectory.api";
import { listProfileRequestsForHr } from "../api/hrProfile.api";
import HrPageHeader from "../components/HrPageHeader";

type DashboardSnapshot = {
  storeCount: number;
  pendingProfiles: number;
  totalEmployees: number;
  partTimeCount: number;
  fullTimeCount: number;
  pendingRequests: number;
};

const sectionStyle: CSSProperties = {
  marginBottom: 28,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: "1px solid #d5dfd2",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const softCardStyle: CSSProperties = {
  background: "#fffdf9",
  borderRadius: 16,
  border: "1px solid #ddd8cc",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
};

export default function HRDashboardWorkspaceV2Page() {
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
        if (cancelled) return;
        setError("Không tải được số liệu HR. Vui lòng làm mới trang.");
        setSnapshot({
          storeCount: 0,
          pendingProfiles: 0,
          totalEmployees: 0,
          partTimeCount: 0,
          fullTimeCount: 0,
          pendingRequests: 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Tổng nhân sự",
        value: loading ? "—" : snapshot.totalEmployees,
        note: "Nhân sự đang có dữ liệu trong toàn chuỗi",
        tone: "#1f2937",
      },
      {
        label: "Part-time / Full-time",
        value: loading ? "—" : `${snapshot.partTimeCount} / ${snapshot.fullTimeCount}`,
        note: "Tương quan loại hình làm việc hiện tại",
        tone: "#35543c",
      },
      {
        label: "Cửa hàng",
        value: loading ? "—" : snapshot.storeCount,
        note: "Số điểm bán HR đang theo dõi dữ liệu",
        tone: "#2b6cb0",
      },
      {
        label: "Hồ sơ chờ duyệt",
        value: loading ? "—" : snapshot.pendingProfiles,
        note: "Phiếu chỉnh hồ sơ đang nằm ở HR",
        tone: snapshot.pendingProfiles > 0 ? "#b45309" : "#1f2937",
      },
      {
        label: "Request nhân sự chờ duyệt",
        value: loading ? "—" : snapshot.pendingRequests,
        note: "Tuyển mới, nghỉ việc hoặc cập nhật vai trò",
        tone: snapshot.pendingRequests > 0 ? "#c2410c" : "#1f2937",
      },
    ],
    [loading, snapshot],
  );

  const quickLinks = [
    {
      to: "/office/hr/profile-requests",
      title: "Yêu cầu chỉnh hồ sơ",
      description: "Kiểm tra hồ sơ được cửa hàng chuyển lên và chốt vòng duyệt cuối cùng.",
      caption: "Ưu tiên cao",
    },
    {
      to: "/office/hr/employees",
      title: "Nhân sự toàn chuỗi",
      description: "Tra cứu nhân viên theo cửa hàng, vai trò, loại hình và mở hồ sơ chi tiết.",
      caption: "Tra cứu",
    },
    {
      to: "/office/hr/payroll",
      title: "Quỹ lương",
      description: "Xem báo cáo chi phí nhân sự PT/FT theo từng cửa hàng.",
      caption: "Báo cáo",
    },
    {
      to: "/office/hr/requests",
      title: "Yêu cầu tuyển / sa thải",
      description: "Tách riêng luồng tuyển mới, nghỉ việc và cập nhật vai trò để duyệt nhanh hơn.",
      caption: "Ưu tiên cao",
    },
    {
      to: "/office/hr/attendance",
      title: "Giám sát chấm công",
      description: "Theo dõi tỷ lệ đúng giờ, ca trễ, vắng mặt và thời lượng đi muộn.",
      caption: "Theo dõi",
    },
    {
      to: "/office/hr/schedules",
      title: "Lịch làm việc",
      description: "Giám sát lịch ca toàn chuỗi theo khoảng ngày và cửa hàng.",
      caption: "Điều phối",
    },
  ] as const;

  return (
    <div>
      <HrPageHeader
        title="Bảng điều khiển HR"
        description="Không gian điều phối nhân sự toàn chuỗi với cách trình bày đồng đều, dễ đọc và ưu tiên đúng chỗ cần xử lý."
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

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#16301f", letterSpacing: "-0.01em" }}>
              Tổng quan nhanh
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: dash.muted, lineHeight: 1.6 }}>
              Tóm tắt những chỉ số cần nhìn đầu ngày để biết HR đang phải xử lý gì trước.
            </p>
          </div>
        </div>

        <div style={statGridStyle}>
          {stats.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} note={item.note} tone={item.tone} />
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#16301f", letterSpacing: "-0.01em" }}>
              Truy cập nhanh
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: dash.muted, lineHeight: 1.6 }}>
              Các module HR chính được gom lại với cùng nhịp nhìn để thao tác nhanh hơn.
            </p>
          </div>
        </div>

        <div style={cardGridStyle}>
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                ...softCardStyle,
                padding: 22,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
                {item.caption}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#16301f", lineHeight: 1.4, marginBottom: 8 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: dash.muted }}>
                {item.description}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#16301f", letterSpacing: "-0.01em" }}>
              Nhịp vận hành
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: dash.muted, lineHeight: 1.6 }}>
              Nhìn nhanh điểm nào cần ưu tiên xử lý trước trong ngày.
            </p>
          </div>
        </div>

        <div style={cardGridStyle}>
          <SummaryCard
            title="Ưu tiên duyệt"
            value={loading ? "Đang tải..." : `${snapshot.pendingProfiles + snapshot.pendingRequests} đầu việc`}
            description="Gồm yêu cầu chỉnh hồ sơ và các request nhân sự đang chờ HR quyết định."
          />
          <SummaryCard
            title="Cơ cấu hợp đồng"
            value={loading ? "Đang tải..." : `${snapshot.partTimeCount} PT · ${snapshot.fullTimeCount} FT`}
            description="Giúp HR nhìn nhanh tương quan bán thời gian và toàn thời gian giữa các quán."
          />
          <SummaryCard
            title="Độ phủ dữ liệu"
            value={loading ? "Đang tải..." : `${snapshot.storeCount} cửa hàng`}
            description="Số điểm bán đang có dữ liệu HR để theo dõi chấm công, lịch làm và quỹ lương."
          />
        </div>
      </section>
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
      <div style={{ fontSize: 13, opacity: 0.88, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone: string;
}) {
  return (
    <div style={{ ...softCardStyle, padding: "18px 18px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: tone, lineHeight: 1.2 }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{note}</div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div style={{ ...softCardStyle, padding: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 14, color: dash.muted, lineHeight: 1.7 }}>{description}</div>
    </div>
  );
}
