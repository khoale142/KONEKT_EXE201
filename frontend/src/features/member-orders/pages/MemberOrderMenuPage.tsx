import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { getPublicMenu, type MenuCategory, type MenuVariant, type MenuProduct, type MenuCombo } from "../../menu/api/menu.api";
import { getStoreDetail } from "../../stores/api/stores.api";
import { useOnlineCartStore, useCurrentStoreItems, useCurrentStoreCombos } from "../store/onlineCart.store";

const CATEGORY_LABEL: Record<string, string> = {
  BEST_SELLER: "Bán chạy nhất",
  BAKERY_SWEET: "Bánh ngọt",
  BAKERY_SAVORY: "Bánh mặn",
  COFFEE: "Cà phê truyền thống",
  ESPRESSO: "Espresso",
  PHINDI: "Phindi",
  TEA: "Trà",
  FREEZE: "Freeze",
  JUICE: "Nước ép",
  TOPPING: "Topping",
  OTHERS: "Nước khác",
};

export default function MemberOrderMenuPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeId, storeName, setStore, addItem, addCombo, getTotalItems } = useOnlineCartStore();
  const items = useCurrentStoreItems();
  const combosInCart = useCurrentStoreCombos();

  const stateStoreId = (location.state as { storeId?: number })?.storeId;
  const stateStoreName = (location.state as { storeName?: string })?.storeName;
  const effectiveStoreId = storeId ?? stateStoreId;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [combos, setCombos] = useState<MenuCombo[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storeAddress, setStoreAddress] = useState<string | null>(null);

  useEffect(() => {
    if (stateStoreId && stateStoreName) {
      setStore(stateStoreId, stateStoreName);
    }
  }, [stateStoreId, stateStoreName, setStore]);

  useEffect(() => {
    if (!storeId && !stateStoreId) {
      navigate("/customer/order", { replace: true });
      return;
    }
  }, [storeId, stateStoreId, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await getPublicMenu();
        setCategories(r.categories);
        setCombos(r.combos || []);
        setActiveCat(r.categories[0]?.key || "");
      } catch (e: unknown) {
        setError((e as Error)?.message || "Không tải được thực đơn");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!effectiveStoreId) return;
    getStoreDetail(String(effectiveStoreId))
      .then((s) => setStoreAddress(s?.address ?? null))
      .catch(() => setStoreAddress(null));
  }, [effectiveStoreId]);

  const handleChangeStore = () => {
    navigate("/customer/order", { replace: true });
  };

  const effectiveStoreName = storeName ?? stateStoreName;
  const active = categories.find((c) => c.key === activeCat);
  const normalizedKeyword = searchQuery.trim().toLowerCase();
  const filteredProducts = active?.products?.filter((p) => {
    if (!normalizedKeyword) return true;
    const haystack = [p.name, p.description, ...(p.variants || []).map((v) => v.size)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedKeyword);
  }) || [];
  const filteredCombos = combos.filter((combo) => {
    if (!normalizedKeyword) return true;
    const haystack = [
      combo.name,
      combo.description,
      combo.code,
      ...combo.items.map((item) => `${item.productName} ${item.size}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedKeyword);
  });
  const totalItems = getTotalItems();
  const totalAmount =
    items.reduce((sum, i) => sum + i.price * i.quantity, 0) +
    combosInCart.reduce((sum, c) => sum + c.comboPrice * c.quantity, 0);

  const handleAddItem = (product: MenuProduct, variant: MenuVariant) => {
    if (product.isSoldOut) return;
    addItem({
      productVariantId: variant.id,
      productName: product.name || "Món",
      size: variant.size,
      price: variant.price ?? 0,
      quantity: 1,
    });
  };

  if (loading) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải thực đơn...</p>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="order-hero">
        <h1 className="order-hero__title">Thực đơn</h1>
        {effectiveStoreName && (
          <div className="order-hero__store-card">
            <div className="order-hero__store-info">
              <p className="order-hero__store-name">📍 {effectiveStoreName}</p>
              {storeAddress && <p className="order-hero__store-address">{storeAddress}</p>}
            </div>
            <button type="button" onClick={handleChangeStore} className="order-hero__btn-change-store">
              Đổi quán
            </button>
          </div>
        )}
        {!effectiveStoreName && (
          <p className="order-hero__store-address" style={{ margin: 0 }}>
            Chọn món để thêm vào giỏ
          </p>
        )}
        {totalItems > 0 && (
          <div className="order-hero__cart-bar">
            <div className="order-hero__cart-info">
              <span className="order-hero__cart-icon">🛒</span>
              <span className="order-hero__cart-text">
                Giỏ hàng: {totalItems} món · <span className="order-hero__cart-amount">{totalAmount.toLocaleString("vi-VN")}đ</span>
              </span>
            </div>
            <div className="order-hero__cart-actions">
              <Link
                to="/customer/vouchers"
                state={{ returnTo: "/customer/order/menu" }}
                className="cafe-btn-secondary"
              >
                Đổi điểm / Voucher
              </Link>
              <Link to="/customer/order/cart" className="cafe-btn-primary">
                Xem giỏ hàng
              </Link>
            </div>
          </div>
        )}
      </section>

      <main style={{ flex: 1, padding: 32, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {error && (
          <p className="cafe-error" style={{ marginBottom: 24 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`cafe-category-pill ${activeCat === c.key ? "active" : ""}`}
            >
              {CATEGORY_LABEL[c.key] || c.name}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm món hoặc combo..."
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 12,
              border: "1px solid var(--cafe-border)",
              background: "#fff",
              padding: "10px 14px",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
        </div>

        <div className="cafe-card" style={{ padding: 28 }}>
          <h2 className="cafe-section-title" style={{ marginBottom: 20 }}>
            {active ? CATEGORY_LABEL[active.key] || active.name : "Chọn danh mục"}
          </h2>

          {!filteredProducts.length && (
            <p style={{ color: "var(--cafe-text-muted)", marginBottom: 20 }}>
              Không tìm thấy món phù hợp trong danh mục hiện tại.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {filteredProducts.map((p, idx) => (
              <div
                key={p.id ?? p.name ?? idx}
                className="cafe-product-card"
                style={p.isSoldOut ? { opacity: 0.75, position: "relative" } : undefined}
              >
                {/* Tags: Hết món, Món mới, Best seller */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, minHeight: 24 }}>
                  {p.isSoldOut && (
                    <span
                      style={{
                        padding: "4px 10px",
                        background: "#c53030",
                        color: "#fff",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: 6,
                      }}
                    >
                      Hết món
                    </span>
                  )}
                  {p.isNew && !p.isSoldOut && (
                    <span
                      style={{
                        padding: "4px 10px",
                        background: "#2b6cb0",
                        color: "#fff",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: 6,
                      }}
                    >
                      Món mới
                    </span>
                  )}
                  {p.isBestSeller && !p.isSoldOut && (
                    <span
                      style={{
                        padding: "4px 10px",
                        background: "var(--cafe-brown)",
                        color: "#fff",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: 6,
                      }}
                    >
                      Best seller
                    </span>
                  )}
                </div>
                {p.imageUrl ? (
                  <div
                    style={{
                      aspectRatio: "16/10",
                      background: "var(--cafe-cream)",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.name || ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      aspectRatio: "16/10",
                      background: "linear-gradient(135deg, var(--cafe-cream-dark) 0%, var(--cafe-cream) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--cafe-text-muted)",
                      fontSize: "0.9rem",
                    }}
                  >
                    Chưa có ảnh
                  </div>
                )}
                <div style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "var(--cafe-olive-dark)" }}>
                    {p.name || "Món"}
                  </h3>
                  {p.description && (
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: "0.9rem",
                        color: "var(--cafe-text-muted)",
                        lineHeight: 1.5,
                      }}
                    >
                      {p.description}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(p.variants || []).map((v: MenuVariant) => (
                      <div
                        key={v.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: p.isSoldOut ? "var(--cafe-cream-dark)" : "var(--cafe-cream)",
                          borderRadius: 10,
                        }}
                      >
                        <span style={{ color: p.isSoldOut ? "var(--cafe-text-muted)" : "var(--cafe-text)" }}>
                          {v.size}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "var(--cafe-brown)" }}>
                            {Number(v.price || 0).toLocaleString("vi-VN")}đ
                          </span>
                          <button
                            type="button"
                            className="cafe-btn-primary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "0.85rem",
                              opacity: p.isSoldOut ? 0.6 : 1,
                              cursor: p.isSoldOut ? "not-allowed" : "pointer",
                            }}
                            onClick={() => handleAddItem(p, v)}
                            disabled={!!p.isSoldOut}
                          >
                            {p.isSoldOut ? "Hết món" : "Thêm"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cafe-card" style={{ padding: 28, marginTop: 24 }}>
          <h2 className="cafe-section-title" style={{ marginBottom: 20 }}>
            Combo
          </h2>
          {!filteredCombos.length ? (
            <p style={{ color: "var(--cafe-text-muted)" }}>
              Không tìm thấy combo phù hợp.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {filteredCombos.map((combo) => (
                <div key={combo.id} className="cafe-product-card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: "0 0 8px", color: "var(--cafe-olive-dark)" }}>{combo.name}</h3>
                      {combo.description && (
                        <p style={{ margin: "0 0 10px", color: "var(--cafe-text-muted)", fontSize: "0.9rem" }}>
                          {combo.description}
                        </p>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--cafe-brown)" }}>
                      {Number(combo.comboPrice || 0).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {combo.items.map((item, idx) => (
                      <div
                        key={`${combo.id}-${item.productVariantId}-${idx}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "var(--cafe-cream)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span>
                          {item.quantity} x {item.productName} ({item.size})
                        </span>
                        <span style={{ color: "var(--cafe-text-muted)" }}>
                          {Number(item.unitPrice || 0).toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cafe-btn-primary"
                    style={{ marginTop: 12, width: "100%" }}
                    onClick={() =>
                      addCombo({
                        comboId: combo.id,
                        comboName: combo.name,
                        comboPrice: Number(combo.comboPrice || 0),
                        items: (combo.items || []).map((item) => ({
                          productVariantId: item.productVariantId,
                          productName: item.productName,
                          size: item.size,
                          unitPrice: Number(item.unitPrice || 0),
                          quantity: Number(item.quantity || 1),
                        })),
                        quantity: 1,
                      })
                    }
                  >
                    Thêm combo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {totalItems > 0 && (
        <Link
          to="/customer/order/cart"
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 22px",
            background: "var(--cafe-brown)",
            color: "white",
            borderRadius: 50,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "1rem",
            zIndex: 1000,
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>🛒</span>
          <span>Giỏ hàng ({totalItems})</span>
        </Link>
      )}
      <CafeFooter />
      <ChatButton />
    </div>
  );
}
