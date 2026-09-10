import { useState } from "react";
import { X, Edit2, Trash2, Check, AlertCircle } from "lucide-react";
import { CategoryItem, ownerMenuApi } from "../api/ownerMenu.api";

interface CategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: "product" | "raw_material" | "semi_finished";
  categories: CategoryItem[];
  onRefresh: () => void;
}

export default function CategoryManageModal({
  isOpen,
  onClose,
  scope,
  categories,
  onRefresh,
}: CategoryManageModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const scopeTitleMap: Record<string, string> = {
    product: "Danh mục Món bán",
    raw_material: "Danh mục Nguyên liệu",
    semi_finished: "Danh mục Bán thành phẩm",
  };

  // Only root categories (where parentId is null) can be chosen as parent
  const rootCategories = categories.filter((c) => !c.parentId && c.id !== editingId);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setParentId("");
    setSortOrder("0");
    setErrorMsg("");
  }

  function startEdit(cat: CategoryItem) {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || "");
    setParentId(cat.parentId ? String(cat.parentId) : "");
    setSortOrder(String(cat.sortOrder || 0));
    setErrorMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Vui lòng nhập tên danh mục");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      if (editingId) {
        await ownerMenuApi.updateCategory(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          parentId: parentId ? Number(parentId) : null,
          sortOrder: Number(sortOrder) || 0,
          scope,
        });
      } else {
        await ownerMenuApi.createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          parentId: parentId ? Number(parentId) : null,
          sortOrder: Number(sortOrder) || 0,
          scope,
        });
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Lỗi lưu danh mục");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(cat: CategoryItem) {
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${cat.name}"?`)) return;
    try {
      await ownerMenuApi.deleteCategory(cat.id);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa danh mục");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24, 30, 25, 0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid #E8E3DA",
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 40px -8px rgba(45, 62, 47, 0.20)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E8E3DA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FAF8F5",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E261F" }}>
              Quản lý {scopeTitleMap[scope]}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#607062" }}>
              Phân cấp danh mục cha - danh mục con trực tiếp trên trang.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#5A685B",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {errorMsg && (
            <div
              style={{
                background: "#FDF2F2",
                border: "1px solid #FECACA",
                color: "#DC2626",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#FAF8F5",
              border: "1px solid #DFD9CE",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2D3E2F" }}>
              {editingId ? "Chỉnh sửa danh mục" : "+ Thêm danh mục mới"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#4A5D4D", marginBottom: 3 }}>
                  Tên danh mục *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Cà phê, Trà sữa, Sữa tươi..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#4A5D4D", marginBottom: 3 }}>
                  Thuộc danh mục cha
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">(Là danh mục gốc - Cấp 1)</option>
                  {rootCategories.map((rc) => (
                    <option key={rc.id} value={rc.id}>
                      {rc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#4A5D4D", marginBottom: 3 }}>
                  Mô tả ngắn
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú về phân nhóm này..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#4A5D4D", marginBottom: 3 }}>
                  Thứ tự hiển thị
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 7,
                    border: "1px solid #DFD9CE",
                    background: "#FFFFFF",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: "#5A685B",
                  }}
                >
                  Hủy sửa
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: "#2D3E2F",
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={14} />
                {editingId ? "Cập nhật" : "Lưu danh mục"}
              </button>
            </div>
          </form>

          {/* Current List Table */}
          <div style={{ border: "1px solid #E8E3DA", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8F6F1", borderBottom: "1px solid #E8E3DA", color: "#4A5D4D" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 700, width: 60 }}>Thứ tự</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>Tên danh mục</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>Cấp độ</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right", width: 80 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#8A968B" }}>
                      Chưa có danh mục nào cho mục này.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => {
                    const isChild = !!c.parentId;
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid #F0ECE4",
                          background: isChild ? "#FAF8F5" : "#FFFFFF",
                        }}
                      >
                        <td style={{ padding: "8px 12px", color: "#8A968B", fontVariantNumeric: "tabular-nums" }}>
                          #{c.sortOrder}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isChild && (
                              <span style={{ color: "#8A968B", fontSize: 13, marginRight: 2 }}>↳</span>
                            )}
                            <span style={{ fontWeight: isChild ? 500 : 700, color: "#1E261F" }}>
                              {c.name}
                            </span>
                            {c.productCount !== undefined && c.productCount > 0 && (
                              <span style={{ fontSize: 11, color: "#607062" }}>
                                ({c.productCount} món)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isChild ? "#EBF4ED" : "#F2EFEA",
                              color: isChild ? "#235E2D" : "#4A5D4D",
                              fontWeight: 600,
                            }}
                          >
                            {isChild ? `Con của: ${c.parentName || "Gốc"}` : "Gốc (Cấp 1)"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                            <button
                              onClick={() => startEdit(c)}
                              title="Sửa"
                              style={iconBtnStyle}
                            >
                              <Edit2 size={13} color="#2D3E2F" />
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              title="Xóa"
                              style={{ ...iconBtnStyle, color: "#DC2626" }}
                            >
                              <Trash2 size={13} color="#DC2626" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid #DFD9CE",
  fontSize: 12.5,
  color: "#1E261F",
  background: "#FFFFFF",
  outline: "none",
};

const iconBtnStyle: React.CSSProperties = {
  border: "1px solid #E8E3DA",
  background: "#FFFFFF",
  borderRadius: 6,
  padding: "4px 6px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
