import { useEffect } from "react";
import { Printer, CheckCircle2, ArrowRight, X, Wifi } from "lucide-react";
import type { PosSettingsData } from "./PosSettingsModal";

export interface ReceiptOrderData {
  orderId: number;
  orderCode: string;
  createdAt?: string;
  cashierName?: string;
  serviceModeLabel: string;
  serviceIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    size?: string;
    qty: number;
    price: number;
    note?: string;
  }>;
  combos?: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  giftItems?: Array<{
    name: string;
    qty: number;
  }>;
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  finalAmount: number;
  paymentMethod: string;
  cashReceived?: number;
  changeAmount?: number;
}

export default function PosReceiptModal({
  open,
  order,
  config,
  onClose,
  onNewOrder,
}: {
  open: boolean;
  order: ReceiptOrderData | null;
  config: PosSettingsData;
  onClose: () => void;
  onNewOrder: () => void;
}) {
  useEffect(() => {
    if (!open || !order) return;

    // Tự động in nếu được bật trong setting
    if (config.autoPrintReceipt) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [open, order, config.autoPrintReceipt]);

  // Phím tắt: Enter hoặc Space để tạo đơn mới
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSmall58 = config.paperSize === "58mm";

  return (
    <div
      className="konekt-receipt-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 18, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
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
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .konekt-receipt-modal-backdrop,
          .konekt-receipt-print-area,
          .konekt-receipt-print-area * {
            visibility: visible;
          }
          .konekt-receipt-modal-backdrop {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .konekt-no-print {
            display: none !important;
          }
          .konekt-receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${isSmall58 ? "58mm" : "80mm"} !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: isSmall58 ? "420px" : "460px",
          maxHeight: "92vh",
          backgroundColor: "#FAF7F2",
          borderRadius: "20px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #DFD6C7",
        }}
      >
        {/* Header Thông báo thanh toán thành công (no-print) */}
        <div
          className="konekt-no-print"
          style={{
            padding: "16px 20px",
            backgroundColor: "#2E7D32",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={24} color="#FFFFFF" />
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                Thanh Toán Thành Công!
              </h3>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>
                Đơn hàng #{order.orderCode} đã hoàn tất
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#FFFFFF",
              padding: "4px",
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thân Hóa Đơn (Khu vực in) */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            flex: 1,
            backgroundColor: "#EFECE6",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            className="konekt-receipt-print-area"
            style={{
              width: "100%",
              maxWidth: isSmall58 ? "320px" : "360px",
              backgroundColor: "#FFFFFF",
              borderRadius: "8px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
              padding: isSmall58 ? "14px 12px" : "18px 16px",
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: isSmall58 ? "11px" : "12px",
              color: "#0F172A",
              lineHeight: 1.4,
              boxSizing: "border-box",
            }}
          >
            {/* Header Bill */}
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: isSmall58 ? "14px" : "16px", fontWeight: "bold", letterSpacing: "-0.01em" }}>
                {config.storeDisplayName || "KONEKT Coffee & Tea"}
              </div>
              {config.receiptAddress && (
                <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                  {config.receiptAddress}
                </div>
              )}
              {config.receiptPhone && (
                <div style={{ fontSize: "10px", color: "#475569" }}>
                  Hotline: {config.receiptPhone}
                </div>
              )}
              <div style={{ margin: "6px 0", borderTop: "1px dashed #64748B" }} />
              <div style={{ fontWeight: "bold", fontSize: isSmall58 ? "13px" : "14px" }}>
                HÓA ĐƠN THANH TOÁN
              </div>
              <div style={{ fontSize: "10px", color: "#64748B" }}>
                Mã đơn: #{order.orderCode}
              </div>
              <div style={{ fontSize: "10px", color: "#64748B" }}>
                {order.createdAt || new Date().toLocaleString("vi-VN")}
              </div>
            </div>

            {/* Thông tin phục vụ & thu ngân */}
            <div style={{ fontSize: "11px", marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Định danh:</span>
                <b>
                  {order.serviceModeLabel}
                  {order.serviceIdentifier ? `: ${order.serviceIdentifier}` : ""}
                </b>
              </div>
              {order.customerName && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Khách hàng:</span>
                  <span>{order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ""}</span>
                </div>
              )}
              {config.printCashierName && order.cashierName && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Thu ngân:</span>
                  <span>{order.cashierName}</span>
                </div>
              )}
            </div>

            {/* Tiêu đề bảng món */}
            <div style={{ borderTop: "1px dashed #64748B", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", padding: "2px 0" }}>
              <span>Tên món</span>
              <span>T.Tiền</span>
            </div>
            <div style={{ borderTop: "1px dashed #64748B", margin: "2px 0 6px 0" }} />

            {/* Danh sách món */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {order.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {it.qty}x {it.name} {it.size ? `(${it.size})` : ""}
                    </span>
                    <span>{(it.price * it.qty).toLocaleString()}đ</span>
                  </div>
                  {it.note && (
                    <span style={{ fontSize: "10px", color: "#64748B", paddingLeft: "10px" }}>
                      - {it.note}
                    </span>
                  )}
                </div>
              ))}

              {/* Combo Items */}
              {order.combos?.map((cb, idx) => (
                <div key={`cb-${idx}`} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{cb.qty}x [Combo] {cb.name}</span>
                  <span>{(cb.price * cb.qty).toLocaleString()}đ</span>
                </div>
              ))}

              {/* Gift Items */}
              {order.giftItems?.map((g, idx) => (
                <div key={`g-${idx}`} style={{ display: "flex", justifyContent: "space-between", color: "#2E7D32" }}>
                  <span>{g.qty}x [TẶNG] {g.name}</span>
                  <span>0đ</span>
                </div>
              ))}
            </div>

            {/* Tóm tắt tiền */}
            <div style={{ borderTop: "1px dashed #64748B", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tạm tính:</span>
              <span>{order.subtotal.toLocaleString()}đ</span>
            </div>

            {order.discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#15803D" }}>
                <span>Giảm giá {order.discountReason ? `(${order.discountReason})` : ""}:</span>
                <span>-{order.discountAmount.toLocaleString()}đ</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: isSmall58 ? "13px" : "14px",
                marginTop: "4px",
                padding: "2px 0",
              }}
            >
              <span>TỔNG THANH TOÁN:</span>
              <span>{order.finalAmount.toLocaleString()}đ</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginTop: "2px" }}>
              <span>Phương thức:</span>
              <span>{order.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản QR"}</span>
            </div>

            {order.paymentMethod === "cash" && order.cashReceived != null && order.cashReceived > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569" }}>
                  <span>Tiền khách đưa:</span>
                  <span>{order.cashReceived.toLocaleString()}đ</span>
                </div>
                {order.changeAmount != null && order.changeAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "bold", color: "#1E293B" }}>
                    <span>Tiền thối lại:</span>
                    <span>{order.changeAmount.toLocaleString()}đ</span>
                  </div>
                )}
              </>
            )}

            {/* Chân Bill: Wi-Fi & Lời cảm ơn */}
            <div style={{ borderTop: "1px dashed #64748B", margin: "8px 0" }} />
            {(config.wifiSsid || config.wifiPassword) && (
              <div style={{ textAlign: "center", fontSize: "11px", margin: "4px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Wifi size={12} />
                <span>Wi-Fi: <b>{config.wifiSsid || "Free"}</b> | Pass: <b>{config.wifiPassword || "None"}</b></span>
              </div>
            )}
            <div style={{ textAlign: "center", fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>
              {config.receiptFooterMessage || "Cảm ơn quý khách và hẹn gặp lại!"}
            </div>
            <div style={{ textAlign: "center", fontSize: "9px", color: "#94A3B8", marginTop: "6px" }}>
              Powered by KONEKT Web POS
            </div>
          </div>
        </div>

        {/* Footer Actions (no-print) */}
        <div
          className="konekt-no-print"
          style={{
            padding: "14px 20px",
            backgroundColor: "#FAF8F5",
            borderTop: "1px solid #DFD6C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={handlePrint}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #3D5E46",
              backgroundColor: "#FAF7F2",
              color: "#3D5E46",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Printer size={16} />
            <span>In Hóa Đơn</span>
          </button>

          <button
            onClick={onNewOrder}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 22px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#3D5E46",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(61, 94, 70, 0.3)",
            }}
          >
            <span>Tạo Đơn Mới</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
