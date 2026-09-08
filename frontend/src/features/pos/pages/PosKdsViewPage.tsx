import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { kdsListOrders, kdsUpdateStatus, type KdsOrder } from "../../kds/api/kds.api";

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function orderTypeBadge(orderType?: string) {
  if (!orderType || orderType === "NORMAL") return null;
  return <span className="pos-badge pos-badge--warning">{orderType}</span>;
}

function serviceModeBadge(serviceMode?: "TAKE_AWAY" | "IN_STORE") {
  if (!serviceMode) return null;
  return (
    <span
      className={
        serviceMode === "TAKE_AWAY"
          ? "pos-badge pos-badge--info"
          : "pos-badge pos-badge--warning"
      }
    >
      {serviceMode === "TAKE_AWAY" ? "Mang đi" : "Tại quán"}
    </span>
  );
}

export default function PosKdsViewPage() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") || "paid") as "paid" | "completed";
  const [date, setDate] = useState(todayLocal());

  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<number, boolean>>({});

  const load = async () => {
    try {
      setError(null);
      const r = await kdsListOrders({ date, status: "paid,completed" });
      setOrders(r.orders || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Load failed");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [date]);

  const updateStatus = async (orderId: number, nextStatus: "completed") => {
    try {
      setError(null);
      setBusyIds((p) => ({ ...p, [orderId]: true }));

      await kdsUpdateStatus(orderId, nextStatus);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: nextStatus,
                completedAt: new Date().toISOString(),
              }
            : o,
        ),
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Update failed");
    } finally {
      setBusyIds((p) => ({ ...p, [orderId]: false }));
    }
  };

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "paid"), [orders]);
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === "completed"),
    [orders],
  );

  const currentOrders = tab === "paid" ? paidOrders : completedOrders;
  const title = tab === "paid" ? "Đang làm" : "Đã hoàn thành";
  const subtitle =
    tab === "paid"
      ? "Đơn đã thanh toán, đang chờ bếp xử lý"
      : "Đơn đã xong và có thể giao khách";

  const actionLabel = tab === "paid" ? "Hoàn thành" : undefined;
  const actionStatus = tab === "paid" ? "completed" : undefined;

  return (
    <div className="pos-screen pos-ui pos-kds-page">
      <div className="pos-shell pos-shell--medium">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Kitchen queue</div>
            <h2 className="pos-topbar__title">POS KDS view</h2>
            <p className="pos-topbar__subtitle">
              Theo dõi đơn đang làm và đơn đã hoàn thành theo ngày vận hành.
            </p>
          </div>

          <div className="pos-inline-actions">
            <label className="pos-field" style={{ minWidth: 170 }}>
              <span className="pos-field__label">Ngày làm việc</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button onClick={load}>Refresh</button>
            <button onClick={() => nav("/pos")}>Về dashboard</button>
          </div>
        </div>

        <div className="pos-chip-row" style={{ marginTop: 18 }}>
          <TabButton active={tab === "paid"} onClick={() => setSearchParams({ tab: "paid" })}>
            Đang làm ({paidOrders.length})
          </TabButton>

          <TabButton
            active={tab === "completed"}
            onClick={() => setSearchParams({ tab: "completed" })}
          >
            Đã hoàn thành ({completedOrders.length})
          </TabButton>
        </div>

        {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}

        <div style={{ marginTop: 16 }}>
          <Board
            title={title}
            subtitle={subtitle}
            orders={currentOrders}
            busyIds={busyIds}
            actionLabel={actionLabel}
            actionStatus={actionStatus}
            onAction={updateStatus}
          />
        </div>
      </div>
    </div>
  );
}

function TabButton(props: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { active, onClick, children } = props;

  return (
    <button
      onClick={onClick}
      className={active ? "pos-select-card is-active" : "pos-select-card"}
      style={{ padding: "10px 14px" }}
    >
      {children}
    </button>
  );
}

function Board(props: {
  title: string;
  subtitle: string;
  orders: KdsOrder[];
  busyIds: Record<number, boolean>;
  actionLabel?: string;
  actionStatus?: "completed";
  onAction?: (orderId: number, status: "completed") => void;
}) {
  const { title, subtitle, orders, busyIds, actionLabel, actionStatus, onAction } = props;

  return (
    <div className="pos-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 22 }}>{title}</div>
          <div className="pos-muted" style={{ marginTop: 4 }}>
            {subtitle}
          </div>
        </div>
        <span className="pos-badge pos-badge--info">{orders.length} don</span>
      </div>

      <div className="pos-stack pos-stack--compact" style={{ marginTop: 14 }}>
        {orders.map((o) => (
          <div key={o.id} className="pos-list-card" style={{ padding: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div className="pos-stack pos-stack--compact" style={{ gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 20 }}>{o.orderCode}</div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {serviceModeBadge(o.serviceMode)}
                  {orderTypeBadge(o.orderType)}
                  {o.pickupNumber ? (
                    <span className="pos-badge pos-badge--info">Số thẻ {o.pickupNumber}</span>
                  ) : null}
                </div>

                <div className="pos-muted">{new Date(o.createdAt).toLocaleString("vi-VN")}</div>
                {o.finalAmount != null ? (
                  <div className="pos-muted">
                    Tổng: {Number(o.finalAmount).toLocaleString("vi-VN")}d
                  </div>
                ) : null}
                {o.specialNote ? <div className="pos-muted">{o.specialNote}</div> : null}
              </div>

              {actionLabel && actionStatus && onAction ? (
                <button
                  className="pos-btn-primary"
                  onClick={() => onAction(o.id, actionStatus)}
                  disabled={!!busyIds[o.id]}
                >
                  {busyIds[o.id] ? "Đang cập nhật..." : actionLabel}
                </button>
              ) : null}
            </div>

            <div className="pos-stack pos-stack--compact" style={{ marginTop: 12 }}>
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

        {orders.length === 0 ? (
          <div className="pos-empty-state">Không có đơn trong nhóm này.</div>
        ) : null}
      </div>
    </div>
  );
}

