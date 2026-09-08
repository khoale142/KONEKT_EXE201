import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStoreReportOverview,
  getTodayStoreReport,
  type StoreReportResponse,
} from "../../pos/api/storeReports.api";

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(v: number) {
  return `${Number(v || 0).toLocaleString()}đ`;
}

function pct(v: number) {
  return `${Number(v || 0).toLocaleString()}%`;
}

function fmtMin(v?: number | null) {
  if (v == null) return "-";
  return `${v} phút`;
}

function statusLabel(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "Hoàn tất";
  if (s === "paid") return "Đã thanh toán";
  if (s === "voided") return "Void";
  if (s === "refunded") return "Hoàn tiền";
  return status;
}

function orderTypeLabel(orderType?: string) {
  const t = String(orderType || "NORMAL").toUpperCase();
  if (t === "NORMAL") return "Đơn thường";
  if (t === "TEST") return "Test món";
  if (t === "FREE") return "Tặng / miễn phí";
  if (t === "INTERNAL") return "Nội bộ";
  if (t === "GUEST") return "Mời chủ / auditor / kỹ thuật";
  if (t === "COMPENSATION") return "Bù khách / khiếu nại";
  return t;
}

function OrderTypeBadge(props: { orderType?: string }) {
  const t = String(props.orderType || "NORMAL").toUpperCase();

  const bg =
    t === "NORMAL"
      ? "#f3f4f6"
      : t === "TEST"
        ? "#fef3c7"
        : t === "FREE"
          ? "#fee2e2"
          : t === "INTERNAL"
            ? "#dbeafe"
            : t === "GUEST"
              ? "#ede9fe"
              : "#ffedd5";

  const border =
    t === "NORMAL"
      ? "#d1d5db"
      : t === "TEST"
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
      title={orderTypeLabel(t)}
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
      {t}
    </span>
  );
}

