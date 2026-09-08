import { useEffect, useState, useRef } from "react";
import {
  auditApi,
  type AuditReport,
  type AuditReportType,
  type StoreAuditSummary,
  type ChecklistItem,
  type ChecklistRating,
  QUALITY_CRITERIA,
  SALES_CRITERIA,
} from "../api/audit.api";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { formatDate } from "../../../utils/dateUtils";
import { showToast } from "../../../shared/components/Toast";

/* ── Label / màu cho type + rating + status ── */
const TYPE_LABEL: Record<AuditReportType, { bg: string; color: string; label: string }> = {
  QUALITY: { bg: "#e9d8fd", color: "#553c9a", label: "Chất lượng (QSC)" },
  SALES:   { bg: "#fefcbf", color: "#975a16", label: "Vận hành (Sales)" },
};
const RATING_COLOR: Record<ChecklistRating, { bg: string; color: string; label: string }> = {
  HIGH:   { bg: "#c6f6d5", color: "#276749", label: "Tốt" },
  MEDIUM: { bg: "#fefcbf", color: "#975a16", label: "Trung bình" },
  LOW:    { bg: "#fed7d7", color: "#9b2c2c", label: "Kém" },
};
const STATUS_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  SUBMITTED:          { bg: "#c6f6d5", color: "#276749", label: "Đã nộp" },
  ACKNOWLEDGED_BY_SM: { bg: "#c6f6d5", color: "#276749", label: "SM đã xác nhận" },
};

/* ── Khởi tạo checklist mặc định cho một loại ── */
function buildDefaultChecklist(type: AuditReportType): ChecklistItem[] {
  const criteria = type === "QUALITY" ? QUALITY_CRITERIA : SALES_CRITERIA;
  return criteria.map((c) => ({ criterion: c, rating: "HIGH" as ChecklistRating }));
}

type ViewMode = "auditor" | "sm";

