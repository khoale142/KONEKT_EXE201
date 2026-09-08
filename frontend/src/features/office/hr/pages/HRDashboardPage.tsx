import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import { listProfileRequestsForHr } from "../api/hrProfile.api";
import { fetchHrEmployeeDirectory } from "../api/hrEmployeeDirectory.api";
import HrPageHeader from "../components/HrPageHeader";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  padding: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  textDecoration: "none",
  color: "inherit",
  display: "block",
  transition: "box-shadow 0.18s ease, transform 0.18s ease",
};

const kpiCard: React.CSSProperties = {
  ...card,
  cursor: "default",
  position: "relative",
  overflow: "hidden",
};

const linkCard: React.CSSProperties = {
  ...card,
  cursor: "pointer",
};

const label = "#718096";

type KPI = {
  title: string;
  value: string | number;
  color: string;
  accent?: string;
  icon: string;
};

export default function HRDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [storeCount, setStoreCount] = useState<number>(0);
  const [pendingProfiles, setPendingProfiles] = useState<number>(0);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [ptCount, setPtCount] = useState(0);
  const [ftCount, setFtCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
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
        setStoreCount(insights.stores.length);
        setPendingProfiles(profileRequests.length);
        setTotalEmployees(employees.length);
        setPtCount(employees.filter((e) => e.employmentType === "part_time").length);
        setFtCount(employees.filter((e) => e.employmentType === "full_time").length);
        setPendingRequests(staffRequests.filter((r) => r.status === "pending").length);
      } catch {
        if (!cancelled) {
          setStoreCount(0);
          setPendingProfiles(0);
          setTotalEmployees(0);
          setPtCount(0);
          setFtCount(0);
          setPendingRequests(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis: KPI[] = [
    {
      title: "Tổng nhân viên",
      value: loading ? "—" : totalEmployees,
      color: "#2d3748",
      accent: "#4299e1",
      icon: "👥",
    },
    {
      title: "Part-time / Full-time",
      value: loading ? "—" : `${ptCount} / ${ftCount}`,
      color: "#2d3748",
      accent: "#9f7aea",
      icon: "📊",
    },
    {
      title: "Cửa hàng",
      value: loading ? "—" : storeCount,
      color: "#2d3748",
      accent: "#38b2ac",
      icon: "🏪",
    },
    {
      title: "Hồ sơ chờ duyệt",
      value: loading ? "—" : pendingProfiles,
      color: pendingProfiles > 0 ? "#c05621" : "#2d3748",
      accent: "#f6ad55",
      icon: "📝",
    },
    {
      title: "Tuyển / Sa thải chờ duyệt",
      value: loading ? "—" : pendingRequests,
      color: pendingRequests > 0 ? "#c53030" : "#2d3748",
      accent: "#fc8181",
      icon: "📋",
    },
  ];

  const quickLinks = [
    {
      to: "/office/hr/profile-requests",
      title: "Yêu cầu chỉnh hồ sơ",
      desc: "Duyệt yêu cầu thay đổi thông tin cá nhân từ nhân viên.",
      badge: pendingProfiles > 0 ? `${pendingProfiles} chờ` : null,
      badgeColor: "#dd6b20",
    },
    {
      to: "/office/hr/employees",
      title: "Nhân sự & hồ sơ",
      desc: "Danh sách nhân viên toàn chuỗi, lọc theo cửa hàng và vai trò.",
      badge: `${totalEmployees} NV`,
      badgeColor: "#3182ce",
    },
    {
      to: "/office/hr/payroll",
      title: "Quỹ lương",
      desc: "Báo cáo quỹ lương PT/FT theo từng cửa hàng trong chuỗi.",
    },
    {
      to: "/office/hr/requests",
      title: "Yêu cầu tuyển / sa thải",
      desc: "Duyệt yêu cầu nhân sự gửi từ cửa hàng (tuyển dụng, nghỉ việc).",
      badge: pendingRequests > 0 ? `${pendingRequests} chờ` : null,
      badgeColor: "#e53e3e",
    },
    {
      to: "/office/hr/attendance",
      title: "Giám sát chấm công",
      desc: "Xem tổng hợp chấm công toàn chuỗi — tỷ lệ đúng giờ, trễ, vắng mặt.",
    },
    {
      to: "/office/hr/schedules",
      title: "Lịch làm việc (xem)",
      desc: "Tổng quan lịch ca làm việc của nhân viên trên các cửa hàng.",
    },
  ];

  return (
    <div>
      <HrPageHeader
        title="Bảng điều khiển HR"
        description="Theo dõi nhân sự, hồ sơ và các tác vụ phòng nhân sự trong hệ thống."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}
      >
        {kpis.map((k, i) => (
          <div key={i} style={kpiCard}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: k.accent || "#e2e8f0",
                borderRadius: "14px 14px 0 0",
              }}
            />
            <div style={{ fontSize: 22, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: label, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {k.title}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, marginTop: 4 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: "#4a5568" }}>
        Truy cập nhanh
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} style={linkCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{link.title}</div>
              {link.badge ? (
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    background: link.badgeColor ? `${link.badgeColor}18` : "#edf2f7",
                    color: link.badgeColor || "#718096",
                    whiteSpace: "nowrap",
                  }}
                >
                  {link.badge}
                </span>
              ) : null}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: label, lineHeight: 1.5 }}>
              {link.desc}
            </p>
            <span style={{ marginTop: 10, display: "inline-block", color: "#3182ce", fontWeight: 600, fontSize: 13 }}>
              {"Mở →"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

