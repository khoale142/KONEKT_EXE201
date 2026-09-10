import { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  CategoryItem,
  IngredientItem,
  ProductItem,
  ownerMenuApi,
} from "../api/ownerMenu.api";
import IngredientPickerModal from "./IngredientPickerModal";

interface ProductFormModalProps {
  product?: ProductItem | null;
  categories: CategoryItem[];
  ingredients: IngredientItem[];
  initialTab?: "info" | "recipe";
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: (product: ProductItem) => void;
  onCategoryCreated?: (newCategory: CategoryItem) => void;
}

interface MatrixIngredientRow {
  ingredientId: number;
  // Map of variant key (name or string id) -> quantity (number or empty string when user is typing)
  quantities: { [variantKey: string]: number | string };
  // For single-size mode:
  singleQuantity: number | string;
}

interface SizeColumn {
  id?: number;
  name: string;
  price: number;
  isDefault: boolean;
}

export default function ProductFormModal({
  product,
  categories,
  ingredients,
  onClose,
  onSuccess,
  onDelete,
  onCategoryCreated,
}: ProductFormModalProps) {
  const isEdit = !!product;
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Category List & Quick Creation
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(categories);
  const [showQuickCatInput, setShowQuickCatInput] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  // Sync if parent updates categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  async function handleQuickCreateCat() {
    if (!quickCatName.trim()) return;
    try {
      setIsCreatingCat(true);
      const created = await ownerMenuApi.createCategory({
        name: quickCatName.trim(),
        scope: "product",
      });
      setLocalCategories((prev) => [...prev, created]);
      setCategoryId(String(created.id));
      if (onCategoryCreated) {
        onCategoryCreated(created);
      }
      setQuickCatName("");
      setShowQuickCatInput(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể tạo danh mục món bán");
    } finally {
      setIsCreatingCat(false);
    }
  }

  // Modal Picker State
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Basic Info States
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId ? String(product.categoryId) : ""
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [description, setDescription] = useState(product?.description || "");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);

  // Mode: Multi-size vs Single-size
  const [hasMultipleSizes, setHasMultipleSizes] = useState<boolean>(() => {
    if (!product || !product.variants) return false;
    return product.variants.length > 1;
  });

  // Single-size Base Price
  const [singlePrice, setSinglePrice] = useState<string>(
    product?.basePrice ? String(product.basePrice) : "35000"
  );

  // Multi-size Columns State
  const [sizeColumns, setSizeColumns] = useState<SizeColumn[]>(() => {
    if (product?.variants && product.variants.length > 0) {
      const base = product.basePrice || 0;
      return product.variants.map((v, idx) => ({
        id: v.id,
        name: v.name,
        price: base + (v.priceAdjustment || 0),
        isDefault: idx === 0,
      }));
    }
    return [
      { name: "Size S", price: 29000, isDefault: true },
      { name: "Size M", price: 35000, isDefault: false },
      { name: "Size L", price: 40000, isDefault: false },
    ];
  });

  // Matrix Ingredient Rows State
  const [matrixRows, setMatrixRows] = useState<MatrixIngredientRow[]>(() => {
    if (!product || !product.recipes || product.recipes.length === 0) {
      return [];
    }

    const rowMap = new Map<number, MatrixIngredientRow>();
    const varMap = new Map(product.variants.map((v) => [v.id, v.name]));

    for (const r of product.recipes) {
      if (!rowMap.has(r.ingredientId)) {
        rowMap.set(r.ingredientId, {
          ingredientId: r.ingredientId,
          quantities: {},
          singleQuantity: r.quantity,
        });
      }
      const row = rowMap.get(r.ingredientId)!;
      const key = r.variantId
        ? String(r.variantId)
        : product.variants[0]?.id
        ? String(product.variants[0].id)
        : product.variants[0]?.name || "default";

      row.quantities[key] = r.quantity;
      if (r.variantId && varMap.has(r.variantId)) {
        row.quantities[varMap.get(r.variantId)!] = r.quantity;
      }
      row.singleQuantity = r.quantity;
    }

    return Array.from(rowMap.values());
  });

  // Multi-size Helpers
  function addSizeColumn() {
    const nextIdx = sizeColumns.length + 1;
    const prevPrice = sizeColumns[sizeColumns.length - 1]?.price || 35000;
    setSizeColumns((prev) => [
      ...prev,
      {
        name: `Size ${nextIdx}`,
        price: prevPrice + 5000,
        isDefault: false,
      },
    ]);
  }

  function removeSizeColumn(idx: number) {
    if (sizeColumns.length <= 1) return;
    const removed = sizeColumns[idx];
    const nextSizes = sizeColumns.filter((_, i) => i !== idx);
    if (removed.isDefault && nextSizes.length > 0) {
      nextSizes[0].isDefault = true;
    }
    setSizeColumns(nextSizes);
  }

  function updateSizeName(idx: number, name: string) {
    setSizeColumns((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, name } : s))
    );
  }

  function updateSizePrice(idx: number, priceStr: string) {
    const price = Number(priceStr) || 0;
    setSizeColumns((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, price } : s))
    );
  }

  // Ingredient Picker Confirm Handler
  const alreadySelectedIds = useMemo(
    () => matrixRows.map((r) => r.ingredientId),
    [matrixRows]
  );

  function handlePickerConfirm(selectedIngredients: IngredientItem[]) {
    const newRows: MatrixIngredientRow[] = selectedIngredients.map((ing) => {
      const initialQuantities: { [key: string]: number | string } = {};
      for (const sc of sizeColumns) {
        const key = sc.id ? String(sc.id) : sc.name;
        initialQuantities[key] = 0;
        initialQuantities[sc.name] = 0;
      }
      return {
        ingredientId: ing.id,
        quantities: initialQuantities,
        singleQuantity: 0,
      };
    });
    setMatrixRows((prev) => [...prev, ...newRows]);
  }

  function removeIngredientRow(idx: number) {
    setMatrixRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMatrixQuantity(rowIdx: number, sizeKey: string, val: string | number) {
    setMatrixRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        return {
          ...r,
          quantities: {
            ...r.quantities,
            [sizeKey]: val,
          },
        };
      })
    );
  }

  function updateSingleQuantity(rowIdx: number, val: string | number) {
    setMatrixRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, singleQuantity: val } : r))
    );
  }

  // Cost & Percentage Computations
  const singleCalculations = useMemo(() => {
    const price = Number(singlePrice) || 0;
    let cost = 0;
    for (const row of matrixRows) {
      const ing = ingredients.find((i) => i.id === row.ingredientId);
      if (ing) {
        const q = Number(row.singleQuantity) || 0;
        cost += (ing.costPerUnit || 0) * q;
      }
    }
    cost = Math.round(cost);
    const costPercent = price > 0 ? Math.round((cost / price) * 100) : 0;
    return { cost, costPercent };
  }, [singlePrice, matrixRows, ingredients]);

  const multiCalculations = useMemo(() => {
    return sizeColumns.map((sc) => {
      const key = sc.id ? String(sc.id) : sc.name;
      let cost = 0;
      for (const row of matrixRows) {
        const ing = ingredients.find((i) => i.id === row.ingredientId);
        if (ing) {
          const rawQ =
            row.quantities[key] ??
            row.quantities[sc.name] ??
            (sc.id ? row.quantities[String(sc.id)] : 0) ??
            0;
          const q = Number(rawQ) || 0;
          cost += (ing.costPerUnit || 0) * q;
        }
      }
      cost = Math.round(cost);
      const costPercent = sc.price > 0 ? Math.round((cost / sc.price) * 100) : 0;
      return {
        sizeName: sc.name,
        price: sc.price,
        cost,
        costPercent,
      };
    });
  }, [sizeColumns, matrixRows, ingredients]);

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Vui lòng nhập tên món ăn/đồ uống");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      let targetProductId = product?.id;
      let finalBasePrice = 0;
      let finalVariants: Array<{ id?: number; name: string; priceAdjustment: number; isAvailable: boolean }> = [];

      if (!hasMultipleSizes) {
        // Single size mode
        finalBasePrice = Number(singlePrice) || 0;
        finalVariants = [
          { name: "Size Tiêu chuẩn", priceAdjustment: 0, isAvailable: true },
        ];
      } else {
        // Multi-size mode (Base price is first size)
        finalBasePrice = sizeColumns[0]?.price || 0;
        finalVariants = sizeColumns.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          priceAdjustment: s.price - finalBasePrice,
          isAvailable: true,
        }));
      }

      if (isEdit && product) {
        const updated = await ownerMenuApi.updateProduct(product.id, {
          name: name.trim(),
          categoryId: categoryId ? Number(categoryId) : null,
          basePrice: finalBasePrice,
          imageUrl: imageUrl.trim() || undefined,
          description: description.trim() || undefined,
          isAvailable,
          variants: finalVariants,
        });
        targetProductId = updated.id;
      } else {
        const created = await ownerMenuApi.createProduct({
          name: name.trim(),
          categoryId: categoryId ? Number(categoryId) : null,
          basePrice: finalBasePrice,
          imageUrl: imageUrl.trim() || undefined,
          description: description.trim() || undefined,
          isAvailable,
          variants: finalVariants,
        });
        targetProductId = created.id;
      }

      // Sync Recipe Matrix to Backend
      const latestProd = await ownerMenuApi.getProductDetail(targetProductId!);
      const latestVariants = latestProd.variants;

      const flatRecipes: Array<{
        variantId: number;
        ingredientId: number;
        quantity: number;
        unit: string;
        wasteRatePercent: number;
      }> = [];

      for (const row of matrixRows) {
        const ing = ingredients.find((i) => i.id === row.ingredientId);
        if (!ing) continue;

        if (!hasMultipleSizes) {
          // Single size recipe
          const v0 = latestVariants[0];
          if (v0 && v0.id) {
            flatRecipes.push({
              variantId: v0.id,
              ingredientId: row.ingredientId,
              quantity: Number(row.singleQuantity) || 0,
              unit: ing.unit,
              wasteRatePercent: 0,
            });
          }
        } else {
          // Multi-size recipe
          for (let i = 0; i < latestVariants.length; i++) {
            const lv = latestVariants[i];
            const sc = sizeColumns[i];
            const scKey = sc ? (sc.id ? String(sc.id) : sc.name) : lv.name;

            const rawQ =
              row.quantities[scKey] ??
              row.quantities[lv.name] ??
              (lv.id ? row.quantities[String(lv.id)] : 0) ??
              0;
            const qty = Number(rawQ) || 0;

            if (lv.id && qty > 0) {
              flatRecipes.push({
                variantId: lv.id,
                ingredientId: row.ingredientId,
                quantity: qty,
                unit: ing.unit,
                wasteRatePercent: 0,
              });
            }
          }
        }
      }

      await ownerMenuApi.saveProductRecipes(targetProductId!, flatRecipes);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || "Lỗi lưu thông tin sản phẩm");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Handler
  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa món "${product.name}"?`)) return;

    setDeleting(true);
    try {
      if (onDelete) {
        onDelete(product);
      } else {
        await ownerMenuApi.deleteProduct(product.id);
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Lỗi xóa sản phẩm");
    } finally {
      setDeleting(false);
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
          width: "fit-content",
          minWidth: "min(1040px, 95vw)",
          maxWidth: "min(1280px, 96vw)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 48px -8px rgba(45, 62, 47, 0.22)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid #E8E3DA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FAF8F5",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17.5, fontWeight: 800, color: "#1E261F" }}>
              {isEdit ? `Chỉnh sửa: ${product.name}` : "Thêm món mới vào thực đơn"}
            </h2>
            <div style={{ fontSize: 12.5, color: "#607062", marginTop: 2 }}>
              {isEdit
                ? `#${product.id} • Cập nhật giá bán, kích cỡ và định lượng nguyên liệu`
                : "Thiết lập giá bán và định lượng công thức pha chế"}
            </div>
          </div>

          <button
            type="button"
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
            {errorMsg && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            {/* BLOCK 1: THÔNG TIN CƠ BẢN */}
            <div
              style={{
                background: "#FAF8F5",
                border: "1px solid #E8E3DA",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1E261F", marginBottom: 12 }}>
                1. Thông tin cơ bản
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr", gap: 14 }}>
                {/* Product Name */}
                <div>
                  <label style={labelStyle}>TÊN MÓN <span style={{ color: "#DC2626" }}>*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Cà phê sữa đá, Trà đào..."
                    style={inputStyle}
                    maxLength={60}
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={labelStyle}>DANH MỤC</label>
                    {!showQuickCatInput && (
                      <button
                        type="button"
                        onClick={() => setShowQuickCatInput(true)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#2D3E2F",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          padding: 0,
                        }}
                      >
                        <Plus size={12} /> Tạo nhanh
                      </button>
                    )}
                  </div>

                  {showQuickCatInput ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <input
                        type="text"
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickCreateCat();
                          }
                        }}
                        placeholder="Tên danh mục..."
                        autoFocus
                        style={{ ...inputStyle, flex: 1, padding: "5px 8px", fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={handleQuickCreateCat}
                        disabled={isCreatingCat || !quickCatName.trim()}
                        style={{
                          padding: "5px 8px",
                          borderRadius: 6,
                          background: "#2D3E2F",
                          color: "#FFFFFF",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isCreatingCat ? "..." : "Lưu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickCatInput(false);
                          setQuickCatName("");
                        }}
                        style={{
                          padding: "5px 7px",
                          borderRadius: 6,
                          background: "#F2F0EB",
                          color: "#607062",
                          border: "none",
                          fontSize: 11.5,
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Chưa phân loại --</option>
                      {localCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label style={labelStyle}>TRẠNG THÁI</label>
                  <select
                    value={isAvailable ? "true" : "false"}
                    onChange={(e) => setIsAvailable(e.target.value === "true")}
                    style={inputStyle}
                  >
                    <option value="true">Đang bán</option>
                    <option value="false">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              {/* Image URL & Preview */}
              <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>HÌNH ẢNH MÓN (LINK URL)</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    style={inputStyle}
                  />
                </div>

                {/* Image Preview Box */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      objectFit: "cover",
                      border: "1px solid #DFD9CE",
                      marginTop: 14,
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: "#EAE5DC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#7A8A7C",
                      fontWeight: 600,
                      marginTop: 14,
                      flexShrink: 0,
                    }}
                  >
                    Ảnh
                  </div>
                )}
              </div>

              {/* Description */}
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>MÔ TẢ NGẮN</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả hương vị, thành phần đặc trưng của món..."
                  style={inputStyle}
                  maxLength={120}
                />
              </div>

              {/* Toggle Multi-size */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px dashed #DFD9CE",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <input
                  type="checkbox"
                  id="toggle-multi-size"
                  checked={hasMultipleSizes}
                  onChange={(e) => setHasMultipleSizes(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#2D3E2F", cursor: "pointer" }}
                />
                <label
                  htmlFor="toggle-multi-size"
                  style={{ fontSize: 13.5, fontWeight: 700, color: "#1E261F", cursor: "pointer" }}
                >
                  Bán theo nhiều kích cỡ (Size S, M, L...)
                </label>
                <span style={{ fontSize: 12, color: "#7A8A7C" }}>
                  (Bật để thiết lập giá bán và định lượng riêng cho từng size)
                </span>
              </div>
            </div>

            {/* BLOCK 2: CÔNG THỨC & GIÁ BÁN */}
            <div
              style={{
                background: "#FAF8F5",
                border: "1px solid #E8E3DA",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1E261F" }}>
                    2. Giá bán & Định lượng nguyên liệu
                  </div>
                  <div style={{ fontSize: 12, color: "#607062", marginTop: 2 }}>
                    {hasMultipleSizes
                      ? "Bảng ma trận: Nhập giá bán và định lượng nguyên liệu cho từng kích cỡ"
                      : "Nhập giá bán món và định lượng các nguyên vật liệu pha chế"}
                  </div>
                </div>

                {hasMultipleSizes && (
                  <button
                    type="button"
                    onClick={addSizeColumn}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #2D3E2F",
                      background: "#FFFFFF",
                      color: "#2D3E2F",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <Plus size={13} /> Thêm Size
                  </button>
                )}
              </div>

              {/* CASE A: SINGLE-SIZE MODE */}
              {!hasMultipleSizes ? (
                <div>
                  {/* Single Price Input */}
                  <div style={{ maxWidth: 260, marginBottom: 14 }}>
                    <label style={labelStyle}>GIÁ BÁN (ĐỒNG) <span style={{ color: "#DC2626" }}>*</span></label>
                    <input
                      type="number"
                      value={singlePrice}
                      onChange={(e) => setSinglePrice(e.target.value)}
                      placeholder="VD: 35000"
                      style={{ ...inputStyle, fontWeight: 800, fontSize: 15, color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}
                      required
                    />
                  </div>

                  {/* Single Recipe Table */}
                  <div style={{ border: "1px solid #E8E3DA", borderRadius: 10, overflow: "hidden", background: "#FFFFFF" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#F4F0E8", borderBottom: "1px solid #E8E3DA", color: "#4A5D4D" }}>
                          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700 }}>Nguyên liệu</th>
                          <th style={{ padding: "10px 14px", textAlign: "center", width: 170, fontWeight: 700 }}>Định lượng</th>
                          <th style={{ padding: "10px 14px", textAlign: "center", width: 48 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ padding: 22, textAlign: "center", color: "#8A968B" }}>
                              Chưa có nguyên liệu nào. Bấm nút <b>"+ Thêm nguyên liệu"</b> bên dưới để chọn vật tư từ kho.
                            </td>
                          </tr>
                        ) : (
                          matrixRows.map((r, rIdx) => {
                            const ing = ingredients.find((i) => i.id === r.ingredientId);
                            const singleVal = r.singleQuantity;

                            return (
                              <tr key={rIdx} style={{ borderBottom: "1px solid #F0ECE4" }}>
                                {/* Clean single-line Ingredient name with tooltip & ellipsis */}
                                <td style={{ padding: "10px 14px", maxWidth: 360 }}>
                                  <div
                                    title={ing?.name || ""}
                                    style={{
                                      fontWeight: 700,
                                      color: "#1E261F",
                                      fontSize: 13.5,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {ing?.name || "Nguyên liệu không xác định"}
                                    </span>
                                    {ing?.itemType === "semi_finished" && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: "1px 5px",
                                          borderRadius: 4,
                                          background: "#FEF3C7",
                                          color: "#92400E",
                                          flexShrink: 0,
                                        }}
                                      >
                                        BTP
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Quantity with centered text & auto 0-clearing */}
                                <td style={{ padding: "8px 14px", textAlign: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                    <input
                                      type="number"
                                      step="any"
                                      value={singleVal === undefined ? "" : singleVal}
                                      onFocus={(e) => {
                                        if (e.target.value === "0" || e.target.value === "") {
                                          updateSingleQuantity(rIdx, "");
                                        }
                                        e.target.select();
                                      }}
                                      onChange={(e) => updateSingleQuantity(rIdx, e.target.value)}
                                      onBlur={() => {
                                        if (String(r.singleQuantity).trim() === "") {
                                          updateSingleQuantity(rIdx, 0);
                                        }
                                      }}
                                      placeholder="0"
                                      style={{
                                        ...inputStyle,
                                        textAlign: "center",
                                        padding: "5px 8px",
                                        fontWeight: 700,
                                        width: 76,
                                        fontVariantNumeric: "tabular-nums",
                                      }}
                                    />
                                    <span style={{ fontSize: 12, color: "#607062", fontWeight: 600, minWidth: 24, textAlign: "left" }}>
                                      {ing?.unit || ""}
                                    </span>
                                  </div>
                                </td>

                                <td style={{ padding: "8px 14px", textAlign: "center" }}>
                                  <button
                                    type="button"
                                    onClick={() => removeIngredientRow(rIdx)}
                                    title="Xóa nguyên liệu"
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#DC2626" }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Ingredient & Cost Summary */}
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setShowPickerModal(true)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "1px solid #DFD9CE",
                        background: "#FFFFFF",
                        color: "#2D3E2F",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Plus size={14} /> Thêm nguyên liệu
                    </button>

                    <div style={{ fontSize: 13.5, color: "#1E261F", fontWeight: 700 }}>
                      Giá vốn:{" "}
                      <span style={{ color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}>
                        {singleCalculations.cost.toLocaleString("vi-VN")} đ
                      </span>{" "}
                      • Tỷ lệ vốn:{" "}
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          background:
                            singleCalculations.costPercent <= 30
                              ? "#EBF4ED"
                              : singleCalculations.costPercent <= 35
                              ? "#FEF3C7"
                              : "#FEE2E2",
                          color:
                            singleCalculations.costPercent <= 30
                              ? "#235E2D"
                              : singleCalculations.costPercent <= 35
                              ? "#92400E"
                              : "#B91C1C",
                          fontWeight: 800,
                        }}
                      >
                        {singleCalculations.costPercent}% Vốn
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASE B: MULTI-SIZE MATRIX TABLE (IMAGE 2) */
                <div>
                  <div
                    style={{
                      border: "1px solid #E8E3DA",
                      borderRadius: 10,
                      overflowX: "auto",
                      background: "#FFFFFF",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      {/* Matrix Header: Sizes & Prices (Without star ⭐) */}
                      <thead>
                        <tr style={{ background: "#F4F0E8", borderBottom: "2px solid #DFD9CE" }}>
                          <th style={{ padding: "10px 14px", textAlign: "left", minWidth: 260, maxWidth: 360, verticalAlign: "bottom" }}>
                            <span style={{ fontSize: 11, color: "#7A8A7C", textTransform: "uppercase", fontWeight: 700 }}>
                              NGUYÊN LIỆU \ KÍCH CỠ
                            </span>
                          </th>

                          {sizeColumns.map((sc, idx) => {
                            return (
                              <th
                                key={idx}
                                style={{
                                  padding: "8px 8px",
                                  textAlign: "center",
                                  minWidth: 130,
                                  background: "#F4F0E8",
                                  borderLeft: "1px solid #DFD9CE",
                                }}
                              >
                                {/* Size Box Header: Name + Price + Delete corner button */}
                                <div
                                  style={{
                                    border: "1px solid #DFD9CE",
                                    background: "#FFFFFF",
                                    borderRadius: 8,
                                    padding: "6px 8px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                    position: "relative",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                  }}
                                >
                                  {/* Delete size (✕) corner button */}
                                  {sizeColumns.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeSizeColumn(idx)}
                                      title="Xóa kích cỡ này"
                                      style={{
                                        position: "absolute",
                                        top: 3,
                                        right: 4,
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        color: "#DC2626",
                                        padding: 0,
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        lineHeight: 1,
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}

                                  {/* Size Name Input */}
                                  <input
                                    type="text"
                                    value={sc.name}
                                    onChange={(e) => updateSizeName(idx, e.target.value)}
                                    placeholder="Tên size"
                                    maxLength={20}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      textAlign: "center",
                                      fontWeight: 800,
                                      fontSize: 13,
                                      color: "#1E261F",
                                      outline: "none",
                                      background: "transparent",
                                      paddingRight: sizeColumns.length > 1 ? 14 : 0,
                                    }}
                                  />

                                  {/* Size Actual Price Input */}
                                  <input
                                    type="number"
                                    value={sc.price}
                                    onChange={(e) => updateSizePrice(idx, e.target.value)}
                                    placeholder="Giá bán"
                                    style={{
                                      width: "100%",
                                      boxSizing: "border-box",
                                      border: "1px solid #E8E3DA",
                                      borderRadius: 5,
                                      textAlign: "center",
                                      fontWeight: 800,
                                      fontSize: 13,
                                      color: "#2D3E2F",
                                      padding: "4px 6px",
                                      outline: "none",
                                      background: "#FAF8F5",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  />
                                </div>
                              </th>
                            );
                          })}

                          <th style={{ padding: "8px 10px", width: 44, textAlign: "center", borderLeft: "1px solid #DFD9CE" }}></th>
                        </tr>
                      </thead>

                      {/* Matrix Rows: Clean single-line Ingredient name & Centered Quantities with auto 0-clearing */}
                      <tbody>
                        {matrixRows.length === 0 ? (
                          <tr>
                            <td colSpan={sizeColumns.length + 2} style={{ padding: 24, textAlign: "center", color: "#8A968B" }}>
                              Chưa có nguyên liệu nào trong công thức. Bấm nút <b>"+ Thêm nguyên liệu"</b> bên dưới để chọn vật tư từ kho.
                            </td>
                          </tr>
                        ) : (
                          matrixRows.map((r, rIdx) => {
                            const ing = ingredients.find((i) => i.id === r.ingredientId);
                            return (
                              <tr key={rIdx} style={{ borderBottom: "1px solid #F0ECE4" }}>
                                {/* Clean single-line Ingredient Name with tooltip & ellipsis */}
                                <td style={{ padding: "10px 14px", maxWidth: 360 }}>
                                  <div
                                    title={ing?.name || ""}
                                    style={{
                                      fontWeight: 700,
                                      color: "#1E261F",
                                      fontSize: 13.5,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {ing?.name || "Nguyên liệu không xác định"}
                                    </span>
                                    {ing?.itemType === "semi_finished" && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: "1px 5px",
                                          borderRadius: 4,
                                          background: "#FEF3C7",
                                          color: "#92400E",
                                          flexShrink: 0,
                                        }}
                                      >
                                        BTP
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Quantities for each size column with Centered Text & auto 0-clearing */}
                                {sizeColumns.map((sc, sIdx) => {
                                  const key = sc.id ? String(sc.id) : sc.name;
                                  const rawVal =
                                    r.quantities[key] ??
                                    r.quantities[sc.name] ??
                                    (sc.id ? r.quantities[String(sc.id)] : 0) ??
                                    0;

                                  return (
                                    <td
                                      key={sIdx}
                                      style={{
                                        padding: "6px 8px",
                                        textAlign: "center",
                                        borderLeft: "1px solid #F0ECE4",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                        <input
                                          type="number"
                                          step="any"
                                          value={rawVal === undefined ? "" : rawVal}
                                          onFocus={(e) => {
                                            if (e.target.value === "0" || e.target.value === "") {
                                              updateMatrixQuantity(rIdx, key, "");
                                            }
                                            e.target.select();
                                          }}
                                          onChange={(e) => updateMatrixQuantity(rIdx, key, e.target.value)}
                                          onBlur={() => {
                                            if (String(rawVal).trim() === "") {
                                              updateMatrixQuantity(rIdx, key, 0);
                                            }
                                          }}
                                          placeholder="0"
                                          style={{
                                            ...inputStyle,
                                            textAlign: "center",
                                            padding: "5px 6px",
                                            fontWeight: 700,
                                            width: 70,
                                            fontVariantNumeric: "tabular-nums",
                                          }}
                                        />
                                        <span style={{ fontSize: 11.5, color: "#607062", fontWeight: 600, minWidth: 22, textAlign: "left" }}>
                                          {ing?.unit || ""}
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}

                                {/* Delete Row */}
                                <td style={{ padding: "6px 10px", textAlign: "center", borderLeft: "1px solid #F0ECE4" }}>
                                  <button
                                    type="button"
                                    onClick={() => removeIngredientRow(rIdx)}
                                    title="Xóa nguyên liệu này"
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#DC2626" }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>

                      {/* Matrix Footer: Live Calculated Costs for each Size */}
                      <tfoot>
                        <tr style={{ background: "#FAF8F5", borderTop: "2px solid #DFD9CE" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1E261F" }}>
                            TỔNG HỢP GIÁ VỐN & % VỐN
                          </td>

                          {multiCalculations.map((calc, idx) => (
                            <td
                              key={idx}
                              style={{
                                padding: "8px 6px",
                                textAlign: "center",
                                borderLeft: "1px solid #DFD9CE",
                              }}
                            >
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2D3E2F", fontVariantNumeric: "tabular-nums" }}>
                                {calc.cost.toLocaleString("vi-VN")} đ
                              </div>
                              <div style={{ marginTop: 2 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    background:
                                      calc.costPercent <= 30
                                        ? "#EBF4ED"
                                        : calc.costPercent <= 35
                                        ? "#FEF3C7"
                                        : "#FEE2E2",
                                    color:
                                      calc.costPercent <= 30
                                        ? "#235E2D"
                                        : calc.costPercent <= 35
                                        ? "#92400E"
                                        : "#B91C1C",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {calc.costPercent}% Vốn
                                </span>
                              </div>
                            </td>
                          ))}

                          <td style={{ borderLeft: "1px solid #DFD9CE" }}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Add Ingredient Button */}
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowPickerModal(true)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "1px solid #DFD9CE",
                        background: "#FFFFFF",
                        color: "#2D3E2F",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Plus size={14} /> Thêm nguyên liệu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions: EXACTLY 2 Main Buttons (Delete & Save) as requested */}
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid #E8E3DA",
              background: "#FAF8F5",
              display: "flex",
              alignItems: "center",
              justifyContent: isEdit ? "space-between" : "flex-end",
            }}
          >
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || submitting}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Xóa món
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || deleting}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                border: "none",
                background: "#2D3E2F",
                color: "#FFFFFF",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(45, 62, 47, 0.20)",
              }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Tạo món mới"}
            </button>
          </div>
        </form>
      </div>

      {/* Dedicated Ingredient & Semi-Finished Picker Modal */}
      <IngredientPickerModal
        isOpen={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        ingredients={ingredients}
        alreadySelectedIds={alreadySelectedIds}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#6A7B6D",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid #DFD9CE",
  fontSize: 13,
  color: "#1E261F",
  background: "#FFFFFF",
  outline: "none",
};
