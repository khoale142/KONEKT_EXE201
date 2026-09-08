import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { getStoreLocations, type StoreLocation } from "../../stores/api/stores.api";

export default function MemberOrderStoreSelectPage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getStoreLocations();
        setStores(data);
      } catch (e: unknown) {
        setError((e as Error)?.message || "Không tải được danh sách cửa hàng");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectStore = (store: StoreLocation) => {
    navigate(`/customer/order/menu`, {
      state: { storeId: Number(store.id), storeName: store.name },
    });
  };

  if (loading) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải danh sách cửa hàng...</p>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />
      <section className="cafe-hero">
        <h1 className="cafe-hero-title">Chọn cửa hàng nhận hàng</h1>
        <p className="cafe-hero-subtitle">Chọn cửa hàng bạn muốn đến lấy đơn hàng</p>
      </section>

      <main style={{ flex: 1, padding: 32, maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {error && (
          <p className="cafe-error" style={{ marginBottom: 24 }}>
            {error}
          </p>
        )}

        <div className="cafe-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stores.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => handleSelectStore(store)}
                className="cafe-btn-secondary"
                style={{
                  padding: 20,
                  textAlign: "left",
                  display: "block",
                }}
              >
                <strong style={{ fontSize: "1.1rem" }}>{store.name}</strong>
                {store.address && (
                  <p style={{ margin: "8px 0 0", fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
                    {store.address}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <p style={{ marginTop: 24, textAlign: "center" }}>
          <Link to="/customer" className="cafe-link">
            ← Quay lại
          </Link>
        </p>
      </main>
      <CafeFooter />
      <ChatButton />
    </div>
  );
}
