import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  posCancelHeldOrder,
  posListHeldOrders,
} from "../api/orders.api";

type HeldOrder = Awaited<ReturnType<typeof posListHeldOrders>>["orders"][number];

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
      setError(e?.response?.data?.message || e.message || "Load held orders failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancelHold = async (orderId: number) => {
    try {
      setBusyId(orderId);
      setError(null);
      await posCancelHeldOrder(orderId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Cancel held order failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pos-screen pos-ui pos-held-page">
      <div className="pos-shell pos-shell--medium">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Held orders</div>
            <h2 className="pos-topbar__title">Đơn đang giữ</h2>
            <p className="pos-topbar__subtitle">
              Theo dõi đơn tạm giữ tại quầy để mở lại và thanh toán tiếp khi cần.
            </p>
          </div>

          <div className="pos-inline-actions">
            <button onClick={() => nav("/pos")}>Về dashboard</button>
            <button onClick={load}>Tải lại</button>
            <button onClick={() => nav("/pos/pickup")}>Tạo đơn mới</button>
          </div>
        </div>

        {loading ? <div className="pos-alert pos-alert--info">Đang tải đơn giữ...</div> : null}
        {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}

        <div className="pos-card-grid" style={{ marginTop: 18 }}>
          {orders.map((o) => (
            <div
              key={o.id}
              className="pos-list-card"
              style={{ padding: 16 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{o.orderCode}</div>
                  <div className="pos-muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 6 }}>Số thẻ: {o.pickupNumber ?? "-"}</div>
                  <div style={{ marginTop: 4 }}>
                    Tổng: {Number(o.finalAmount || 0).toLocaleString()}d
                  </div>

                  {o.orderType && o.orderType !== "NORMAL" ? (
                    <div style={{ marginTop: 8 }}>
                      <span className="pos-badge pos-badge--warning">{o.orderType}</span>
                      {o.specialNote ? (
                        <div className="pos-muted" style={{ marginTop: 6, fontSize: 12 }}>
                          {o.specialNote}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="pos-inline-actions" style={{ alignItems: "flex-start" }}>
                  <button onClick={() => nav(`/pos/order?pickup=${o.pickupNumber}&heldOrderId=${o.id}`)}>
                    Mở lại và thanh toán
                  </button>
                  <button
                    onClick={() => cancelHold(o.id)}
                    disabled={busyId === o.id}
                    style={{ color: "#b91c1c" }}
                  >
                    {busyId === o.id ? "Đang hủy..." : "Hủy đơn giữ"}
                  </button>
                </div>
              </div>

              <div className="pos-card-grid" style={{ marginTop: 14 }}>
                {o.items.map((it) => (
                  <div
                    key={it.id}
                    className="pos-summary-box"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div>{it.variantName || it.productName || `variant#${it.productVariantId}`}</div>
                      {it.note ? (
                        <div className="pos-muted" style={{ marginTop: 4, fontSize: 12 }}>
                          Note: {it.note}
                        </div>
                      ) : null}
                    </div>
                    <div>x {it.quantity}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!loading && orders.length === 0 ? (
            <div className="pos-panel pos-panel--soft pos-muted">Không có đơn đang giữ</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

