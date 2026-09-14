import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  Store,
  Check,
  ArrowRightLeft,
} from "lucide-react";
import { useAuthStore } from "../../app/store/auth.store";
import { workspaceApi, WorkspaceTenant } from "../../features/workspace/api/workspace.api";

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [switchError, setSwitchError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<WorkspaceTenant[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const data = await workspaceApi.getWorkspaces();
        setTenants(data.tenants || []);
      } catch {
        // silent
      }
    }
    if (user?.sub) {
      void fetchTenants();
    }
  }, [user?.sub, user?.tenantId]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentTenant = tenants.find((t) => t.tenantId === user?.tenantId);
  const currentStore = currentTenant?.stores.find((s) => s.id === user?.storeId);

  const handleSwitchTenant = async (tenant: WorkspaceTenant) => {
    setIsOpen(false);
    try {
      const data = await workspaceApi.selectTenant({ tenantId: tenant.tenantId, membershipId: tenant.membershipId });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      navigate("/workspace/select-store");
    } catch {
      navigate("/workspace/select-tenant");
    }
  };

  const handleSwitchStore = async (storeId: number) => {
    if (!user?.tenantId) return;
    setIsOpen(false);
    try {
      const data = await workspaceApi.selectTenant({
        tenantId: user.tenantId,
        membershipId: currentTenant?.membershipId,
        storeId,
      });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      window.location.reload();
    } catch {
      setSwitchError("Không chuyển được chi nhánh. Vui lòng thử lại.");
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {switchError && <p role="alert">{switchError}</p>}
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 9,
          border: "1px solid #E8E0D5",
          background: "#FFFFFF",
          color: "#2A3B2C",
          fontSize: "0.82rem",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D503C")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E4DFD6")}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "#3D503C",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Building2 size={13} />
        </div>

        <div style={{ textAlign: "left", lineHeight: 1.15 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>
            {currentTenant?.tenantName || user?.tenantName || "Chọn Thương Hiệu"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "#687668", fontWeight: 500 }}>
            {currentStore?.name || (user?.storeId ? `Store #${user.storeId}` : "Toàn chuỗi")}
          </div>
        </div>

        <ChevronDown size={14} color="#687668" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 280,
            background: "#FFFFFF",
            border: "1px solid #E4DFD6",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(61, 80, 60, 0.12)",
            padding: "8px",
            zIndex: 150,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "6px 10px 10px",
              borderBottom: "1px solid #E4DFD6",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#687668", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Thương hiệu đang làm việc
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#3D503C" }}>
              {currentTenant?.tenantName || "KONEKT"}
            </div>
          </div>

          {/* Tenants Section */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#687668", padding: "4px 8px" }}>
              Chuyển thương hiệu ({tenants.length})
            </div>
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {tenants.map((t) => {
                const isCurrent = t.tenantId === user?.tenantId;

                return (
                  <div
                    key={t.tenantId}
                    onClick={() => !isCurrent && handleSwitchTenant(t)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 10px",
                      borderRadius: 8,
                      background: isCurrent ? "rgba(61, 80, 60, 0.08)" : "transparent",
                      color: isCurrent ? "#3D503C" : "#4A5A4C",
                      fontWeight: isCurrent ? 800 : 600,
                      fontSize: "0.82rem",
                      cursor: isCurrent ? "default" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = "#FEF8EE";
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={14} color={isCurrent ? "#3D503C" : "#687668"} />
                      <span>{t.tenantName}</span>
                    </div>
                    {isCurrent && <Check size={14} color="#3D503C" strokeWidth={2.5} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stores Section if available */}
          {currentTenant && currentTenant.stores.length > 1 && (
            <div style={{ marginBottom: 8, borderTop: "1px solid #E4DFD6", paddingTop: 8 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#687668", padding: "4px 8px" }}>
                Đổi chi nhánh ({currentTenant.stores.length})
              </div>
              <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {currentTenant.stores.map((st) => {
                  const isCurrentStore = st.id === user?.storeId;

                  return (
                    <div
                      key={st.id}
                      onClick={() => !isCurrentStore && handleSwitchStore(st.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: 7,
                        background: isCurrentStore ? "#EBF3EC" : "transparent",
                        color: isCurrentStore ? "#3D503C" : "#4A5A4C",
                        fontWeight: isCurrentStore ? 800 : 500,
                        fontSize: "0.8rem",
                        cursor: isCurrentStore ? "default" : "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentStore) e.currentTarget.style.background = "#FEF8EE";
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentStore) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Store size={13} color={isCurrentStore ? "#3D503C" : "#687668"} />
                        <span>{st.name}</span>
                      </div>
                      {isCurrentStore && <Check size={13} color="#3D503C" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div style={{ borderTop: "1px solid #E4DFD6", paddingTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/workspace/select-store");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#3D503C",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF8EE")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Store size={14} />
              Quản lý chi nhánh & Dashboard chuỗi
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/workspace/select-tenant");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#3D503C",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF8EE")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ArrowRightLeft size={14} />
              Trung tâm chọn thương hiệu (Hub)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
