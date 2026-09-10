import { useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import { CategoryItem, ownerMenuApi } from "../api/ownerMenu.api";

export default function OwnerCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await ownerMenuApi.listCategories();
      setCategories(data);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Không thể tải danh sách danh mục");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setSortOrder(String(categories.length + 1));
    setShowModal(true);
  }

  function openEditModal(c: CategoryItem) {
    setEditingCategory(c);
    setName(c.name);
    setDescription(c.description || "");
    setSortOrder(String(c.sortOrder));
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (editingCategory) {
        await ownerMenuApi.updateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          sortOrder: Number(sortOrder) || 0,
        });
      } else {
        await ownerMenuApi.createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          sortOrder: Number(sortOrder) || 0,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Lỗi lưu danh mục");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c: CategoryItem) {
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${c.name}"?`)) return;
    try {
      await ownerMenuApi.deleteCategory(c.id);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa danh mục");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#FFFFFF",
          border: "1px solid #E8E3DA",
          borderRadius: 14,
          padding: "10px 16px",
        }}
      >
        <div style={{ fontSize: 13, color: "#607062" }}>
          Phân loại nhóm món (Cà phê, Trà, Bánh...) và thứ tự hiển thị trên POS.
        </div>
        <button
          onClick={openCreateModal}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#2D3E2F",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 2px 6px rgba(45, 62, 47, 0.20)",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={15} /> Thêm danh mục mới
        </button>
      </div>

      {/* Categories Card Table */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E3DA",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#607062" }}>
            Đang tải dữ liệu danh mục...
          </div>
        ) : errorMsg ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 16px",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} /> {errorMsg}
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#607062" }}>
            Chưa có danh mục nào. Hãy nhấn "+ Thêm danh mục mới".
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8F6F1", borderBottom: "1px solid #E8E3DA" }}>
                <th style={{ ...thStyle, width: 70 }}>Thứ tự</th>
                <th style={thStyle}>Tên danh mục</th>
                <th style={thStyle}>Mô tả</th>
                <th style={{ ...thStyle, textAlign: "right", width: 130 }}>Số lượng món</th>
                <th style={{ ...thStyle, textAlign: "center", width: 140 }}>Trạng thái</th>
                <th style={{ ...thStyle, textAlign: "right", width: 100 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: "1px solid #F0ECE4", transition: "background 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                    <span
                      style={{
                        background: "#F2EFE9",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#4A5D4D",
                      }}
                    >
                      #{c.sortOrder}
                    </span>
                  </td>

                  {/* Category Name - Direct text, no FolderTree icon! */}
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: "#1E261F", fontSize: 13.5 }}>
                      {c.name}
                    </span>
                  </td>

                  <td style={{ ...tdStyle, color: "#607062", maxWidth: 280 }}>
                    {c.description || "—"}
                  </td>

                  {/* Product Count - Right aligned, tabular-nums, no coffee cup icon! */}
                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontWeight: 600, color: "#2D3E2F" }}>
                      {c.productCount || 0} món
                    </span>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: c.isActive ? "#EBF4ED" : "#F2EFEA",
                        color: c.isActive ? "#235E2D" : "#736E66",
                      }}
                    >
                      {c.isActive ? "Đang hoạt động" : "Tạm khóa"}
                    </span>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      <button
                        onClick={() => openEditModal(c)}
                        title="Chỉnh sửa"
                        style={iconBtnStyle}
                      >
                        <Edit2 size={14} color="#2D3E2F" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Xóa danh mục"
                        style={{ ...iconBtnStyle, color: "#DC2626" }}
                      >
                        <Trash2 size={14} color="#DC2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Add / Edit Category */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.40)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              width: "100%",
              maxWidth: 440,
              padding: 22,
              boxShadow: "0 16px 36px rgba(0,0,0,0.12)",
              border: "1px solid #E8E3DA",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid #E8E3DA",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1E261F" }}>
                {editingCategory ? "Chỉnh Sửa Nhóm Món" : "Thêm Danh Mục Mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#8A968B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Tên danh mục nhóm món *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cà Phê, Trà Sữa, Bánh Ngọt..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Mô tả tóm tắt</label>
                <textarea
                  placeholder="VD: Các món đồ uống chiết xuất từ hạt cà phê rang xay..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "none",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>Thứ tự sắp xếp hiển thị</label>
                <input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #DFD9CE",
                    background: "#FAF8F5",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#5A685B",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2D3E2F",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(45, 62, 47, 0.20)",
                  }}
                >
                  {submitting ? "Đang lưu..." : editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "#4A5D4D",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  verticalAlign: "middle",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 13,
  verticalAlign: "middle",
};

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.12s ease",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#1E261F",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #DFD9CE",
  fontSize: 13,
  color: "#1E261F",
  background: "#FAF8F5",
  outline: "none",
};
