import { useState, useEffect } from "react";
import {
  X,
  Store,
  Printer,
  Sliders,
  CheckCircle2,
  Percent,
  Wifi,
  Plus,
  Armchair,
  Tag,
  Hash,
  User,
  Zap,
  Banknote,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { posGetStoreConfig, posUpdateStoreConfig } from "../api/orders.api";

export interface PosSettingsData {
  defaultOrderType: string;
  defaultServiceMode: string;
  enabledServiceModes?: string[];
  autoPrintReceipt: boolean;
  storeDisplayName: string;
  receiptAddress: string;
  receiptPhone: string;
  receiptFooterMessage: string;
  paperSize: "80mm" | "58mm";
  wifiSsid: string;
  wifiPassword: string;
  quickTables: string[];
  quickMarkers?: string[];
  quickDiscounts: number[];
  defaultPaymentMethod: "cash" | "transfer";
  printCashierName: boolean;
}

export const DEFAULT_SETTINGS: PosSettingsData = {
  defaultOrderType: "dine_in",
  defaultServiceMode: "table",
  enabledServiceModes: ["table", "table_marker", "queue_number", "customer_name", "none"],
  autoPrintReceipt: true,
  storeDisplayName: "KONEKT Coffee & Tea",
  receiptAddress: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
  receiptPhone: "0901 234 567",
  receiptFooterMessage: "Cảm ơn quý khách và hẹn gặp lại!",
  paperSize: "80mm",
  wifiSsid: "Konekt_Guest",
  wifiPassword: "konektcoffee",
  quickTables: ["Bàn 1", "Bàn 2", "Bàn 3", "Bàn 4", "Bàn 5", "Bàn 6", "Bàn 7", "Bàn 8", "VIP 1", "Sân Thượng"],
  quickMarkers: ["Thẻ 01", "Thẻ 02", "Thẻ 03", "Thẻ 04", "Thẻ 05", "Thẻ 06", "Thẻ 07", "Thẻ 08", "Thẻ 09", "Thẻ 10"],
  quickDiscounts: [5, 10, 15, 20, 50, 100],
  defaultPaymentMethod: "cash",
  printCashierName: true,
};

export interface ServiceModeOption {
  id: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

export const SERVICE_MODE_OPTIONS: ServiceModeOption[] = [
  {
    id: "table",
    label: "Số Bàn",
    desc: "Quán cafe, nhà hàng, quán ăn ngồi tại chỗ",
    Icon: Armchair,
  },
  {
    id: "table_marker",
    label: "Thẻ Số Để Bàn",
    desc: "Trà sữa, thức ăn nhanh mang số thẻ ra bàn",
    Icon: Tag,
  },
  {
    id: "queue_number",
    label: "Số Thứ Tự (STT)",
    desc: "Tự động nhảy số tăng dần theo ngày in trên bill",
    Icon: Hash,
  },
  {
    id: "customer_name",
    label: "Tên & SĐT Khách",
    desc: "Tiệm bánh, tiệm trà takeaway, spa, dịch vụ",
    Icon: User,
  },
  {
    id: "none",
    label: "Bán Nhanh Tại Quầy",
    desc: "Bán lẻ, tạp hóa, phụ kiện lấy đồ ngay",
    Icon: Zap,
  },
];

type SettingsTab = "service" | "receipt" | "discounts";

export default function PosSettingsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (cfg: PosSettingsData) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("service");
  const [form, setForm] = useState<PosSettingsData>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newTableInput, setNewTableInput] = useState("");
  const [newMarkerInput, setNewMarkerInput] = useState("");
  const [newDiscountInput, setNewDiscountInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setSaveSuccess(false);

    // 1. Đọc từ localStorage trước
    const cached = localStorage.getItem("konekt_pos_config");
    if (cached) {
      try {
        setForm((prev) => ({ ...prev, ...JSON.parse(cached) }));
      } catch (e) {
        console.error("Failed to parse cached config", e);
      }
    }

    // 2. Fetch config từ backend để đồng bộ
    posGetStoreConfig()
      .then((res) => {
        if (res?.ok && res.config) {
          const merged: PosSettingsData = {
            defaultOrderType: res.config.defaultOrderType || DEFAULT_SETTINGS.defaultOrderType,
            defaultServiceMode: res.config.defaultServiceMode || DEFAULT_SETTINGS.defaultServiceMode,
            enabledServiceModes: res.config.enabledServiceModes || DEFAULT_SETTINGS.enabledServiceModes,
            autoPrintReceipt: res.config.autoPrintReceipt ?? DEFAULT_SETTINGS.autoPrintReceipt,
            storeDisplayName: res.config.storeDisplayName || DEFAULT_SETTINGS.storeDisplayName,
            receiptAddress: res.config.receiptAddress || DEFAULT_SETTINGS.receiptAddress,
            receiptPhone: res.config.receiptPhone || DEFAULT_SETTINGS.receiptPhone,
            receiptFooterMessage: res.config.receiptFooterMessage || DEFAULT_SETTINGS.receiptFooterMessage,
            paperSize: res.config.paperSize || DEFAULT_SETTINGS.paperSize,
            wifiSsid: res.config.wifiSsid ?? DEFAULT_SETTINGS.wifiSsid,
            wifiPassword: res.config.wifiPassword ?? DEFAULT_SETTINGS.wifiPassword,
            quickTables: Array.isArray(res.config.quickTables) && res.config.quickTables.length > 0
              ? res.config.quickTables
              : DEFAULT_SETTINGS.quickTables,
            quickMarkers: Array.isArray(res.config.quickMarkers) && res.config.quickMarkers.length > 0
              ? res.config.quickMarkers
              : (DEFAULT_SETTINGS.quickMarkers || []),
            quickDiscounts: Array.isArray(res.config.quickDiscounts) && res.config.quickDiscounts.length > 0
              ? res.config.quickDiscounts
              : DEFAULT_SETTINGS.quickDiscounts,
            defaultPaymentMethod: res.config.defaultPaymentMethod || DEFAULT_SETTINGS.defaultPaymentMethod,
            printCashierName: res.config.printCashierName ?? DEFAULT_SETTINGS.printCashierName,
          };
          setForm(merged);
          localStorage.setItem("konekt_pos_config", JSON.stringify(merged));
        }
      })
      .catch((err) => {
        console.warn("Could not load backend store pos config", err);
      });
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("konekt_pos_config", JSON.stringify(form));
      window.dispatchEvent(new CustomEvent("konekt_pos_config_updated", { detail: form }));
      await posUpdateStoreConfig(form);
      setSaveSuccess(true);
      onSaved?.(form);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (e: any) {
      console.error("Save config error", e);
      localStorage.setItem("konekt_pos_config", JSON.stringify(form));
      window.dispatchEvent(new CustomEvent("konekt_pos_config_updated", { detail: form }));
      setSaveSuccess(true);
      onSaved?.(form);
      setTimeout(() => {
        onClose();
      }, 500);
    } finally {
      setSaving(false);
    }
  };

  const addQuickTable = () => {
    const val = newTableInput.trim();
    if (!val || form.quickTables.includes(val)) return;
    setForm({ ...form, quickTables: [...form.quickTables, val] });
    setNewTableInput("");
  };

  const removeQuickTable = (table: string) => {
    setForm({ ...form, quickTables: form.quickTables.filter((t) => t !== table) });
  };

  const addQuickMarker = () => {
    const val = newMarkerInput.trim();
    const current = form.quickMarkers || DEFAULT_SETTINGS.quickMarkers || [];
    if (!val || current.includes(val)) return;
    setForm({ ...form, quickMarkers: [...current, val] });
    setNewMarkerInput("");
  };

  const removeQuickMarker = (marker: string) => {
    const current = form.quickMarkers || DEFAULT_SETTINGS.quickMarkers || [];
    setForm({ ...form, quickMarkers: current.filter((m) => m !== marker) });
  };

  const addQuickDiscount = () => {
    const val = Number(newDiscountInput.trim());
    if (isNaN(val) || val <= 0 || val > 100 || form.quickDiscounts.includes(val)) return;
    const updated = [...form.quickDiscounts, val].sort((a, b) => a - b);
    setForm({ ...form, quickDiscounts: updated });
    setNewDiscountInput("");
  };

  const removeQuickDiscount = (disc: number) => {
    setForm({ ...form, quickDiscounts: form.quickDiscounts.filter((d) => d !== disc) });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 18, 0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          backgroundColor: "#FAF7F2",
          borderRadius: "20px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #DFD6C7",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #44654D 0%, #344F3C 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sliders size={20} color="#FAF7F2" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                Cài Đặt Web POS · Tùy Chỉnh Đa Ngành
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255, 255, 255, 0.8)" }}>
                Cấu hình chế độ phục vụ, danh sách bàn nhanh, mẫu in hóa đơn K80/K58 & chiết khấu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255, 255, 255, 0.8)",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Sub-header: Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #DFD6C7",
            backgroundColor: "#EBE3D7",
            padding: "0 24px",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("service")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "service" ? "3px solid #3D5E46" : "3px solid transparent",
              color: activeTab === "service" ? "#213224" : "#667064",
              fontWeight: activeTab === "service" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Store size={16} />
            <span>1. Phục Vụ & Định Danh Bàn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("receipt")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "receipt" ? "3px solid #3D5E46" : "3px solid transparent",
              color: activeTab === "receipt" ? "#213224" : "#667064",
              fontWeight: activeTab === "receipt" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Printer size={16} />
            <span>2. Mẫu In Bill & Máy In</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("discounts")}
            style={{
              padding: "12px 16px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "discounts" ? "3px solid #3D5E46" : "3px solid transparent",
              color: activeTab === "discounts" ? "#213224" : "#667064",
              fontWeight: activeTab === "discounts" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Percent size={16} />
            <span>3. Giảm Giá Nhanh & Thanh Toán</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "22px 24px", overflowY: "auto", flex: 1 }}>
          {/* TAB 1: MÔ HÌNH BÁN HÀNG */}
          {activeTab === "service" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#213224" }}>
                    Mô Hình Bán Hàng Của Quán (Chế độ nhận món)
                  </h4>
                  <span style={{ fontSize: "12px", color: "#3D5E46", fontWeight: 700, backgroundColor: "#E3ECE4", padding: "3px 8px", borderRadius: "6px" }}>
                    1 Mô hình duy nhất
                  </span>
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#667064" }}>
                  Chọn 1 mô hình vận hành cố định của quán. Màn hình bán hàng POS sẽ hiển thị đúng cấu hình này để thu ngân thao tác nhanh nhất:
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                  {SERVICE_MODE_OPTIONS.map((opt) => {
                    const isSelected = form.defaultServiceMode === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setForm({ ...form, defaultServiceMode: opt.id })}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px",
                          border: isSelected ? "2px solid #3D5E46" : "1px solid #DFD6C7",
                          backgroundColor: isSelected ? "#E3ECE4" : "#FAF7F2",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: isSelected ? "#3D5E46" : "#213224", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <opt.Icon size={16} /> {opt.label}
                          </span>
                          {isSelected && <CheckCircle2 size={16} color="#3D5E46" />}
                        </div>
                        <span style={{ fontSize: "11px", color: "#667064" }}>{opt.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chi tiết cấu hình theo mô hình đã chọn */}
              {form.defaultServiceMode === "table" && (
                <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#213224" }}>
                        Danh Sách Bàn / Vị Trí Gợi Ý Nhanh (Quick Table Buttons)
                      </h4>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#667064" }}>
                        Thu ngân có thể click 1 chạm để chọn bàn mà không cần gõ bàn phím
                      </p>
                    </div>
                  </div>

                  {/* Form thêm bàn */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input
                      type="text"
                      placeholder="Nhập tên bàn mới (ví dụ: Bàn 9, VIP 2, Tầng 2...)"
                      value={newTableInput}
                      onChange={(e) => setNewTableInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addQuickTable();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DFD6C7",
                        backgroundColor: "#FFFFFF",
                        fontSize: "13px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addQuickTable}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#3D5E46",
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={16} /> Thêm Bàn
                    </button>
                  </div>

                  {/* Chips bàn */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {form.quickTables.map((t) => (
                      <div
                        key={t}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          backgroundColor: "#FAF7F2",
                          borderRadius: "8px",
                          border: "1px solid #DFD6C7",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#27402F",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Armchair size={13} /> {t}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQuickTable(t)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#991B1B",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Xóa bàn này"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.defaultServiceMode === "table_marker" && (
                <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#213224" }}>
                        Danh Sách Thẻ Số Để Bàn / Thẻ Rung Gợi Ý Nhanh (Quick Markers)
                      </h4>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#667064" }}>
                        Thu ngân click 1 chạm để gán thẻ số đưa cho khách mà không cần nhập tay
                      </p>
                    </div>
                  </div>

                  {/* Form thêm thẻ */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input
                      type="text"
                      placeholder="Nhập số thẻ mới (ví dụ: Thẻ 11, Thẻ 12...)"
                      value={newMarkerInput}
                      onChange={(e) => setNewMarkerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addQuickMarker();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DFD6C7",
                        backgroundColor: "#FFFFFF",
                        fontSize: "13px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addQuickMarker}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#3D5E46",
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={16} /> Thêm Thẻ
                    </button>
                  </div>

                  {/* Chips thẻ số */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(form.quickMarkers || DEFAULT_SETTINGS.quickMarkers || []).map((m) => (
                      <div
                        key={m}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          backgroundColor: "#FAF7F2",
                          borderRadius: "8px",
                          border: "1px solid #DFD6C7",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#27402F",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Tag size={13} /> {m}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQuickMarker(m)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#991B1B",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Xóa thẻ này"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.defaultServiceMode === "queue_number" && (
                <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                  <div style={{ padding: "16px 20px", backgroundColor: "#FAF7F2", borderRadius: "12px", border: "1px solid #DFD6C7" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <Hash size={24} color="#3D5E46" />
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#213224" }}>
                        Mô Hình Số Thứ Tự (STT) Tự Động Theo Hóa Đơn
                      </h4>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#445041", lineHeight: 1.6 }}>
                      Khi bật mô hình này, màn hình POS sẽ không yêu cầu thu ngân nhập số bàn hay thẻ. Hệ thống sẽ tự động cấp số thứ tự tăng dần theo ngày (VD: <b>#01</b>, <b>#02</b>, <b>#03</b>...) và in nổi bật lên hóa đơn để khách nhìn số lấy đồ tại quầy nhận món.
                    </p>
                  </div>
                </div>
              )}

              {form.defaultServiceMode === "none" && (
                <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                  <div style={{ padding: "16px 20px", backgroundColor: "#FAF7F2", borderRadius: "12px", border: "1px solid #DFD6C7" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <Zap size={24} color="#3D5E46" />
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#213224" }}>
                        Mô Hình Bán Nhanh Tại Quầy (Takeaway / Fast-Casual)
                      </h4>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#445041", lineHeight: 1.6 }}>
                      Dành cho ki-ốt, quầy bán đồ mang đi hoặc bán lẻ. Thu ngân chọn món và bấm thanh toán ngay, bỏ qua hoàn toàn các bước nhập định danh, tối ưu tốc độ thanh toán tối đa.
                    </p>
                  </div>
                </div>
              )}

              {form.defaultServiceMode === "customer_name" && (
                <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                  <div style={{ padding: "16px 20px", backgroundColor: "#FAF7F2", borderRadius: "12px", border: "1px solid #DFD6C7" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <User size={24} color="#3D5E46" />
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#213224" }}>
                        Mô Hình Gọi Tên & SĐT Khách Hàng
                      </h4>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#445041", lineHeight: 1.6 }}>
                      Màn hình POS sẽ hiển thị ô nhập Tên và Số điện thoại khách hàng. Phù hợp cho các tiệm trà sữa, tiệm bánh hoặc spa cần gọi tên khách khi sản phẩm hoàn thành.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MẪU IN HÓA ĐƠN & MÁY IN */}
          {activeTab === "receipt" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px" }}>
              {/* Cột trái: Cài đặt thông số in bill */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#213224", marginBottom: "4px" }}>
                    Khổ Giấy In Hóa Đơn
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: form.paperSize === "80mm" ? "2px solid #3D5E46" : "1px solid #DFD6C7",
                        backgroundColor: form.paperSize === "80mm" ? "#E3ECE4" : "#FAF7F2",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#213224",
                      }}
                    >
                      <input
                        type="radio"
                        name="paperSize"
                        checked={form.paperSize === "80mm"}
                        onChange={() => setForm({ ...form, paperSize: "80mm" })}
                        style={{ accentColor: "#3D5E46" }}
                      />
                      <span>K80 (80mm - Tiêu chuẩn)</span>
                    </label>

                    <label
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: form.paperSize === "58mm" ? "2px solid #3D5E46" : "1px solid #DFD6C7",
                        backgroundColor: form.paperSize === "58mm" ? "#E3ECE4" : "#FAF7F2",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#213224",
                      }}
                    >
                      <input
                        type="radio"
                        name="paperSize"
                        checked={form.paperSize === "58mm"}
                        onChange={() => setForm({ ...form, paperSize: "58mm" })}
                        style={{ accentColor: "#3D5E46" }}
                      />
                      <span>K58 (58mm - Máy mini)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#445041", marginBottom: "4px" }}>
                    Tên Quán / Cửa Hàng In Trên Bill
                  </label>
                  <input
                    type="text"
                    value={form.storeDisplayName}
                    onChange={(e) => setForm({ ...form, storeDisplayName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DFD9CE",
                      backgroundColor: "#FFFFFF",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#445041", marginBottom: "4px" }}>
                      Địa Chỉ Quán
                    </label>
                    <input
                      type="text"
                      value={form.receiptAddress}
                      onChange={(e) => setForm({ ...form, receiptAddress: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DFD9CE",
                        backgroundColor: "#FFFFFF",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#445041", marginBottom: "4px" }}>
                      Hotline
                    </label>
                    <input
                      type="text"
                      value={form.receiptPhone}
                      onChange={(e) => setForm({ ...form, receiptPhone: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #DFD9CE",
                        backgroundColor: "#FFFFFF",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Wi-Fi quán in trên bill */}
                <div style={{ padding: "12px", backgroundColor: "#F2EBE0", borderRadius: "10px", border: "1px solid #DFD6C7" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <Wifi size={16} color="#3D5E46" />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#3D5E46" }}>
                      Thông Tin Wi-Fi Quán (In lên chân bill cho khách)
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <input
                      type="text"
                      placeholder="Tên Wi-Fi (SSID)"
                      value={form.wifiSsid}
                      onChange={(e) => setForm({ ...form, wifiSsid: e.target.value })}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #DFD6C7",
                        backgroundColor: "#FFFFFF",
                        fontSize: "12px",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Mật khẩu Wi-Fi"
                      value={form.wifiPassword}
                      onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #DFD6C7",
                        backgroundColor: "#FFFFFF",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#445041", marginBottom: "4px" }}>
                    Lời Cảm Ơn / Ghi Chú Chân Bill
                  </label>
                  <input
                    type="text"
                    value={form.receiptFooterMessage}
                    onChange={(e) => setForm({ ...form, receiptFooterMessage: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DFD6C7",
                      backgroundColor: "#FFFFFF",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Toggle Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#213224", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.autoPrintReceipt}
                      onChange={(e) => setForm({ ...form, autoPrintReceipt: e.target.checked })}
                      style={{ accentColor: "#3D5E46", width: "16px", height: "16px" }}
                    />
                    <span>Tự động mở hộp thoại in sau khi hoàn tất thanh toán</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#213224", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.printCashierName}
                      onChange={(e) => setForm({ ...form, printCashierName: e.target.checked })}
                      style={{ accentColor: "#3D5E46", width: "16px", height: "16px" }}
                    />
                    <span>In tên thu ngân trên hóa đơn</span>
                  </label>
                </div>
              </div>

              {/* Cột phải: Live Preview Bill Nhiệt */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px dashed #A8A29E",
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: form.paperSize === "58mm" ? "11px" : "12px",
                  color: "#1E293B",
                  display: "flex",
                  flexDirection: "column",
                  alignSelf: "flex-start",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ textAlign: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    {form.storeDisplayName || "KONEKT Coffee"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                    {form.receiptAddress || "123 Đường Nguyễn Huệ, Q.1"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>
                    Hotline: {form.receiptPhone || "0901 234 567"}
                  </div>
                  <div style={{ margin: "6px 0", borderTop: "1px dashed #94A3B8" }} />
                  <div style={{ fontWeight: "bold", fontSize: "13px" }}>PHIẾU THANH TOÁN</div>
                  <div style={{ fontSize: "10px", color: "#64748B" }}>HĐ: #ORD-2026-8899 · 10/09/2026 09:30</div>
                </div>

                <div style={{ fontSize: "11px", marginBottom: "6px" }}>
                  <div>Định danh: <b>Bàn 04 (Tầng 1)</b></div>
                  {form.printCashierName && <div>Thu ngân: Thu ngân 1</div>}
                </div>

                <div style={{ borderTop: "1px dashed #94A3B8", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", padding: "2px 0" }}>
                  <span>Món</span>
                  <span>T.Tiền</span>
                </div>
                <div style={{ borderTop: "1px dashed #94A3B8", margin: "2px 0 6px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>1x Cà Phê Muối (M)</span>
                  <span>35.000đ</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>2x Trà Sữa Oolong (L)</span>
                  <span>90.000đ</span>
                </div>
                <div style={{ fontSize: "10px", color: "#64748B", paddingLeft: "10px" }}>- Ít đường, ít đá</div>

                <div style={{ borderTop: "1px dashed #94A3B8", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tạm tính:</span>
                  <span>125.000đ</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#15803D" }}>
                  <span>Giảm giá (10%):</span>
                  <span>-12.500đ</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", marginTop: "4px" }}>
                  <span>TỔNG CỘNG:</span>
                  <span>112.500đ</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                  <span>Tiền mặt:</span>
                  <span>112.500đ</span>
                </div>

                <div style={{ borderTop: "1px dashed #94A3B8", margin: "8px 0" }} />
                {(form.wifiSsid || form.wifiPassword) && (
                  <div style={{ textAlign: "center", fontSize: "11px", margin: "4px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Wifi size={12} />
                    <span>Wi-Fi: <b>{form.wifiSsid || "Free"}</b> | Pass: <b>{form.wifiPassword || "None"}</b></span>
                  </div>
                )}
                <div style={{ textAlign: "center", fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>
                  {form.receiptFooterMessage || "Cảm ơn quý khách!"}
                </div>
                <div style={{ textAlign: "center", fontSize: "9px", color: "#94A3B8", marginTop: "4px" }}>
                  Powered by KONEKT Web POS ({form.paperSize})
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GIẢM GIÁ NHANH & THANH TOÁN */}
          {activeTab === "discounts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Giảm giá nhanh */}
              <div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "#213224" }}>
                  Cấu Hình Phím Giảm Giá Nhanh (% Quick Discounts)
                </h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#667064" }}>
                  Các nút chiết khấu phần trăm sẽ hiển thị trực tiếp trên giỏ hàng để thu ngân áp dụng nhanh:
                </p>

                {/* Form thêm % giảm */}
                <div style={{ display: "flex", gap: "8px", maxWidth: "360px", marginBottom: "12px" }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Nhập % giảm (ví dụ: 25, 30...)"
                    value={newDiscountInput}
                    onChange={(e) => setNewDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addQuickDiscount();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #DFD6C7",
                      backgroundColor: "#FFFFFF",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={addQuickDiscount}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#3D5E46",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} /> Thêm %
                  </button>
                </div>

                {/* Chips giảm giá */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {form.quickDiscounts.map((disc) => (
                    <div
                      key={disc}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        backgroundColor: "#FAF7F2",
                        borderRadius: "8px",
                        border: "1px solid #DFD6C7",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#2E7D32",
                      }}
                    >
                      <span>Giảm {disc}%</span>
                      <button
                        type="button"
                        onClick={() => removeQuickDiscount(disc)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#991B1B",
                          padding: "2px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phương thức thanh toán ưu tiên */}
              <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "18px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "#213224" }}>
                  Phương Thức Thanh Toán Mặc Định Khi Mở Màn Hình Trả Tiền
                </h4>
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                  <label
                    style={{
                      padding: "12px 18px",
                      borderRadius: "10px",
                      border: form.defaultPaymentMethod === "cash" ? "2px solid #3D5E46" : "1px solid #DFD6C7",
                      backgroundColor: form.defaultPaymentMethod === "cash" ? "#E3ECE4" : "#FAF7F2",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#213224",
                    }}
                  >
                    <input
                      type="radio"
                      name="defaultPaymentMethod"
                      checked={form.defaultPaymentMethod === "cash"}
                      onChange={() => setForm({ ...form, defaultPaymentMethod: "cash" })}
                      style={{ accentColor: "#3D5E46" }}
                    />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Banknote size={15} /> Tiền Mặt (Khách đưa tiền & tính tiền thối)
                    </span>
                  </label>

                  <label
                    style={{
                      padding: "12px 18px",
                      borderRadius: "10px",
                      border: form.defaultPaymentMethod === "transfer" ? "2px solid #3D5E46" : "1px solid #DFD6C7",
                      backgroundColor: form.defaultPaymentMethod === "transfer" ? "#E3ECE4" : "#FAF7F2",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#213224",
                    }}
                  >
                    <input
                      type="radio"
                      name="defaultPaymentMethod"
                      checked={form.defaultPaymentMethod === "transfer"}
                      onChange={() => setForm({ ...form, defaultPaymentMethod: "transfer" })}
                      style={{ accentColor: "#3D5E46" }}
                    />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <QrCode size={15} /> Chuyển Khoản VietQR Tự Động
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#EBE3D7",
            borderTop: "1px solid #DFD6C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {saveSuccess && (
              <span style={{ fontSize: "13px", color: "#2E7D32", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                <CheckCircle2 size={16} /> Đã lưu cấu hình POS thành công!
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "10px",
                border: "1px solid #DFD6C7",
                backgroundColor: "#FAF7F2",
                color: "#445041",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "9px 24px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#3D5E46",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: "0 2px 6px rgba(61, 94, 70, 0.3)",
              }}
            >
              {saving ? "Đang lưu..." : "Lưu Cài Đặt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
