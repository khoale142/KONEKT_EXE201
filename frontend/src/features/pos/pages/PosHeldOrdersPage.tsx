import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  posDeleteHeldOrder,
  posListHeldOrders,
} from "../api/orders.api";
import {
  RefreshCw,
  Play,
  Trash2,
  Plus,
  Clock,
  Armchair,
  Tag,
  Hash,
  User,
  Zap,
  ClipboardList,
  Coffee,
  type LucideIcon,
} from "lucide-react";

type HeldOrder = Awaited<ReturnType<typeof posListHeldOrders>>["orders"][number];

function getServiceModeDisplay(o: any): { label: string; Icon: LucideIcon } {
  const mode = o.serviceMode || (o.pickupNumber ? "table_marker" : "none");
  const id = o.serviceIdentifier || (o.pickupNumber ? String(o.pickupNumber) : "");

  switch (mode) {
    case "table":
      return { label: `Số Bàn: ${id || "Chưa đặt"}`, Icon: Armchair };
    case "table_marker":
      return { label: `Thẻ Số: ${id || o.pickupNumber || "-"}`, Icon: Tag };
    case "queue_number":
      return { label: `STT: #${id || o.queueNumber || "-"}`, Icon: Hash };
    case "customer_name":
      return { label: `Khách: ${o.customerName || id || "Khách lẻ"}`, Icon: User };
    case "none":
    default:
      return { label: "Bán nhanh tại quầy", Icon: Zap };
  }
}

export default function PosHeldOrdersPage() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await posListHeldOrders();
      setOrders(r.orders || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Tải danh sách đơn giữ thất bại");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteHeld = async (orderId: number) => {
    if (!confirm("Bạn có chắc chắn muốn hủy và xóa đơn tạm giữ này không?")) return;
    try {
      setBusyId(orderId);
      setError(null);
      await posDeleteHeldOrder(orderId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Hủy đơn giữ thất bại");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        padding: "20px 24px",
        backgroundColor: "#EFE9DF",
        fontFamily: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#213224", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={22} color="#3D5E46" /> Danh Sách Đơn Đang Tạm Giữ
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#667064" }}>
            Đơn khách đặt nhưng tạm dừng hoặc chờ thêm món. Click để mở lại và thanh toán.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={load}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #DFD6C7",
              backgroundColor: "#FAF7F2",
              color: "#3D5E46",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => nav("/pos")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#3D5E46",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(61, 94, 70, 0.25)",
            }}
          >
            <Plus size={16} />
            <span>Tạo Đơn Mới</span>
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: "14px", backgroundColor: "#E3ECE4", borderRadius: "10px", color: "#27402F", fontSize: "13px" }}>
          Đang tải danh sách đơn giữ...
        </div>
      )}

      {error && (
        <div style={{ padding: "14px", backgroundColor: "#FEE2E2", borderRadius: "10px", color: "#991B1B", fontSize: "13px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {/* Grid danh sách đơn giữ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
        {orders.map((o) => {
          const serviceInfo = getServiceModeDisplay(o);
          return (
            <div
              key={o.id}
              style={{
                backgroundColor: "#FAF7F2",
                borderRadius: "14px",
                border: "1px solid #DFD6C7",
                padding: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              <div>
                {/* Order Top: Mã đơn & Thời gian */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "#213224" }}>
                      #{o.orderCode}
                    </span>
                    <div style={{ fontSize: "12px", color: "#667064", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                      <Clock size={13} />
                      <span>{new Date(o.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {new Date(o.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Đang Giữ
                  </span>
                </div>

                {/* Badge Phục vụ & Định danh */}
                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      backgroundColor: "#E3ECE4",
                      color: "#27402F",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <serviceInfo.Icon size={13} color="#27402F" />
                    <span>{serviceInfo.label}</span>
                  </span>

                  {o.orderType && o.orderType !== "NORMAL" && (
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "8px",
                        backgroundColor: "#FEE2E2",
                        color: "#991B1B",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {o.orderType}
                    </span>
                  )}
                </div>

                {/* Danh sách món tóm tắt */}
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    backgroundColor: "#F2EBE0",
                    borderRadius: "10px",
                    border: "1px solid #DFD6C7",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "140px",
                    overflowY: "auto",
                  }}
                >
                  {o.items.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        color: "#334155",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {it.quantity}x {it.variantName || it.productName || `Món #${it.productVariantId}`}
                      </span>
                      {it.note && (
                        <span style={{ color: "#64748B", fontStyle: "italic", fontSize: "11px" }}>
                          ({it.note})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom: Tiền & Nút thao tác */}
              <div style={{ borderTop: "1px solid #DFD6C7", paddingTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#667064" }}>Tổng tiền:</span>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "#213224" }}>
                    {Number(o.finalAmount || 0).toLocaleString()}đ
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
                  <button
                    onClick={() => nav(`/pos?heldOrderId=${o.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "9px 14px",
                      borderRadius: "10px",
                      border: "none",
                      backgroundColor: "#3D5E46",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Play size={15} />
                    <span>Mở Lại & Thanh Toán</span>
                  </button>

                  <button
                    onClick={() => handleDeleteHeld(o.id)}
                    disabled={busyId === o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid #FCA5A5",
                      backgroundColor: "#FEF2F2",
                      color: "#B91C1C",
                      fontSize: "13px",
                      cursor: busyId === o.id ? "not-allowed" : "pointer",
                    }}
                    title="Xóa đơn giữ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && orders.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            backgroundColor: "#FAF7F2",
            borderRadius: "16px",
            border: "1px dashed #DFD6C7",
            color: "#667064",
          }}
        >
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
            <Coffee size={40} color="#667064" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#213224" }}>
            Không có đơn hàng nào đang tạm giữ
          </div>
          <p style={{ margin: "6px 0 16px 0", fontSize: "13px" }}>
            Khi khách cần giữ đơn để chọn thêm món, bấm nút "Giữ đơn" tại màn hình bán hàng.
          </p>
          <button
            onClick={() => nav("/pos")}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#3D5E46",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Đến Màn Hình Bán Hàng
          </button>
        </div>
      )}
    </div>
  );
}
