import React, { useState } from "react";
import { X, Calculator, PackageCheck, Layers, ArrowRight } from "lucide-react";

interface CostCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUnit: string;
  currentCost: number;
  currentStock?: number;
  onApplyCost: (calculatedCost: number) => void;
}

export default function CostCalculatorModal({
  isOpen,
  onClose,
  currentUnit,
  currentCost,
  currentStock = 0,
  onApplyCost,
}: CostCalculatorModalProps) {
  const [activeTab, setActiveTab] = useState<"package" | "average">("package");

  // Tab 1: Package conversion states
  const [packageTotalMoney, setPackageTotalMoney] = useState<string>("850000");
  const [packageQty, setPackageQty] = useState<string>("5000"); // Total in base units

  // Tab 2: Weighted average states
  const [oldStockQty, setOldStockQty] = useState<string>(String(currentStock || 1000));
  const [oldUnitCost, setOldUnitCost] = useState<string>(String(currentCost || 150));
  const [newIncomingQty, setNewIncomingQty] = useState<string>("5000");
  const [newIncomingTotalMoney, setNewIncomingTotalMoney] = useState<string>("900000");

  if (!isOpen) return null;

  // Calculation for Tab 1 (Package conversion)
  const money = parseFloat(packageTotalMoney) || 0;
  const qty = parseFloat(packageQty) || 0;
  const packageCalculatedCost = qty > 0 ? Math.round(money / qty) : 0;

  // Calculation for Tab 2 (Weighted average)
  const stock = parseFloat(oldStockQty) || 0;
  const oldCost = parseFloat(oldUnitCost) || 0;
  const incomingQty = parseFloat(newIncomingQty) || 0;
  const incomingMoney = parseFloat(newIncomingTotalMoney) || 0;

  const totalStockAfter = stock + incomingQty;
  const totalValueAfter = stock * oldCost + incomingMoney;
  const averageCalculatedCost =
    totalStockAfter > 0 ? Math.round(totalValueAfter / totalStockAfter) : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(30, 38, 31, 0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#FFFFFF",
          borderRadius: 14,
          border: "1px solid #DFD9CE",
          boxShadow: "0 16px 36px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E8E3DA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FAF8F5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#EBF4ED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2D3E2F",
              }}
            >
              <Calculator size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1E261F" }}>
                Máy tính giá vốn & Bình quân kho
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#607062" }}>
                Đơn vị tính: <b>{currentUnit || "đơn vị"}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#607062",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E8E3DA",
            background: "#FAF8F5",
            padding: "4px 8px 0",
            gap: 6,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("package")}
            style={{
              padding: "8px 14px",
              border: "none",
              borderBottom: activeTab === "package" ? "2px solid #2D3E2F" : "2px solid transparent",
              background: "transparent",
              color: activeTab === "package" ? "#2D3E2F" : "#7A8A7C",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <PackageCheck size={14} /> Quy đổi theo gói/bao mua về
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("average")}
            style={{
              padding: "8px 14px",
              border: "none",
              borderBottom: activeTab === "average" ? "2px solid #2D3E2F" : "2px solid transparent",
              background: "transparent",
              color: activeTab === "average" ? "#2D3E2F" : "#7A8A7C",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Layers size={14} /> Bình quân gia quyền tồn kho
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 20 }}>
          {activeTab === "package" ? (
            /* TAB 1: Package conversion */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12.5, color: "#607062", lineHeight: 1.5 }}>
                Dành cho nguyên liệu mua theo bao, thùng, hộp lớn (VD: mua 1 bao cà phê 5kg = 5.000g
                giá 850.000đ $\rightarrow$ tự chia ra giá vốn mỗi gram).
              </div>

              <div>
                <label style={labelStyle}>Tổng số tiền mua gói / thùng (VNĐ)</label>
                <input
                  type="number"
                  value={packageTotalMoney}
                  onChange={(e) => setPackageTotalMoney(e.target.value)}
                  placeholder="VD: 850000"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Tổng số lượng quy đổi ra đơn vị tính ({currentUnit || "đv"})
                </label>
                <input
                  type="number"
                  value={packageQty}
                  onChange={(e) => setPackageQty(e.target.value)}
                  placeholder={`VD: 5000 ${currentUnit || "đv"}`}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11.5, color: "#7A8A7C", marginTop: 4 }}>
                  Mẹo: 1 kg = 1.000 g • 1 lít = 1.000 ml • 1 thùng 12 hộp 1L = 12.000 ml
                </div>
              </div>

              {/* Calculated Result Box */}
              <div
                style={{
                  background: "#F2F7F2",
                  border: "1px solid #C8DEC9",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#235E2D", textTransform: "uppercase" }}>
                    GIÁ VỐN QUY ĐỔI
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1E261F", marginTop: 2 }}>
                    {packageCalculatedCost.toLocaleString("vi-VN")}{" "}
                    <span style={{ fontSize: 13, color: "#607062" }}>
                      VNĐ / {currentUnit || "đv"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onApplyCost(packageCalculatedCost);
                    onClose();
                  }}
                  disabled={packageCalculatedCost <= 0}
                  style={{
                    padding: "8px 14px",
                    background: "#2D3E2F",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Áp dụng giá này <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: Weighted Average Cost */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12.5, color: "#607062", lineHeight: 1.5 }}>
                Tính giá vốn bình quân khi giá nhập hàng đợt mới thay đổi so với lượng hàng đang còn tồn trong kho.
              </div>

              {/* Part 1: Existing Stock */}
              <div
                style={{
                  background: "#FAF8F5",
                  border: "1px solid #E8E3DA",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8A7C", textTransform: "uppercase" }}>
                  1. TỒN KHO HIỆN TẠI
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#607062" }}>SL tồn ({currentUnit})</label>
                    <input
                      type="number"
                      value={oldStockQty}
                      onChange={(e) => setOldStockQty(e.target.value)}
                      style={{ ...inputStyle, padding: "5px 8px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#607062" }}>Giá vốn cũ (VNĐ/{currentUnit})</label>
                    <input
                      type="number"
                      value={oldUnitCost}
                      onChange={(e) => setOldUnitCost(e.target.value)}
                      style={{ ...inputStyle, padding: "5px 8px" }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "#607062", marginTop: 4 }}>
                  Giá trị tồn cũ: <b>{(stock * oldCost).toLocaleString("vi-VN")} đ</b>
                </div>
              </div>

              {/* Part 2: Incoming Batch */}
              <div
                style={{
                  background: "#FAF8F5",
                  border: "1px solid #E8E3DA",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8A7C", textTransform: "uppercase" }}>
                  2. LÔ HÀNG NHẬP MỚI
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#607062" }}>SL nhập mới ({currentUnit})</label>
                    <input
                      type="number"
                      value={newIncomingQty}
                      onChange={(e) => setNewIncomingQty(e.target.value)}
                      style={{ ...inputStyle, padding: "5px 8px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#607062" }}>Tổng tiền mua mới (VNĐ)</label>
                    <input
                      type="number"
                      value={newIncomingTotalMoney}
                      onChange={(e) => setNewIncomingTotalMoney(e.target.value)}
                      style={{ ...inputStyle, padding: "5px 8px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Weighted Average Result Box */}
              <div
                style={{
                  background: "#F2F7F2",
                  border: "1px solid #C8DEC9",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#235E2D", textTransform: "uppercase" }}>
                    GIÁ BÌNH QUÂN GIA QUYỀN
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1E261F", marginTop: 2 }}>
                    {averageCalculatedCost.toLocaleString("vi-VN")}{" "}
                    <span style={{ fontSize: 13, color: "#607062" }}>
                      VNĐ / {currentUnit || "đv"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#607062", marginTop: 2 }}>
                    Tổng tồn sau nhập: {totalStockAfter.toLocaleString("vi-VN")} {currentUnit}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onApplyCost(averageCalculatedCost);
                    onClose();
                  }}
                  disabled={averageCalculatedCost <= 0}
                  style={{
                    padding: "8px 14px",
                    background: "#2D3E2F",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Áp dụng giá bình quân <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#1E261F",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  border: "1px solid #DFD9CE",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#1E261F",
  outline: "none",
  background: "#FFFFFF",
  fontVariantNumeric: "tabular-nums",
};
