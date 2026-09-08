import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi, type NotificationItem } from "../api/notifications.api";
import CustomerLayout from "../../../shared/layouts/CustomerLayout";

function formatTimeLabel(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function resolveDeepLink(item: NotificationItem): string | null {
  const fromData = item.data?.deepLink?.trim();
  if (fromData) return fromData.replace("/account/orders/", "/customer/orders/");
  if (item.data?.orderId) return `/customer/orders/${item.data.orderId}`;
  return null;
}

export default function CustomerNotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const hasPrev = useMemo(() => page > 1, [page]);
  const hasNext = useMemo(() => page < totalPages, [page, totalPages]);

  const loadNotificationsPage = async (nextPage: number) => {
    const res = await notificationsApi.getMyNotifications({ page: nextPage, limit: 10 });
    setItems(res.items || []);
    setTotalPages(res.pagination?.totalPages || 1);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const run = async () => {
      try {
        await loadNotificationsPage(page);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();

    const timer = window.setInterval(() => {
      if (!mounted) return;
      void loadNotificationsPage(page);
    }, 10000);

    const onFocus = () => {
      if (!mounted) return;
      void loadNotificationsPage(page);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [page]);

  const handleClickItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markNotificationAsRead(item.id);
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x)));
      } catch {
        // non-blocking for navigation
      }
    }
    const deepLink = resolveDeepLink(item);
    if (deepLink) navigate(deepLink);
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllNotificationsAsRead();
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
  };

  return (
    <CustomerLayout>
      <main className="cafe-page-main cafe-page-main--wide">
        <div className="cafe-card-elevated" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1 className="cafe-section-heading" style={{ margin: 0 }}>
              Thông báo của tôi
            </h1>
            <button className="cafe-btn-secondary" onClick={handleMarkAll}>
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          {loading ? (
            <p>Đang tải thông báo...</p>
          ) : items.length === 0 ? (
            <div className="cafe-empty-state">
              <p className="cafe-empty-state-title">Bạn chưa có thông báo nào</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClickItem(item)}
                  className={`notif-page-item ${item.isRead ? "" : "notif-page-item--unread"}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong style={{ textAlign: "left" }}>{item.title}</strong>
                    {!item.isRead && <span className="notif-unread-dot" />}
                  </div>
                  <div style={{ textAlign: "left", marginTop: 4 }}>{item.message}</div>
                  <div className="notif-time">{formatTimeLabel(item.createdAt)}</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button className="cafe-btn-secondary" disabled={!hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Trang trước
            </button>
            <span style={{ alignSelf: "center" }}>
              Trang {page}/{totalPages}
            </span>
            <button className="cafe-btn-secondary" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              Trang sau
            </button>
          </div>
        </div>
      </main>
    </CustomerLayout>
  );
}
