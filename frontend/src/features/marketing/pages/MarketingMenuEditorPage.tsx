import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { uploadReviewImage } from "../../stores/utils/uploadReviewImage";
import { marketingApi } from "../api/marketing.api";

type Category = Awaited<ReturnType<typeof marketingApi.listMenuCategories>>[number];
type ProductDetail = Awaited<ReturnType<typeof marketingApi.getMenuProductDetail>>;

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

function getImageUploadError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "Tải ảnh thất bại. Vui lòng thử lại.";
  if (message.startsWith("Thiếu cấu hình Cloudinary")) return message;
  return `Tải ảnh thất bại: ${message}`;
}

export default function MarketingMenuEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const productId = Number(id);
  const noticeTimerRef = useRef<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingVariantId, setSavingVariantId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const [form, setForm] = useState({
    categoryId: "",
    name: "",
    imageUrl: "",
    isActive: true,
  });

  const [variantDrafts, setVariantDrafts] = useState<Record<number, { size: string; price: string; isActive: boolean }>>({});

  function showNotice(type: "success" | "error" | "info", message: string, duration = 2600) {
    setNotice({ type, message });

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, duration);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [cats, detail] = await Promise.all([
        marketingApi.listMenuCategories(),
        marketingApi.getMenuProductDetail(productId),
      ]);

      setCategories(cats);
      setProduct(detail);
      setForm({
        categoryId: detail.categoryId != null ? String(detail.categoryId) : "",
        name: detail.name || "",
        imageUrl: detail.imageUrl || "",
        isActive: detail.isActive,
      });

      const nextDrafts: Record<number, { size: string; price: string; isActive: boolean }> = {};
      for (const item of detail.variants) {
        nextDrafts[item.id] = {
          size: item.size || "",
          price: String(item.price ?? 0),
          isActive: item.isActive,
        };
      }
      setVariantDrafts(nextDrafts);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không tải được dữ liệu món");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      setErr("ID món không hợp lệ");
      setLoading(false);
      return;
    }
    load();
  }, [productId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    setErr("");
    try {
      const imageUrl = await uploadReviewImage(file);
      setForm((current) => ({ ...current, imageUrl }));
      showNotice("success", "Tải ảnh thành công");
    } catch (error) {
      const message = getImageUploadError(error);
      setErr(message);
      showNotice("error", message, 3200);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveProduct() {
    if (!form.name.trim()) {
      showNotice("error", "Tên món không được để trống");
      return;
    }
    if (uploadingImage) {
      showNotice("info", "Ảnh đang được tải lên. Vui lòng chờ hoàn tất.");
      return;
    }

    setSavingProduct(true);
    try {
      await marketingApi.updateMenuProduct(productId, {
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        name: form.name.trim(),
        imageUrl: form.imageUrl.trim() || null,
        isActive: form.isActive,
      });

      showNotice("success", "Đã lưu thông tin món. Đang quay về danh sách...", 1200);

      window.setTimeout(() => {
        navigate("/office/marketing/menu");
      }, 900);
    } catch (e: any) {
      showNotice("error", e?.response?.data?.message || "Lưu món thất bại", 3200);
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleSaveVariant(variantId: number) {
    const draft = variantDrafts[variantId];
    if (!draft) return;

    const price = Number(draft.price);
    if (!draft.size.trim()) {
      showNotice("error", "Size không được để trống");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showNotice("error", "Giá variant không hợp lệ");
      return;
    }

    setSavingVariantId(variantId);
    try {
      await marketingApi.updateMenuVariant(variantId, {
        size: draft.size.trim(),
        price,
        isActive: draft.isActive,
      });
      await load();
      showNotice("success", "Đã lưu variant");
    } catch (e: any) {
      showNotice("error", e?.response?.data?.message || "Lưu variant thất bại", 3200);
    } finally {
      setSavingVariantId(null);
    }
  }

  async function handleToggleVariant(variantId: number, currentActive: boolean) {
    setSavingVariantId(variantId);
    try {
      await marketingApi.toggleMenuVariantActive(variantId, !currentActive);
      await load();
      showNotice("success", !currentActive ? "Đã mở bán lại variant" : "Đã tạm ngưng variant");
    } catch (e: any) {
      showNotice("error", e?.response?.data?.message || "Đổi trạng thái variant thất bại", 3200);
    } finally {
      setSavingVariantId(null);
    }
  }

  if (loading) return <div style={panelStyle}>Đang tải dữ liệu món...</div>;
  if (err) return <div style={{ ...panelStyle, color: "#b91c1c" }}>{err}</div>;
  if (!product) return <div style={panelStyle}>Không có dữ liệu món.</div>;

  return (
    <div style={pageStyle}>
      {notice ? (
        <div
          style={{
            ...toastStyle,
            ...(notice.type === "success"
              ? toastSuccessStyle
              : notice.type === "error"
              ? toastErrorStyle
              : toastInfoStyle),
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {notice.type === "success"
              ? "Thành công"
              : notice.type === "error"
              ? "Có lỗi xảy ra"
              : "Thông báo"}
          </div>
          <div>{notice.message}</div>
        </div>
      ) : null}

      <div style={headerStyle}>
        <div>
          <Link to="/office/marketing/menu" style={backLinkStyle}>
            ← Về danh sách menu
          </Link>
          <div style={{ marginTop: 8, color: "#6b7280" }}>Product #{product.id}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={secondaryButtonStyle} onClick={() => navigate("/office/marketing/menu")}>
            Quay lại
          </button>
          <button type="button" style={primaryButtonStyle} onClick={handleSaveProduct} disabled={savingProduct || uploadingImage}>
            {savingProduct ? "Đang lưu..." : "Lưu món"}
          </button>
        </div>
      </div>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Thông tin món</h2>

        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Category</span>
            <select
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              style={inputStyle}
            >
              <option value="">—</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Tên món</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              style={inputStyle}
            />
          </label>

          <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
            <span style={fieldLabelStyle}>Ảnh món</span>

            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              {form.imageUrl ? (
                <img
                  src={form.imageUrl}
                  alt={form.name || "Ảnh món"}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid #d9dce1",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 14,
                    border: "1px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                    fontSize: 12,
                  }}
                >
                  Chưa có ảnh
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #d9dce1",
                    borderRadius: 10,
                    background: "#fff",
                    color: "#374151",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                    width: "fit-content",
                  }}
                >
                  {uploadingImage ? "Đang tải ảnh..." : "Chọn ảnh"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await handleUploadImage(file);
                      event.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Ảnh sẽ upload lên Cloudinary rồi lưu URL vào product.
                </div>

                {form.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, imageUrl: "" }));
                      showNotice("info", "Đã bỏ ảnh khỏi form. Nhớ bấm Lưu món để áp dụng.");
                    }}
                    style={{
                      border: "1px solid #d9dce1",
                      borderRadius: 10,
                      background: "#fff",
                      color: "#374151",
                      padding: "8px 12px",
                      cursor: "pointer",
                      width: "fit-content",
                    }}
                  >
                    Bỏ ảnh
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <label style={checkFieldStyle}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>Đang bán</span>
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Variant hiện có</h2>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Giá</th>
                <th style={thStyle}>Đang bán</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((item) => {
                const draft = variantDrafts[item.id] || {
                  size: item.size,
                  price: String(item.price),
                  isActive: item.isActive,
                };

                return (
                  <tr key={item.id}>
                    <td style={tdStyle}>{item.id}</td>
                    <td style={tdStyle}>{item.sku || "—"}</td>
                    <td style={tdStyle}>
                      <input
                        value={draft.size}
                        onChange={(event) =>
                          setVariantDrafts((current) => ({
                            ...current,
                            [item.id]: { ...draft, size: event.target.value },
                          }))
                        }
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={draft.price}
                        onChange={(event) =>
                          setVariantDrafts((current) => ({
                            ...current,
                            [item.id]: { ...draft, price: event.target.value },
                          }))
                        }
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <label style={checkFieldStyle}>
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            setVariantDrafts((current) => ({
                              ...current,
                              [item.id]: { ...draft, isActive: event.target.checked },
                            }))
                          }
                        />
                        <span>{draft.isActive ? "On" : "Off"}</span>
                      </label>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionWrapStyle}>
                        <button
                          type="button"
                          style={primaryButtonStyle}
                          onClick={() => handleSaveVariant(item.id)}
                          disabled={savingVariantId === item.id}
                        >
                          {savingVariantId === item.id ? "Đang lưu..." : "Lưu variant"}
                        </button>
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() => handleToggleVariant(item.id, item.isActive)}
                          disabled={savingVariantId === item.id}
                        >
                          {item.isActive ? "Tạm ngưng" : "Mở bán lại"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {product.variants.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    Món này chưa có variant nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const pageStyle: React.CSSProperties = { display: "grid", gap: 16 };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9dce1", borderRadius: 18, padding: 18 };
const sectionTitleStyle: React.CSSProperties = { marginTop: 0, marginBottom: 14 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 6 };
const fieldLabelStyle: React.CSSProperties = { fontWeight: 700, color: "#374151" };
const inputStyle: React.CSSProperties = { border: "1px solid #d9dce1", borderRadius: 12, padding: "10px 12px", width: "100%" };
const panelStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9dce1", borderRadius: 18, padding: 18 };
const backLinkStyle: React.CSSProperties = { textDecoration: "none", color: "#6b7280", fontWeight: 700 };
const primaryButtonStyle: React.CSSProperties = { border: "1px solid #2f5c4f", background: "#2f5c4f", color: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #d9dce1", background: "#fff", color: "#374151", borderRadius: 10, padding: "10px 14px", cursor: "pointer" };
const checkFieldStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const tableWrapStyle: React.CSSProperties = { overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb", fontSize: 13 };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const actionWrapStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: 20,
  right: 20,
  zIndex: 9999,
  minWidth: 280,
  maxWidth: 420,
  borderRadius: 14,
  padding: "14px 16px",
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.16)",
  border: "1px solid transparent",
  fontSize: 14,
};

const toastSuccessStyle: React.CSSProperties = {
  background: "#ecfdf5",
  borderColor: "#86efac",
  color: "#166534",
};

const toastErrorStyle: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fca5a5",
  color: "#b91c1c",
};

const toastInfoStyle: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#93c5fd",
  color: "#1d4ed8",
};