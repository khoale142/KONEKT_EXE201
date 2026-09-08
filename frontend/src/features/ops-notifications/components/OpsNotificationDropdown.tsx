import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyOpsNotifications,
  getOpsUnreadNotificationCount,
  markAllOpsNotificationsAsRead,
  markOpsNotificationAsRead,
} from "../api/opsNotifications.api";
import type { OpsNotificationItem } from "../types";
import { resolveOpsNotificationTarget } from "../utils/resolveOpsNotificationTarget";

const REFRESH_INTERVAL_MS = 10000;

function formatTimeAgo(input: string) {
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

export default function OpsNotificationDropdown() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<OpsNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [countData, listData] = await Promise.all([
        getOpsUnreadNotificationCount(),
        getMyOpsNotifications({ page: 1, limit: 10 }),
      ]);

      setUnreadCount(
        typeof countData.unreadCount === "number"
          ? countData.unreadCount
          : listData.items.filter((item) => !item.isRead).length,
      );
      setNotifications(listData.items || []);
    } catch (error) {
      console.error("Failed to fetch ops notifications", error);
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
    const interval = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      void fetchNotifications();
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markOpsNotificationAsRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark ops notification as read", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllOpsNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all ops notifications as read", error);
    }
  };

  const handleNotificationClick = async (notification: OpsNotificationItem) => {
    const target = resolveOpsNotificationTarget(notification);

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
        type="button"
        onClick={handleToggle}
        aria-label="Mở thông báo nội bộ"
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
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "transparent";
        }}
      >
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
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
            {unreadCount > 99 ? "99+" : unreadCount}
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
            width: "340px",
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(10px)",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
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
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Thông báo</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 600,
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
                Chưa có thông báo nội bộ nào
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom: "1px solid #f9fafb",
                    cursor: "pointer",
                    background: notification.isRead ? "transparent" : "rgba(37, 99, 235, 0.05)",
                    transition: "background 0.2s",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {!notification.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#2563eb",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <strong style={{ color: "#111827", fontSize: "14px" }}>{notification.title}</strong>
                  </div>
                  <div style={{ color: "#4b5563", fontSize: "13px", lineHeight: 1.5 }}>{notification.message}</div>
                  <div style={{ color: "#9ca3af", fontSize: "12px", marginTop: 8 }}>
                    {formatTimeAgo(notification.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