export default function AuditReportsPage({ viewMode = "auditor" }: { viewMode?: ViewMode }) {
  const isAuditor = viewMode === "auditor";
  const isSM = viewMode === "sm";
  const [data, setData] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<AuditReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Danh sách store (dropdown) ── */
  const [stores, setStores] = useState<StoreAuditSummary[]>([]);

  /* ── Form state ── */
  const [formType, setFormType] = useState<AuditReportType>("QUALITY");
  const [storeId, setStoreId] = useState(0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(buildDefaultChecklist("QUALITY"));
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  /* Khi đổi type → reset checklist */
  const handleTypeChange = (t: AuditReportType) => {
    setFormType(t);
    setChecklist(buildDefaultChecklist(t));
  };

  /* Cập nhật rating cho một checklist item */
  const setRating = (idx: number, rating: ChecklistRating) => {
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, rating } : item)));
  };

  /* Cập nhật note cho một checklist item */
  const setNote = (idx: number, note: string) => {
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, note } : item)));
  };

  /* Cập nhật financial_loss cho một checklist item (chỉ SALES) */
  const setLoss = (idx: number, val: string) => {
    const num = val ? Number(val) : undefined;
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, financial_loss: num } : item)));
  };

  const load = () => {
    setLoading(true);
    auditApi.getReports()
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // SM không cần dropdown store — API đã filter sẵn
    if (isAuditor) auditApi.getStoreData().then(setStores).catch(() => {});
  }, []);

  /* ── Validate & Submit ── */
  const handleCreate = async () => {
    if (!storeId) { showToast("error", "Vui lòng chọn cửa hàng"); return; }

    // Validate: Mỗi item LOW phải có note
    const missingNote = checklist.find((c) => c.rating === "LOW" && (!c.note || !c.note.trim()));
    if (missingNote) {
      showToast("error", `Tiêu chí "${missingNote.criterion}" đánh giá KÉM — vui lòng nhập ghi chú giải trình.`);
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("store_id", String(storeId));
      fd.append("type", formType);
      fd.append("checklist_data", JSON.stringify(checklist));
      fd.append("discrepancy_note", discrepancyNote || "");
      if (file) fd.append("attachment", file);

      await auditApi.createReport(fd);
      setShowForm(false);
      resetForm();
      load();
      showToast("success", "Tạo báo cáo thành công");
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Lỗi tạo báo cáo");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStoreId(0);
    setFormType("QUALITY");
    setChecklist(buildDefaultChecklist("QUALITY"));
    setDiscrepancyNote("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ── SM: Xác nhận tiếp nhận & khắc phục ── */
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackTarget, setAckTarget] = useState<number | null>(null);
  const handleAcknowledge = async () => {
    if (ackTarget == null) return;
    setAcknowledging(true);
    try {
      const updated = await auditApi.acknowledgeReport(ackTarget);
      setData((prev) => prev.map((r) => (r.id === ackTarget ? { ...r, status: updated.status ?? "ACKNOWLEDGED_BY_SM" } : r)));
      if (detail?.id === ackTarget) setDetail({ ...detail, status: updated.status ?? "ACKNOWLEDGED_BY_SM" });
      showToast("success", "Xác nhận tiếp nhận thành công");
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Lỗi xác nhận báo cáo");
    } finally {
      setAcknowledging(false);
      setAckTarget(null);
    }
  };

  /* ── Tính tổng score cho detail view ── */
  const calcScore = (items: ChecklistItem[]) => {
    if (!items?.length) return null;
    const total = items.length;
    const high = items.filter((c) => c.rating === "HIGH").length;
    const low = items.filter((c) => c.rating === "LOW").length;
    return { total, high, low, pct: Math.round((high / total) * 100) };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={h1}>{isSM ? "Phiếu Audit từ Kiểm toán" : "Báo cáo Audit"}</h1>
          <p style={sub}>
            {isSM
              ? `Các phiếu kiểm toán thuộc cửa hàng của bạn — ${data.length} báo cáo`
              : `Checklist kiểm toán Chất lượng (QSC) & Vận hành (Sales) — ${data.length} báo cáo`}
          </p>
        </div>
        {isAuditor && (
          <button onClick={() => { setShowForm(!showForm); setDetail(null); }} style={btnPrimary}>
            {showForm ? "Đóng" : "+ Tạo Báo cáo Audit"}
          </button>
        )}
      </div>

      {/* ══════════ FORM TẠO BÁO CÁO — CHECKLIST (chỉ Auditor) ══════════ */}
      {isAuditor && showForm && (
        <div style={formCard}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>📋 Tạo phiếu kiểm toán</h3>

          <div style={grid2}>
            {/* Chọn cửa hàng */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Cửa hàng</label>
              <select value={storeId || ""} onChange={(e) => setStoreId(Number(e.target.value))}
                style={{ ...inputStyle, color: storeId ? "#1a202c" : "#a0aec0" }}>
                <option value="" disabled>— Chọn cửa hàng —</option>
                {stores.map((s) => (
                  <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                ))}
              </select>
            </div>
            {/* Loại kiểm toán */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Loại kiểm toán</label>
              <select value={formType} onChange={(e) => handleTypeChange(e.target.value as AuditReportType)} style={inputStyle}>
                <option value="QUALITY">Chất lượng — QSC (Vệ sinh, CSVC)</option>
                <option value="SALES">Vận hành — Sales (Doanh thu, Kho)</option>
              </select>
            </div>
          </div>

          {/* ── Bảng Checklist tiêu chí ── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Bảng chấm điểm</label>
            <table style={{ ...tableStyle, marginBottom: 0 }}>
              <thead>
                <tr style={thRow}>
                  <th style={{ ...th, width: "30%" }}>Tiêu chí</th>
                  <th style={{ ...th, textAlign: "center" }}>🟢 Tốt</th>
                  <th style={{ ...th, textAlign: "center" }}>🟡 TB</th>
                  <th style={{ ...th, textAlign: "center" }}>🔴 Kém</th>
                  <th style={th}>Ghi chú {formType === "SALES" && "/ Thất thoát"}</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #edf2f7" }}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{item.criterion}</td>
                    {(["HIGH", "MEDIUM", "LOW"] as ChecklistRating[]).map((r) => (
                      <td key={r} style={{ ...tdS, textAlign: "center" }}>
                        <input type="radio" name={`rating-${idx}`} checked={item.rating === r}
                          onChange={() => setRating(idx, r)}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: RATING_COLOR[r].color }} />
                      </td>
                    ))}
                    <td style={tdS}>
                      <div style={{ position: "relative" }}>
                        <input type="text" placeholder={item.rating === "LOW" ? "⚠ Bắt buộc giải trình..." : "Tùy chọn"}
                          value={item.note || ""} onChange={(e) => setNote(idx, e.target.value)}
                          required={item.rating === "LOW"}
                          style={{ ...inputStyle, padding: "4px 8px", fontSize: 12,
                            borderColor: item.rating === "LOW" && !item.note?.trim() ? "#e53e3e" : "#cbd5e0",
                            background: item.rating === "LOW" && !item.note?.trim() ? "#fff5f5" : "white" }} />
                        {item.rating === "LOW" && !item.note?.trim() && (
                          <span style={{ fontSize: 11, color: "#e53e3e", display: "block", marginTop: 2 }}>Bắt buộc khi đánh giá Kém</span>
                        )}
                      </div>
                      {formType === "SALES" && (
                        <input type="number" placeholder="Thất thoát (₫)" value={item.financial_loss ?? ""}
                          onChange={(e) => setLoss(idx, e.target.value)}
                          style={{ ...inputStyle, padding: "4px 8px", fontSize: 12, marginTop: 4 }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ghi chú tổng */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Ghi chú tổng hợp (tùy chọn)</label>
            <textarea value={discrepancyNote} onChange={(e) => setDiscrepancyNote(e.target.value)}
              placeholder="Nhận xét chung về buổi kiểm toán..."
              style={{ ...inputStyle, height: 80, resize: "vertical" }} />
          </div>

          {/* Upload ảnh */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Ảnh bằng chứng (tùy chọn)</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg"
              onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 14 }} />
            {file && <p style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>Đã chọn: {file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
          </div>

          <button onClick={handleCreate} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Đang lưu..." : "Nộp báo cáo"}
          </button>
        </div>
      )}

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {/* ══════════ BẢNG DANH SÁCH BÁO CÁO ══════════ */}
      {!loading && !err && !detail && (
        <table style={tableStyle}>
          <thead>
            <tr style={thRow}>
              <th style={th}>Quán</th>
              <th style={th}>Loại</th>
              <th style={th}>Điểm</th>
              <th style={th}>Trạng thái</th>
              <th style={th}>Auditor</th>
              <th style={th}>Bằng chứng</th>
              <th style={th}>Ngày tạo</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const tl = TYPE_LABEL[r.type] || TYPE_LABEL.QUALITY;
              const st = STATUS_LABEL[r.status] || STATUS_LABEL.SUBMITTED;
              const score = calcScore(r.checklist_data);
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                  <td style={{ ...tdS, fontWeight: 700 }}>{r.store_name}</td>
                  <td style={tdS}>
                    <span style={{ ...badgeS, background: tl.bg, color: tl.color }}>{tl.label}</span>
                  </td>
                  <td style={tdS}>
                    {score ? (
                      <span style={{ fontWeight: 700, color: score.pct >= 80 ? "#276749" : score.pct >= 50 ? "#975a16" : "#9b2c2c" }}>
                        {score.pct}%
                      </span>
                    ) : "—"}
                  </td>
                  <td style={tdS}>
                    <span style={{ ...badgeS, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={tdS}>{r.auditor_name}</td>
                  <td style={tdS}>
                    {r.attachment_url ? (
                      <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" style={imgBtn}>🖼️ Xem ảnh</a>
                    ) : <span style={{ color: "#a0aec0" }}>—</span>}
                  </td>
                  <td style={tdS}>{formatDate(r.created_at)}</td>
                  <td style={tdS}>
                    <button onClick={() => setDetail(r)} style={viewBtn}>Chi tiết</button>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#a0aec0", padding: 40 }}>Chưa có báo cáo nào</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* ══════════ DETAIL VIEW ══════════ */}
      {detail && (
        <div style={formCard}>
          <button onClick={() => setDetail(null)} style={{ ...viewBtn, marginBottom: 16 }}>← Quay lại</button>
          <h2 style={{ marginBottom: 4 }}>{detail.store_name} — Báo cáo Audit</h2>
          <p style={{ color: "#718096", marginBottom: 20 }}>
            Ngày: {formatDate(detail.created_at)} | Auditor: {detail.auditor_name}
          </p>

          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={summaryCard}>
              <div style={summaryLabel}>Loại kiểm toán</div>
              <span style={{ ...badgeS, background: (TYPE_LABEL[detail.type] || TYPE_LABEL.QUALITY).bg,
                color: (TYPE_LABEL[detail.type] || TYPE_LABEL.QUALITY).color, fontSize: 14, padding: "4px 16px" }}>
                {(TYPE_LABEL[detail.type] || TYPE_LABEL.QUALITY).label}
              </span>
            </div>
            <div style={summaryCard}>
              <div style={summaryLabel}>Trạng thái</div>
              <span style={{ ...badgeS, background: (STATUS_LABEL[detail.status] || STATUS_LABEL.SUBMITTED).bg,
                color: (STATUS_LABEL[detail.status] || STATUS_LABEL.SUBMITTED).color, fontSize: 14, padding: "4px 16px" }}>
                {(STATUS_LABEL[detail.status] || STATUS_LABEL.SUBMITTED).label}
              </span>
            </div>
            {(() => {
              const sc = calcScore(detail.checklist_data);
              return sc ? (
                <div style={summaryCard}>
                  <div style={summaryLabel}>Điểm tổng</div>
                  <span style={{ fontSize: 22, fontWeight: 800,
                    color: sc.pct >= 80 ? "#276749" : sc.pct >= 50 ? "#975a16" : "#9b2c2c" }}>
                    {sc.pct}% <span style={{ fontSize: 12, fontWeight: 400, color: "#718096" }}>({sc.high}/{sc.total} Tốt)</span>
                  </span>
                </div>
              ) : null;
            })()}
          </div>

          {/* Checklist detail table */}
          {detail.checklist_data?.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8 }}>📋 Kết quả chấm điểm</h4>
              <table style={{ ...tableStyle, marginBottom: 20 }}>
                <thead>
                  <tr style={thRow}>
                    <th style={th}>Tiêu chí</th>
                    <th style={th}>Đánh giá</th>
                    <th style={th}>Ghi chú</th>
                    {detail.type === "SALES" && <th style={th}>Thất thoát</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.checklist_data.map((item, idx) => {
                    const rc = RATING_COLOR[item.rating] || RATING_COLOR.HIGH;
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #edf2f7" }}>
                        <td style={{ ...tdS, fontWeight: 600 }}>{item.criterion}</td>
                        <td style={tdS}>
                          <span style={{ ...badgeS, background: rc.bg, color: rc.color }}>{rc.label}</span>
                        </td>
                        <td style={{ ...tdS, color: "#4a5568" }}>{item.note || "—"}</td>
                        {detail.type === "SALES" && (
                          <td style={{ ...tdS, color: item.financial_loss ? "#e53e3e" : "#a0aec0", fontWeight: item.financial_loss ? 700 : 400 }}>
                            {item.financial_loss ? `${item.financial_loss.toLocaleString("vi-VN")}₫` : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* Ghi chú tổng */}
          {detail.discrepancy_note && (
            <>
              <h4 style={{ marginBottom: 8 }}>Ghi chú tổng hợp</h4>
              <p style={{ color: "#4a5568", lineHeight: 1.6, marginBottom: 16, whiteSpace: "pre-wrap" }}>
                {detail.discrepancy_note}
              </p>
            </>
          )}

          {/* Ảnh bằng chứng */}
          {detail.attachment_url && (
            <>
              <h4 style={{ marginBottom: 8 }}>Ảnh bằng chứng</h4>
              <img src={detail.attachment_url} alt="Bằng chứng"
                style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 12, border: "1px solid #e2e8f0" }} />
            </>
          )}

          {/* ── SM: Nút xác nhận tiếp nhận (chỉ khi SUBMITTED) ── */}
          {isSM && detail.status === "SUBMITTED" && (
            <div style={{ marginTop: 24, padding: 16, background: "#fffaf0", border: "1px solid #fbd38d", borderRadius: 12, textAlign: "center" }}>
              <p style={{ marginBottom: 12, color: "#975a16", fontWeight: 600 }}>
                ⚠ Phiếu kiểm toán này đang chờ bạn xác nhận tiếp nhận
              </p>
              <button
                onClick={() => setAckTarget(detail.id)}
                disabled={acknowledging}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#38a169",
                  color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14,
                  opacity: acknowledging ? 0.5 : 1 }}>
                {acknowledging ? "Đang xử lý..." : "✅ Đã tiếp nhận & Sẽ khắc phục"}
              </button>
            </div>
          )}
          {isSM && detail.status === "ACKNOWLEDGED_BY_SM" && (
            <div style={{ marginTop: 24, padding: 16, background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 12, textAlign: "center" }}>
              <p style={{ color: "#276749", fontWeight: 600 }}>✅ Bạn đã xác nhận tiếp nhận báo cáo này</p>
            </div>
          )}
        </div>
      )}

      {/* SM Acknowledge Confirm */}
      <ConfirmModal
        open={ackTarget != null}
        title="Xác nhận tiếp nhận"
        variant="success"
        confirmLabel="Đã tiếp nhận & Sẽ khắc phục"
        loading={acknowledging}
        onConfirm={handleAcknowledge}
        onCancel={() => setAckTarget(null)}
      >
        <p style={{ margin: 0 }}>Xác nhận bạn đã tiếp nhận báo cáo này và sẽ tiến hành khắc phục?</p>
      </ConfirmModal>
    </div>
  );
}

/* ═══════ Shared Styles ═══════ */
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 800, marginBottom: 4 };
const sub: React.CSSProperties = { color: "#718096" };
const btnPrimary: React.CSSProperties = { padding: "10px 20px", borderRadius: 8, border: "none", background: "#3d503c", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const formCard: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 24 };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#4a5568" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e0", fontSize: 14, boxSizing: "border-box", color: "#1a202c" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 10, overflow: "hidden" };
const thRow: React.CSSProperties = { background: "#edf2f7", textAlign: "left" };
const th: React.CSSProperties = { padding: "12px 10px", fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" };
const tdS: React.CSSProperties = { padding: "12px 10px", fontSize: 13 };
const badgeS: React.CSSProperties = { padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700 };
const viewBtn: React.CSSProperties = { padding: "4px 12px", borderRadius: 6, border: "1px solid #cbd5e0", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const imgBtn: React.CSSProperties = { display: "inline-block", padding: "3px 10px", background: "#f0fff4", color: "#276749", borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none" };
const summaryCard: React.CSSProperties = { padding: 16, background: "#f7fafc", borderRadius: 12, flex: 1, textAlign: "center", minWidth: 140 };
const summaryLabel: React.CSSProperties = { fontSize: 13, color: "#718096", marginBottom: 4 };
