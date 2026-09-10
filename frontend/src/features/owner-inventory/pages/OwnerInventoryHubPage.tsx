import { useSearchParams } from "react-router-dom";
import { PackageCheck, PackageX, ClipboardCheck, Boxes } from "lucide-react";
import InventoryWastePage from "../../head-officer/pages/InventoryWastePage";
import InventoryAuditApprovalPage from "../../head-officer/pages/InventoryAuditApprovalPage";
import InventoryReceiptReportPage from "../../head-officer/pages/InventoryReceiptReportPage";

type InventoryTab = "waste" | "shifts" | "receipts";

export default function OwnerInventoryHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as InventoryTab) || "waste";

  const handleTabChange = (tab: InventoryTab) => {
    setSearchParams({ tab });
  };

  const tabs: { key: InventoryTab; label: string; icon: any; description: string }[] = [
    {
      key: "waste",
      label: "Tồn kho & Hàng hủy",
      icon: PackageX,
      description: "Theo dõi tồn kho toàn chuỗi, tỷ lệ hao hụt & phiếu hủy",
    },
    {
      key: "shifts",
      label: "Duyệt kiểm hàng ca",
      icon: ClipboardCheck,
      description: "Phê duyệt biên bản đối soát kiểm kê ca từ các cơ sở",
    },
    {
      key: "receipts",
      label: "Nhập xuất vật tư",
      icon: Boxes,
      description: "Báo cáo phiếu nhập hàng từ nhà cung cấp & điều chuyển",
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
            <PackageCheck size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2C3B2B", letterSpacing: "-0.02em" }}>
              Kho & Quản Lý Vật Tư (Inventory Hub)
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "#687668", marginTop: 2 }}>
              Trung tâm kiểm soát tồn kho nguyên vật liệu, xử lý hàng hủy hao hụt, phê duyệt kiểm kê ca và theo dõi nhập xuất kho toàn chuỗi.
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
                minWidth: 200,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: active ? "1px solid rgba(61, 80, 60, 0.25)" : "1px solid transparent",
                background: active ? "#3D503C" : "transparent",
                color: active ? "#FFFFFF" : "#556854",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.16s ease",
                boxShadow: active ? "0 2px 8px rgba(61, 80, 60, 0.22)" : "none",
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
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: 13.5, fontWeight: active ? 800 : 600, lineHeight: 1.2 }}>
                  {tab.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
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
        {currentTab === "waste" && <InventoryWastePage />}
        {currentTab === "shifts" && <InventoryAuditApprovalPage />}
        {currentTab === "receipts" && <InventoryReceiptReportPage />}
      </div>
    </div>
  );
}
