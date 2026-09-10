import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  RotateCw,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { IngredientItem, ownerMenuApi } from "../api/ownerMenu.api";

const border = "1px solid #E8E3DA";

export default function OwnerIngredientsTab() {
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "raw" | "semi">("all");

  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [itemType, setItemType] = useState<"raw" | "semi">("raw");
  const [unit, setUnit] = useState("g");
  const [costPerUnit, setCostPerUnit] = useState("100");
  const [minThreshold, setMinThreshold] = useState("500");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await ownerMenuApi.listIngredients();
      setIngredients(data);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message || "Không thể tải danh sách nguyên liệu"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function isSemiFinished(item: IngredientItem): boolean {
    const c = (item.code || "").toUpperCase();
    const n = item.name.toLowerCase();
    return (
      c.startsWith("SEMI") ||
      c.startsWith("BTP") ||
      n.includes("cốt") ||
      n.includes("sốt") ||
      n.includes("pha sẵn") ||
      n.includes("nấu") ||
      n.includes("ủ") ||
      n.includes("siro tự")
    );
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ingredients.filter((item) => {
      const isSemi = isSemiFinished(item);
      if (typeFilter === "raw" && isSemi) return false;
      if (typeFilter === "semi" && !isSemi) return false;

      if (!q) return true;
      const blob = `${item.name} ${item.code || ""} ${item.unit}`.toLowerCase();
      return blob.includes(q);
    });
  }, [ingredients, keyword, typeFilter]);

  const rawCount = useMemo(
    () => ingredients.filter((i) => !isSemiFinished(i)).length,
    [ingredients]
  );
  const semiCount = useMemo(
    () => ingredients.filter((i) => isSemiFinished(i)).length,
    [ingredients]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const finalCode =
        code.trim() ||
        `${itemType === "semi" ? "SEMI" : "RAW"}-${Date.now().toString().slice(-4)}`;

      await ownerMenuApi.createIngredient({
        name: name.trim(),
        code: finalCode,
        unit: unit.trim(),
        costPerUnit: Number(costPerUnit) || 0,
        minThreshold: Number(minThreshold) || 0,
      });

      setSuccessMsg(`Đã thêm "${name}" thành công`);
      setShowModal(false);
      setName("");
      setCode("");
      loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể thêm nguyên liệu");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards - Clean Minimalist (No colorful icon blobs) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>TỔNG VẬT TƯ</div>
          <div style={kpiValueStyle}>
            {ingredients.length} <span style={kpiUnitStyle}>loại</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>NGUYÊN LIỆU</div>
          <div style={kpiValueStyle}>
            {rawCount} <span style={kpiUnitStyle}>loại</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>BÁN THÀNH PHẨM</div>
          <div style={kpiValueStyle}>
            {semiCount} <span style={kpiUnitStyle}>loại</span>
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

      {errorMsg && (
        <div
          style={{
            background: "#FDF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            padding: "10px 14px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Single Consolidated Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          background: "#FFFFFF",
          padding: "10px 14px",
          borderRadius: 14,
          border: border,
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
            placeholder="Tìm theo tên hoặc mã..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
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
          {keyword && (
            <button
              onClick={() => setKeyword("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#8A968B",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type Filter Segment */}
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
            onClick={() => setTypeFilter("all")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: typeFilter === "all" ? 700 : 500,
              border: "none",
              cursor: "pointer",
              background: typeFilter === "all" ? "#FFFFFF" : "transparent",
              color: typeFilter === "all" ? "#2D3E2F" : "#5A685B",
              boxShadow: typeFilter === "all" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.12s ease",
            }}
          >
            Tất cả ({ingredients.length})
          </button>
          <button
            onClick={() => setTypeFilter("raw")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: typeFilter === "raw" ? 700 : 500,
              border: "none",
              cursor: "pointer",
              background: typeFilter === "raw" ? "#FFFFFF" : "transparent",
              color: typeFilter === "raw" ? "#2D3E2F" : "#5A685B",
              boxShadow: typeFilter === "raw" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.12s ease",
            }}
          >
            Nguyên liệu ({rawCount})
          </button>
          <button
            onClick={() => setTypeFilter("semi")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: typeFilter === "semi" ? 700 : 500,
              border: "none",
              cursor: "pointer",
              background: typeFilter === "semi" ? "#FFFFFF" : "transparent",
              color: typeFilter === "semi" ? "#2D3E2F" : "#5A685B",
              boxShadow: typeFilter === "semi" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.12s ease",
            }}
          >
            Bán thành phẩm ({semiCount})
          </button>
        </div>

        {/* Reload button */}
        <button
          onClick={() => loadData()}
          disabled={loading}
          title="Làm mới dữ liệu"
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
          <RotateCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Primary CTA */}
        <button
          onClick={() => setShowModal(true)}
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
          <Plus size={15} /> Thêm vật tư / BTP
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#FFFFFF",
          border: border,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8F6F1", borderBottom: border, color: "#4A5D4D" }}>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", verticalAlign: "middle" }}>
                Mã & Tên Vật Tư
              </th>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", verticalAlign: "middle" }}>
                Phân Loại
              </th>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", verticalAlign: "middle" }}>
                Đơn Vị Tính
              </th>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "right", verticalAlign: "middle" }}>
                Đơn Giá Vốn (COGS)
              </th>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "right", verticalAlign: "middle" }}>
                Mức Tồn Tối Thiểu
              </th>
              <th style={{ padding: "10px 14px", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.3px", textAlign: "center", verticalAlign: "middle" }}>
                Trạng Thái
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#607062" }}>
                  Đang tải danh sách vật tư...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#607062" }}>
                  Không tìm thấy nguyên liệu hoặc bán thành phẩm nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isSemi = isSemiFinished(item);
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #F0ECE4", transition: "background 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Item Name & Code - Straight text alignment */}
                    <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 700, color: "#1E261F" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#8A968B", marginTop: 2, fontFamily: "monospace" }}>
                        {item.code || `ING-${item.id}`}
                      </div>
                    </td>

                    {/* Classification - Clean text badge without wheat/flask icons */}
                    <td style={{ padding: "11px 14px", verticalAlign: "middle" }}>
                      {isSemi ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: "#F8EFE7",
                            color: "#8C4B1E",
                          }}
                        >
                          Bán thành phẩm
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: "#EBF4ED",
                            color: "#235E2D",
                          }}
                        >
                          Nguyên liệu
                        </span>
                      )}
                    </td>

                    {/* Unit */}
                    <td style={{ padding: "11px 14px", color: "#1E261F", verticalAlign: "middle" }}>
                      <span
                        style={{
                          background: "#F2EFE9",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#4A5D4D",
                        }}
                      >
                        {item.unit}
                      </span>
                    </td>

                    {/* COGS - CANH PHẢI & TABULAR NUMS */}
                    <td
                      style={{
                        padding: "11px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#1E261F",
                        fontVariantNumeric: "tabular-nums",
                        verticalAlign: "middle",
                      }}
                    >
                      {Number(item.costPerUnit || 0).toLocaleString("vi-VN")} đ / {item.unit}
                    </td>

                    {/* Min threshold - CANH PHẢI & TABULAR NUMS */}
                    <td
                      style={{
                        padding: "11px 14px",
                        textAlign: "right",
                        color: "#5A685B",
                        fontVariantNumeric: "tabular-nums",
                        verticalAlign: "middle",
                      }}
                    >
                      {Number(item.minThreshold || 0).toLocaleString("vi-VN")} {item.unit}
                    </td>

                    {/* Status - Center */}
                    <td style={{ padding: "11px 14px", textAlign: "center", verticalAlign: "middle" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: item.isActive ? "#EBF4ED" : "#F2EFEA",
                          color: item.isActive ? "#235E2D" : "#736E66",
                        }}
                      >
                        {item.isActive ? "Đang dùng" : "Tạm ngưng"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add Ingredient / Semi-finished */}
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
              maxWidth: 460,
              padding: 22,
              boxShadow: "0 16px 36px rgba(0,0,0,0.12)",
              border: border,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                paddingBottom: 10,
                borderBottom: border,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1E261F" }}>
                Thêm Vật Tư / Định Lượng
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#8A968B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {/* Type Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 6 }}>
                  Phân loại vật tư <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setItemType("raw")}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: itemType === "raw" ? "2px solid #2D3E2F" : border,
                      background: itemType === "raw" ? "rgba(45, 62, 47, 0.06)" : "#FFFFFF",
                      color: itemType === "raw" ? "#2D3E2F" : "#5A685B",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Nguyên liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType("semi")}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: itemType === "semi" ? "2px solid #8C4B1E" : border,
                      background: itemType === "semi" ? "rgba(140, 75, 30, 0.06)" : "#FFFFFF",
                      color: itemType === "semi" ? "#8C4B1E" : "#5A685B",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Bán thành phẩm
                  </button>
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 4 }}>
                  Tên nguyên liệu / BTP <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={itemType === "semi" ? "VD: Cốt cà phê phin, Kem macchiato" : "VD: Hạt Cà Phê Robusta, Sữa tươi"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: border,
                    fontSize: 13,
                    color: "#1E261F",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Code & Unit */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 4 }}>
                    Mã quản lý
                  </label>
                  <input
                    type="text"
                    placeholder={itemType === "semi" ? "SEMI-01" : "RAW-01"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: border,
                      fontSize: 13,
                      color: "#1E261F",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 4 }}>
                    Đơn vị tính <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: border,
                      fontSize: 13,
                      color: "#1E261F",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="g">Gam (g)</option>
                    <option value="ml">Mililít (ml)</option>
                    <option value="shot">Shot</option>
                    <option value="chiếc">Chiếc / Cái</option>
                    <option value="hộp">Hộp</option>
                    <option value="lon">Lon</option>
                    <option value="chai">Chai</option>
                  </select>
                </div>
              </div>

              {/* Cost & Min Threshold */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 4 }}>
                    Giá vốn (VNĐ/{unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: border,
                      fontSize: 13,
                      color: "#1E261F",
                      boxSizing: "border-box",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#1E261F", marginBottom: 4 }}>
                    Mức tồn tối thiểu ({unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="500"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: border,
                      fontSize: 13,
                      color: "#1E261F",
                      boxSizing: "border-box",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: border,
                    background: "#FAF8F5",
                    color: "#5A685B",
                    fontWeight: 600,
                    fontSize: 13,
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
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(45, 62, 47, 0.20)",
                  }}
                >
                  {submitting ? "Đang lưu..." : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: border,
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
