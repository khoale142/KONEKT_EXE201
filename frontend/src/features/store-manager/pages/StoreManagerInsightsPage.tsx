import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  managerDashboardApi,
  type StoreDashboardInsights,
} from "../api/managerDashboard.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { formatDateVN, formatTimeVN, getTodayVN } from "../../shared/utils/formatDateTime";
import { getAttendanceStatusLabel } from "../../shared/utils/attendanceStatus";
import { PageHeader } from "../../shared/components/PageHeader";
import { DashboardShell, dash, DashIcons } from "../../shared/dashboard/dashboardUi";

function actionTypeAccent(type: string): { border: string; bg: string } {
  if (type === "overdue_checkout") return { border: "#c53030", bg: "#fff5f5" };
  if (type === "absent" || type === "awaiting_checkin" || type === "missing_checkout_late") {
    return { border: "#dd6b20", bg: "#fffaf0" };
  }
  return { border: "#718096", bg: "#f7fafc" };
}

export default function StoreManagerInsightsPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const [insights, setInsights] = useState<StoreDashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        if (!storeId) {
          setInsights(null);
          return;
        }
        const data = await managerDashboardApi.getDashboardInsights(Number(storeId), 7);
        setInsights(data);
      } catch (e) {
        console.error(e);
        setError("Không tải được phân tích chấm công. Thử làm mới trang.");
        setInsights(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storeId]);

  return (
    <DashboardShell>
      <PageHeader
        backTo="/store/manager"
        backLabel="Dashboard cửa hàng"
        title="Phân tích chấm công chi tiết"
        subtitle={`Theo dõi vắng, trễ, check-out và các mẫu theo ca — cùng nguồn dữ liệu với đối soát.`}
      />

      <div
        style={{
          background: dash.surface,
          borderRadius: dash.radiusLg,
          border: `1px solid ${dash.border}`,
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
          marginTop: 8,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            background: `linear-gradient(90deg, ${dash.primarySoft} 0%, transparent 100%)`,
            borderBottom: `1px solid ${dash.border}`,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: dash.primary,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {DashIcons.zap}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: dash.primaryDark }}>
              Insight chấm công · {formatDateVN(getTodayVN())}
            </div>
            <div style={{ fontSize: "0.78rem", color: dash.muted, marginTop: 2 }}>
              {insights
                ? `Phân tích ${insights.windowDays} ngày (${formatDateVN(insights.dateFrom)} → ${formatDateVN(insights.dateTo)}).`
                : "Tổng hợp từ lịch ca + chấm công tại cửa hàng."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              to="/store/manager/reconciliation"
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: dash.primary,
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${dash.border}`,
                background: "#fff",
              }}
            >
              Đối soát →
            </Link>
            <Link
              to="/store/manager/attendance"
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: dash.primary,
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${dash.border}`,
                background: "#fff",
              }}
            >
              Chấm công →
            </Link>
          </div>
        </div>

        <div style={{ padding: "16px 20px 20px" }}>
          {!storeId || loading ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: dash.muted }}>Đang tải…</p>
          ) : error ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#c53030" }}>{error}</p>
          ) : !insights ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: dash.muted }}>Chưa có dữ liệu.</p>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: dash.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Cảnh báo và tóm tắt
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#1e293b", fontSize: "0.875rem", lineHeight: 1.6 }}>
                  {insights.alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              {insights.actionQueue.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: dash.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 10,
                    }}
                  >
                    Cần xử lý (ưu tiên)
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {insights.actionQueue.map((a, idx) => {
                      const accent = actionTypeAccent(a.type);
                      return (
                        <div
                          key={`${a.type}-${a.userId}-${idx}`}
                          style={{
                            borderLeft: `4px solid ${accent.border}`,
                            background: accent.bg,
                            borderRadius: 10,
                            padding: "12px 14px",
                            border: `1px solid ${dash.border}`,
                          }}
                        >
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: accent.border }}>
                            {a.priorityLabel}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#0f172a", marginTop: 4 }}>
                            {a.headline}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#4a5568", marginTop: 4 }}>{a.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {insights.absentDetails.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: dash.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 10,
                    }}
                  >
                    Chi tiết vắng mặt ({insights.absentDetails.length} ca)
                  </div>
                  <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dash.border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: dash.pageBg, textAlign: "left" }}>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Ưu tiên</th>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Nhân viên</th>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Ngày</th>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Ca / giờ</th>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Trạng thái</th>
                          <th style={{ padding: "10px 12px", fontWeight: 700, color: dash.muted }}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.absentDetails.map((r, i) => (
                          <tr key={`${r.userId}-${r.workDate}-${i}`} style={{ borderTop: `1px solid ${dash.border}` }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.priorityLabel}</td>
                            <td style={{ padding: "10px 12px" }}>{r.fullName || `NV #${r.userId}`}</td>
                            <td style={{ padding: "10px 12px" }}>{formatDateVN(r.workDate)}</td>
                            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                              {r.shiftLabel || "Ca"}{" "}
                              {r.scheduledStartAt && r.scheduledEndAt
                                ? `(${formatTimeVN(r.scheduledStartAt)}–${formatTimeVN(r.scheduledEndAt)})`
                                : ""}
                            </td>
                            <td style={{ padding: "10px 12px" }}>{getAttendanceStatusLabel(r.status)}</td>
                            <td style={{ padding: "10px 12px", color: "#4a5568" }}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${dash.border}`,
                    background: "#fffbeb",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#92400e", marginBottom: 8 }}>
                    Đi trễ nhiều (≥2 lần / {insights.windowDays} ngày)
                  </div>
                  {insights.lateLeaders.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: dash.muted }}>Không có nhân viên lặp lại đáng kể.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", lineHeight: 1.55 }}>
                      {insights.lateLeaders.map((x) => (
                        <li key={x.userId}>
                          <strong>{x.fullName || `NV #${x.userId}`}</strong> — {x.count} lần (gần nhất{" "}
                          {formatDateVN(x.lastWorkDate)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${dash.border}`,
                    background: "#eff6ff",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#1e40af", marginBottom: 8 }}>
                    Thiếu check-out lặp lại
                  </div>
                  {insights.missingCheckoutLeaders.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: dash.muted }}>Không có mẫu lặp đáng kể.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", lineHeight: 1.55 }}>
                      {insights.missingCheckoutLeaders.map((x) => (
                        <li key={x.userId}>
                          <strong>{x.fullName || `NV #${x.userId}`}</strong> — {x.count} lần phát sinh thiếu / trễ
                          check-out
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {insights.hotDays.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: dash.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Ngày nhiều sự cố chấm công
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {insights.hotDays.map((d) => (
                      <div
                        key={d.workDate}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          background: dash.pageBg,
                          border: `1px solid ${dash.border}`,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#334155",
                        }}
                        title={`Vắng ${d.absent}, trễ ${d.late}, checkout ${d.checkoutIssues}`}
                      >
                        {formatDateVN(d.workDate)} · {d.issueCount} vấn đề
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.shiftsWithAbsence.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: dash.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Khung ca có người vắng (cùng lịch)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", lineHeight: 1.55, color: "#334155" }}>
                    {insights.shiftsWithAbsence.map((sh, i) => (
                      <li key={i}>
                        <strong>{formatDateVN(sh.workDate)}</strong> · {sh.shiftLabel || "Ca"}{" "}
                        {sh.scheduledStartAt && sh.scheduledEndAt
                          ? `(${formatTimeVN(sh.scheduledStartAt)}–${formatTimeVN(sh.scheduledEndAt)})`
                          : ""}
                        : {sh.absent}/{sh.assigned} vắng / xếp ca — {sh.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p style={{ margin: "18px 0 0", fontSize: "0.78rem", color: dash.muted, lineHeight: 1.5 }}>
                Gợi ý: nhắc check-in/out, đối chiếu lịch phân công, xử lý vắng có chủ đích. Dùng màn{" "}
                <Link to="/store/manager/attendance" style={{ color: dash.primary, fontWeight: 600 }}>
                  Chấm công
                </Link>{" "}
                để lọc theo trạng thái chi tiết.
              </p>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
