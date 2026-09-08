import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function DisposalOrderApprovalPage({ isEmbedded = false }: { isEmbedded?: boolean } = {}) {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);
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
        status: "submitted_to_dm",
        search: search.trim() || undefined,
        limit: 100,
      });
      setOrders(r.orders || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được danh sách lệnh chờ DM duyệt");
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
    <div style={{ padding: isEmbedded ? 0 : 16, maxWidth: isEmbedded ? "none" : 1200, margin: isEmbedded ? 0 : "0 auto" }}>
      {!isEmbedded && (
        <div style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>DM duyệt lệnh hủy</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Trang này chỉ hiện các lệnh đang chờ DM xử lý. Lịch sử tách sang trang riêng.
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" style={btn} onClick={() => nav("/office/dm/disposals/history")}>Xem lịch sử</button>
        {!isEmbedded && <button type="button" style={btn} onClick={() => nav("/office/dm", { replace: true })}>Về dashboard</button>}
        <button type="button" style={btn} onClick={() => loadOrders(storeId)}>{loading ? "Đang tải..." : "Tải lại"}</button>
      </div>

      {error && <div style={{ ...box, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={box}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
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
            <div style={{ marginBottom: 6 }}>Tìm kiếm</div>
            <input style={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã lệnh hoặc ghi chú" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }} onClick={() => loadOrders(storeId)}>
            {loading ? "Đang tải..." : "Tải danh sách chờ duyệt"}
          </button>
          <button type="button" style={btn} onClick={() => setSearch("")}>Xóa lọc</button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Lệnh đang chờ DM duyệt</h3>
        {!orders.length && <div>Hiện chưa có lệnh nào đang chờ DM duyệt.</div>}

        {orders.map((order) => (
          <div key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>
              {order.code} • {labelOf(ORDER_STATUS_LABEL, order.status)}
            </div>
            <div style={{ color: "#4b5563", marginTop: 6 }}>
              Reports: {order.reportCount ?? 0} | Lines: {order.lineCount ?? 0} | Estimated: {Number(order.totalEstimatedCost || 0).toLocaleString("vi-VN")}
            </div>
            {order.stockApplyError && (
              <div style={{ marginTop: 8, color: "#b91c1c" }}>Lỗi duyệt gần nhất: {order.stockApplyError}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...btn, background: "#111827", color: "#fff", borderColor: "#111827" }}
                onClick={() => nav(`/office/dm/disposals/${order.id}`)}
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
