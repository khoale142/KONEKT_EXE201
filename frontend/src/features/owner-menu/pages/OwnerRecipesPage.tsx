import { useEffect, useState, useMemo } from "react";
import {
  Search,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
} from "lucide-react";
import {
  CategoryItem,
  IngredientItem,
  ProductItem,
  ownerMenuApi,
} from "../api/ownerMenu.api";
import ProductFormModal from "../components/ProductFormModal";

export default function OwnerRecipesPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [keyword, setKeyword] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [recipeFilter, setRecipeFilter] = useState<
    "all" | "has_recipe" | "no_recipe"
  >("all");

  // Accordion state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null
  );
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<"info" | "recipe">(
    "info"
  );

  // Add ingredient modal
  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [ingName, setIngName] = useState("");
  const [ingCode, setIngCode] = useState("");
  const [ingUnit, setIngUnit] = useState("g");
  const [ingCost, setIngCost] = useState("200");
  const [submittingIng, setSubmittingIng] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const [prodsData, catsData, ingsData] = await Promise.all([
        ownerMenuApi.listProducts({ keyword: keyword.trim() || undefined }),
        ownerMenuApi.listCategories(),
        ownerMenuApi.listIngredients(),
      ]);

      const detailedProds = await Promise.all(
        prodsData.map(async (p) => {
          try {
            return await ownerMenuApi.getProductDetail(p.id);
          } catch {
            return p;
          }
        })
      );

      setProducts(detailedProds);
      setCategories(catsData);
      setIngredients(ingsData);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message || "Không thể tải danh sách công thức"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openEditProduct(p: ProductItem, tab: "info" | "recipe") {
    setSelectedProduct(p);
    setModalInitialTab(tab);
    setShowProductModal(true);
  }

  async function handleAddIngredient(e: React.FormEvent) {
    e.preventDefault();
    if (!ingName.trim() || !ingUnit.trim()) return;
    setSubmittingIng(true);
    try {
      await ownerMenuApi.createIngredient({
        name: ingName.trim(),
        code: ingCode.trim() || undefined,
        unit: ingUnit.trim(),
        costPerUnit: Number(ingCost) || 0,
      });
      setShowAddIngModal(false);
      setIngName("");
      setIngCode("");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Lỗi tạo nguyên vật liệu");
    } finally {
      setSubmittingIng(false);
    }
  }

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesKeyword =
        p.name.toLowerCase().includes(keyword.toLowerCase()) ||
        (p.categoryName &&
          p.categoryName.toLowerCase().includes(keyword.toLowerCase()));

      const matchesCategory =
        !selectedCatId || String(p.categoryId) === String(selectedCatId);

      const hasRecipe = !!(p.recipes && p.recipes.length > 0);
      const matchesRecipeFilter =
        recipeFilter === "all" ||
        (recipeFilter === "has_recipe" && hasRecipe) ||
        (recipeFilter === "no_recipe" && !hasRecipe);

      return matchesKeyword && matchesCategory && matchesRecipeFilter;
    });
  }, [products, keyword, selectedCatId, recipeFilter]);

  const countWithRecipe = useMemo(
    () => products.filter((p) => p.recipes && p.recipes.length > 0).length,
    [products]
  );
  const countWithoutRecipe = products.length - countWithRecipe;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Stats - Clean Minimalist (No colorful icon blobs) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div style={statCardStyle}>
          <div style={kpiLabelStyle}>TỔNG SỐ MÓN</div>
          <div style={kpiValueStyle}>
            {products.length} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={kpiLabelStyle}>ĐÃ CÓ ĐỊNH LƯỢNG (BOM)</div>
          <div style={kpiValueStyle}>
            {countWithRecipe} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={kpiLabelStyle}>CHƯA KHAI BÁO CÔNG THỨC</div>
          <div style={kpiValueStyle}>
            {countWithoutRecipe} <span style={kpiUnitStyle}>món</span>
          </div>
        </div>
      </div>

      {/* Single Consolidated Toolbar (Search + Category + Status + CTA) */}
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
        {/* Search Box */}
        <div
          style={{
            position: "relative",
            flex: "1 1 240px",
            minWidth: 200,
          }}
        >
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
            placeholder="Tìm kiếm món hoặc danh mục..."
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

        {/* Category Dropdown */}
        <select
          value={selectedCatId}
          onChange={(e) => setSelectedCatId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #DFD9CE",
            fontSize: 13,
            color: "#1E261F",
            background: "#FAF8F5",
            outline: "none",
            cursor: "pointer",
            minWidth: 150,
          }}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status Filter Segment */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#EAE5DC",
            padding: 3,
            borderRadius: 8,
            border: "1px solid #DFD9CE",
          }}
        >
          <button
            onClick={() => setRecipeFilter("all")}
            style={getPillStyle(recipeFilter === "all")}
          >
            Tất cả ({products.length})
          </button>
          <button
            onClick={() => setRecipeFilter("has_recipe")}
            style={getPillStyle(recipeFilter === "has_recipe")}
          >
            Đã có BOM ({countWithRecipe})
          </button>
          <button
            onClick={() => setRecipeFilter("no_recipe")}
            style={getPillStyle(recipeFilter === "no_recipe")}
          >
            Chưa có BOM ({countWithoutRecipe})
          </button>
        </div>

        {/* Add ingredient CTA */}
        <button
          onClick={() => setShowAddIngModal(true)}
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
          <Plus size={15} /> Thêm NVL kho
        </button>
      </div>

      {/* Recipe Cards List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "#607062" }}>
          Đang tải danh sách công thức định lượng...
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
      ) : filteredProducts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 16px",
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px dashed #DFD9CE",
            color: "#607062",
          }}
        >
          Không tìm thấy món nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredProducts.map((p) => {
            const hasRecipe = !!(p.recipes && p.recipes.length > 0);
            const isExpanded = expandedIds.has(p.id);
            const variantCount = p.variants?.length || 0;

            return (
              <div
                key={p.id}
                style={{
                  background: "#FFFFFF",
                  border: isExpanded ? "1px solid #2D3E2F" : "1px solid #E8E3DA",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: isExpanded
                    ? "0 4px 14px rgba(45, 62, 47, 0.06)"
                    : "0 1px 3px rgba(0,0,0,0.02)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Product Header Row - NO placeholder coffee icon! Straight vertical alignment */}
                <div
                  style={{
                    padding: "12px 18px",
                    background: isExpanded ? "#FAF8F5" : "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  {/* Left: Direct Text Info */}
                  <div style={{ minWidth: 260, flex: "1 1 300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1E261F" }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          background: "#F2EFE9",
                          color: "#4A5D4D",
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        {p.categoryName || "Đồ uống"}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 500,
                          background: p.isAvailable ? "#EBF4ED" : "#F2EFEA",
                          color: p.isAvailable ? "#235E2D" : "#736E66",
                        }}
                      >
                        {p.isAvailable ? "Đang bán" : "Tạm ngưng"}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#607062", marginTop: 3 }}>
                      Giá:{" "}
                      <strong style={{ color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}>
                        {p.basePrice.toLocaleString("vi-VN")} đ
                      </strong>{" "}
                      ·{" "}
                      {variantCount > 0
                        ? `${variantCount} Kích cỡ (${p.variants.map((v) => v.name).join(", ")})`
                        : "1 Kích cỡ (Tiêu chuẩn)"}
                    </div>
                  </div>

                  {/* Right: Metrics + Compact Actions (NO 3 giant buttons in a row!) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    {/* Food Cost - CANH PHẢI & TABULAR NUMS */}
                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      <div style={{ fontSize: 10, color: "#6A7B6D", fontWeight: 700, letterSpacing: "0.3px" }}>
                        FOOD COST
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: hasRecipe && p.estimatedCostPrice > 0 ? "#1E261F" : "#9CA3AF",
                          fontVariantNumeric: "tabular-nums",
                          marginTop: 1,
                        }}
                      >
                        {hasRecipe && p.estimatedCostPrice > 0
                          ? `${p.estimatedCostPrice.toLocaleString("vi-VN")} đ`
                          : "Chưa tính"}
                      </div>
                    </div>

                    {/* Margin % - CANH PHẢI & TABULAR NUMS */}
                    <div style={{ textAlign: "right", minWidth: 60 }}>
                      <div style={{ fontSize: 10, color: "#6A7B6D", fontWeight: 700, letterSpacing: "0.3px" }}>
                        MARGIN
                      </div>
                      <div style={{ marginTop: 1 }}>
                        {hasRecipe && p.estimatedCostPrice > 0 && p.marginPercent > 0 ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: p.marginPercent >= 60 ? "#EBF4ED" : "#FBF2E3",
                              color: p.marginPercent >= 60 ? "#235E2D" : "#92400E",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {p.marginPercent}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
                        )}
                      </div>
                    </div>

                    {/* Primary Compact Toggle / CTA */}
                    {hasRecipe ? (
                      <button
                        onClick={() => toggleExpand(p.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: isExpanded ? "1px solid #2D3E2F" : "1px solid #DFD9CE",
                          background: isExpanded ? "#EBF4ED" : "#FFFFFF",
                          color: "#2D3E2F",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>{isExpanded ? "Thu gọn" : `Xem công thức (${p.recipes?.length || 0})`}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    ) : (
                      <button
                        onClick={() => openEditProduct(p, "recipe")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px dashed #235E2D",
                          background: "#EBF4ED",
                          color: "#235E2D",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Plus size={13} /> Khai báo BOM
                      </button>
                    )}

                    {/* Compact Edit Ghost Button */}
                    <button
                      onClick={() => openEditProduct(p, "recipe")}
                      title="Chỉnh sửa công thức & thông tin"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: "1px solid #DFD9CE",
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#2D3E2F",
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>

                {/* Recipe Ingredients Details (when isExpanded is true) */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "14px 18px",
                      background: "#FAF8F5",
                      borderTop: "1px solid #E8E3DA",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2D3E2F" }}>
                        Bảng định lượng nguyên vật liệu theo từng Size:
                      </div>
                      <button
                        onClick={() => openEditProduct(p, "recipe")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#235E2D",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Chỉnh sửa bảng công thức này
                      </button>
                    </div>

                    {p.recipeMatrix && p.recipeMatrix.rows.length > 0 ? (
                      <div
                        style={{
                          overflowX: "auto",
                          background: "#FFFFFF",
                          border: "1px solid #E8E3DA",
                          borderRadius: 8,
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #E8E3DA", background: "#F8F6F1" }}>
                              <th style={{ ...thMiniStyle, minWidth: 180 }}>Nguyên vật liệu (Đơn vị)</th>
                              <th style={{ ...thMiniStyle, textAlign: "center", width: 70 }}>Hao hụt %</th>
                              {p.recipeMatrix.variants.map((v, vIdx) => (
                                <th key={vIdx} style={{ ...thMiniStyle, minWidth: 120, textAlign: "right" }}>
                                  <div style={{ fontWeight: 700, color: "#1E261F" }}>{v.variantName}</div>
                                  <div style={{ fontSize: 10.5, color: "#607062", fontVariantNumeric: "tabular-nums" }}>
                                    {v.finalPrice.toLocaleString("vi-VN")} đ
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {p.recipeMatrix.rows.map((row, rIdx) => (
                              <tr key={rIdx} style={{ borderBottom: "1px solid #F0ECE4" }}>
                                <td style={tdMiniStyle}>
                                  <div style={{ fontWeight: 600, color: "#1E261F" }}>
                                    {row.ingredientName}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: "#607062", fontVariantNumeric: "tabular-nums" }}>
                                    Giá: {row.costPerUnit.toLocaleString("vi-VN")} đ/{row.unit}
                                  </div>
                                </td>
                                <td style={{ ...tdMiniStyle, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                                  {row.wasteRatePercent || 0}%
                                </td>
                                {p.recipeMatrix!.variants.map((v, vIdx) => {
                                  const qty = row.quantities[v.variantId] || 0;
                                  const cost = row.costs[v.variantId] || 0;
                                  return (
                                    <td key={vIdx} style={{ ...tdMiniStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                      {qty > 0 ? (
                                        <div>
                                          <span style={{ fontWeight: 700, color: "#2D3E2F" }}>
                                            {qty} {row.unit}
                                          </span>
                                          <div style={{ fontSize: 10.5, color: "#607062" }}>
                                            ~{Math.round(cost).toLocaleString("vi-VN")} đ
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: "#D1D5DB" }}>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#F8F6F1", borderTop: "1px solid #E8E3DA", fontWeight: 700 }}>
                              <td style={tdMiniStyle} colSpan={2}>
                                Tổng Food Cost ước tính
                              </td>
                              {p.recipeMatrix.variants.map((v, vIdx) => (
                                <td key={vIdx} style={{ ...tdMiniStyle, textAlign: "right", color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}>
                                  {v.estimatedCostPrice.toLocaleString("vi-VN")} đ
                                  <div style={{ fontSize: 10.5, color: v.marginPercent >= 60 ? "#235E2D" : "#92400E" }}>
                                    Margin: {v.marginPercent}%
                                  </div>
                                </td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#607062" }}>
                        Chưa có dữ liệu ma trận định lượng cho món này.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Product & Recipe Matrix Form Modal */}
      {showProductModal && selectedProduct && (
        <ProductFormModal
          product={selectedProduct}
          categories={categories}
          ingredients={ingredients}
          initialTab={modalInitialTab}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={loadData}
        />
      )}

      {/* Modal Thêm nguyên liệu nhanh */}
      {showAddIngModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.40)",
            backdropFilter: "blur(2px)",
            zIndex: 1100,
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
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid #E8E3DA",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1E261F" }}>
                Thêm Nguyên Vật Liệu Mới
              </h3>
              <button
                onClick={() => setShowAddIngModal(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#8A968B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddIngredient} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Tên nguyên vật liệu *</label>
                <input
                  type="text"
                  required
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  placeholder="VD: Cà phê Arabica Cầu Đất"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Mã định danh</label>
                  <input
                    type="text"
                    value={ingCode}
                    onChange={(e) => setIngCode(e.target.value)}
                    placeholder="ING-CATIMOR"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Đơn vị tính *</label>
                  <select
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="g">Gam (g)</option>
                    <option value="ml">Mililit (ml)</option>
                    <option value="quả">Quả / Trái</option>
                    <option value="lon">Lon / Hộp</option>
                    <option value="gói">Gói</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Giá vốn ước tính (VNĐ / đơn vị) *</label>
                <input
                  type="number"
                  value={ingCost}
                  onChange={(e) => setIngCost(e.target.value)}
                  placeholder="250"
                  step="any"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowAddIngModal(false)}
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
                  disabled={submittingIng}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2D3E2F",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {submittingIng ? "Đang lưu..." : "Tạo nguyên liệu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    border: "none",
    background: active ? "#FFFFFF" : "transparent",
    color: active ? "#2D3E2F" : "#5A685B",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
    transition: "all 0.12s ease",
  };
}

const statCardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E3DA",
  borderRadius: 12,
  padding: "12px 16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#6A7B6D",
  letterSpacing: "0.4px",
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
  fontSize: 12,
  fontWeight: 500,
  color: "#7A8A7C",
};

const thMiniStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#4A5D4D",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const tdMiniStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12.5,
  verticalAlign: "middle",
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
