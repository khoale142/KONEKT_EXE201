import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMyNotifications, markNotificationAsRead, Notification, markAllNotificationsAsRead } from "../api/notifications.api";

const NOTIFICATION_REFRESH_INTERVAL_MS = 8000;

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getMyNotifications({ limit: 10 });
      setNotifications(data.items);
      const unread =
        typeof data.unreadCount === "number"
          ? data.unreadCount
          : data.items.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    };

    void fetchNotifications();
    const interval = window.setInterval(refreshIfVisible, NOTIFICATION_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchNotifications();
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all read", error);
    }
  };

  const buildNotificationTarget = (notification: Notification) => {
    let rawDeepLink =
      typeof notification.data?.deepLink === "string" && notification.data.deepLink.trim()
        ? notification.data.deepLink.trim()
        : "";

    if (!rawDeepLink) return null;
    if (rawDeepLink === "/store/staff/schedule") {
      rawDeepLink = "/store/staff/schedules";
    }

    const extras = new URLSearchParams();
    const storeId = Number(notification.data?.storeId);
    if (Number.isFinite(storeId) && storeId > 0) {
      extras.set("storeId", String(storeId));
    }
    const requestId = Number(notification.data?.requestId);
    if (Number.isFinite(requestId) && requestId > 0) {
      extras.set("requestId", String(requestId));
    }
    if (typeof notification.data?.status === "string" && notification.data.status.trim()) {
      extras.set("requestStatus", notification.data.status.trim());
    }

    const queryString = extras.toString();
    if (!queryString) return rawDeepLink;
    const separator = rawDeepLink.includes("?") ? "&" : "?";
    return `${rawDeepLink}${separator}${queryString}`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    const target = buildNotificationTarget(notification);

    if (!notification.isRead) {
      await handleMarkRead(notification.id);
    }

    setIsOpen(false);

    if (target) {
      navigate(target);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={handleToggle}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        {/* Bell Icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#4b5563" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              transform: "translate(35%, -35%)",
              background: "#ef4444",
              color: "white",
              borderRadius: "999px",
              minWidth: "22px",
              height: "22px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid white",
              fontWeight: 700,
              lineHeight: 1,
              padding: "0 6px",
              boxShadow: "0 4px 10px rgba(239, 68, 68, 0.28)",
              zIndex: 2,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            width: "320px",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e5e7eb",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#111827" }}>Thông báo</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                Đang tải...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                Không có thông báo nào
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => void handleNotificationClick(n)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f9fafb",
                    cursor: "pointer",
                    background: n.isRead ? "transparent" : "rgba(37, 99, 235, 0.05)",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(37, 99, 235, 0.05)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px", color: n.isRead ? "#4b5563" : "#111827" }}>{n.title}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: "1.4" }}>{n.message}</p>
                </div>
              ))
            )}
          </div>
          
          <div style={{ padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
             <span style={{ fontSize: "12px", color: "#9ca3af" }}>Xem tất cả thông báo</span>
          </div>
        </div>
      )}
    </div>
  );
}
