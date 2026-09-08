import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  inventoryDisposalsApi,
  type DisposalReport,
} from "../api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import {
  PHYSICAL_STATE_LABEL,
  REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TYPE_LABEL,
  labelOf,
} from "../../shared/utils/disposalLabels";

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  cursor: "pointer",
  background: "#fff",
};

function ReportEvidence({ urls }: { urls: string[] }) {
  if (!urls.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={`evidence-${i}`}
            style={{
              width: 64,
              height: 64,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />
        </a>
      ))}
    </div>
  );
}

export default function StoreDisposalManagerPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [reports, setReports] = useState<DisposalReport[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["store_manager"]);

  const loadReports = async (targetStoreId: number) => {
    setLoading(true);
    setError(null);
    try {
      const reportRes = await inventoryDisposalsApi.listStoreReports({
        storeId: targetStoreId,
        limit: 100,
      });
      const actionable = (reportRes.reports || []).filter((report) =>
        ["submitted", "verified_by_sm"].includes(report.status),
      );
      setReports(actionable);
      setSelectedReportIds([]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được dữ liệu review của SM");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisposalUser()
      .then((u) => {
        setUser(u);
        const s = getDefaultStoreId(u);
        setStoreId(s);
        if (s) loadReports(s);
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, []);

  const toggleReport = (reportId: number) => {
    setSelectedReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((x) => x !== reportId) : [...prev, reportId],
    );
  };

  const actVerify = async (reportId: number) => {
    try {
      setSubmitting(true);
      setError(null);
      await inventoryDisposalsApi.markVerified(reportId, { storeId });
      await loadReports(storeId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Xác nhận report thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const createOrder = async () => {
    if (!selectedReportIds.length) {
      setError("Chọn ít nhất 1 report đã được SM xác nhận");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const result = await inventoryDisposalsApi.createOrder({
        storeId,
        reportIds: selectedReportIds,
      });
      // Tự động submit ngay để DM thấy lệnh trong hàng chờ duyệt
      await inventoryDisposalsApi.submitOrder(result.order.id, { storeId });
      await loadReports(storeId);
      nav("/inventory/disposals/history");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Tạo lệnh hủy thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "STORE" || !allowed) {
    return <div style={{ padding: 16 }}>Chỉ store manager được vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>SM xử lý report hủy hàng</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Trang tổng chỉ giữ các report còn cần SM xử lý. Các lệnh hủy đã tách sang lịch sử riêng.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => nav("/store/manager", { replace: true })}
            style={btn}
            type="button"
          >
            Về dashboard
          </button>

          <button type="button" onClick={() => loadReports(storeId)} style={btn}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>

          <button
            type="button"
            onClick={() => nav("/inventory/disposals/history")}
            style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
          >
            Xem lịch sử lệnh hủy
          </button>
        </div>
      </div>

      {error && <div style={{ ...box, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={box}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            style={{ ...input, maxWidth: 320 }}
            value={storeId}
            onChange={(e) => setStoreId(Number(e.target.value))}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button type="button" style={{ ...btn, background: "#e5e7eb" }} onClick={() => loadReports(storeId)}>
            {loading ? "Đang tải..." : "Reload"}
          </button>

          <button
            type="button"
            style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
            onClick={createOrder}
            disabled={submitting}
          >
            Tạo lệnh hủy từ report đã chọn
          </button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Report cần review</h3>

        {!reports.length && <div>Hiện không còn report nào cần SM xử lý.</div>}

        {reports.map((report) => {
          const canSelect = report.status === "verified_by_sm";
          const canReview = ["submitted", "verified_by_sm"].includes(report.status);
          const canRelease = report.physicalState === "quarantined" && ![
            "included_in_disposal_order",
            "duplicate_closed",
            "released_back_to_stock",
            "cancelled_by_sm",
            "finalized",
          ].includes(report.status);

          return (
            <div
              key={report.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontWeight: 700 }}>
                    {report.code} • {labelOf(REPORT_STATUS_LABEL, report.status)}
                  </div>
                  <div style={{ color: "#4b5563", marginTop: 6 }}>
                    {labelOf(REPORT_TYPE_LABEL, report.reportType)} • {labelOf(REASON_LABEL, report.reasonCode)} •{" "}
                    {labelOf(PHYSICAL_STATE_LABEL, report.physicalState)}
                  </div>
                  {report.description && <div style={{ marginTop: 8 }}>{report.description}</div>}                </div>

                {canSelect && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={selectedReportIds.includes(report.id)}
                      onChange={() => toggleReport(report.id)}
                    />
                    Chọn vào lệnh hủy
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {report.status === "submitted" && (
                  <button
                    type="button"
                    style={{ ...btn, background: "#dbeafe", borderColor: "#bfdbfe" }}
                    onClick={() => actVerify(report.id)}
                    disabled={submitting}
                  >
                    Xác nhận hợp lệ
                  </button>
                )}

                {canReview && (
                  <button
                    type="button"
                    style={{ ...btn, background: "#fef3c7", borderColor: "#fde68a" }}
                    onClick={() => nav(`/inventory/disposals/review-report/${report.id}/cancel`)}
                  >
                    Hủy phiếu report
                  </button>
                )}

                {canRelease && (
                  <button
                    type="button"
                    style={{ ...btn, background: "#dcfce7", borderColor: "#bbf7d0" }}
                    onClick={() => nav(`/inventory/disposals/review-report/${report.id}/release`)}
                  >
                    Trả lại kho
                  </button>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                {report.lines.map((line) => (
                  <div key={line.id} style={{ color: "#6b7280", marginBottom: 8 }}>
                    <div>
                      • {line.itemNameSnapshot} — {line.quantityReported} {line.unitName}
                    </div>
                    {line.note && <div style={{ marginTop: 4 }}>{line.note}</div>}
                    <ReportEvidence urls={line.evidenceUrls || []} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
