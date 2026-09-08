import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaymentStatus } from "../../payment/hooks/usePaymentStatus";
import {
  readPosCustomerPreview,
  subscribePosCustomerPreview,
  type PosCustomerPreviewSnapshot,
} from "../utils/posCustomerPreviewSession";

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function getModeLabel(mode?: string) {
  switch (mode) {
    case "cart":
      return "Đang chọn món";
    case "combo":
      return "Đang chọn combo";
    case "promotion":
      return "Đang áp dụng ưu đãi";
    case "payment":
      return "Đang xác nhận thanh toán";
    default:
      return "Đang thao tác";
  }
}

function getPaymentStatusLabel(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "EXPIRED":
      return "Đã hết hạn";
    case "FAILED":
      return "Thất bại";
    case "PENDING":
      return "Đang chờ xác nhận";
    default:
      return "-";
  }
}

function InfoCard(props: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  tone?: "default" | "success" | "warning" | "info";
  align?: "left" | "center" | "right";
}) {
  const toneMap = {
    default: {
      background: "#ffffff",
      border: "1px solid #ece6dd",
      color: "#2b2b2b",
    },
    success: {
      background: "#edf8f1",
      border: "1px solid #cfe7d7",
      color: "#184d2c",
    },
    warning: {
      background: "#fff7e8",
      border: "1px solid #f2dfb1",
      color: "#7a5610",
    },
    info: {
      background: "#eef6ff",
      border: "1px solid #cfe1f7",
      color: "#1d4e89",
    },
  };

  const tone = toneMap[props.tone || "default"];

  return (
    <div
      style={{
        background: tone.background,
        border: tone.border,
        borderRadius: 20,
        padding: 18,
        minHeight: 116,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: props.align || "left",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#7b746a",
          marginBottom: 10,
        }}
      >
        {props.eyebrow}
      </div>
      <div
        style={{
          fontSize: 28,
          lineHeight: 1.2,
          fontWeight: 900,
          color: tone.color,
        }}
      >
        {props.title}
      </div>
      {props.subtitle ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 16,
            lineHeight: 1.45,
            color: "#5f5a52",
          }}
        >
          {props.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard(props: { snapshot: PosCustomerPreviewSnapshot }) {
  const { snapshot } = props;
  const isCompleted = Boolean(snapshot.created);

  return (
    <div
      className="pos-panel"
      style={{
        borderRadius: 24,
        padding: 22,
        background: "linear-gradient(180deg, #fffdfa 0%, #ffffff 100%)",
        border: "1px solid #ece6dd",
        boxShadow: "0 10px 30px rgba(46, 38, 24, 0.05)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 270px) minmax(0, 1fr)",
          gap: 18,
        }}
      >
        <div
          style={{
            borderRadius: 22,
            padding: 22,
            background: isCompleted
              ? "linear-gradient(135deg, #eaf7ee 0%, #f7fcf8 100%)"
              : "linear-gradient(135deg, #f8f2e9 0%, #fffdfa 100%)",
            border: isCompleted ? "1px solid #cfe7d7" : "1px solid #ece1d2",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 172,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#7b746a",
            }}
          >
            Số thẻ
          </div>

          <div
            style={{
              fontSize: 72,
              lineHeight: 1,
              fontWeight: 900,
              color: "#2b2b2b",
            }}
          >
            {snapshot.pickupNumber ?? "-"}
          </div>

          <div style={{ fontSize: 15, color: "#6f675e" }}>
            {isCompleted
              ? "Đơn trước đã hoàn tất hiển thị"
              : "Khách theo dõi đơn đang được chọn"}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <InfoCard
            eyebrow="Trạng thái"
            title={isCompleted ? "Cảm ơn quý khách" : getModeLabel(snapshot.mode)}
            subtitle={
              isCompleted
                ? "Đơn hàng đã được xác nhận. Màn hình đang chờ phiên order tiếp theo."
                : `Cập nhật: ${formatTime(snapshot.updatedAt)}`
            }
            tone={isCompleted ? "success" : snapshot.mode === "payment" ? "info" : "default"}
          />

          <InfoCard
            eyebrow="Khách hàng"
            title={snapshot.memberName || "Khách lẻ"}
            subtitle={
              snapshot.phone
                ? `SĐT: ${snapshot.phone}`
                : "Chưa có thông tin số điện thoại"
            }
          />

          <InfoCard
            eyebrow="Ưu đãi"
            title={
              snapshot.appliedOfferCode
                ? `${snapshot.offerMode === "promotion" ? "Promotion" : "Voucher"}`
                : "Chưa áp dụng"
            }
            subtitle={
              snapshot.appliedOfferCode
                ? `Mã: ${snapshot.appliedOfferCode}`
                : "Không có ưu đãi nào được áp dụng"
            }
            tone={snapshot.appliedOfferCode ? "warning" : "default"}
          />
        </div>
      </div>

      {snapshot.specialNote ? (
        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            background: "#fffaf2",
            border: "1px solid #f0e2c9",
            padding: "14px 16px",
            fontSize: 16,
            color: "#5f5649",
          }}
        >
          <strong>Ghi chú:</strong> {snapshot.specialNote}
        </div>
      ) : null}

      {snapshot.orderType && snapshot.orderType !== "NORMAL" ? (
        <div
          style={{
            marginTop: 14,
            fontSize: 15,
            color: "#6c665d",
          }}
        >
          <strong>Loại đơn:</strong> {snapshot.orderType}
        </div>
      ) : null}

      {snapshot.shiftBlockedMessage ? (
        <div
          className="pos-alert pos-alert--warning"
          style={{
            marginTop: 16,
            borderRadius: 16,
            fontWeight: 700,
          }}
        >
          {snapshot.shiftBlockedMessage}
        </div>
      ) : null}
    </div>
  );
}

