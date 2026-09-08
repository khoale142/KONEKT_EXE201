import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi, type NotificationItem } from "../api/notifications.api";
import { getNotificationDisplayData } from "./notificationDisplay";

function formatTimeAgo(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

function resolveDeepLink(item: NotificationItem): string | null {
  const fromData = item.data?.deepLink?.trim();
  if (fromData) {
    // TICKET_CREATED / TICKET_REPLY / TICKET_CLOSED → deepLink chứa đúng route /customer/support?tab=history&ticket_id=...
    if (fromData.startsWith("/customer/support")) return fromData;
    // Chuẩn hoá legacy route /account/orders/ → /customer/orders/
    return fromData.replace("/account/orders/", "/customer/orders/");
  }
  if (item.data?.orderId) return `/customer/orders/${item.data.orderId}`;
  return null;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    const [countRes, listRes] = await Promise.all([
      notificationsApi.getUnreadNotificationCount(),
      notificationsApi.getMyNotifications({ page: 1, limit: 5 }),
    ]);
    setUnreadCount(countRes.unreadCount || 0);
    setItems(listRes.items || []);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await loadNotifications();
      } catch {
        // keep bell non-blocking
      }
    };
    void run();
    const timer = window.setInterval(() => {
      if (!mounted) return;
      void run();
    }, 10000);

    const onFocus = () => {
      if (!mounted) return;
      void run();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleMarkAllRead = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await notificationsApi.markAllNotificationsAsRead();
      setUnreadCount(0);
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } finally {
      setLoading(false);
    }
  };

  const handleClickItem = async (item: NotificationItem) => {
    const deepLink = resolveDeepLink(item);
    if (!item.isRead) {
      try {
        await notificationsApi.markNotificationAsRead(item.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x)));
      } catch {
        // keep UX non-blocking even if mark-read fails
      }
    }
    setOpen(false);
    if (deepLink) navigate(deepLink);
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`notif-bell-btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((s) => !s)}
        aria-label="Mở thông báo"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="notif-bell-icon"
        >
          <path
            d="M12 3.75a5.25 5.25 0 0 0-5.25 5.25v2.44c0 .84-.23 1.66-.66 2.39l-1.03 1.73a1.5 1.5 0 0 0 1.29 2.27h11.3a1.5 1.5 0 0 0 1.29-2.27l-1.03-1.73a4.68 4.68 0 0 1-.66-2.39V9A5.25 5.25 0 0 0 12 3.75Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.75 19.25a2.25 2.25 0 0 0 4.5 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <strong>Thông báo</strong>
            <button type="button" className="notif-link-btn" onClick={handleMarkAllRead} disabled={loading}>
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">Bạn chưa có thông báo nào</div>
            ) : (
              items.map((item) => {
                const display = getNotificationDisplayData(item);
                return (
                  <button key={item.id} type="button" className={`notif-item${item.isRead ? "" : " notif-item--unread"}`} onClick={() => handleClickItem(item)}>
                    <div className="notif-item-row">
                      <span className="notif-item-icon">{display.icon}</span>
                      <div className="notif-item-body">
                        <div className="notif-item-title">
                          {!item.isRead && <span className="notif-unread-dot" />}
                          {display.title}
                        </div>
                        <div className="notif-item-content">{display.content}</div>
                        <div className="notif-item-meta">
                          <span className="notif-time">{formatTimeAgo(item.createdAt)}</span>
                          <span className="notif-cta">Nhấn để xem chi tiết</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="notif-footer">
            <Link to="/customer/notifications" onClick={() => setOpen(false)} className="notif-view-all-btn">
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
