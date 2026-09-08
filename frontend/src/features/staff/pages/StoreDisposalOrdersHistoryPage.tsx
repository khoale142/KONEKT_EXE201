import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  inventoryDisposalsApi,
  type DisposalOrder,
  type DisposalOrderStatus,
} from "../api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import { ORDER_STATUS_LABEL, labelOf } from "../../shared/utils/disposalLabels";

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

export default function StoreDisposalOrdersHistoryPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<DisposalOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["store_manager"]);

  const loadOrders = async (targetStoreId: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await inventoryDisposalsApi.listOrders({
        storeId: targetStoreId,
        status: (status || undefined) as DisposalOrderStatus | undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      setOrders(r.orders || []);
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
  if (user.portal !== "STORE" || !allowed) {
    return <div style={{ padding: 16 }}>Chỉ store manager được vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Lịch sử lệnh hủy của cửa hàng</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Trang riêng cho lệnh hủy, tách khỏi màn review report.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => nav("/inventory/disposals/manage")}>Về màn review report</button>
          <button type="button" style={btn} onClick={() => nav("/store/manager", { replace: true })}>Về dashboard</button>
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
            <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="draft">Nháp</option>
              <option value="submitted_to_dm">Đã gửi DM</option>
              <option value="returned_to_sm">DM trả về</option>
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
            {loading ? "Đang tải..." : "Tải danh sách"}
          </button>
          <button type="button" style={btn} onClick={() => { setStatus(""); setSearch(""); }}>
            Xóa lọc
          </button>
        </div>
      </div>

      <div style={box}>
        {!orders.length && <div>Chưa có lệnh hủy nào.</div>}
        {orders.map((order) => (
          <div key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>
              {order.code} • {labelOf(ORDER_STATUS_LABEL, order.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              Reports: {order.reportCount ?? 0} | Lines: {order.lineCount ?? 0} | Estimated: {Number(order.totalEstimatedCost || 0).toLocaleString("vi-VN")}
            </div>
            {order.returnedToSmNote && (
              <div style={{ marginTop: 8, color: "#92400e" }}>DM trả về: {order.returnedToSmNote}</div>
            )}
            {order.stockApplyError && (
              <div style={{ marginTop: 8, color: "#b91c1c" }}>Lỗi duyệt gần nhất: {order.stockApplyError}</div>
            )}
            {order.cancelledNote && (
              <div style={{ marginTop: 8, color: "#6b7280" }}>Ghi chú hủy: {order.cancelledNote}</div>
            )}
            <div style={{ marginTop: 12 }}>
              <button type="button" style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }} onClick={() => nav(`/inventory/disposals/history/${order.id}`)}>
                Xem chi tiết
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