function PaymentPanel(props: { snapshot: PosCustomerPreviewSnapshot }) {
  const { snapshot } = props;
  const payment = snapshot.payment;
  const gatewayOrderId = payment?.gatewayOrderId ?? null;
  const { data } = usePaymentStatus(gatewayOrderId, { refetchInterval: 2000 });
  const status = data?.status ?? payment?.status ?? null;
  const expiresAt = data?.expiredAt ?? payment?.expiresAt ?? null;
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSec(0);
      return;
    }

    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemainingSec(Math.max(0, Math.floor(ms / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (payment?.method !== "transfer" || !gatewayOrderId) {
    return null;
  }

  return (
    <div
      className="pos-panel"
      style={{
        borderRadius: 24,
        padding: 22,
        background: "#ffffff",
        border: "1px solid #ece6dd",
        boxShadow: "0 10px 30px rgba(46, 38, 24, 0.05)",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginBottom: 18,
          color: "#2b2b2b",
        }}
      >
        Thanh toán QR
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: 20,
            border: "1px solid #ece6dd",
            background: "#fcfbf8",
            padding: 16,
            display: "grid",
            placeItems: "center",
          }}
        >
          {payment.qrImageUrl ? (
            <img
              src={payment.qrImageUrl}
              alt="VietQR"
              style={{
                width: "100%",
                maxWidth: 280,
                height: "auto",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                minHeight: 280,
                display: "grid",
                placeItems: "center",
                color: "#6b7280",
                textAlign: "center",
                fontSize: 18,
              }}
            >
              QR đang được tạo
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            alignContent: "start",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              background: "#f8f5f0",
              padding: 16,
              border: "1px solid #ece6dd",
            }}
          >
            <div style={{ fontSize: 15, color: "#6d655b", marginBottom: 6 }}>
              Số tiền cần thanh toán
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#2b2b2b" }}>
              {formatMoney(snapshot.pricing.finalAmount)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              background: "#ffffff",
              padding: 16,
              border: "1px solid #ece6dd",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 17 }}>
              <strong>Nội dung:</strong> {payment.orderRef || "-"}
            </div>
            <div style={{ fontSize: 17 }}>
              <strong>Trạng thái:</strong> {getPaymentStatusLabel(status)}
            </div>

            {status === "PENDING" ? (
              <div
                className="pos-alert pos-alert--info"
                style={{ marginTop: 4, borderRadius: 14, fontWeight: 700 }}
              >
                Đang đợi hệ thống xác nhận giao dịch
                {remainingSec > 0 ? ` - ${formatCountdown(remainingSec)}` : ""}
              </div>
            ) : null}

            {status === "PAID" ? (
              <div
                className="pos-alert pos-alert--success"
                style={{ marginTop: 4, borderRadius: 14, fontWeight: 800 }}
              >
                Đã nhận tiền. Nhân viên đang hoàn tất đơn hàng.
              </div>
            ) : null}

            {status === "EXPIRED" ? (
              <div
                className="pos-alert pos-alert--danger"
                style={{ marginTop: 4, borderRadius: 14, fontWeight: 700 }}
              >
                QR đã hết hạn. Vui lòng báo nhân viên tạo QR mới.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCard(props: { snapshot: PosCustomerPreviewSnapshot }) {
  const { snapshot } = props;
  const p = snapshot.pricing;

  return (
    <div
      className="pos-panel"
      style={{
        borderRadius: 24,
        padding: 22,
        background: "#ffffff",
        border: "1px solid #ece6dd",
        boxShadow: "0 10px 30px rgba(46, 38, 24, 0.05)",
        height: "fit-content",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>
        Tóm tắt thanh toán
      </div>

      <Row label="Tạm tính" value={formatMoney(p.subtotalAmount)} />
      {p.promotionDiscountAmount > 0 ? (
        <Row
          label="Giảm promotion"
          value={`- ${formatMoney(p.promotionDiscountAmount)}`}
        />
      ) : null}
      {p.voucherDiscountAmount > 0 ? (
        <Row
          label="Giảm voucher"
          value={`- ${formatMoney(p.voucherDiscountAmount)}`}
        />
      ) : null}
      {p.totalDiscountAmount > 0 ? (
        <Row
          label="Tổng giảm"
          value={`- ${formatMoney(p.totalDiscountAmount)}`}
        />
      ) : null}

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #eee7df",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900 }}>Tổng thanh toán</div>
        <div style={{ fontSize: 34, fontWeight: 900 }}>
          {formatMoney(p.finalAmount)}
        </div>
      </div>
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        fontSize: 18,
        borderBottom: "1px dashed #f0e8de",
      }}
    >
      <span style={{ color: "#5f5a52" }}>{props.label}</span>
      <strong style={{ color: "#2b2b2b" }}>{props.value}</strong>
    </div>
  );
}

function ActiveOrderPanel(props: { snapshot: PosCustomerPreviewSnapshot }) {
  const { snapshot } = props;
  const items = snapshot.items || [];
  const combos = snapshot.combos || [];
  const hasAnyItems = items.length > 0 || combos.length > 0;

  return (
    <div className="pos-preview-grid">
      <div
        className="pos-panel"
        style={{
          borderRadius: 24,
          padding: 22,
          background: "#ffffff",
          border: "1px solid #ece6dd",
          boxShadow: "0 10px 30px rgba(46, 38, 24, 0.05)",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 18 }}>
          Món đang chọn
        </div>

        {!hasAnyItems ? (
          <div
            style={{
              borderRadius: 18,
              border: "1px dashed #ddd3c7",
              background: "#fbfaf8",
              padding: "28px 22px",
              fontSize: 22,
              color: "#8b847a",
            }}
          >
            Chưa có món trong giỏ
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {items.map((item) => (
              <div
                key={`item-${item.key}`}
                style={{
                  borderRadius: 20,
                  border: "1px solid #ece6dd",
                  background: "#fcfbf9",
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: "#2b2b2b",
                        lineHeight: 1.3,
                      }}
                    >
                      {item.productName} {item.size || ""}
                    </div>

                    {item.note ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 16,
                          color: "#6e675e",
                        }}
                      >
                        Ghi chú: {item.note}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 64,
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 999,
                        background: "#f1ebe2",
                        fontSize: 22,
                        fontWeight: 900,
                        color: "#2b2b2b",
                      }}
                    >
                      x{item.qty}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#2b2b2b",
                      }}
                    >
                      {formatMoney(item.lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {combos.map((combo) => (
              <div
                key={`combo-${combo.key}`}
                style={{
                  borderRadius: 20,
                  border: "1px solid #e7e0d6",
                  background: "linear-gradient(180deg, #fffaf2 0%, #ffffff 100%)",
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: "#2b2b2b",
                        lineHeight: 1.3,
                      }}
                    >
                      {combo.name}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gap: 6,
                        fontSize: 16,
                        color: "#6e675e",
                      }}
                    >
                      {combo.items.map((x, idx) => (
                        <div key={`${combo.key}-${idx}`}>
                          • {x.productName} {x.size || ""} x{x.quantity}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 64,
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 999,
                        background: "#f3ead4",
                        fontSize: 22,
                        fontWeight: 900,
                        color: "#5c4718",
                      }}
                    >
                      x{combo.qty}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#2b2b2b",
                      }}
                    >
                      {formatMoney(combo.lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PricingCard snapshot={snapshot} />
    </div>
  );
}

function CompletedPanel(props: { snapshot: PosCustomerPreviewSnapshot }) {
  const { snapshot } = props;
  const created = snapshot.created;

  if (!created) return null;

  return (
    <div
      className="pos-panel"
      style={{
        borderRadius: 28,
        padding: 28,
        background: "linear-gradient(180deg, #f7fcf8 0%, #ffffff 100%)",
        border: "1px solid #d7eadc",
        boxShadow: "0 12px 34px rgba(30, 74, 44, 0.08)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            background: "linear-gradient(135deg, #ebf8ef 0%, #ffffff 100%)",
            border: "1px solid #d7eadc",
            padding: 26,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#4f7b5a",
              marginBottom: 12,
            }}
          >
            Order completed
          </div>

          <div
            style={{
              fontSize: 46,
              lineHeight: 1.15,
              fontWeight: 900,
              color: "#1f4b2c",
            }}
          >
            Cảm ơn quý khách
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 21,
              lineHeight: 1.55,
              color: "#44614d",
              maxWidth: 700,
            }}
          >
            Đơn hàng đã được xác nhận thành công. Hẹn gặp lại quý khách ở lần sau.
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 17,
              lineHeight: 1.55,
              color: "#5b6f61",
            }}
          >
            Màn hình này sẽ giữ lời nhắn cảm ơn cho tới khi nhân viên bắt đầu phiên order tiếp theo.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <InfoCard
            eyebrow="Mã đơn"
            title={created.orderCode || "-"}
            subtitle="Đơn đã được ghi nhận trên hệ thống"
            tone="success"
          />

          <InfoCard
            eyebrow="Số thẻ"
            title={String(created.pickupNumber ?? "-")}
            subtitle="Khách nhận đồ theo số thẻ này"
            tone="default"
          />

          <InfoCard
            eyebrow="Thanh toán"
            title={formatMoney(created.finalAmount)}
            subtitle={`Cập nhật lúc ${formatTime(snapshot.updatedAt)}`}
            tone="info"
          />
        </div>
      </div>
    </div>
  );
}

export default function PosCustomerPreviewPage() {
  const nav = useNavigate();
  const [snapshot, setSnapshot] = useState<PosCustomerPreviewSnapshot | null>(
    readPosCustomerPreview(),
  );

  useEffect(() => {
    const sync = () => setSnapshot(readPosCustomerPreview());
    sync();
    return subscribePosCustomerPreview(sync);
  }, []);

  const isCompletedView = Boolean(snapshot?.created);

  return (
    <div
      className="pos-screen pos-ui pos-preview-page"
      style={{
        background:
          "linear-gradient(180deg, #f8f4ee 0%, #f5efe7 50%, #f7f3ed 100%)",
        minHeight: "100vh",
      }}
    >
      <div className="pos-shell pos-shell--wide" style={{ paddingBottom: 28 }}>
        <div
          style={{
            marginBottom: 20,
            borderRadius: 28,
            padding: 24,
            background: "linear-gradient(180deg, #fffdfa 0%, #ffffff 100%)",
            border: "1px solid #ece6dd",
            boxShadow: "0 12px 30px rgba(46, 38, 24, 0.04)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#7b746a",
                marginBottom: 8,
              }}
            >
              Facing customer
            </div>

            <div
              style={{
                fontSize: 46,
                lineHeight: 1.15,
                fontWeight: 900,
                color: "#2b2b2b",
              }}
            >
              Màn hình khách tại quầy
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 19,
                lineHeight: 1.5,
                color: "#6b655d",
              }}
            >
              {isCompletedView
                ? "Hiển thị lời nhắn cảm ơn sau khi đơn hàng đã được xác nhận."
                : "Khách xem món đang được nhân viên chọn trong giỏ và theo dõi thanh toán."}
            </div>
          </div>

          <button
            onClick={() => nav("/pos")}
            style={{
              height: 48,
              padding: "0 20px",
              borderRadius: 999,
              border: "1px solid #ddd3c7",
              background: "#ffffff",
              color: "#3b3a36",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Về dashboard
          </button>
        </div>

        {!snapshot ? (
          <div
            className="pos-panel"
            style={{
              textAlign: "center",
              borderRadius: 28,
              padding: "40px 28px",
              background: "#ffffff",
              border: "1px solid #ece6dd",
              boxShadow: "0 12px 30px rgba(46, 38, 24, 0.04)",
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 900, color: "#2b2b2b" }}>
              Chưa có phiên order nào
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 19,
                lineHeight: 1.6,
                color: "#6a645c",
              }}
            >
              Hãy mở trang POS order và thêm món để màn hình này cập nhật.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            <SummaryCard snapshot={snapshot} />

            {!isCompletedView ? <PaymentPanel snapshot={snapshot} /> : null}

            {isCompletedView ? (
              <CompletedPanel snapshot={snapshot} />
            ) : (
              <ActiveOrderPanel snapshot={snapshot} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}