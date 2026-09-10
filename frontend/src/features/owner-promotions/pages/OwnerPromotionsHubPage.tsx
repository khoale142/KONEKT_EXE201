import { useSearchParams } from "react-router-dom";
import { Ticket, Layers, Sparkles } from "lucide-react";
import MarketingComboRuleListPage from "../../marketing/pages/MarketingComboRuleListPage";
import VouchersPage from "../../marketing/pages/VouchersPage";

type PromotionTab = "combos" | "vouchers";

export default function OwnerPromotionsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as PromotionTab) || "combos";

  const handleTabChange = (tab: PromotionTab) => {
    setSearchParams({ tab });
  };

  const tabs: { key: PromotionTab; label: string; icon: any; description: string }[] = [
    {
      key: "combos",
      label: "Quy tắc Combo (Combo Rules)",
      icon: Layers,
      description: "Tạo combo bán kèm tự động nhận diện & gợi ý trên máy POS",
    },
    {
      key: "vouchers",
      label: "Voucher & Khuyến mãi hóa đơn",
      icon: Ticket,
      description: "Mã giảm giá, chiết khấu theo %, khuyến mãi mua X tặng Y",
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
            <Sparkles size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#2C3B2B", letterSpacing: "-0.02em" }}>
              Khuyến Mãi & Ưu Đãi (Promotions & Offers Hub)
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "#687668", marginTop: 2 }}>
              Trung tâm thiết lập các chương trình khuyến mãi, quy tắc kết hợp combo món và phát hành mã voucher ưu đãi.
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
                minWidth: 220,
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
        {currentTab === "combos" && <MarketingComboRuleListPage />}
        {currentTab === "vouchers" && <VouchersPage />}
      </div>
    </div>
  );
}
