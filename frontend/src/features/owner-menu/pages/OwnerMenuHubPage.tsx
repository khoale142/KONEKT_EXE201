import { useSearchParams } from "react-router-dom";
import OwnerProductsPage from "./OwnerProductsPage";
import OwnerRawMaterialsPage from "./OwnerRawMaterialsPage";
import OwnerSemiFinishedPage from "./OwnerSemiFinishedPage";

type MenuTab = "products" | "raw-materials" | "semi-finished";

export default function OwnerMenuHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");

  // Backward compatibility fallback
  let currentTab: MenuTab = "products";
  if (rawTab === "raw-materials" || rawTab === "ingredients") {
    currentTab = "raw-materials";
  } else if (rawTab === "semi-finished") {
    currentTab = "semi-finished";
  } else {
    currentTab = "products";
  }

  const handleTabChange = (tab: MenuTab) => {
    setSearchParams({ tab });
  };

  const tabs: { key: MenuTab; label: string }[] = [
    { key: "products", label: "Sản phẩm / Món bán" },
    { key: "raw-materials", label: "Nguyên liệu" },
    { key: "semi-finished", label: "Bán thành phẩm" },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 0 40px" }}>
      {/* Clean Minimalist Hub Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "#1E261F",
            letterSpacing: "-0.02em",
          }}
        >
          Thực đơn & Định lượng
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#607062" }}>
          Quản lý sản phẩm bán lẻ, vật tư nguyên liệu và bán thành phẩm sơ chế với công thức định lượng pha chế đa kích cỡ.
        </p>
      </div>

      {/* 1-Line Minimalist Segmented Tab Bar */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#EAE5DC",
          padding: 4,
          borderRadius: 12,
          marginBottom: 24,
          gap: 4,
          width: "100%",
          maxWidth: 540,
          border: "1px solid #DFD9CE",
        }}
      >
        {tabs.map((tab) => {
          const active = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 9,
                border: "none",
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "#2D3E2F" : "#5A685B",
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
                boxShadow: active ? "0 1px 4px rgba(45, 62, 47, 0.08)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {currentTab === "products" && <OwnerProductsPage />}
        {currentTab === "raw-materials" && <OwnerRawMaterialsPage />}
        {currentTab === "semi-finished" && <OwnerSemiFinishedPage />}
      </div>
    </div>
  );
}
