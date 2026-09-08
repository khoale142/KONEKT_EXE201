import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  closeShiftReconciliation,
  getCurrentShiftReconciliation,
  getShiftReconciliationDetail,
  listShiftReconciliations,
  openShiftReconciliation,
  verifyShiftClose,
  type ShiftReconciliationDetailResponse,
  type ShiftReconciliationItem,
  type VerifyShiftCloseResponse,
} from "../api/shiftReconciliations.api";

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMoney(n: number) {
  return `${Number(n || 0).toLocaleString()}d`;
}

function formatDateTime(v?: string | null) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function orderTypeLabel(orderType?: string) {
  const t = String(orderType || "NORMAL").toUpperCase();
  if (t === "TEST") return "TEST";
  if (t === "FREE") return "FREE";
  if (t === "INTERNAL") return "INTERNAL";
  if (t === "GUEST") return "GUEST";
  if (t === "COMPENSATION") return "COMP";
  return t;
}

function OrderTypeBadge(props: { orderType?: string }) {
  const t = String(props.orderType || "NORMAL").toUpperCase();

  const bg =
    t === "TEST"
      ? "#fef3c7"
      : t === "FREE"
        ? "#fee2e2"
        : t === "INTERNAL"
          ? "#dbeafe"
          : t === "GUEST"
            ? "#ede9fe"
            : "#ffedd5";

  const border =
    t === "TEST"
      ? "#f59e0b"
      : t === "FREE"
        ? "#ef4444"
        : t === "INTERNAL"
          ? "#3b82f6"
          : t === "GUEST"
            ? "#8b5cf6"
            : "#f97316";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {orderTypeLabel(t)}
    </span>
  );
}

