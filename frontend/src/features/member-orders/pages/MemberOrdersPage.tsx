import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { memberOrdersApi, type MemberOrderListItem } from "../api/memberOrders.api";
import { getStoreLocations, type StoreLocation } from "../../stores/api/stores.api";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  completed: "Hoàn thành",
  voided: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

export default function MemberOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MemberOrderListItem[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    getStoreLocations().then(setStores).catch(() => setStores([]));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await memberOrdersApi.listOrders({
          status: statusFilter === "all" ? undefined : statusFilter,
          storeId: storeFilter ? Number(storeFilter) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        setOrders(res.orders);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Không tải được danh sách đơn");
        if (e?.response?.status === 401) navigate("/login/customer", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter, storeFilter, dateFrom, dateTo, navigate]);

  const grouped = useMemo(() => {
    if (statusFilter !== "all") return null;
    const pending = orders.filter((o) => o.status === "pending");
    const awaitingPickup = orders.filter((o) => o.status === "paid");
    const done = orders.filter((o) => o.status === "completed");
    const cancelled = orders.filter((o) => o.status === "voided" || o.status === "refunded");
    return { pending, awaitingPickup, done, cancelled };
  }, [orders, statusFilter]);

  const renderOrderCard = (o: MemberOrderListItem) => (
    <div
      key={o.id}
      role="button"
      tabIndex={0}
      className="cafe-card-elevated cafe-order-card"
      style={{ cursor: "pointer" }}
      onClick={() => navigate(`/customer/orders/${o.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/customer/orders/${o.id}`);
        }
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <strong style={{ fontSize: "1.05rem", color: "var(--cafe-olive-dark)" }}>{o.orderCode}</strong>
            <span className={`cafe-status-badge cafe-status-badge--${o.status}`}>
              {STATUS_LABEL[o.status] || o.status}
            </span>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            {o.storeName || "—"}
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
            {o.createdAt || "-"} {o.paymentMethod ? ` • ${o.paymentMethod}` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "var(--cafe-brown)" }}>
            {o.finalAmount.toLocaleString("vi-VN")}đ
          </p>
          {o.status === "pending" && (
            <Link
              to={`/customer/orders/${o.id}/payment`}
              className="cafe-link"
              style={{ fontSize: "0.85rem", display: "block", marginTop: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              Tiếp tục thanh toán
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero" style={{ padding: "40px 24px 36px" }}>
        <h1 className="cafe-hero-title" style={{ marginBottom: 8 }}>Đơn hàng của tôi</h1>
        <p className="cafe-hero-subtitle">Xem lịch sử đơn hàng đã đặt</p>
      </section>

      <main className="cafe-page-main cafe-page-main--wide">
        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 12, color: "var(--cafe-error)", fontSize: "0.9rem", marginBottom: 24 }}>
            {error}
          </div>
        )}

        <div className="cafe-card-elevated" style={{ marginBottom: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: "var(--cafe-text-muted)", fontSize: "0.95rem" }}>
            Muốn đặt thêm đơn mới hoặc xem lại phản ánh đã gửi?
          </p>
          {/*
              Phản ánh của tôi
          */}
            <Link to="/customer/order" className="cafe-btn-primary cafe-btn-cta" style={{ textDecoration: "none" }}>
              Đặt hàng ngay
            </Link>
        </div>

        <div className="cafe-filter-bar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="completed">Hoàn thành</option>
            <option value="pending">Chờ xử lý</option>
            <option value="voided">Đã hủy</option>
            <option value="refunded">Đã hoàn tiền</option>
          </select>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">Tất cả quán</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            Từ ngày
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            Đến ngày
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          {(dateFrom || dateTo || storeFilter) && (
            <button
              type="button"
              className="cafe-btn-secondary"
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
              onClick={() => { setDateFrom(""); setDateTo(""); setStoreFilter(""); }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: "var(--cafe-text-muted)", padding: 32, textAlign: "center" }}>Đang tải...</p>
        ) : orders.length === 0 ? (
          <div className="cafe-empty-state">
            <p className="cafe-empty-state-icon">🛒</p>
            <p className="cafe-empty-state-title">
              Chưa có đơn hàng nào. Hãy đặt hàng online và đến lấy tại cửa hàng.
            </p>
            <Link to="/customer/order" className="cafe-btn-primary cafe-btn-cta" style={{ textDecoration: "none" }}>
              Đặt hàng ngay
            </Link>
          </div>
        ) : grouped ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {grouped.pending.length > 0 && (
              <section>
                <h2 className="cafe-section-heading" style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                  Chờ thanh toán
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grouped.pending.map((o) => renderOrderCard(o))}
                </div>
              </section>
            )}
            {grouped.awaitingPickup.length > 0 && (
              <section>
                <h2 className="cafe-section-heading" style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                  Đang xử lý / chờ nhận tại quán
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grouped.awaitingPickup.map((o) => renderOrderCard(o))}
                </div>
              </section>
            )}
            {grouped.done.length > 0 && (
              <section>
                <h2 className="cafe-section-heading" style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                  Đã hoàn thành
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grouped.done.map((o) => renderOrderCard(o))}
                </div>
              </section>
            )}
            {grouped.cancelled.length > 0 && (
              <section>
                <h2 className="cafe-section-heading" style={{ fontSize: "1.05rem", marginBottom: 12 }}>
                  Đã hủy / hoàn tiền
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grouped.cancelled.map((o) => renderOrderCard(o))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{orders.map((o) => renderOrderCard(o))}</div>
        )}
      </main>
      <CafeFooter />
      <ChatButton />
    </div>
  );
}
