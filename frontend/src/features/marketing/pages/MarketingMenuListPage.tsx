import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { marketingApi } from "../api/marketing.api";

type Category = Awaited<ReturnType<typeof marketingApi.listMenuCategories>>[number];
type MenuListResponse = Awaited<ReturnType<typeof marketingApi.listMenuProducts>>;
type MenuItem = MenuListResponse["items"][number];

export default function MarketingMenuListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [cats, data] = await Promise.all([
        marketingApi.listMenuCategories(),
        marketingApi.listMenuProducts({
          keyword: keyword.trim() || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          isActive: isActive === "" ? undefined : isActive === "true",
          limit: 200,
          offset: 0,
        }),
      ]);

      setCategories(cats);
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không tải được danh sách menu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const active = items.filter((x) => x.isActive).length;
    return `${items.length} món · ${active} đang bán`;
  }, [items]);

  async function handleToggleActive(item: MenuItem) {
    setSubmittingId(item.id);
    try {
      await marketingApi.toggleMenuProductActive(item.id, !item.isActive);
      await load();
    } catch (e: any) {
      window.alert(e?.response?.data?.message || "Cập nhật trạng thái món thất bại");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Quản lý menu</h1>
          <p style={heroTextStyle}>
            Bản demo này chỉ quản lý dữ liệu menu dùng chung toàn hệ thống: tên món, ảnh, giá, variant và trạng thái tạm ngưng.
          </p>
          <div style={subtleTextStyle}>{summary}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/office/marketing/contents" style={secondaryLinkStyle}>
            Nội dung marketing
          </Link>
          <Link to="/office/marketing/combos" style={secondaryLinkStyle}>
            Quản lý combo
          </Link>
          <Link to="/office/marketing/promotions" style={secondaryLinkStyle}>
            Promotions
          </Link>
        </div>
      </section>

      <section style={filterCardStyle}>
        <div style={filterGridStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Từ khóa</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tên món..."
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} style={inputStyle}>
              <option value="">Tất cả</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Trạng thái</span>
            <select value={isActive} onChange={(event) => setIsActive(event.target.value as any)} style={inputStyle}>
              <option value="">Tất cả</option>
              <option value="true">Đang bán</option>
              <option value="false">Tạm ngưng</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" style={primaryButtonStyle} onClick={load}>
            Lọc
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              setKeyword("");
              setCategoryId("");
              setIsActive("");
            }}
          >
            Reset
          </button>
        </div>
      </section>

      {loading ? <div style={panelStyle}>Đang tải danh sách menu...</div> : null}
      {err ? <div style={{ ...panelStyle, color: "#b91c1c" }}>{err}</div> : null}

      {!loading && !err ? (
        <section style={tableCardStyle}>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Món</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Trạng thái</th>
                  <th style={thStyle}>Variant</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} style={thumbStyle} />
                        ) : (
                          <div style={thumbPlaceholderStyle}>No img</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={subtleCellStyle}>ID: {item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{item.categoryName || "—"}</td>
                    <td style={tdStyle}>
                      <div>{item.isActive ? "Đang bán" : "Tạm ngưng"}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>{item.activeVariantCount}/{item.variantCount} variant đang bán</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionWrapStyle}>
                        <Link to={`/office/marketing/menu/${item.id}/edit`} style={actionLinkStyle}>
                          Sửa
                        </Link>
                        <button
                          type="button"
                          style={actionButtonStyle}
                          onClick={() => handleToggleActive(item)}
                          disabled={submittingId === item.id}
                        >
                          {item.isActive ? "Tạm ngưng" : "Mở bán lại"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      Chưa có món nào phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const pageStyle: React.CSSProperties = { display: "grid", gap: 16 };
const heroStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 22,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};
const heroTextStyle: React.CSSProperties = { color: "#6b7280", margin: 0 };
const subtleTextStyle: React.CSSProperties = { color: "#6b7280", marginTop: 8, fontSize: 13 };
const filterCardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9dce1", borderRadius: 18, padding: 18 };
const filterGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 6 };
const fieldLabelStyle: React.CSSProperties = { fontWeight: 700, color: "#374151" };
const inputStyle: React.CSSProperties = { border: "1px solid #d9dce1", borderRadius: 12, padding: "10px 12px" };
const panelStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9dce1", borderRadius: 18, padding: 18 };
const tableCardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9dce1", borderRadius: 18, padding: 18 };
const tableWrapStyle: React.CSSProperties = { overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb", fontSize: 13 };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const subtleCellStyle: React.CSSProperties = { color: "#6b7280", fontSize: 12, marginTop: 4 };
const thumbStyle: React.CSSProperties = { width: 54, height: 54, objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" };
const thumbPlaceholderStyle: React.CSSProperties = { width: 54, height: 54, borderRadius: 12, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b7280" };
const actionWrapStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const actionLinkStyle: React.CSSProperties = { textDecoration: "none", border: "1px solid #d9dce1", borderRadius: 10, padding: "8px 10px", color: "#374151", fontWeight: 700 };
const actionButtonStyle: React.CSSProperties = { border: "1px solid #d9dce1", borderRadius: 10, padding: "8px 10px", background: "#fff", cursor: "pointer" };
const primaryButtonStyle: React.CSSProperties = { border: "1px solid #2f5c4f", background: "#2f5c4f", color: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #d9dce1", background: "#fff", color: "#374151", borderRadius: 10, padding: "10px 14px", cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { textDecoration: "none", border: "1px solid #d9dce1", background: "#fff", color: "#374151", borderRadius: 10, padding: "10px 14px", fontWeight: 700 };