export default function PosShiftReconciliationPage() {
  const nav = useNavigate();
  const today = useMemo(() => todayLocal(), []);

  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [submittingOpen, setSubmittingOpen] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [submittingClose, setSubmittingClose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ShiftReconciliationDetailResponse | null>(null);
  const [history, setHistory] = useState<ShiftReconciliationItem[]>([]);
  const [verification, setVerification] = useState<VerifyShiftCloseResponse | null>(null);

  const [workDate, setWorkDate] = useState(today);
  const [shiftCode, setShiftCode] = useState<"A" | "B">("A");
  const [openingCashAmount, setOpeningCashAmount] = useState("");
  const [openNote, setOpenNote] = useState("");

  const [actualCashAmount, setActualCashAmount] = useState("");
  const [confirmActualCashAmount, setConfirmActualCashAmount] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [closeNote, setCloseNote] = useState("");

  const [historyDateFrom, setHistoryDateFrom] = useState(today);
  const [historyDateTo, setHistoryDateTo] = useState(today);
  const [historyShiftCode, setHistoryShiftCode] = useState<"" | "A" | "B">("");

  const loadCurrent = async () => {
    const r = await getCurrentShiftReconciliation();
    setDetail(r.current);
    setVerification(null);

    if (r.current?.reconciliation) {
      setWorkDate(r.current.reconciliation.workDate);
      setShiftCode(r.current.reconciliation.shiftCode);
      setCloseNote(r.current.reconciliation.note || "");
      setActualCashAmount("");
      setConfirmActualCashAmount("");
      setConfirmText("");
    }
  };

  const loadHistory = async () => {
    const r = await listShiftReconciliations({
      dateFrom: historyDateFrom || undefined,
      dateTo: historyDateTo || undefined,
      shiftCode: historyShiftCode || undefined,
      limit: 20,
      offset: 0,
    });
    setHistory(r.reconciliations || []);
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Load shift reconciliation failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const reloadCurrentDetail = async () => {
    if (!detail?.reconciliation?.id) {
      await loadCurrent();
      return;
    }

    setReloading(true);
    setError(null);
    try {
      const r = await getShiftReconciliationDetail(detail.reconciliation.id);
      setDetail(r);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Reload current failed");
    } finally {
      setReloading(false);
    }
  };

  const handleOpenShift = async () => {
    setSubmittingOpen(true);
    setError(null);
    try {
      const opening = Number((openingCashAmount || "").replace(/[^\d]/g, ""));
      const r = await openShiftReconciliation({
        workDate,
        shiftCode,
        openingCashAmount: Number.isFinite(opening) ? opening : 0,
        note: openNote.trim() || undefined,
      });
      setDetail(r);
      setVerification(null);
      setActualCashAmount("");
      setConfirmActualCashAmount("");
      setConfirmText("");
      setCloseNote("");
      await loadHistory();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Open shift failed");
    } finally {
      setSubmittingOpen(false);
    }
  };

  const handleVerifyClose = async () => {
    if (!detail?.reconciliation?.id) return;

    setSubmittingVerify(true);
    setError(null);
    try {
      const actual = Number((actualCashAmount || "").replace(/[^\d]/g, ""));
      const r = await verifyShiftClose(detail.reconciliation.id, {
        actualCashAmount: Number.isFinite(actual) ? actual : 0,
      });
      setVerification(r);
      setConfirmActualCashAmount(String(r.verification.actualCashAmount));
      setConfirmText("");
    } catch (e: any) {
      setVerification(null);
      setError(e?.response?.data?.message || e.message || "Verify close failed");
    } finally {
      setSubmittingVerify(false);
    }
  };

  const handleCloseShift = async () => {
    if (!detail?.reconciliation?.id || !verification) return;

    setSubmittingClose(true);
    setError(null);
    try {
      const actual = Number((actualCashAmount || "").replace(/[^\d]/g, ""));
      const confirmAmount = Number((confirmActualCashAmount || "").replace(/[^\d]/g, ""));
      const r = await closeShiftReconciliation(detail.reconciliation.id, {
        actualCashAmount: Number.isFinite(actual) ? actual : 0,
        confirmActualCashAmount: Number.isFinite(confirmAmount) ? confirmAmount : 0,
        confirmText: confirmText.trim(),
        note: closeNote.trim() || undefined,
      });
      setDetail(r);
      setVerification(null);
      await loadHistory();
      nav("/pos", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Close shift failed");
    } finally {
      setSubmittingClose(false);
    }
  };

  return (
    <div className="pos-screen pos-ui pos-shift-page">
      <div className="pos-shell pos-shell--wide">
      <div className="pos-topbar">
        <div className="pos-topbar__main">
          <div className="pos-topbar__eyebrow">Shift reconciliation</div>
          <h2 className="pos-topbar__title">Chốt ca và kiểm quỹ</h2>
          <p className="pos-topbar__subtitle">
            Mở ca A/B, đối soát tiền mặt và xác thực đóng ca theo 2 bước.
          </p>
        </div>

        <div className="pos-inline-actions">
          <button onClick={reloadCurrentDetail} disabled={reloading || !detail}>
            {reloading ? "Đang tải..." : "Tải lại ca hiện tại"}
          </button>
          <button onClick={loadHistory} disabled={loading}>
            Tải lịch sử
          </button>
          <button onClick={() => nav("/pos")}>Về dashboard</button>
        </div>
      </div>

      {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}
      {loading ? <div className="pos-alert pos-alert--info">Đang tải dữ liệu...</div> : null}

      {!loading ? (
        <div
          className="pos-main-grid pos-main-grid--content"
          style={{ gridTemplateColumns: "1.15fr 0.85fr", alignItems: "start" }}
        >
          <div className="pos-stack">
            {!detail ? (
              <SectionCard title="Mở ca mới">
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Ngày làm việc</div>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      style={{ width: "100%", padding: 10 }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Loại ca</div>
                    <div className="pos-inline-actions">
                      <button
                        onClick={() => setShiftCode("A")}
                        className={shiftCode === "A" ? "pos-select-card is-active" : "pos-select-card"}
                        style={{ padding: "10px 14px" }}
                      >
                        Ca A (07:00 - 15:00)
                      </button>
                      <button
                        onClick={() => setShiftCode("B")}
                        className={shiftCode === "B" ? "pos-select-card is-active" : "pos-select-card"}
                        style={{ padding: "10px 14px" }}
                      >
                        Ca B (15:00 - 23:00)
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Tiền đầu ca trong két</div>
                    <input
                      value={openingCashAmount}
                      onChange={(e) => setOpeningCashAmount(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="VD: 200000"
                      inputMode="numeric"
                      style={{ width: "100%", padding: 10 }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Ghi chú</div>
                    <textarea
                      value={openNote}
                      onChange={(e) => setOpenNote(e.target.value)}
                      placeholder="Mô tả ngắn cho ca này (nếu có)"
                      rows={3}
                      style={{ width: "100%", padding: 10, resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <button onClick={handleOpenShift} disabled={submittingOpen}>
                      {submittingOpen ? "Đang mở ca..." : `Mở ca ${shiftCode}`}
                    </button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <>
                {detail.reconciliation.warning ? (
                  <div
                    style={{
                      border: "1px solid #f59e0b",
                      background: "#fffbeb",
                      color: "#92400e",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <b>Cảnh báo ca quá giờ:</b> {detail.reconciliation.warning.message}
                  </div>
                ) : null}

                <SectionCard title="Thông tin ca hiện tại">
                  <div style={{ display: "grid", gap: 10 }}>
                    <div><b>Cửa hàng:</b> {detail.store.name}</div>
                    <div><b>Mã cửa hàng:</b> {detail.store.code}</div>
                    <div><b>Địa chỉ:</b> {detail.store.address || "--"}</div>
                    <div><b>Ngày làm việc:</b> {detail.reconciliation.workDate}</div>
                    <div><b>Loại ca:</b> {detail.reconciliation.shiftCode}</div>
                    <div><b>Khung giờ:</b> {formatDateTime(detail.reconciliation.scheduledStartAt)} → {formatDateTime(detail.reconciliation.scheduledEndAt)}</div>
                    <div><b>Bắt đầu thực tế:</b> {formatDateTime(detail.reconciliation.startedAt)}</div>
                    <div><b>Đóng ca:</b> {formatDateTime(detail.reconciliation.closedAt)}</div>
                    <div>
                      <b>Trạng thái:</b>{" "}
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background:
                            detail.reconciliation.status === "open" ? "#dcfce7" : "#e5e7eb",
                          display: "inline-block",
                        }}
                      >
                        {detail.reconciliation.status === "open" ? "Đang mở" : "Đã đóng"}
                      </span>
                    </div>
                    <div><b>Tiền đầu ca:</b> {formatMoney(detail.reconciliation.openingCashAmount)}</div>
                    {detail.reconciliation.note ? (
                      <div><b>Ghi chú:</b> {detail.reconciliation.note}</div>
                    ) : null}
                    {(detail.summary.specialOrderCount || 0) > 0 ? (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          color: "#92400e",
                        }}
                      >
                        Ca này có <b>{detail.summary.specialOrderCount}</b> đơn đặc biệt, tổng giá trị
                        hàng xuất là <b>{formatMoney(detail.summary.specialValue || 0)}</b>. Các đơn
                        này không tạo payment transaction nên không làm tăng tiền trong két.
                      </div>
                    ) : null}
                  </div>
                </SectionCard>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <MetricCard title="Tổng order trong ca" value={String(detail.summary.totalOrders)} />
                  <MetricCard title="Đơn bán thực" value={String(detail.summary.normalOrderCount || 0)} />
                  <MetricCard title="Đơn đặc biệt" value={String(detail.summary.specialOrderCount || 0)} />
                  <MetricCard
                    title="Tỷ lệ special"
                    value={`${Number(detail.summary.specialRatePct || 0).toLocaleString()}%`}
                  />

                  <MetricCard title="Tiền đầu ca" value={formatMoney(detail.summary.openingCashAmount)} />
                  <MetricCard title="Tiền mặt thu trong ca" value={formatMoney(detail.summary.cashAmount)} />
                  <MetricCard
                    title="Chuyển khoản trong ca"
                    value={formatMoney(detail.summary.transferAmount)}
                  />
                  <MetricCard title="Tổng thu trong ca" value={formatMoney(detail.summary.expectedTotalAmount)} />

                  <MetricCard title="Đơn tiền mặt" value={String(detail.summary.cashOrderCount)} />
                  <MetricCard title="Đơn chuyển khoản" value={String(detail.summary.transferOrderCount)} />
                  <MetricCard title="Giá trị special" value={formatMoney(detail.summary.specialValue || 0)} />
                  <MetricCard title="Món special" value={String(detail.summary.specialItemCount || 0)} />
                </div>

                <SectionCard title="Đóng ca / Xác thực 2 bước">
                  {detail.reconciliation.status === "closed" ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div><b>Tiền mặt thực tế:</b> {formatMoney(detail.reconciliation.actualCashAmount || 0)}</div>
                      <div>
                        <b>Chênh lệch:</b>{" "}
                        <span style={{ color: detail.reconciliation.varianceCashAmount === 0 ? "#111" : "crimson" }}>
                          {detail.reconciliation.varianceCashAmount > 0 ? "+" : ""}
                          {formatMoney(detail.reconciliation.varianceCashAmount)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>Bước 1 - Nhập tiền mặt đếm thực tế</div>
                        <input
                          value={actualCashAmount}
                          onChange={(e) => {
                            setActualCashAmount(e.target.value.replace(/[^\d]/g, ""));
                            setVerification(null);
                          }}
                          placeholder="Nhập số tiền đếm được"
                          inputMode="numeric"
                          style={{ width: "100%", padding: 10 }}
                        />
                      </div>

                      <div
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 10,
                          background: "#fafafa",
                          padding: 12,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div><b>Tiền đầu ca:</b> {formatMoney(detail.summary.openingCashAmount)}</div>
                        <div><b>Tiền mặt thu trong ca:</b> {formatMoney(detail.summary.cashAmount)}</div>
                        <div><b>Tiền dự kiến trong két:</b> {formatMoney(detail.summary.expectedCashInDrawer)}</div>
                        {(detail.summary.specialOrderCount || 0) > 0 ? (
                          <div style={{ color: "#92400e" }}>
                            <b>Đơn special trong ca:</b> {detail.summary.specialOrderCount} đơn •{" "}
                            {formatMoney(detail.summary.specialValue || 0)} giá trị hàng xuất
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <button onClick={handleVerifyClose} disabled={submittingVerify || !actualCashAmount}>
                          {submittingVerify ? "Đang kiểm tra..." : "Bước 1 - Kiểm tra số liệu"}
                        </button>
                      </div>

                      {verification ? (
                        <div
                          style={{
                            border: "1px solid #a7f3d0",
                            background: "#ecfdf5",
                            borderRadius: 12,
                            padding: 12,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div><b>Bước 2 - Xác thực đóng ca</b></div>
                          <div><b>Tiền đếm thực tế:</b> {formatMoney(verification.verification.actualCashAmount)}</div>
                          <div><b>Tiền dự kiến trong két:</b> {formatMoney(verification.verification.expectedCashInDrawer)}</div>
                          <div>
                            <b>Chênh lệch tạm tính:</b>{" "}
                            <span style={{ color: verification.verification.variancePreview === 0 ? "#111" : "crimson" }}>
                              {verification.verification.variancePreview > 0 ? "+" : ""}
                              {formatMoney(verification.verification.variancePreview)}
                            </span>
                          </div>

                          <div>
                            <div style={{ fontSize: 13, marginBottom: 4 }}>
                              Nhập lại số tiền để xác nhận lần 2
                            </div>
                            <input
                              value={confirmActualCashAmount}
                              onChange={(e) =>
                                setConfirmActualCashAmount(e.target.value.replace(/[^\d]/g, ""))
                              }
                              placeholder="Nhập lại số tiền"
                              inputMode="numeric"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 13, marginBottom: 4 }}>
                              Nhập chuỗi xác nhận: <b>{verification.verification.confirmText}</b>
                            </div>
                            <input
                              value={confirmText}
                              onChange={(e) => setConfirmText(e.target.value)}
                              placeholder="Nhập lại chuỗi xác nhận"
                              style={{ width: "100%", padding: 10 }}
                            />
                          </div>

                          <div>
                            <div style={{ fontSize: 13, marginBottom: 4 }}>Ghi chú đóng ca</div>
                            <textarea
                              value={closeNote}
                              onChange={(e) => setCloseNote(e.target.value)}
                              placeholder="VD: lech 20k nghi do thoi tien"
                              rows={3}
                              style={{ width: "100%", padding: 10, resize: "vertical" }}
                            />
                          </div>

                          <div>
                            <button onClick={handleCloseShift} disabled={submittingClose}>
                              {submittingClose ? "Đang đóng ca..." : "Bước 2 - Xác nhận đóng ca"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Phân loại đơn đặc biệt trong ca">
                  {(detail.summary.specialOrderCount || 0) === 0 ? (
                    <div>Không có đơn đặc biệt trong ca</div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 12,
                      }}
                    >
                      <MetricCard title="TEST" value={String(detail.summary.specialTestCount || 0)} />
                      <MetricCard title="FREE" value={String(detail.summary.specialFreeCount || 0)} />
                      <MetricCard title="INTERNAL" value={String(detail.summary.specialInternalCount || 0)} />
                      <MetricCard title="GUEST" value={String(detail.summary.specialGuestCount || 0)} />
                      <MetricCard title="COMP" value={String(detail.summary.specialCompensationCount || 0)} />
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Danh sách thanh toán trong ca">
                  {detail.payments.length === 0 ? (
                    <div>Chưa có thanh toán nào trong ca</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, maxHeight: 420, overflow: "auto" }}>
                      {detail.payments.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{p.orderCode}</div>
                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Bill: {formatMoney(p.finalAmount)} • Payment: {formatMoney(p.amount)}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Pickup: {p.pickupNumber ?? "--"} • Staff: {p.staffId ?? "--"}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Trạng thái: {p.orderStatus}
                            </div>
                            {p.referenceCode ? (
                              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                                Mã GD: {p.referenceCode}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: p.method === "cash" ? "#fef3c7" : "#dbeafe",
                                marginBottom: 8,
                              }}
                            >
                              {p.method}
                            </div>
                            <div style={{ fontWeight: 700 }}>{formatMoney(p.amount)}</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                              {formatDateTime(p.paidAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: "#f9fafb",
                      border: "1px solid #eee",
                      fontSize: 13,
                      opacity: 0.85,
                    }}
                  >
                    Danh sách này chỉ hiển thị payment transaction thực. Đơn đặc biệt 0đ sẽ không
                    xuất hiện ở đây.
                  </div>
                </SectionCard>

                <SectionCard title="Đơn đặc biệt trong ca">
                  {!detail.specialOrders || detail.specialOrders.length === 0 ? (
                    <div>Không có đơn đặc biệt trong ca</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, maxHeight: 420, overflow: "auto" }}>
                      {detail.specialOrders.map((o) => (
                        <div
                          key={o.id}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <span>{o.orderCode}</span>
                              <OrderTypeBadge orderType={o.orderType} />
                            </div>

                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Pickup: {o.pickupNumber ?? "--"} • Staff: {o.staffId ?? "--"}
                            </div>

                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Trạng thái: {o.orderStatus}
                            </div>

                            {o.specialNote ? (
                              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                                <b>Ghi chú:</b> {o.specialNote}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700 }}>
                              Giá trị gốc: {formatMoney(o.subtotalAmount)}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                              Final: {formatMoney(o.finalAmount)}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                              {formatDateTime(o.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <SectionCard title="Lịch sử chốt ca">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 120px auto",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  style={{ padding: 10 }}
                />
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  style={{ padding: 10 }}
                />
                <select
                  value={historyShiftCode}
                  onChange={(e) => setHistoryShiftCode(e.target.value as "" | "A" | "B")}
                  style={{ padding: 10 }}
                >
                  <option value="">Tất cả ca</option>
                  <option value="A">Ca A</option>
                  <option value="B">Ca B</option>
                </select>
                <button onClick={loadHistory}>Lọc</button>
              </div>

              {history.length === 0 ? (
                <div>Chưa có lịch sử</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {history.map((x) => (
                    <button
                      key={x.id}
                      onClick={async () => {
                        setError(null);
                        try {
                          const r = await getShiftReconciliationDetail(x.id);
                          setDetail(r);
                          setVerification(null);
                          setCloseNote(r.reconciliation.note || "");
                          setActualCashAmount("");
                          setConfirmActualCashAmount("");
                          setConfirmText("");
                        } catch (e: any) {
                          setError(
                            e?.response?.data?.message ||
                              e.message ||
                              "Load reconciliation detail failed"
                          );
                        }
                      }}
                      style={{
                        textAlign: "left",
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: 12,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 700 }}>
                          Ca {x.shiftCode} - {x.workDate}
                        </div>
                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: x.status === "open" ? "#dcfce7" : "#e5e7eb",
                            height: "fit-content",
                          }}
                        >
                          {x.status}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                        Khung giờ: {formatDateTime(x.scheduledStartAt)} → {formatDateTime(x.scheduledEndAt)}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        Tiền đầu ca: {formatMoney(x.openingCashAmount)}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        Tiền mặt hệ thống: {formatMoney(x.expectedCashAmount)}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        Tiền đếm thực tế: {formatMoney(x.actualCashAmount || 0)}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        Chênh lệch:{" "}
                        <span style={{ color: x.varianceCashAmount === 0 ? "#111" : "crimson" }}>
                          {x.varianceCashAmount > 0 ? "+" : ""}
                          {formatMoney(x.varianceCashAmount)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Lưu ý vận hành">
              <div style={{ display: "grid", gap: 10 }}>
                <TipBox text="Muốn tạo order thì bắt buộc phải có ca A hoặc B đang mở." />
                <TipBox text="Hết giờ ca chỉ hiện cảnh báo để nhân viên chốt ca, hệ thống không khóa order." />
                <TipBox text="Đóng ca phải qua 2 bước: kiểm tra số liệu và xác nhận lần 2." />
                <TipBox text="Sau khi đóng ca thành công, màn hình sẽ tự quay về dashboard." />
                <TipBox text="Đơn đặc biệt 0đ vẫn đi KDS và trừ kho như đơn thường, nhưng không tạo payment transaction nên không cộng vào tiền trong két." />
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function MetricCard(props: { title: string; value: string }) {
  return (
    <div className="pos-metric-card">
      <div className="pos-metric-card__label">{props.title}</div>
      <div className="pos-metric-card__value">{props.value}</div>
    </div>
  );
}

function SectionCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="pos-section-card">
      <div className="pos-section-card__title">{props.title}</div>
      {props.children}
    </div>
  );
}

function TipBox(props: { text: string }) {
  return <div className="pos-tip-card">{props.text}</div>;
}

