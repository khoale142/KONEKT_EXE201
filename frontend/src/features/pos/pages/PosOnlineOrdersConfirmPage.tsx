import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  posConfirmOnlineOrder,
  posListOnlinePendingOrders,
  type PosOnlinePendingOrderListItem,
  type PosServiceMode,
} from "../api/orders.api";

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")}d`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function PosOnlineOrdersConfirmPage() {
  const nav = useNavigate();
  const numbers = useMemo(() => Array.from({ length: 24 }, (_, i) => i + 1), []);

  const [orderCode, setOrderCode] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [orders, setOrders] = useState<PosOnlinePendingOrderListItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedPickupNumber, setSelectedPickupNumber] = useState<number | null>(null);
  const [serviceMode, setServiceMode] = useState<PosServiceMode>("IN_STORE");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await posListOnlinePendingOrders({
        orderCode: orderCode.trim() || undefined,
        memberPhone: memberPhone.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setOrders(r.orders || []);
      setSelectedOrderId((prev) => (r.orders.some((x) => x.id === prev) ? prev : null));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Không tải được danh sách đơn online");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const selectedOrder = orders.find((x) => x.id === selectedOrderId) || null;

  const onConfirm = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedOrder) {
      setError("Vui lòng chọn đơn online cần xác nhận");
      return;
    }
    if (!selectedPickupNumber) {
      setError("Vui lòng chọn số thẻ");
      return;
    }

    setConfirming(true);
    try {
      const r = await posConfirmOnlineOrder(selectedOrder.id, {
        pickupNumber: selectedPickupNumber,
        serviceMode,
      });
      setSuccess(`Đã xác nhận đơn ${r.order.orderCode} với số thẻ ${r.order.pickupNumber}. Đơn đã vào KDS.`);
      setSelectedOrderId(null);
      setServiceMode("IN_STORE");
      await loadOrders();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Xác nhận đơn online thất bại");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="pos-screen pos-ui pos-online-orders-page">
      <div className="pos-shell pos-shell--wide">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Online order intake</div>
            <h2 className="pos-topbar__title">Xác nhận đơn online</h2>
            <p className="pos-topbar__subtitle">
              Đơn online chỉ vào KDS sau khi POS gán số thẻ pickup và confirm.
            </p>
          </div>

          <div className="pos-inline-actions">
            <button onClick={() => nav("/pos/pickup")}>Về chọn số thẻ</button>
            <button onClick={() => nav("/pos", { replace: true })}>Về dashboard</button>
          </div>
        </div>

        <div className="pos-stack" style={{ marginTop: 18 }}>
          <div className="pos-panel">
            <div className="pos-filter-grid pos-filter-grid--3">
              <label className="pos-field">
                <span className="pos-field__label">Mã đơn</span>
                <input
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  placeholder="Tìm theo mã đơn"
                />
              </label>

              <label className="pos-field">
                <span className="pos-field__label">Số điện thoại</span>
                <input
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="Tìm theo số điện thoại"
                />
              </label>

              <div className="pos-field">
                <span className="pos-field__label">Tải danh sách</span>
                <button onClick={loadOrders} disabled={loading}>
                  {loading ? "Đang tải..." : "Tải danh sách"}
                </button>
              </div>
            </div>
          </div>

          <div className="pos-panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Chọn số thẻ pickup</h3>
                <div className="pos-muted" style={{ marginTop: 4 }}>
                  Số thẻ sẽ được gán cho đơn được chọn để đẩy sang KDS.
                </div>
              </div>

              {selectedPickupNumber ? (
                <span className="pos-badge pos-badge--info">Số thẻ {selectedPickupNumber}</span>
              ) : null}
            </div>

            <div className="pos-pickup-grid">
              {numbers.map((n) => {
                const active = selectedPickupNumber === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedPickupNumber(n)}
                    className={active ? "pos-pickup-button is-active" : "pos-pickup-button"}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pos-panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Chọn hình thức phục vụ</h3>
                <div className="pos-muted" style={{ marginTop: 4 }}>
                  Xác định đơn này mang đi hay dùng tại quán trước khi đưa vào KDS.
                </div>
              </div>

              <span className="pos-badge pos-badge--info">
                {serviceMode === "IN_STORE" ? "Tại quán" : "Mang đi"}
              </span>
            </div>

            <div className="pos-chip-row">
              {(["IN_STORE", "TAKE_AWAY"] as PosServiceMode[]).map((modeValue) => (
                <button
                  key={modeValue}
                  type="button"
                  onClick={() => setServiceMode(modeValue)}
                  className={serviceMode === modeValue ? "pos-select-card is-active" : "pos-select-card"}
                  style={{ padding: "10px 14px" }}
                >
                  {modeValue === "IN_STORE" ? "Tại quán" : "Mang đi"}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}
          {success ? <div className="pos-alert pos-alert--success">{success}</div> : null}

          <div className="pos-panel pos-panel--soft">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div className="pos-stack pos-stack--compact" style={{ gap: 8 }}>
                <div style={{ fontWeight: 800 }}>
                  {selectedOrder ? `Đơn đã chọn: ${selectedOrder.orderCode}` : "Chưa chọn đơn online"}
                </div>
                <div className="pos-muted">
                  {selectedPickupNumber ? `Số thẻ pickup: ${selectedPickupNumber}` : "Chưa chọn số thẻ"}
                </div>
                <div className="pos-muted">
                  Hình thức: {serviceMode === "IN_STORE" ? "Tại quán" : "Mang đi"}
                </div>
              </div>

              <button
                onClick={onConfirm}
                disabled={!selectedOrder || !selectedPickupNumber || confirming}
              >
                {confirming ? "Đang confirm..." : "Confirm và đưa vào KDS"}
              </button>
            </div>
          </div>

          <div className="pos-card-grid">
            {orders.length === 0 ? (
              <div className="pos-empty-state">Không có đơn online nào đang chờ xác nhận.</div>
            ) : (
              orders.map((order) => {
                const active = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                  className={active ? "pos-select-card is-active" : "pos-select-card"}
                  style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 18,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div className="pos-stack pos-stack--compact" style={{ gap: 8 }}>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>{order.orderCode}</div>
                        <div className="pos-muted">
                          Khách: {order.customerName || "-"}
                          {order.customerPhone ? ` • ${order.customerPhone}` : ""}
                        </div>
                        <div className="pos-muted">Tạo lúc: {formatDateTime(order.createdAt)}</div>
                        <div className="pos-muted">
                          Thanh toán: {formatDateTime(order.paidAt || order.createdAt)}
                        </div>
                      </div>

                      <div style={{ fontWeight: 900, fontSize: 22 }}>{formatMoney(order.finalAmount)}</div>
                    </div>

                    {order.pickupDelayNotice ? (
                      <div className="pos-alert pos-alert--warning" style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="pos-badge pos-badge--warning">Khách báo bận</span>
                          <span>Khách chưa thể tới lấy ngay.</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          Lý do: {order.pickupDelayNotice.reason}
                        </div>
                        {order.pickupDelayNotice.expectedArrivalAt ? (
                          <div style={{ marginTop: 4, fontSize: 13 }}>
                            Dự kiến ghé lấy: {formatDateTime(order.pickupDelayNotice.expectedArrivalAt)}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          Gửi lúc: {formatDateTime(order.pickupDelayNotice.createdAt)}
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
