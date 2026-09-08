import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  inventoryDisposalsApi,
  type DisposalOrder,
} from "../../staff/api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import {
  ORDER_STATUS_LABEL,
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

export default function DisposalOrderApprovalDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const orderId = Number(id || 0);

  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [order, setOrder] = useState<DisposalOrder | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["district_manager", "admin"]);

  const loadOrder = async (targetStoreId: number) => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await inventoryDisposalsApi.getOrderDetail(orderId, { storeId: targetStoreId });
      setOrder(r.order);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được chi tiết lệnh hủy");
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
        if (s) loadOrder(s);
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, [orderId]);

  const approve = async () => {
    if (!order) return;
    try {
      setSaving(true);
      setError(null);
      await inventoryDisposalsApi.approveOrder(order.id, {
        storeId,
        note: approveNote.trim() || undefined,
      });
      await loadOrder(storeId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Duyệt lệnh hủy thất bại");
      await loadOrder(storeId);
    } finally {
      setSaving(false);
    }
  };

  const returnToSm = async () => {
    if (!order) return;
    try {
      setSaving(true);
      setError(null);
      if (!returnNote.trim()) throw new Error("Vui lòng nhập lý do trả về SM");
      await inventoryDisposalsApi.returnOrder(order.id, {
        storeId,
        note: returnNote.trim(),
      });
      await loadOrder(storeId);
    } catch (e: any) {
      setError(e?.message || e?.response?.data?.message || "Trả về SM thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "OFFICE" || !allowed) {
    return <div style={{ padding: 16 }}>Chỉ DM / admin được vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>DM xem chi tiết lệnh hủy</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Chi tiết mở trên trang riêng, không còn kiểu bấm rồi nhảy xuống cuối danh sách.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => nav("/office/dm/disposals")}>Về trang duyệt</button>
          <button type="button" style={btn} onClick={() => nav("/office/dm/disposals/history")}>Về lịch sử</button>
          <button type="button" style={btn} onClick={() => nav("/office/dm", { replace: true })}>Về dashboard</button>
          <button type="button" style={btn} onClick={() => loadOrder(storeId)}>{loading ? "Đang tải..." : "Tải lại"}</button>
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

        {order ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {order.code} • {labelOf(ORDER_STATUS_LABEL, order.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              Reports: {order.reportCount ?? 0} | Lines: {order.lineCount ?? 0} | Estimated: {Number(order.totalEstimatedCost || 0).toLocaleString("vi-VN")}
            </div>
            {order.dmReviewNote && <div style={{ marginTop: 8 }}>Ghi chú DM gần nhất: {order.dmReviewNote}</div>}
            {order.returnedToSmNote && <div style={{ marginTop: 8, color: "#92400e" }}>Đã trả về SM: {order.returnedToSmNote}</div>}
            {order.stockApplyError && <div style={{ marginTop: 8, color: "#b91c1c" }}>Lỗi duyệt gần nhất: {order.stockApplyError}</div>}
            {order.cancelledNote && <div style={{ marginTop: 8, color: "#6b7280" }}>Ghi chú hủy: {order.cancelledNote}</div>}
          </>
        ) : (
          <div>Không có dữ liệu lệnh hủy.</div>
        )}
      </div>

      {order?.status === "submitted_to_dm" && (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Duyệt & trừ kho</h3>
            <div style={{ marginBottom: 6 }}>Ghi chú duyệt (không bắt buộc)</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Có thể ghi rõ đã kiểm tra đầy đủ chứng từ / hình ảnh / logic trước khi duyệt"
            />
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
                onClick={approve}
                disabled={saving}
              >
                {saving ? "Đang xử lý..." : "Duyệt & trừ kho"}
              </button>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Trả về SM</h3>
            <div style={{ marginBottom: 6 }}>Lý do trả về</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="Ghi rõ SM cần sửa gì, giải trình thêm gì, hoặc vì sao chưa đủ điều kiện duyệt"
            />
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                style={{ ...btn, background: "#fef3c7", borderColor: "#fde68a" }}
                onClick={returnToSm}
                disabled={saving}
              >
                {saving ? "Đang xử lý..." : "Trả về SM"}
              </button>
            </div>
          </div>
        </>
      )}

      {order && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Reports</h3>
          {(order.reports || []).map((report) => (
            <div key={report.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }}>
                {report.code} — {labelOf(REPORT_STATUS_LABEL, report.status)}
              </div>
              <div style={{ color: "#4b5563", marginTop: 4 }}>
                {labelOf(REPORT_TYPE_LABEL, report.reportType)} • {labelOf(REASON_LABEL, report.reasonCode)} • {labelOf(PHYSICAL_STATE_LABEL, report.physicalState)}
              </div>
              {report.description && <div style={{ marginTop: 6 }}>{report.description}</div>}
              {report.returnExplanationRequiredNote && (
                <div style={{ marginTop: 6, color: "#92400e" }}>SM yêu cầu giải trình: {report.returnExplanationRequiredNote}</div>
              )}
              {report.reporterExplanationNote && (
                <div style={{ marginTop: 6, color: "#065f46" }}>Giải trình gần nhất của người tạo: {report.reporterExplanationNote}</div>
              )}
              <div style={{ marginTop: 8 }}>
                {(report.lines || []).map((line) => (
                  <div key={line.id} style={{ color: "#6b7280", marginBottom: 4 }}>
                    • {line.itemNameSnapshot} — {line.quantityReported} {line.unitName}
                    {line.note ? ` — ${line.note}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <h3>Ingredient deduction lines</h3>
          {(order.lines || []).map((line) => (
            <div key={line.id} style={{ color: "#4b5563", marginBottom: 6 }}>
              • {line.ingredientNameSnapshot} — {line.quantityToDeduct} {line.deductionUnit} — {Number(line.lineTotalCost || 0).toLocaleString("vi-VN")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
