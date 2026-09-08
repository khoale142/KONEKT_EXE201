import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  posOrderIssuesApi,
  type PosOrderIssue,
} from "../api/posOrderIssues.api";

export default function PosPickupSelectPage() {
  const nav = useNavigate();

  const PICKUP_CARD_COUNT = Math.max(
    1,
    Number(import.meta.env.VITE_PICKUP_CARD_COUNT || 24)
  );

  const numbers = useMemo(
    () => Array.from({ length: PICKUP_CARD_COUNT }, (_, i) => i + 1),
    [PICKUP_CARD_COUNT]
  );

  const [activeIssues, setActiveIssues] = useState<PosOrderIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const loadActiveIssues = async () => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await posOrderIssuesApi.listIssues({
        limit: 200,
      });
      const next = (res.issues || []).filter(
        (issue) => issue.status === "open" || issue.status === "in_progress"
      );
      setActiveIssues(next);
    } catch (e: any) {
      setIssuesError(
        e?.response?.data?.message || "Không tải được thông tin phản ánh"
      );
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    loadActiveIssues();
  }, []);

  const previewIssues = activeIssues.slice(0, 3);

  const uiFont =
    'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const primaryButtonStyle: React.CSSProperties = {
    background: "#16a34a",
    color: "#ffffff",
    border: "1px solid #16a34a",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 700,
    fontSize: 15,
    fontFamily: uiFont,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(22, 163, 74, 0.16)",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    background: "#ffffff",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 700,
    fontSize: 15,
    fontFamily: uiFont,
    cursor: "pointer",
  };

  const pickupButtonStyle: React.CSSProperties = {
    background: "#ffffff",
    color: "#1f2937",
    border: "1px solid #d6e6d8",
    borderRadius: 16,
    minHeight: 76,
    fontSize: 22,
    fontWeight: 700,
    fontFamily: uiFont,
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
  };

  return (
    <div
      className="pos-screen pos-ui pos-pickup-page"
      style={{
        fontFamily: uiFont,
      }}
    >
      <div className="pos-shell pos-shell--narrow">
        <div
          className="pos-topbar"
          style={{
            gap: 20,
          }}
        >
          <div className="pos-topbar__main">
            <div
              className="pos-topbar__eyebrow"
              style={{
                fontFamily: uiFont,
                letterSpacing: "0.12em",
                fontWeight: 700,
                color: "#6b7280",
              }}
            >
              PICKUP SETUP
            </div>

            <h2
              className="pos-topbar__title"
              style={{
                fontFamily: uiFont,
                fontSize: 42,
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: "8px 0 10px",
                color: "#1f2937",
              }}
            >
              Chọn số thẻ (1 - {PICKUP_CARD_COUNT})
            </h2>

            <p
              className="pos-topbar__subtitle"
              style={{
                fontFamily: uiFont,
                fontSize: 17,
                lineHeight: 1.6,
                color: "#6b7280",
                margin: 0,
              }}
            >
              Bắt đầu order mới bằng cách chọn pickup number trước khi vào màn
              hình cashier.
            </p>
          </div>

          <div
            className="pos-inline-actions"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              style={primaryButtonStyle}
              onClick={() => nav("/pos/online-orders")}
            >
              Xác nhận đơn online
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => nav("/pos", { replace: true })}
            >
              Về dashboard
            </button>
          </div>
        </div>

        {activeIssues.length > 0 ? (
          <div
            className="pos-alert pos-alert--warning"
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
              fontFamily: uiFont,
              borderRadius: 16,
            }}
          >
            <div style={{ minWidth: 280, flex: 1 }}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 6,
                  fontFamily: uiFont,
                  color: "#92400e",
                }}
              >
                Đang có {activeIssues.length} phản ánh cần xử lý
              </div>

              <div
                className="pos-muted"
                style={{
                  marginBottom: previewIssues.length ? 10 : 0,
                  fontFamily: uiFont,
                }}
              >
                Nhân viên nên mở màn hình phản ánh để kiểm tra và liên hệ hỗ trợ
                khách.
              </div>

              {previewIssues.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {previewIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="pos-muted"
                      style={{
                        fontSize: 13,
                        fontFamily: uiFont,
                      }}
                    >
                      • {issue.orderCode || `#${issue.orderId}`}
                      {issue.customerName ? ` • ${issue.customerName}` : ""}
                      {issue.customerPhone ? ` • ${issue.customerPhone}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className="pos-inline-actions"
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                style={secondaryButtonStyle}
                onClick={loadActiveIssues}
                disabled={issuesLoading}
              >
                {issuesLoading ? "Đang tải..." : "Tải lại cảnh báo"}
              </button>

              <button
                style={primaryButtonStyle}
                onClick={() => nav("/pos/issues")}
              >
                Mở phản ánh
              </button>
            </div>
          </div>
        ) : issuesError ? (
          <div
            className="pos-alert pos-alert--danger"
            style={{
              marginTop: 18,
              fontFamily: uiFont,
              borderRadius: 16,
            }}
          >
            {issuesError}
          </div>
        ) : null}

        <div
          className="pos-panel"
          style={{
            marginTop: 18,
            borderRadius: 20,
          }}
        >
          <div className="pos-pickup-grid">
            {numbers.map((n) => (
              <button
                key={n}
                onClick={() => nav(`/pos/order?pickup=${n}`)}
                className="pos-pickup-button"
                style={pickupButtonStyle}
              >
                {n}
              </button>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              color: "#6b7280",
              fontFamily: uiFont,
            }}
            className="pos-muted"
          >
            <small>
              Chọn số thẻ để order. Đơn online sẽ vào màn hình xác nhận riêng.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}