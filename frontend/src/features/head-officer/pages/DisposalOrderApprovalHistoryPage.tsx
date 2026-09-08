import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../../../utils/dateUtils";
import {
  inventoryDisposalsApi,
  type DisposalOrder,
  type DisposalOrderStatus,
} from "../../staff/api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import { ORDER_STATUS_LABEL, labelOf } from "../../shared/utils/disposalLabels";

// Alias cho OrderTimestamps component
type _DO = DisposalOrder;

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

/** Format ISO → DD/MM/YYYY HH:mm, trả null nếu rỗng */
function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatDateTime(iso);
}

/** Badge trạng thái nhỏ gọn */
const STATUS_BADGE_COLOR: Record<string, { bg: string; color: string }> = {
  approved:        { bg: "#dcfce7", color: "#166534" },
  returned_to_sm:  { bg: "#fef9c3", color: "#854d0e" },
  cancelled:       { bg: "#fee2e2", color: "#991b1b" },
  submitted_to_dm: { bg: "#eff6ff", color: "#1e40af" },
  draft:           { bg: "#f3f4f6", color: "#374151" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_BADGE_COLOR[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{
      ...colors,
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {labelOf(ORDER_STATUS_LABEL, status)}
    </span>
  );
}

function OrderTimestamps({ order }: { order: _DO }) {
  const milestones: string[] = [];

  if (fmt(order.createdAt))
    milestones.push(`Tạo: ${fmt(order.createdAt)}`);

  if (fmt(order.submittedAt))
    milestones.push(`Gửi DM: ${fmt(order.submittedAt)}`);

  if (fmt(order.dmReviewedAt)) {
    const dmLabel =
      order.status === "approved"      ? "DM duyệt"  :
      order.status === "returned_to_sm" ? "DM trả về" : "DM xử lý";
    milestones.push(`${dmLabel}: ${fmt(order.dmReviewedAt)}`);
  }

  if (order.status === "cancelled" && fmt(order.cancelledAt))
    milestones.push(`Hủy: ${fmt(order.cancelledAt)}`);

  if (!milestones.length) return null;

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px dashed #e5e7eb",
        color: "#9ca3af",
        fontSize: 12,
        lineHeight: 1.6,
        letterSpacing: 0.1,
      }}
    >
      {milestones.join(" • ")}
    </div>
  );
}

export default function DisposalOrderApprovalHistoryPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [status, setStatus] = useState<"" | DisposalOrderStatus>("");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<DisposalOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["district_manager", "admin"]);

  const loadOrders = async (targetStoreId: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await inventoryDisposalsApi.listOrders({
        storeId: targetStoreId,
        status: status || undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      const all = r.orders || [];
      const filtered = status
        ? all
        : all.filter((x) => ["returned_to_sm", "approved", "cancelled"].includes(x.status));
      setOrders(filtered);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được lịch sử lệnh hủy");
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
        if (s) loadOrders(s);
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, []);

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "OFFICE" || !allowed) {
    return <div style={{ padding: 16 }}>Chỉ DM / admin được vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>DM lịch sử lệnh hủy</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Trang lịch sử riêng. Các lệnh chờ duyệt nằm ở trang DM duyệt.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => nav("/office/dm/disposals")}>Về trang duyệt</button>
          <button type="button" style={btn} onClick={() => nav("/office/dm", { replace: true })}>Về dashboard</button>
          <button type="button" style={btn} onClick={() => loadOrders(storeId)}>{loading ? "Đang tải..." : "Tải lại"}</button>
        </div>
      </div>

      {error && <div style={{ ...box, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={box}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>Cửa hàng</div>
            <select style={input} value={storeId} onChange={(e) => setStoreId(Number(e.target.value))}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Trạng thái</div>
            <select style={input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Tất cả lịch sử</option>
              <option value="returned_to_sm">Đã trả về SM</option>
              <option value="approved">Đã duyệt</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Tìm kiếm</div>
            <input style={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã lệnh hoặc ghi chú" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }} onClick={() => loadOrders(storeId)}>
            {loading ? "Đang tải..." : "Tải lịch sử"}
          </button>
          <button type="button" style={btn} onClick={() => { setStatus(""); setSearch(""); }}>
            Xóa lọc
          </button>
        </div>
      </div>

      <div style={box}>
        {!orders.length && <div>Chưa có lệnh nào trong lịch sử.</div>}

        {orders.map((order) => (
          <div key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            {/* ── Tiêu đề ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>{order.code}</div>
              <StatusBadge status={order.status} />
            </div>

            {/* ── Thông số ── */}
            <div style={{ color: "#4b5563", marginTop: 6, fontSize: 14 }}>
              {order.reportCount ?? 0} report • {order.lineCount ?? 0} dòng &nbsp;|&nbsp;
              <span style={{ fontWeight: 600 }}>{Number(order.totalEstimatedCost || 0).toLocaleString("vi-VN")} đ</span>
            </div>

            {/* ── Ghi chú nghiệp vụ ── */}
            {order.returnedToSmNote && (
              <div style={{ marginTop: 6, color: "#92400e", fontSize: 13 }}>↩ DM trả về: {order.returnedToSmNote}</div>
            )}
            {order.dmReviewNote && order.status === "approved" && (
              <div style={{ marginTop: 6, fontSize: 13 }}>✓ Ghi chú duyệt: {order.dmReviewNote}</div>
            )}
            {order.cancelledNote && (
              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>✕ Ghi chú hủy: {order.cancelledNote}</div>
            )}
            {order.stockApplyError && (
              <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>⚠ Lỗi trừ kho: {order.stockApplyError}</div>
            )}

            {/* ── Nút hành động ── */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
                onClick={() => nav(`/office/dm/disposals/${order.id}`)}
              >
                Xem chi tiết
              </button>
            </div>

            {/* ── Mốc thời gian SLA — luôn ở cuối card ── */}
            <OrderTimestamps order={order} />
          </div>
        ))}
      </div>
    </div>
  );
}
