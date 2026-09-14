import StoreInvitePanel from '../components/StoreInvitePanel';
import OwnerStaffDirectoryPage from './OwnerStaffDirectoryPage';
import { useAuthStore } from '../../../../app/store/auth.store';
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  UserPlus,
  CalendarDays,
  Clock,
  Wallet,
} from "lucide-react";
import StaffJoinRequestsPage from "./StaffJoinRequestsPage";
import { CanonicalTenantJoinRequestsPanel } from "../../../workspace/pages/TenantJoinRequestsPage";

import HRSchedulesPage from "./HRSchedulesWorkspaceV2Page";
import HRAttendancePage from "./HRAttendanceWorkspaceV2Page";
import PayrollReportPage from "../../../head-officer/pages/PayrollReportPage";
import { workspaceApi } from "../../../workspace/api/workspace.api";

type HRTab = "requests" | "employees" | "schedules" | "attendance" | "payroll";

export default function OwnerHRHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as HRTab) || "requests";
  const tenantId = useAuthStore(s => s.user?.tenantId);
  const [revision, setRevision] = useState(0);
  useEffect(() => { const fn = () => setRevision(v => v + 1); window.addEventListener("konekt:staff-changed", fn); return () => window.removeEventListener("konekt:staff-changed", fn); }, []);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    Promise.all([workspaceApi.getStaffRequests(), workspaceApi.getTenantJoinRequests()])
      .then(([legacyRequests, canonicalRequests]) => {
        if (active) {
          const pending = legacyRequests.filter((r) => r.status === "pending").length
            + canonicalRequests.filter((r) => r.status === "pending").length;
          setPendingCount(pending);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentTab, tenantId, revision]);

  const handleTabChange = (tab: HRTab) => {
    setSearchParams({ tab });
  };

  const tabs: { key: HRTab; label: string; icon: any; badge?: number; description: string }[] = [
    {
      key: "requests",
      label: "Duyệt nhân sự (Mã mời)",
      icon: UserPlus,
      badge: pendingCount,
      description: "Ứng viên nhập mã chi nhánh & duyệt phân quyền",
    },
    {
      key: "employees",
      label: "Danh sách nhân sự",
      icon: Users,
      description: "Danh bạ toàn chuỗi, chi nhánh và vai trò",
    },
    {
      key: "schedules",
      label: "Lịch làm việc & Ca",
      icon: CalendarDays,
      description: "Xếp lịch làm việc & phân ca cho các chi nhánh",
    },
    {
      key: "attendance",
      label: "Giám sát chấm công",
      icon: Clock,
      description: "Theo dõi giờ vào/ra ca và chấm công thực tế",
    },
    {
      key: "payroll",
      label: "Quỹ lương",
      icon: Wallet,
      description: "Bảng lương nhân sự toàn chuỗi theo tháng",
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 0 40px" }}>
      {/* Hub Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#3D503C",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(61, 80, 60, 0.25)",
            }}
          >
            <Users size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2C3B2B", letterSpacing: "-0.02em" }}>
              Quản Lý Nhân Sự (HR Management Hub)
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "#687668", marginTop: 2 }}>
              Trung tâm tiếp nhận nhân sự tham gia qua mã mời nội bộ, phân quyền chi tiết, quản lý danh bạ, xếp ca, chấm công và quỹ lương.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "#FFFFFF",
          padding: 6,
          borderRadius: 14,
          border: "1px solid #E4DFD6",
          marginBottom: 24,
          boxShadow: "0 2px 10px rgba(61, 80, 60, 0.04)",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => {
          const active = currentTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                minWidth: 175,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: active ? "1px solid rgba(61, 80, 60, 0.25)" : "1px solid transparent",
                background: active ? "#3D503C" : "transparent",
                color: active ? "#FFFFFF" : "#556854",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.16s ease",
                boxShadow: active ? "0 2px 8px rgba(61, 80, 60, 0.22)" : "none",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "#FEF8EE";
                  e.currentTarget.style.color = "#2C3B2B";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#556854";
                }
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: active ? "rgba(255, 255, 255, 0.18)" : "#FEF8EE",
                  color: active ? "#FFFFFF" : "#3D503C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              </div>
              <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, lineHeight: 1.2 }}>
                    {tab.label}
                  </span>
                  {tab.badge && tab.badge > 0 ? (
                    <span
                      style={{
                        background: active ? "#F59E0B" : "#FEF3C7",
                        color: active ? "#1E293B" : "#92400E",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 999,
                      }}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: active ? "#D6E5D8" : "#8C9B8E",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tab.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {currentTab === "requests" && <><StoreInvitePanel key={tenantId} /><CanonicalTenantJoinRequestsPanel key={`canonical-${tenantId}`} compact /><StaffJoinRequestsPage key={tenantId} /></>}
        {currentTab === "employees" && <OwnerStaffDirectoryPage key={tenantId} />}
        {currentTab === "schedules" && <HRSchedulesPage />}
        {currentTab === "attendance" && <HRAttendancePage />}
        {currentTab === "payroll" && <PayrollReportPage />}
      </div>
    </div>
  );
}
