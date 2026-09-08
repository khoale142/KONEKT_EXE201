import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { getPublicMenu, type MenuCategory, type MenuVariant } from "../api/menu.api";

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

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await getPublicMenu();
        setCategories(r.categories);
        const first = r.categories[0]?.key || "";
        setActiveCat(first);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Không tải được thực đơn");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = categories.find((c) => c.key === activeCat);

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

  if (error) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48, flexDirection: "column", gap: 16 }}>
          <p className="cafe-error">{error}</p>
          <Link to="/" className="cafe-link">← Quay lại trang chủ</Link>
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
        <h1 className="cafe-hero-title">Thực đơn</h1>
        <p className="cafe-hero-subtitle">
          Cà phê đặc sản và bánh ngọt tươi mỗi ngày. Đăng nhập để đặt hàng và tích điểm.
        </p>
      </section>

      <main style={{ flex: 1, padding: 32, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
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

        <div className="cafe-card" style={{ padding: 28 }}>
          <h2 className="cafe-section-title" style={{ marginBottom: 20 }}>
            {active ? (CATEGORY_LABEL[active.key] || active.name) : "Chọn danh mục"}
          </h2>

          {!active && categories.length > 0 && (
            <p style={{ color: "var(--cafe-text-muted)" }}>Chưa có món trong danh mục này.</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {active?.products?.map((p, idx) => (
              <div key={p.id ?? p.name ?? idx} className="cafe-product-card">
                {p.imageUrl ? (
                  <div style={{ aspectRatio: "16/10", background: "var(--cafe-cream)", overflow: "hidden" }}>
                    <img src={p.imageUrl} alt={p.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  </div>
                ) : (
                  <div style={{ aspectRatio: "16/10", background: "linear-gradient(135deg, var(--cafe-cream-dark) 0%, var(--cafe-cream) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cafe-text-muted)", fontSize: "0.9rem" }}>
                    Chưa có ảnh
                  </div>
                )}
                <div style={{ padding: 20 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "var(--cafe-olive-dark)" }}>{p.name || "Món"}</h3>
                  {p.description ? (
                    <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--cafe-text-muted)", lineHeight: 1.5 }}>{p.description}</p>
                  ) : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(p.variants || []).map((v: MenuVariant) => (
                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--cafe-cream)", borderRadius: 10 }}>
                        <span style={{ color: "var(--cafe-text)" }}>{v.size}</span>
                        <span style={{ fontWeight: 600, color: "var(--cafe-brown)" }}>{Number(v.price || 0).toLocaleString("vi-VN")}đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <CafeFooter />
      <ChatButton />
    </div>
  );
}