export default function PosStoreReportPage() {
  const nav = useNavigate();
  const today = useMemo(() => todayLocal(), []);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StoreReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getTodayStoreReport();
      setData(r);
      setDateFrom(r.filters.dateFrom);
      setDateTo(r.filters.dateTo);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Load report failed");
    } finally {
      setLoading(false);
    }
  };

  const loadRange = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getStoreReportOverview({ dateFrom, dateTo, topN: 10 });
      setData(r);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Load report failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pos-screen pos-ui pos-report-page">
      <div className="pos-shell pos-shell--wide">
      <div className="pos-topbar">
        <div className="pos-topbar__main">
          <div className="pos-topbar__eyebrow">Store performance</div>
          <h2 className="pos-topbar__title">Dashboard van hanh cua hang</h2>
          <p className="pos-topbar__subtitle">
            Theo doi doanh thu, member, payment mix va cac diem can SM xu ly.
          </p>
        </div>

        <div className="pos-inline-actions">
          <label className="pos-field" style={{ minWidth: 160 }}>
            <span className="pos-field__label">Tu ngay</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label className="pos-field" style={{ minWidth: 160 }}>
            <span className="pos-field__label">Den ngay</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          <button onClick={loadRange} disabled={loading}>
            {loading ? "Dang tai..." : "Xem bao cao"}
          </button>

          <button onClick={loadToday} disabled={loading}>
            Hom nay
          </button>

          <button onClick={() => nav("/pos")}>Ve dashboard</button>
        </div>
      </div>

      {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}
      {!data && loading ? <div className="pos-alert pos-alert--info">Dang tai du lieu...</div> : null}

      {data ? (
        <>
          <div className="pos-panel pos-panel--soft" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{data.store.name}</div>
            <div className="pos-muted" style={{ marginTop: 4 }}>
              {data.store.code} {data.store.address ? `• ${data.store.address}` : ""}
            </div>
            <div className="pos-muted" style={{ marginTop: 4 }}>
              Ky bao cao: {data.filters.dateFrom} → {data.filters.dateTo}
            </div>
          </div>

          {data.alerts.length > 0 ? (
            <SectionCard
              title="Cảnh báo cần chú ý"
              style={{ marginTop: 16, border: "1px solid #f3d3a3", background: "#fffaf2" }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                {data.alerts.map((x, idx) => (
                  <div key={idx} className="pos-alert pos-alert--warning" style={{ marginTop: 0 }}>
                    {x}
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <MetricCard title="Doanh thu thuần thực" value={money(data.summary.netSales)} />
            <MetricCard title="Gross sales thực" value={money(data.summary.grossSales)} />
            <MetricCard title="Discount thương mại" value={money(data.summary.discountTotal)} />
            <MetricCard title="Số đơn bán thực" value={String(data.summary.recognizedOrders)} />

            <MetricCard title="AOV đơn thường" value={money(data.summary.averageOrderValue)} />
            <MetricCard
              title="Món bán thực"
              value={String(data.summary.itemsSoldNormal ?? data.summary.itemsSold)}
            />
            <MetricCard title="Món / đơn thường" value={String(data.summary.itemsPerRecognizedOrder)} />
            <MetricCard title="Tỷ lệ hoàn tất" value={pct(data.summary.completionRatePct)} />

            <MetricCard title="Đơn đặc biệt" value={String(data.summary.specialOrders)} />
            <MetricCard title="Giá trị special" value={money(data.summary.specialValue)} />
            <MetricCard title="Món special" value={String(data.summary.itemsSoldSpecial || 0)} />
            <MetricCard title="Tỷ lệ special" value={pct(data.summary.specialRatePct || 0)} />

            <MetricCard title="Tỷ lệ member" value={pct(data.summary.memberOrderSharePct)} />
            <MetricCard title="Tổng order vận hành" value={String(data.summary.totalOrders)} />
            <MetricCard title="Đơn treo >15p" value={String(data.summary.preparingOver15m)} />
            <MetricCard title="TG hoàn tất TB" value={fmtMin(data.summary.avgCompletedMinutes)} />
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Tóm tắt điều hành">
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Khung giờ mạnh nhất" value={data.summary.peakHourLabel || "-"} />
                <InfoRow label="Đơn ở giờ mạnh nhất" value={String(data.summary.peakHourOrders)} />
                <InfoRow label="Doanh thu giờ mạnh nhất" value={money(data.summary.peakHourRevenue)} />
                <InfoRow label="Thanh toán trội nhất" value={data.summary.topPaymentMethod || "-"} />
                <InfoRow
                  label="Giá trị thanh toán trội nhất"
                  value={money(data.summary.topPaymentAmount)}
                />
                <InfoRow label="Tổng payment mix" value={money(data.summary.paymentMixTotal)} />
                <InfoRow label="Paid orders" value={String(data.summary.paidOrders)} />
                <InfoRow label="Completed orders" value={String(data.summary.completedOrders)} />
                <InfoRow label="Voided orders" value={String(data.summary.voidedOrders)} />
                <InfoRow label="Refunded orders" value={String(data.summary.refundedOrders)} />
                <div style={{ borderTop: "1px dashed #eee", margin: "4px 0" }} />
                <InfoRow label="Đơn đặc biệt" value={String(data.summary.specialOrders || 0)} />
                <InfoRow
                  label="Giá trị hàng special"
                  value={money(data.summary.specialValue || 0)}
                />
                <InfoRow
                  label="Loại special nhiều nhất"
                  value={data.summary.topSpecialOrderType || "-"}
                />
                <InfoRow label="Món special" value={String(data.summary.itemsSoldSpecial || 0)} />
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  fontSize: 13,
                  color: "#92400e",
                }}
              >
                Doanh thu thuần, AOV, member split và payment mix chỉ tính đơn <b>NORMAL</b>.
                Đơn đặc biệt được tách riêng để SM theo dõi xuất hàng không doanh thu.
              </div>
            </SectionCard>

            <SectionCard title="Member vs guest">
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Đơn member" value={String(data.memberSplit.memberOrders)} />
                <InfoRow label="Doanh thu member" value={money(data.memberSplit.memberSales)} />
                <InfoRow label="AOV member" value={money(data.memberSplit.memberAov)} />
                <div style={{ borderTop: "1px dashed #eee", margin: "4px 0" }} />
                <InfoRow label="Đơn guest" value={String(data.memberSplit.guestOrders)} />
                <InfoRow label="Doanh thu guest" value={money(data.memberSplit.guestSales)} />
                <InfoRow label="AOV guest" value={money(data.memberSplit.guestAov)} />
              </div>
            </SectionCard>

            <SectionCard title="Payment mix">
              {data.paymentMix.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.paymentMix.map((p) => (
                    <div
                      key={p.method}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.method}</div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>{p.transactionCount} giao dịch</div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{money(p.amount)}</div>
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
                Đơn đặc biệt 0đ không tạo payment transaction và không nằm trong payment mix.
              </div>
            </SectionCard>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Top sản phẩm theo doanh thu">
              {data.topProducts.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.topProducts.map((p, idx) => (
                    <div
                      key={p.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          #{idx + 1} {p.productName}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>
                          {p.quantitySold} món • {p.orderCount} đơn
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{money(p.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Cơ cấu trạng thái đơn">
              {data.statusBreakdown.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.statusBreakdown.map((s) => (
                    <div
                      key={s.status}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{statusLabel(s.status)}</div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>{s.orderCount} đơn</div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{money(s.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Đơn đặc biệt / phi doanh thu">
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Tổng đơn đặc biệt" value={String(data.summary.specialOrders || 0)} />
                <InfoRow
                  label="Tổng giá trị hàng special"
                  value={money(data.summary.specialValue || 0)}
                />
                <InfoRow label="TEST" value={String(data.summary.specialTestOrders || 0)} />
                <InfoRow label="FREE" value={String(data.summary.specialFreeOrders || 0)} />
                <InfoRow label="INTERNAL" value={String(data.summary.specialInternalOrders || 0)} />
                <InfoRow label="GUEST" value={String(data.summary.specialGuestOrders || 0)} />
                <InfoRow
                  label="COMPENSATION"
                  value={String(data.summary.specialCompensationOrders || 0)}
                />
              </div>
            </SectionCard>

            <SectionCard title="Cơ cấu loại đơn">
              {data.orderTypeBreakdown?.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.orderTypeBreakdown.map((x) => (
                    <div
                      key={x.orderType}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          <OrderTypeBadge orderType={x.orderType} />
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                          {x.orderCount} đơn
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600 }}>Giá trị gốc: {money(x.subtotalValue)}</div>
                        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                          Final: {money(x.finalAmount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Hiệu suất theo giờ" style={{ marginTop: 16 }}>
            {data.hourlySales.length === 0 ? (
              <div>Chưa có dữ liệu</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Giờ</Th>
                      <Th>Tổng đơn</Th>
                      <Th>Đơn special</Th>
                      <Th>Doanh thu thực</Th>
                      <Th>Giá trị special</Th>
                      <Th>Tổng món</Th>
                      <Th>TG xử lý TB</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourlySales.map((h) => (
                      <tr key={h.hour}>
                        <Td>{String(h.hour).padStart(2, "0")}:00</Td>
                        <Td>{h.orderCount}</Td>
                        <Td>{h.specialOrderCount || 0}</Td>
                        <Td>{money(h.revenue)}</Td>
                        <Td>{money(h.specialValue || 0)}</Td>
                        <Td>{h.totalItems}</Td>
                        <Td>{fmtMin(h.avgProcessMinutes)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Đơn chậm nhất">
              {data.slowOrders.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.slowOrders.map((o) => (
                    <div
                      key={o.orderId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{o.orderCode}</div>
                        <div
                          style={{
                            fontSize: 13,
                            opacity: 0.75,
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span>
                            {statusLabel(o.status)} • {o.itemCount} món
                          </span>
                          {o.orderType ? <OrderTypeBadge orderType={o.orderType} /> : null}
                        </div>
                        {o.specialNote ? (
                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                            {o.specialNote}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600 }}>{fmtMin(o.processMinutes)}</div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>{money(o.finalAmount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Insight gợi ý cho SM">
              {data.insights.length === 0 ? (
                <div>Chưa có insight</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.insights.map((x, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: "#f9fafb",
                        border: "1px solid #eee",
                      }}
                    >
                      {x}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <SectionCard title="Top sản phẩm trong đơn special">
              {data.topSpecialProducts?.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.topSpecialProducts.map((p, idx) => (
                    <div
                      key={p.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          #{idx + 1} {p.productName}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>
                          {p.quantitySold} món • {p.orderCount} đơn special
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{money(p.valueAmount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Đơn special gần đây">
              {data.recentSpecialOrders?.length === 0 ? (
                <div>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.recentSpecialOrders.map((o) => (
                    <div
                      key={o.orderId}
                      style={{
                        paddingBottom: 8,
                        borderBottom: "1px dashed #eee",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{o.orderCode}</div>
                          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                            {new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <OrderTypeBadge orderType={o.orderType} />
                          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                            Pickup: {o.pickupNumber ?? "--"} • Staff: {o.staffId ?? "--"}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                        Giá trị gốc: {money(o.subtotalAmount)} • Final: {money(o.finalAmount)}
                      </div>

                      {o.specialNote ? (
                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                          {o.specialNote}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
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

function SectionCard(props: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="pos-section-card" style={props.style}>
      <div className="pos-section-card__title">{props.title}</div>
      {props.children}
    </div>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ opacity: 0.75 }}>{props.label}</div>
      <div style={{ fontWeight: 600, textAlign: "right" }}>{props.value}</div>
    </div>
  );
}

function Th(props: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 8px",
        borderBottom: "1px solid #e5e7eb",
        fontSize: 13,
        opacity: 0.8,
      }}
    >
      {props.children}
    </th>
  );
}

function Td(props: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "10px 8px",
        borderBottom: "1px dashed #eee",
      }}
    >
      {props.children}
    </td>
  );
}
