import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  labelOf,
  PHYSICAL_STATE_LABEL,
  REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TYPE_LABEL,
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

export default function DisposalReportExplainPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const reportId = Number(id || 0);

  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [report, setReport] = useState<DisposalReport | null>(null);
  const [explanationNote, setExplanationNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["staff", "shift_leader", "store_manager"]);

  const loadReport = async (targetStoreId: number) => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await inventoryDisposalsApi.listMyReports({
        storeId: targetStoreId,
        limit: 100,
      });
      const found = (r.reports || []).find((x) => x.id === reportId) || null;
      setReport(found);
      if (!found) setError("Không tìm thấy report cần giải trình");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được report");
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
        if (s) loadReport(s);
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, [reportId]);

  const submit = async () => {
    if (!reportId) return;
    try {
      setSaving(true);
      setError(null);
      if (!explanationNote.trim()) throw new Error("Vui lòng nhập nội dung giải trình");
      await inventoryDisposalsApi.explainReport(reportId, {
        storeId,
        explanationNote: explanationNote.trim(),
      });
      nav("/inventory/disposals/my");
    } catch (e: any) {
      setError(e?.message || e?.response?.data?.message || "Gửi giải trình thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "STORE" || !allowed) {
    return <div style={{ padding: 16 }}>Bạn không có quyền vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Giải trình report hủy hàng</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Trang riêng để nhân viên / leader / SM nhập giải trình, không dùng popup.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => nav("/inventory/disposals/my")}>
            Quay lại danh sách
          </button>
          <button type="button" style={btn} onClick={() => loadReport(storeId)}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </div>

      {error && <div style={{ ...box, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={box}>
        <div style={{ maxWidth: 320, marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>Cửa hàng</div>
          <select style={input} value={storeId} onChange={(e) => setStoreId(Number(e.target.value))}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {report ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {report.code} • {labelOf(REPORT_STATUS_LABEL, report.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              {labelOf(REPORT_TYPE_LABEL, report.reportType)} • {labelOf(REASON_LABEL, report.reasonCode)} •{" "}
              {labelOf(PHYSICAL_STATE_LABEL, report.physicalState)}
            </div>
            {report.description && <div style={{ marginTop: 10 }}>{report.description}</div>}
            {report.returnExplanationRequiredNote && (
              <div style={{ marginTop: 10, color: "#92400e" }}>
                SM yêu cầu giải trình: {report.returnExplanationRequiredNote}
              </div>
            )}
            {report.reporterExplanationNote && (
              <div style={{ marginTop: 10, color: "#065f46" }}>
                Giải trình gần nhất: {report.reporterExplanationNote}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              {(report.lines || []).map((line) => (
                <div key={line.id} style={{ color: "#4b5563", marginBottom: 6 }}>
                  • {line.itemNameSnapshot} — {line.quantityReported} {line.unitName}
                  {line.note ? ` — ${line.note}` : ""}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div>Không có dữ liệu report.</div>
        )}
      </div>

      <div style={box}>
        <div style={{ marginBottom: 6 }}>Nội dung giải trình</div>
        <textarea
          style={{ ...input, minHeight: 160 }}
          value={explanationNote}
          onChange={(e) => setExplanationNote(e.target.value)}
          placeholder="Giải thích rõ nguyên nhân, bối cảnh, cách xử lý, và thông tin SM/DM cần xem lại"
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
            onClick={submit}
            disabled={saving || !report}
          >
            {saving ? "Đang gửi..." : "Gửi giải trình"}
          </button>
          <button type="button" style={btn} onClick={() => nav("/inventory/disposals/my")}>Hủy</button>
        </div>
      </div>
    </div>
  );
}
