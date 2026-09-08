import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  posGetOrderDetail,
  posListPaidOrders,
  posRefundOrder,
  type PosPaidOrderDetailResponse,
  type PosPaidOrderListItem,
} from "../api/orders.api";

type SearchForm = {
  orderCode: string;
  pickupNumber: string;
  memberPhone: string;
  dateFrom: string;
  dateTo: string;
  refundStatus: "" | "none" | "partial" | "full";
};

function todayVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString("vi-VN")}d`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function getRefundStatusMeta(status?: string | null) {
  switch (status) {
    case "full":
      return {
        label: "Đã refund full",
        background: "#f3f4f6",
        color: "#6b7280",
        border: "1px solid #d1d5db",
      };
    case "partial":
      return {
        label: "Refund một phần",
        background: "#fefce8",
        color: "#a16207",
        border: "1px solid #fde68a",
      };
    case "none":
    default:
      return {
        label: "Chưa refund",
        background: "#eef6ef",
        color: "#4f6a53",
        border: "1px solid #cfe0d0",
      };
  }
}

const topActionButtonStyle: CSSProperties = {
  minWidth: 116,
  minHeight: 44,
};

const sectionHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  boxSizing: "border-box",
};

const listWrapStyle: CSSProperties = {
  maxHeight: 560,
  paddingRight: 4,
};

const orderCardBaseStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  textAlign: "left",
  padding: 16,
  gap: 10,
  borderRadius: 18,
  minHeight: 138,
  lineHeight: 1.4,
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const orderCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const orderMetaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const metaBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const metaLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  opacity: 0.7,
};

const metaValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.4,
};

const detailSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const itemCardStyle: CSSProperties = {
  padding: 16,
};

const itemGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 180px)",
  gap: 16,
  alignItems: "end",
};

const qtyFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
};

const qtyInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  boxSizing: "border-box",
};

const refundModeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const refundModeButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  padding: "10px 14px",
  textAlign: "center",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 110,
  resize: "vertical",
  boxSizing: "border-box",
};

const softButtonStyle: CSSProperties = {
  background: "#7b9080",
  color: "#fff",
  border: "1px solid #7b9080",
  minHeight: 46,
};

const softButtonGhostStyle: CSSProperties = {
  background: "#f7faf7",
  color: "#4f6452",
  border: "1px solid #cdd9ce",
  minHeight: 46,
};

const softActiveOrderCardStyle: CSSProperties = {
  background: "#7b9080",
  color: "#fff",
  border: "1px solid #7b9080",
};

const softBadgeStyle: CSSProperties = {
  background: "#eef6ef",
  color: "#4f6a53",
  border: "1px solid #cfe0d0",
};

const orderCodeTextStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
  lineHeight: 1.2,
};

const detailCodeTextStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
  lineHeight: 1.2,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 700,
};

const blockTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
};

export default function PosPaidOrdersPage() {
  const nav = useNavigate();
  const [form, setForm] = useState<SearchForm>({
    orderCode: "",
    pickupNumber: "",
    memberPhone: "",
    dateFrom: todayVN(),
    dateTo: todayVN(),
    refundStatus: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [orders, setOrders] = useState<PosPaidOrderListItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] =
    useState<PosPaidOrderDetailResponse["order"] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundReason, setRefundReason] = useState("");
  const [selectedQty, setSelectedQty] = useState<Record<number, number>>({});
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState("");

  async function runSearch() {
    setLoading(true);
    setErr("");
    try {
      const data = await posListPaidOrders({
        orderCode: form.orderCode.trim() || undefined,
        pickupNumber: form.pickupNumber
          ? Number(form.pickupNumber)
          : undefined,
        memberPhone: form.memberPhone.trim() || undefined,
        dateFrom: form.dateFrom || undefined,
        dateTo: form.dateTo || undefined,
        refundStatus: form.refundStatus || undefined,
        limit: 50,
        offset: 0,
      });
      setOrders(data.orders);
      if (data.orders.length > 0) {
        setSelectedOrderId((prev) => prev ?? data.orders[0].id);
      } else {
        setSelectedOrderId(null);
        setDetail(null);
      }
    } catch (e: any) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Không tải được danh sách đơn",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
  }, []);

  useEffect(() => {
    async function loadDetail(orderId: number) {
      setDetailLoading(true);
      setDetailErr("");
      setRefundMsg("");
      try {
        const data = await posGetOrderDetail(orderId);
        setDetail(data.order);
        setRefundType(
          data.order.refund.refundStatus === "none" ? "full" : "partial",
        );
        const initQty: Record<number, number> = {};
        for (const item of data.order.items) {
          initQty[item.id] = 0;
        }
        setSelectedQty(initQty);
      } catch (e: any) {
        setDetail(null);
        setDetailErr(
          e?.response?.data?.message ||
            e?.message ||
            "Không tải được chi tiết đơn",
        );
      } finally {
        setDetailLoading(false);
      }
    }

    if (selectedOrderId) {
      loadDetail(selectedOrderId);
    }
  }, [selectedOrderId]);

  const partialPreviewAmount = useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((sum, item) => {
      const qty = Math.max(
        0,
        Math.min(selectedQty[item.id] || 0, item.refund.remainingQty),
      );
      if (!qty) return sum;
      const perUnit =
        item.refund.remainingQty > 0
          ? item.refund.remainingAmount / item.refund.remainingQty
          : 0;
      return sum + perUnit * qty;
    }, 0);
  }, [detail, selectedQty]);

  async function handleRefund() {
    if (!detail) return;
    setRefundLoading(true);
    setRefundMsg("");
    try {
      const items =
        refundType === "partial"
          ? detail.items
              .map((item) => ({
                orderDetailId: item.id,
                quantity: Math.max(
                  0,
                  Math.min(
                    selectedQty[item.id] || 0,
                    item.refund.remainingQty,
                  ),
                ),
              }))
              .filter((item) => item.quantity > 0)
          : [];

      const data = await posRefundOrder(detail.id, {
        refundType,
        reason: refundReason,
        items,
      });

      setRefundMsg(`Refund thành công: ${formatMoney(data.refund.refundAmount)}`);
      setRefundReason("");
      await runSearch();
      const detailData = await posGetOrderDetail(detail.id);
      setDetail(detailData.order);
    } catch (e: any) {
      setRefundMsg(
        e?.response?.data?.message || e?.message || "Refund thất bại",
      );
    } finally {
      setRefundLoading(false);
    }
  }

  return (
    <div className="pos-screen pos-ui pos-paid-page">
      <div className="pos-shell pos-shell--wide">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Order lookup</div>
            <h2 className="pos-topbar__title" style={sectionTitleStyle}>
              Tra cứu và refund đơn
            </h2>
            <p className="pos-topbar__subtitle">
              Tìm đơn đã thanh toán, xem chi tiết giao dịch và xử lý refund tại
              quầy.
            </p>
          </div>

          <div className="pos-inline-actions">
            <button
              onClick={runSearch}
              disabled={loading}
              style={topActionButtonStyle}
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <button
              onClick={() => nav("/pos")}
              style={topActionButtonStyle}
            >
              Về dashboard
            </button>
          </div>
        </div>

        <div
          className="pos-main-grid pos-main-grid--content"
          style={{
            gridTemplateColumns: "minmax(340px, 0.96fr) minmax(0, 1.34fr)",
            alignItems: "start",
          }}
        >
          <div className="pos-panel">
            <div className="pos-stack pos-stack--compact">
              <div>
                <h3 style={blockTitleStyle}>Bộ lọc đơn</h3>
                <div className="pos-muted" style={{ marginTop: 4 }}>
                  Lọc theo mã đơn, pickup number, member và khoảng ngày thanh
                  toán.
                </div>
              </div>

              <div style={formGridStyle}>
                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Mã đơn</span>
                  <input
                    style={inputStyle}
                    placeholder="Nhập mã đơn"
                    value={form.orderCode}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, orderCode: e.target.value }))
                    }
                  />
                </label>

                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Số thẻ</span>
                  <input
                    style={inputStyle}
                    placeholder="Pickup number"
                    value={form.pickupNumber}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, pickupNumber: e.target.value }))
                    }
                  />
                </label>

                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Số điện thoại member</span>
                  <input
                    style={inputStyle}
                    placeholder="Nhập số điện thoại"
                    value={form.memberPhone}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, memberPhone: e.target.value }))
                    }
                  />
                </label>

                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Refund status</span>
                  <select
                    style={inputStyle}
                    value={form.refundStatus}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        refundStatus: e.target.value as SearchForm["refundStatus"],
                      }))
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="none">Chưa refund</option>
                    <option value="partial">Refund một phần</option>
                    <option value="full">Refund full</option>
                  </select>
                </label>

                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Từ ngày</span>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.dateFrom}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, dateFrom: e.target.value }))
                    }
                  />
                </label>

                <label className="pos-field" style={fieldStackStyle}>
                  <span className="pos-field__label">Đến ngày</span>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.dateTo}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, dateTo: e.target.value }))
                    }
                  />
                </label>
              </div>

              <button
                className="pos-btn-primary"
                onClick={runSearch}
                disabled={loading}
                style={softButtonStyle}
              >
                {loading ? "Đang tìm..." : "Tìm đơn"}
              </button>

              {err ? <div className="pos-alert pos-alert--danger">{err}</div> : null}
            </div>

            <div className="pos-stack pos-stack--compact" style={{ marginTop: 20 }}>
              <div style={sectionHeaderRowStyle}>
                <h3 style={blockTitleStyle}>Danh sách đơn</h3>
                <span className="pos-badge pos-badge--info" style={softBadgeStyle}>
                  {orders.length} đơn
                </span>
              </div>

              <div
                className="pos-stack pos-stack--compact pos-scroll"
                style={listWrapStyle}
              >
                {orders.map((order) => {
                  const refundMeta = getRefundStatusMeta(order.refundStatus);

                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="pos-select-card"
                      style={{
                        ...orderCardBaseStyle,
                        ...(selectedOrderId === order.id
                          ? softActiveOrderCardStyle
                          : {}),
                      }}
                    >
                      <div style={orderCardHeaderStyle}>
                        <div style={orderCodeTextStyle}>{order.orderCode}</div>

                        <span
                          style={{
                            ...refundMeta,
                            borderRadius: 999,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {refundMeta.label}
                        </span>
                      </div>

                      <div style={orderMetaGridStyle}>
                        <div style={metaBlockStyle}>
                          <span style={metaLabelStyle}>Pickup</span>
                          <span style={metaValueStyle}>
                            {order.pickupNumber ?? "-"}
                          </span>
                        </div>

                        <div style={metaBlockStyle}>
                          <span style={metaLabelStyle}>SĐT</span>
                          <span style={metaValueStyle}>
                            {order.customerPhone || "-"}
                          </span>
                        </div>

                        <div style={metaBlockStyle}>
                          <span style={metaLabelStyle}>Thanh toán</span>
                          <span style={metaValueStyle}>
                            {formatDate(order.paidAt)}
                          </span>
                        </div>

                        <div style={metaBlockStyle}>
                          <span style={metaLabelStyle}>Tổng đơn</span>
                          <span style={metaValueStyle}>
                            {formatMoney(order.finalAmount)}
                          </span>
                        </div>

                        <div style={metaBlockStyle}>
                          <span style={metaLabelStyle}>Đã refund</span>
                          <span style={metaValueStyle}>
                            {formatMoney(order.refundedAmount)}
                          </span>
                        </div>
                      </div>

                      {order.orderType && order.orderType !== "NORMAL" ? (
                        <div style={{ marginTop: 2 }}>
                          <span className="pos-badge pos-badge--warning">
                            {order.orderType}
                          </span>
                          {order.specialNote ? (
                            <div
                              className="pos-muted"
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                lineHeight: 1.5,
                                whiteSpace: "normal",
                              }}
                            >
                              {order.specialNote}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}

                {!loading && orders.length === 0 ? (
                  <div className="pos-empty-state">
                    Không có đơn phù hợp với bộ lọc hiện tại.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pos-panel">
            <div style={sectionHeaderRowStyle}>
              <div>
                <h3 style={blockTitleStyle}>Chi tiết đơn</h3>
                <div className="pos-muted" style={{ marginTop: 4 }}>
                  Xem thông tin thanh toán và xử lý refund trên từng món.
                </div>
              </div>

              {detail ? (
                <span className="pos-badge pos-badge--info" style={softBadgeStyle}>
                  {detail.orderCode}
                </span>
              ) : null}
            </div>

            {detailLoading ? (
              <div className="pos-alert pos-alert--info" style={{ marginTop: 16 }}>
                Đang tải chi tiết...
              </div>
            ) : null}

            {detailErr ? (
              <div className="pos-alert pos-alert--danger" style={{ marginTop: 16 }}>
                {detailErr}
              </div>
            ) : null}

            {!detailLoading && !detail ? (
              <div className="pos-empty-state" style={{ marginTop: 16 }}>
                Chọn một đơn ở cột bên trái để xem chi tiết.
              </div>
            ) : null}

            {detail ? (
              <div className="pos-stack" style={{ marginTop: 16 }}>
                <div style={detailSummaryGridStyle}>
                  <div className="pos-summary-box" style={{ padding: 18 }}>
                    <div style={detailCodeTextStyle}>{detail.orderCode}</div>
                    <div className="pos-muted" style={{ marginTop: 10 }}>
                      Pickup: {detail.pickupNumber ?? "-"}
                    </div>
                    <div className="pos-muted" style={{ marginTop: 4 }}>
                      Khách: {detail.customerName || "-"}
                    </div>
                    <div className="pos-muted" style={{ marginTop: 4 }}>
                      SDT: {detail.customerPhone || "-"}
                    </div>
                  </div>

                  <div className="pos-summary-box" style={{ padding: 18 }}>
                    <div style={{ fontWeight: 800 }}>
                      Trạng thái đơn: {detail.status}
                    </div>
                    <div className="pos-muted" style={{ marginTop: 10 }}>
                      Thanh toán lúc:{" "}
                      {formatDate(
                        detail.payments[detail.payments.length - 1]?.paidAt,
                      )}
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 800 }}>
                      Tổng đã thu: {formatMoney(detail.finalAmount)}
                    </div>
                    <div className="pos-muted" style={{ marginTop: 4 }}>
                      Đã refund: {formatMoney(detail.refund.refundedAmount)}
                    </div>
                    <div className="pos-muted" style={{ marginTop: 4 }}>
                      Còn refund được:{" "}
                      {formatMoney(detail.refund.remainingRefundableAmount)}
                    </div>
                  </div>
                </div>

                {detail.orderType && detail.orderType !== "NORMAL" ? (
                  <div className="pos-alert pos-alert--warning">
                    Loại đơn: <strong>{detail.orderType}</strong>
                    {detail.specialNote ? ` • ${detail.specialNote}` : ""}
                  </div>
                ) : null}

                <div className="pos-stack pos-stack--compact">
                  <h4 style={blockTitleStyle}>Món đã order</h4>

                  <div className="pos-stack pos-stack--compact">
                    {detail.items.map((item) => (
                      <div
                        key={item.id}
                        className="pos-summary-box"
                        style={itemCardStyle}
                      >
                        <div style={itemGridStyle}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>
                              {item.variantName ||
                                item.productName ||
                                `Variant ${item.productVariantId}`}
                            </div>

                            <div
                              className="pos-muted"
                              style={{ marginTop: 8, lineHeight: 1.5 }}
                            >
                              SL mua: {item.quantity} • Đã refund:{" "}
                              {item.refund.refundedQty} • Còn lại:{" "}
                              {item.refund.remainingQty}
                            </div>

                            <div className="pos-muted" style={{ marginTop: 4 }}>
                              Còn refund được:{" "}
                              {formatMoney(item.refund.remainingAmount)}
                            </div>
                          </div>

                          <label style={qtyFieldStyle}>
                            <span className="pos-field__label">
                              Số lượng refund
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={item.refund.remainingQty}
                              value={selectedQty[item.id] ?? 0}
                              onChange={(e) =>
                                setSelectedQty((s) => ({
                                  ...s,
                                  [item.id]: Number(e.target.value || 0),
                                }))
                              }
                              disabled={
                                refundType !== "partial" ||
                                item.refund.remainingQty <= 0
                              }
                              style={qtyInputStyle}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pos-panel pos-panel--soft" style={{ padding: 16 }}>
                  <div className="pos-stack pos-stack--compact">
                    <h4 style={blockTitleStyle}>Thực hiện refund</h4>

                    <div style={refundModeGridStyle}>
                      <button
                        onClick={() => setRefundType("full")}
                        className="pos-select-card"
                        style={{
                          ...refundModeButtonStyle,
                          ...(refundType === "full"
                            ? softButtonStyle
                            : softButtonGhostStyle),
                        }}
                      >
                        Refund full
                      </button>

                      <button
                        onClick={() => setRefundType("partial")}
                        disabled={detail.refund.remainingRefundableAmount <= 0}
                        className="pos-select-card"
                        style={{
                          ...refundModeButtonStyle,
                          ...(refundType === "partial"
                            ? softButtonStyle
                            : softButtonGhostStyle),
                        }}
                      >
                        Refund partial
                      </button>
                    </div>

                    <textarea
                      placeholder="Lý do refund"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={4}
                      style={textareaStyle}
                    />

                    <div className="pos-summary-box" style={{ padding: 16 }}>
                      Số tiền dự kiến refund:{" "}
                      <strong>
                        {formatMoney(
                          refundType === "full"
                            ? detail.refund.remainingRefundableAmount
                            : partialPreviewAmount,
                        )}
                      </strong>
                    </div>

                    <button
                      className="pos-btn-primary"
                      onClick={handleRefund}
                      disabled={
                        refundLoading ||
                        !refundReason.trim() ||
                        detail.refund.remainingRefundableAmount <= 0
                      }
                      style={{
                        ...softButtonStyle,
                        opacity:
                          refundLoading ||
                          !refundReason.trim() ||
                          detail.refund.remainingRefundableAmount <= 0
                            ? 0.65
                            : 1,
                      }}
                    >
                      {refundLoading ? "Đang refund..." : "Xác nhận refund"}
                    </button>

                    {refundMsg ? (
                      <div
                        className={
                          refundMsg.toLowerCase().includes("thành công")
                            ? "pos-alert pos-alert--success"
                            : "pos-alert pos-alert--danger"
                        }
                      >
                        {refundMsg}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="pos-stack pos-stack--compact">
                  <h4 style={blockTitleStyle}>Lịch sử refund</h4>

                  <div className="pos-stack pos-stack--compact">
                    {detail.refunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="pos-summary-box"
                        style={{ padding: 16 }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          #{refund.id} • {refund.refundType} •{" "}
                          {formatMoney(refund.refundAmount)}
                        </div>
                        <div className="pos-muted" style={{ marginTop: 6 }}>
                          Lý do: {refund.reason}
                        </div>
                        <div className="pos-muted" style={{ marginTop: 4 }}>
                          Thời gian: {formatDate(refund.createdAt)}
                        </div>
                      </div>
                    ))}

                    {detail.refunds.length === 0 ? (
                      <div className="pos-empty-state">
                        Chưa có refund nào trên đơn này.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}