import { useState, useMemo } from "react";
import { X, Search, Check, AlertCircle } from "lucide-react";
import { IngredientItem } from "../api/ownerMenu.api";

interface IngredientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  alreadySelectedIds: number[];
  onConfirm: (selectedIngredients: IngredientItem[]) => void;
}

export default function IngredientPickerModal({
  isOpen,
  onClose,
  ingredients,
  alreadySelectedIds,
  onConfirm,
}: IngredientPickerModalProps) {
  const [keyword, setKeyword] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "raw" | "semi_finished">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Existing IDs set for quick lookup
  const existingSet = useMemo(() => new Set(alreadySelectedIds), [alreadySelectedIds]);

  // Filter ingredients
  const filteredList = useMemo(() => {
    return ingredients.filter((item) => {
      // Filter by type
      if (selectedType !== "all" && item.itemType !== selectedType) {
        return false;
      }
      // Filter by keyword
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code ? item.code.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [ingredients, selectedType, keyword]);

  if (!isOpen) return null;

  function toggleSelect(id: number) {
    if (existingSet.has(id)) return; // Already in recipe
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAllVisible() {
    const next = new Set(selectedIds);
    for (const item of filteredList) {
      if (!existingSet.has(item.id)) {
        next.add(item.id);
      }
    }
    setSelectedIds(next);
  }

  function handleDeselectAllVisible() {
    const next = new Set(selectedIds);
    for (const item of filteredList) {
      next.delete(item.id);
    }
    setSelectedIds(next);
  }

  function handleConfirm() {
    const selectedItems = ingredients.filter((item) => selectedIds.has(item.id));
    onConfirm(selectedItems);
    setSelectedIds(new Set());
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24, 30, 25, 0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
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
          maxWidth: 680,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 40px -8px rgba(45, 62, 47, 0.22)",
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E261F" }}>
              Chọn nguyên vật liệu & bán thành phẩm
            </h3>
            <div style={{ fontSize: 12, color: "#607062", marginTop: 2 }}>
              Tick chọn một hoặc nhiều mục để thêm vào công thức định lượng
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

        {/* Toolbar: Search & Filter Tabs */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid #E8E3DA",
            background: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative" }}>
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
              placeholder="Tìm kiếm theo tên nguyên liệu, bán thành phẩm hoặc mã..."
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

          {/* Filter Tabs & Quick Action */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                background: "#EAE5DC",
                padding: 3,
                borderRadius: 8,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedType("all")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: selectedType === "all" ? "#FFFFFF" : "transparent",
                  color: selectedType === "all" ? "#2D3E2F" : "#7A8A7C",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: selectedType === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Tất cả ({ingredients.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("raw")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: selectedType === "raw" ? "#FFFFFF" : "transparent",
                  color: selectedType === "raw" ? "#2D3E2F" : "#7A8A7C",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: selectedType === "raw" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Nguyên liệu ({ingredients.filter((i) => i.itemType === "raw").length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("semi_finished")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: selectedType === "semi_finished" ? "#FFFFFF" : "transparent",
                  color: selectedType === "semi_finished" ? "#2D3E2F" : "#7A8A7C",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: selectedType === "semi_finished" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Bán thành phẩm ({ingredients.filter((i) => i.itemType === "semi_finished").length})
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2D3E2F",
                  cursor: "pointer",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Chọn tất cả hiển thị
              </button>
              <span style={{ color: "#DFD9CE" }}>|</span>
              <button
                type="button"
                onClick={handleDeselectAllVisible}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#7A8A7C",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        </div>

        {/* List of Ingredients */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px" }}>
          {filteredList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#7A8A7C",
                fontSize: 13,
              }}
            >
              <AlertCircle size={20} style={{ margin: "0 auto 6px", display: "block" }} />
              Không tìm thấy nguyên liệu hoặc bán thành phẩm nào phù hợp.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredList.map((item) => {
                const isAlreadyAdded = existingSet.has(item.id);
                const isChecked = selectedIds.has(item.id) || isAlreadyAdded;

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: isChecked && !isAlreadyAdded ? "1px solid #2D3E2F" : "1px solid #E8E3DA",
                      background: isAlreadyAdded
                        ? "#F5F3EE"
                        : isChecked
                        ? "#F2F7F3"
                        : "#FFFFFF",
                      cursor: isAlreadyAdded ? "not-allowed" : "pointer",
                      transition: "all 0.12s ease",
                      opacity: isAlreadyAdded ? 0.6 : 1,
                    }}
                  >
                    {/* Custom Checkbox */}
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: isChecked ? "none" : "1.5px solid #DFD9CE",
                        background: isAlreadyAdded ? "#9CA3AF" : isChecked ? "#2D3E2F" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    >
                      {isChecked && <Check size={13} strokeWidth={3} />}
                    </div>

                    {/* Ingredient Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E261F" }}>
                          {item.name}
                        </span>
                        {item.code && (
                          <span style={{ fontSize: 11, color: "#7A8A7C", fontFamily: "monospace" }}>
                            [{item.code}]
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: item.itemType === "semi_finished" ? "#FEF3C7" : "#EBF4ED",
                            color: item.itemType === "semi_finished" ? "#92400E" : "#235E2D",
                          }}
                        >
                          {item.itemType === "semi_finished" ? "Bán thành phẩm" : "Nguyên liệu"}
                        </span>
                        {isAlreadyAdded && (
                          <span style={{ fontSize: 11, color: "#854D0E", fontWeight: 600 }}>
                            (Đã có trong công thức)
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "#607062", marginTop: 2 }}>
                        Đơn vị tính: <b>{item.unit}</b> • Giá vốn:{" "}
                        <b style={{ color: "#2D3E2F" }}>
                          {item.costPerUnit.toLocaleString("vi-VN")} đ/{item.unit}
                        </b>
                        {item.currentStock !== undefined && (
                          <span> • Tồn kho: {item.currentStock.toLocaleString("vi-VN")} {item.unit}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #E8E3DA",
            background: "#FAF8F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 13, color: "#1E261F", fontWeight: 600 }}>
            Đã chọn: <b style={{ color: "#2D3E2F" }}>{selectedIds.size}</b> nguyên vật liệu mới
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #DFD9CE",
                background: "#FFFFFF",
                color: "#5A685B",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: selectedIds.size > 0 ? "#2D3E2F" : "#9CA3AF",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
                boxShadow: selectedIds.size > 0 ? "0 2px 6px rgba(45, 62, 47, 0.20)" : "none",
              }}
            >
              Thêm vào công thức ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
