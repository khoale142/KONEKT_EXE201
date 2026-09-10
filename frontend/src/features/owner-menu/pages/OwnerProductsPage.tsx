import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  RotateCw,
  AlertCircle,
  LayoutGrid,
  List,
  Tags,
} from "lucide-react";
import {
  CategoryItem,
  IngredientItem,
  ProductItem,
  ownerMenuApi,
} from "../api/ownerMenu.api";
import ProductFormModal from "../components/ProductFormModal";
import CategoryManageModal from "../components/CategoryManageModal";

export default function OwnerProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // View Mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("konekt_product_view_mode") as "grid" | "table") || "grid";
  });

  function handleSetViewMode(mode: "grid" | "table") {
    setViewMode(mode);
    localStorage.setItem("konekt_product_view_mode", mode);
  }

  // Filters
  const [keyword, setKeyword] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const [prodsData, catsData, ingsData] = await Promise.all([
        ownerMenuApi.listProducts({
          categoryId: selectedCatId ? Number(selectedCatId) : undefined,
          isAvailable: selectedStatus !== "" ? selectedStatus === "true" : undefined,
          keyword: keyword.trim() || undefined,
        }),
        ownerMenuApi.listCategories({ scope: "product" }),
        ownerMenuApi.listIngredients(),
      ]);

      setProducts(prodsData);
      setCategories(catsData);
      setIngredients(ingsData);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Không thể tải danh sách món ăn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCatId, selectedStatus]);

  async function handleDelete(p: ProductItem) {
    try {
      await ownerMenuApi.deleteProduct(p.id);
      setProducts((prev) => prev.filter((item) => item.id !== p.id));
      setSuccessMsg(`Đã xóa món "${p.name}"`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa món ăn");
    }
  }

  function openCreateModal() {
    setEditingProduct(null);
    setShowProductModal(true);
  }

  function openEditModal(p: ProductItem) {
    setEditingProduct(p);
    setShowProductModal(true);
  }

  // Summary Metrics
  const kpis = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isAvailable).length;
    const withRecipe = products.filter((p) => p.recipeItemCount > 0).length;
    const margins = products.map((p) => p.marginPercent).filter((m) => m > 0);
    const avgMargin =
      margins.length > 0
        ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
        : 0;

    return { total, active, withRecipe, avgMargin };
  }, [products]);

  // Hierarchical categories formatted for dropdown
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

  // Group products into Category Sections
  const categorySections = useMemo(() => {
    const map = new Map<number | string, { id: number | string; name: string; products: ProductItem[] }>();

    for (const p of products) {
      const catId = p.categoryId ?? "uncategorized";
      const catName = p.categoryName || "Chưa phân loại";
      const fullName = p.categoryParentName ? `${p.categoryParentName} › ${catName}` : catName;
      if (!map.has(catId)) {
        map.set(catId, {
          id: catId,
          name: fullName,
          products: [],
        });
      }
      map.get(catId)!.products.push(p);
    }

    return Array.from(map.values());
  }, [products]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards - Clean Minimalist */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>TỔNG SẢN PHẨM</div>
          <div style={kpiValueStyle}>
            {kpis.total} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>ĐANG MỞ BÁN</div>
          <div style={kpiValueStyle}>
            {kpis.active} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>ĐÃ CÓ ĐỊNH LƯỢNG</div>
          <div style={kpiValueStyle}>
            {kpis.withRecipe}/{kpis.total} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>BIÊN LỢI NHUẬN TB</div>
          <div style={kpiValueStyle}>{kpis.avgMargin}%</div>
        </div>
      </div>

      {/* Single Consolidated Toolbar */}
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
        {/* Search box */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search
            size={15}
            color="#8A968B"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            placeholder="Tìm theo tên món (Enter)..."
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

        {/* Category filter with parent-child hierarchy */}
        <select
          value={selectedCatId}
          onChange={(e) => setSelectedCatId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tất cả danh mục</option>
          {formattedCategoryOptions.map((opt) => (
            <option key={opt.id} value={opt.id} style={{ fontWeight: opt.isChild ? 400 : 700 }}>
              {opt.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang mở bán</option>
          <option value="false">Tạm ngưng</option>
        </select>

        {/* Manage Categories Button */}
        <button
          onClick={() => setShowCatModal(true)}
          title="Quản lý phân cấp danh mục món"
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

        {/* View Mode Toggle: Grid vs Table */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "#EAE5DC",
            padding: 3,
            borderRadius: 8,
            gap: 2,
          }}
        >
          <button
            onClick={() => handleSetViewMode("grid")}
            title="Chế độ Thẻ (Grid)"
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "grid" ? "#FFFFFF" : "transparent",
              color: viewMode === "grid" ? "#2D3E2F" : "#7A8A7C",
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
            title="Chế độ Bảng dòng (Table)"
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "table" ? "#FFFFFF" : "transparent",
              color: viewMode === "table" ? "#2D3E2F" : "#7A8A7C",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <List size={14} />
          </button>
        </div>

        {/* Refresh button */}
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

        {/* Primary CTA: Thêm món mới */}
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
          <Plus size={15} /> Thêm món mới
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            background: "#EBF4ED",
            border: "1px solid #A7F3D0",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#065F46",
            fontWeight: 600,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Main Content: Category Sections in Grid vs Table */}
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
          Đang tải dữ liệu thực đơn món bán...
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
      ) : products.length === 0 ? (
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
          Không tìm thấy món ăn nào phù hợp với bộ lọc.
        </div>
      ) : viewMode === "grid" ? (
        /* MODE 1: Category Sections Grid View (No category tags on cards, click card to edit directly) */
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {categorySections.map((section) => (
            <div key={section.id}>
              {/* Category Section Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 6,
                  borderBottom: "1px solid #EAE5DC",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#1E261F",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {section.name}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    color: "#7A8A7C",
                    fontWeight: 600,
                    background: "#EAE5DC",
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {section.products.length} món
                </span>
              </div>

              {/* Compact Product Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 14,
                }}
              >
                {section.products.map((p) => {
                  const costPercent =
                    p.basePrice > 0 && p.estimatedCostPrice > 0
                      ? Math.round((p.estimatedCostPrice / p.basePrice) * 100)
                      : null;

                  return (
                    <div
                      key={p.id}
                      onClick={() => openEditModal(p)}
                      title="Nhấn để xem & chỉnh sửa món"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E8E3DA",
                        borderRadius: 13,
                        overflow: "hidden",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 2px 5px rgba(45, 62, 47, 0.04)",
                        transition: "all 0.16s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2D3E2F";
                        e.currentTarget.style.boxShadow = "0 6px 16px -2px rgba(45, 62, 47, 0.12)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E8E3DA";
                        e.currentTarget.style.boxShadow = "0 2px 5px rgba(45, 62, 47, 0.04)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {/* Compact Image + Floating Status Badge */}
                      <div style={{ position: "relative", width: "100%", height: 115, background: "#F5F2EC" }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80";
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#7A8A7C",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Chưa có ảnh
                          </div>
                        )}

                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 5,
                            background: p.isAvailable ? "rgba(235, 244, 237, 0.94)" : "rgba(242, 239, 234, 0.94)",
                            color: p.isAvailable ? "#235E2D" : "#736E66",
                            backdropFilter: "blur(4px)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
                          }}
                        >
                          {p.isAvailable ? "Đang bán" : "Tạm ngưng"}
                        </span>
                      </div>

                      {/* Card Content: Title + Price & % Vốn (NO buttons, NO category tag) */}
                      <div
                        style={{
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          flex: 1,
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1E261F", lineHeight: 1.3 }}>
                          {p.name}
                        </div>

                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: "#2D3E2F",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {p.basePrice.toLocaleString("vi-VN")} đ
                          </div>

                          <div>
                            {costPercent !== null ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background:
                                    costPercent <= 30
                                      ? "#EBF4ED"
                                      : costPercent <= 35
                                      ? "#FEF3C7"
                                      : "#FEE2E2",
                                  color:
                                    costPercent <= 30
                                      ? "#235E2D"
                                      : costPercent <= 35
                                      ? "#92400E"
                                      : "#B91C1C",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {costPercent}% Vốn
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Chưa định lượng</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* MODE 2: Minimalist Table View (Click row directly to edit) */
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
                <th style={thStyle}>Món & Hình ảnh</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Giá cơ bản</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Vốn</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const costPercent =
                  p.basePrice > 0 && p.estimatedCostPrice > 0
                    ? Math.round((p.estimatedCostPrice / p.basePrice) * 100)
                    : null;

                return (
                  <tr
                    key={p.id}
                    onClick={() => openEditModal(p)}
                    title="Nhấn để xem & chỉnh sửa món"
                    style={{
                      borderBottom: "1px solid #F0ECE4",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Thumbnail + Name & Category */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 8,
                              objectFit: "cover",
                              flexShrink: 0,
                              border: "1px solid #E8E3DA",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80";
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 8,
                              background: "#EAE5DC",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              color: "#607062",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            Ảnh
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: "#1E261F", fontSize: 13.5 }}>
                            {p.name}
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11.5, color: "#7A8A7C" }}>
                            {p.categoryParentName ? `${p.categoryParentName} › ` : ""}
                            {p.categoryName || "Chưa phân loại"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Base price */}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 700,
                        color: "#2D3E2F",
                        fontSize: 14,
                      }}
                    >
                      {p.basePrice.toLocaleString("vi-VN")} đ
                    </td>

                    {/* % Vốn */}
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {costPercent !== null ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 5,
                            background:
                              costPercent <= 30
                                ? "#EBF4ED"
                                : costPercent <= 35
                                ? "#FEF3C7"
                                : "#FEE2E2",
                            color:
                              costPercent <= 30
                                ? "#235E2D"
                                : costPercent <= 35
                                ? "#92400E"
                                : "#B91C1C",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {costPercent}%
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>Chưa định lượng</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: p.isAvailable ? "#EBF4ED" : "#F2EFEA",
                          color: p.isAvailable ? "#235E2D" : "#736E66",
                        }}
                      >
                        {p.isAvailable ? "Đang bán" : "Tạm ngưng"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* All-in-One Product Modal: View & Edit with Unified Matrix */}
      {showProductModal && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          ingredients={ingredients}
          onClose={() => setShowProductModal(false)}
          onSuccess={loadData}
          onDelete={handleDelete}
          onCategoryCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
        />
      )}

      {/* Category Manage Modal */}
      <CategoryManageModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        scope="product"
        categories={categories}
        onRefresh={loadData}
      />
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E3DA",
  borderRadius: 14,
  padding: "12px 16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#6A7B6D",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#1E261F",
  marginTop: 4,
  fontVariantNumeric: "tabular-nums",
};

const kpiUnitStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#7A8A7C",
  marginLeft: 3,
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
};

const thStyle: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "#5A685B",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  color: "#1E261F",
};
