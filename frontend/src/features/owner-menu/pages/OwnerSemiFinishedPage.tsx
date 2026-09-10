import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  AlertCircle,
  LayoutGrid,
  List,
  Tags,
  CheckCircle2,
  X,
  FlaskConical,
} from "lucide-react";
import {
  CategoryItem,
  IngredientItem,
  ownerMenuApi,
} from "../api/ownerMenu.api";
import CategoryManageModal from "../components/CategoryManageModal";
import SemiFinishedRecipeModal from "../components/SemiFinishedRecipeModal";

export default function OwnerSemiFinishedPage() {
  const [semiItems, setSemiItems] = useState<IngredientItem[]>([]);
  const [rawIngredients, setRawIngredients] = useState<IngredientItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // View Mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("konekt_semi_view_mode") as "grid" | "table") || "grid";
  });

  function handleSetViewMode(mode: "grid" | "table") {
    setViewMode(mode);
    localStorage.setItem("konekt_semi_view_mode", mode);
  }

  // Filters
  const [keyword, setKeyword] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<IngredientItem | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [recipeModalItem, setRecipeModalItem] = useState<IngredientItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("ml");
  const [batchYield, setBatchYield] = useState("1000");
  const [minThreshold, setMinThreshold] = useState("2000");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const [semiData, rawData, catsData] = await Promise.all([
        ownerMenuApi.listIngredients({
          itemType: "semi_finished",
          categoryId: selectedCatId ? Number(selectedCatId) : undefined,
          keyword: keyword.trim() || undefined,
        }),
        ownerMenuApi.listIngredients({ itemType: "raw" }),
        ownerMenuApi.listCategories({ scope: "semi_finished" }),
      ]);

      setSemiItems(semiData);
      setRawIngredients(rawData);
      setCategories(catsData);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Không thể tải danh sách bán thành phẩm");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCatId]);

  function openCreateModal() {
    setEditingItem(null);
    setName("");
    setCode("");
    setCategoryId("");
    setUnit("ml");
    setBatchYield("1000");
    setMinThreshold("2000");
    setShowModal(true);
  }

  function openEditModal(item: IngredientItem, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setName(item.name);
    setCode(item.code || "");
    setCategoryId(item.categoryId ? String(item.categoryId) : "");
    setUnit(item.unit);
    setBatchYield(String(item.batchYield || 1000));
    setMinThreshold(String(item.minThreshold || 0));
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (editingItem) {
        await ownerMenuApi.updateIngredient(editingItem.id, {
          name: name.trim(),
          code: code.trim() || null,
          categoryId: categoryId ? Number(categoryId) : null,
          unit: unit.trim(),
          batchYield: Number(batchYield) || 1000,
          minThreshold: Number(minThreshold) || 0,
        });
        setSuccessMsg(`Đã cập nhật "${name}"`);
      } else {
        await ownerMenuApi.createIngredient({
          name: name.trim(),
          code: code.trim() || `SEMI-${Date.now().toString().slice(-4)}`,
          categoryId: categoryId ? Number(categoryId) : null,
          itemType: "semi_finished",
          unit: unit.trim(),
          batchYield: Number(batchYield) || 1000,
          costPerUnit: 0,
          minThreshold: Number(minThreshold) || 0,
        });
        setSuccessMsg(`Đã tạo bán thành phẩm "${name}"`);
      }
      setShowModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Lỗi lưu bán thành phẩm");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: IngredientItem, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!window.confirm(`Bạn có chắc muốn xóa bán thành phẩm "${item.name}"?`)) return;
    try {
      await ownerMenuApi.deleteIngredient(item.id);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa bán thành phẩm");
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = semiItems.length;
    const withBom = semiItems.filter((i) => i.hasRecipe).length;
    const withoutBom = total - withBom;
    return { total, withBom, withoutBom };
  }, [semiItems]);

  // Formatted hierarchical categories
  const formattedCategoryOptions = useMemo(() => {
    const rootCats = categories.filter((c) => !c.parentId);
    const options: Array<{ id: number; name: string; isChild: boolean }> = [];
    for (const root of rootCats) {
      options.push({ id: root.id, name: root.name, isChild: false });
      const children = categories.filter((c) => c.parentId === root.id);
      for (const child of children) {
        options.push({ id: child.id, name: `↳ ${child.name}`, isChild: true });
      }
    }
    return options;
  }, [categories]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>TỔNG BÁN THÀNH PHẨM</div>
          <div style={kpiValueStyle}>
            {kpis.total} <span style={kpiUnitStyle}>món sơ chế</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>ĐÃ CÓ CÔNG THỨC SƠ CHẾ</div>
          <div style={{ ...kpiValueStyle, color: "#235E2D" }}>
            {kpis.withBom} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>CHƯA KHAI BÁO BOM SƠ CHẾ</div>
          <div style={{ ...kpiValueStyle, color: kpis.withoutBom > 0 ? "#92400E" : "#1E261F" }}>
            {kpis.withoutBom} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            background: "#EBF4ED",
            border: "1px solid #C4DFC8",
            color: "#235E2D",
            padding: "10px 14px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E3DA",
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search
            size={15}
            color="#8A968B"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            placeholder="Tìm bán thành phẩm sơ chế..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px 8px 34px",
              borderRadius: 8,
              border: "1px solid #DFD9CE",
              fontSize: 13,
              color: "#1E261F",
              outline: "none",
              background: "#FAF8F5",
            }}
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCatId}
          onChange={(e) => setSelectedCatId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tất cả nhóm BTP</option>
          {formattedCategoryOptions.map((opt) => (
            <option key={opt.id} value={opt.id} style={{ fontWeight: opt.isChild ? 400 : 700 }}>
              {opt.name}
            </option>
          ))}
        </select>

        {/* Manage Categories Button */}
        <button
          onClick={() => setShowCatModal(true)}
          title="Quản lý danh mục bán thành phẩm"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #DFD9CE",
            background: "#FAF8F5",
            color: "#2D3E2F",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Tags size={14} /> Danh mục
        </button>

        {/* View Mode Toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "#EAE5DC",
            padding: 2,
            borderRadius: 8,
            border: "1px solid #DFD9CE",
          }}
        >
          <button
            onClick={() => handleSetViewMode("grid")}
            title="Chế độ Thẻ (Laptop)"
            style={{
              padding: "6px 9px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "grid" ? "#FFFFFF" : "transparent",
              color: viewMode === "grid" ? "#2D3E2F" : "#5A685B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => handleSetViewMode("table")}
            title="Chế độ Bảng Dòng"
            style={{
              padding: "6px 9px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "table" ? "#FFFFFF" : "transparent",
              color: viewMode === "table" ? "#2D3E2F" : "#5A685B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <List size={14} />
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={loadData}
          title="Tải lại dữ liệu"
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #DFD9CE",
            background: "#FAF8F5",
            color: "#5A685B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RotateCw size={14} />
        </button>

        {/* Primary CTA */}
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
            marginLeft: "auto",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={15} /> Thêm bán thành phẩm
        </button>
      </div>

      {/* Content: Grid vs Table */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #E8E3DA",
            color: "#607062",
          }}
        >
          Đang tải dữ liệu bán thành phẩm...
        </div>
      ) : errorMsg ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #FECACA",
            color: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} /> {errorMsg}
        </div>
      ) : semiItems.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px dashed #DFD9CE",
            color: "#607062",
          }}
        >
          Chưa có bán thành phẩm nào khớp bộ lọc.
        </div>
      ) : viewMode === "grid" ? (
        /* MODE 1: Card Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {semiItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E8E3DA",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 2px 6px rgba(45, 62, 47, 0.04)",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#2D3E2F";
                e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(45, 62, 47, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E8E3DA";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(45, 62, 47, 0.04)";
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1E261F" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#8A968B", marginTop: 2, fontFamily: "monospace" }}>
                      {item.code || `SEMI-${item.id}`}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      background: "#F8EFE7",
                      color: "#8C4B1E",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {item.categoryName || "Chưa phân loại"}
                  </span>
                </div>

                {/* Metrics */}
                <div
                  style={{
                    marginTop: 14,
                    background: "#FAF8F5",
                    border: "1px solid #DFD9CE",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6A7B6D", textTransform: "uppercase" }}>
                      ĐƠN GIÁ VỐN (COGS)
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}>
                      {item.costPerUnit > 0 ? `${item.costPerUnit.toLocaleString("vi-VN")} đ/${item.unit}` : "Chưa tính"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6A7B6D", textTransform: "uppercase" }}>
                      SẢN LƯỢNG 1 MẺ
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E261F", fontVariantNumeric: "tabular-nums" }}>
                      {item.batchYield.toLocaleString("vi-VN")} {item.unit}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-BOM button & Actions Footer */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: "1px solid #F0ECE4",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setRecipeModalItem(item)}
                  style={{
                    border: item.hasRecipe ? "1px solid #235E2D" : "1px dashed #92400E",
                    background: item.hasRecipe ? "#EBF4ED" : "#FAF4EE",
                    color: item.hasRecipe ? "#235E2D" : "#92400E",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FlaskConical size={12} />
                  {item.hasRecipe ? `Công thức (${item.recipeItemCount} NVL)` : "+ Khai báo BOM"}
                </button>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={(e) => openEditModal(item, e)}
                    title="Chỉnh sửa thông tin BTP"
                    style={cardActionBtnStyle}
                  >
                    <Edit2 size={13} color="#2D3E2F" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item, e)}
                    title="Xóa BTP"
                    style={{ ...cardActionBtnStyle, color: "#DC2626" }}
                  >
                    <Trash2 size={13} color="#DC2626" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* MODE 2: Table Row */
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8E3DA",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8F6F1", borderBottom: "1px solid #E8E3DA" }}>
                <th style={thStyle}>Tên & Mã Bán Thành Phẩm</th>
                <th style={thStyle}>Nhóm Phân Loại</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sản Lượng 1 Mẻ</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Đơn Giá Vốn (COGS)</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Công Thức Sơ Chế</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {semiItems.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid #F0ECE4", transition: "background 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: "#1E261F" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#8A968B", marginTop: 2, fontFamily: "monospace" }}>
                      {item.code || `SEMI-${item.id}`}
                    </div>
                  </td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11.5,
                        background: "#F8EFE7",
                        color: "#8C4B1E",
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      {item.categoryName || "Chưa phân loại"}
                    </span>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1E261F" }}>
                    {item.batchYield.toLocaleString("vi-VN")} {item.unit}
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#2D3E2F" }}>
                    {item.costPerUnit > 0 ? `${item.costPerUnit.toLocaleString("vi-VN")} đ/${item.unit}` : "Chưa tính"}
                  </td>

                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => setRecipeModalItem(item)}
                      style={{
                        border: item.hasRecipe ? "1px solid #235E2D" : "1px dashed #92400E",
                        background: item.hasRecipe ? "#EBF4ED" : "#FAF4EE",
                        color: item.hasRecipe ? "#235E2D" : "#92400E",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FlaskConical size={12} />
                      {item.hasRecipe ? `Công thức (${item.recipeItemCount} NVL)` : "+ Khai báo BOM"}
                    </button>
                  </td>

                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      <button
                        onClick={(e) => openEditModal(item, e)}
                        title="Sửa"
                        style={cardActionBtnStyle}
                      >
                        <Edit2 size={13} color="#2D3E2F" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item, e)}
                        title="Xóa"
                        style={{ ...cardActionBtnStyle, color: "#DC2626" }}
                      >
                        <Trash2 size={13} color="#DC2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Semi-Finished Create / Edit Modal */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E8E3DA",
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 16px 40px -8px rgba(45, 62, 47, 0.20)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E261F" }}>
                {editingItem ? "Chỉnh sửa bán thành phẩm" : "Thêm bán thành phẩm sơ chế"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5A685B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Tên bán thành phẩm *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Cốt cà phê phin, Nước đường nấu, Sốt cheese..."
                  style={formInputStyle}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Mã quản lý</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="SEMI-001"
                    style={formInputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Danh mục BTP</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={formInputStyle}
                  >
                    <option value="">(Chưa phân loại)</option>
                    {formattedCategoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id} style={{ fontWeight: opt.isChild ? 400 : 700 }}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Đơn vị tính *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    style={formInputStyle}
                  >
                    <option value="ml">ml (Mililit)</option>
                    <option value="g">g (Gram)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="lon">Lon</option>
                    <option value="chai">Chai</option>
                    <option value="hop">Hộp</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Sản lượng 1 mẻ chuẩn *</label>
                  <input
                    type="number"
                    value={batchYield}
                    onChange={(e) => setBatchYield(e.target.value)}
                    style={formInputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Tồn tối thiểu</label>
                  <input
                    type="number"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    style={formInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid #DFD9CE",
                    background: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#5A685B",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2D3E2F",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Đang lưu..." : editingItem ? "Cập nhật" : "Tạo bán thành phẩm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-BOM Recipe Modal */}
      <SemiFinishedRecipeModal
        semiItem={recipeModalItem}
        isOpen={!!recipeModalItem}
        onClose={() => setRecipeModalItem(null)}
        rawIngredients={rawIngredients}
        onSaved={loadData}
      />

      {/* Scoped Hierarchical Category Management Modal */}
      <CategoryManageModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        scope="semi_finished"
        categories={categories}
        onRefresh={loadData}
      />
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E3DA",
  borderRadius: 12,
  padding: "12px 14px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "#6A7B6D",
  letterSpacing: "0.3px",
  textTransform: "uppercase",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#1E261F",
  marginTop: 3,
  fontVariantNumeric: "tabular-nums",
};

const kpiUnitStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#8A968B",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #DFD9CE",
  fontSize: 13,
  color: "#1E261F",
  background: "#FAF8F5",
  outline: "none",
  cursor: "pointer",
  minWidth: 170,
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 11.5,
  color: "#4A5D4D",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  verticalAlign: "middle",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  verticalAlign: "middle",
};

const cardActionBtnStyle: React.CSSProperties = {
  border: "1px solid #DFD9CE",
  background: "#FAF8F5",
  borderRadius: 6,
  padding: "5px 7px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  color: "#4A5D4D",
  marginBottom: 4,
};

const formInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #DFD9CE",
  fontSize: 13,
  color: "#1E261F",
  background: "#FAF8F5",
  outline: "none",
};
