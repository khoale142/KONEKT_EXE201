import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Check, AlertCircle } from "lucide-react";
import {
  IngredientItem,
  ownerMenuApi,
} from "../api/ownerMenu.api";

interface SemiFinishedRecipeModalProps {
  semiItem: IngredientItem | null;
  isOpen: boolean;
  onClose: () => void;
  rawIngredients: IngredientItem[];
  onSaved: () => void;
}

export default function SemiFinishedRecipeModal({
  semiItem,
  isOpen,
  onClose,
  rawIngredients,
  onSaved,
}: SemiFinishedRecipeModalProps) {
  const [batchYield, setBatchYield] = useState("1000");
  const [items, setItems] = useState<
    Array<{
      ingredientId: number;
      quantity: string;
      unit: string;
      wasteRatePercent: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !semiItem) return;
    setBatchYield(String(semiItem.batchYield || 1000));
    loadRecipe();
  }, [isOpen, semiItem]);

  async function loadRecipe() {
    if (!semiItem) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await ownerMenuApi.getSemiFinishedRecipe(semiItem.id);
      setBatchYield(String(data.batchYield || 1000));
      setItems(
        data.items.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: String(i.quantity),
          unit: i.unit,
          wasteRatePercent: String(i.wasteRatePercent || 0),
        }))
      );
    } catch (err: any) {
      // If no recipe yet, start with 1 empty row
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function addItemRow() {
    const firstRaw = rawIngredients.find((r) => r.id !== semiItem?.id);
    if (!firstRaw) return;
    setItems((prev) => [
      ...prev,
      {
        ingredientId: firstRaw.id,
        quantity: "100",
        unit: firstRaw.unit,
        wasteRatePercent: "0",
      },
    ]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateItem(index: number, key: string, val: any) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (key === "ingredientId") {
          const ing = rawIngredients.find((r) => r.id === Number(val));
          return {
            ...item,
            ingredientId: Number(val),
            unit: ing?.unit || item.unit,
          };
        }
        return { ...item, [key]: val };
      })
    );
  }

  // Real-time Batch Cost calculation
  const { totalBatchCost, costPerUnit } = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const raw = rawIngredients.find((r) => r.id === item.ingredientId);
      const unitCost = raw?.costPerUnit || 0;
      const qty = Number(item.quantity) || 0;
      const waste = Number(item.wasteRatePercent) || 0;
      total += unitCost * qty * (1 + waste / 100);
    }
    const yieldNum = Number(batchYield) > 0 ? Number(batchYield) : 1;
    const unitPrice = total / yieldNum;
    return {
      totalBatchCost: Math.round(total),
      costPerUnit: Math.round(unitPrice * 100) / 100,
    };
  }, [items, rawIngredients, batchYield]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!semiItem) return;

    if (items.length === 0) {
      setErrorMsg("Vui lòng thêm ít nhất 1 nguyên liệu đầu vào");
      return;
    }

    const yieldNum = Number(batchYield);
    if (!yieldNum || yieldNum <= 0) {
      setErrorMsg("Sản lượng 1 mẻ phải lớn hơn 0");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      await ownerMenuApi.saveSemiFinishedRecipe(semiItem.id, {
        batchYield: yieldNum,
        items: items.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: Number(i.quantity) || 0,
          unit: i.unit.trim(),
          wasteRatePercent: Number(i.wasteRatePercent) || 0,
        })),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Lỗi lưu công thức sơ chế");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !semiItem) return null;

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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E261F" }}>
                Công thức sơ chế (BOM): {semiItem.name}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  background: "#F8EFE7",
                  color: "#8C4B1E",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                Bán thành phẩm
              </span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#607062" }}>
              Khai báo nguyên liệu đầu vào cho 1 mẻ để hệ thống tự động tính đơn giá vốn COGS trên mỗi {semiItem.unit}.
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
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
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

            {/* Batch Output Capacity */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                gap: 12,
                background: "#F8F6F1",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #E8E3DA",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#4A5D4D", marginBottom: 3 }}>
                  SẢN LƯỢNG 1 MẺ CHUẨN *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    step="any"
                    value={batchYield}
                    onChange={(e) => setBatchYield(e.target.value)}
                    placeholder="1000"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 7,
                      border: "1px solid #DFD9CE",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#1E261F",
                      fontVariantNumeric: "tabular-nums",
                      background: "#FFFFFF",
                    }}
                  />
                  <span style={{ fontWeight: 600, color: "#4A5D4D", fontSize: 13 }}>
                    {semiItem.unit}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6A7B6D", textTransform: "uppercase" }}>
                  TỔNG TIỀN 1 MẺ
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E261F", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                  {totalBatchCost.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6A7B6D", textTransform: "uppercase" }}>
                  ĐƠN GIÁ VỐN (COGS)
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#2D3E2F", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                  {costPerUnit.toLocaleString("vi-VN")} đ/{semiItem.unit}
                </div>
              </div>
            </div>

            {/* Ingredients Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1E261F" }}>
                  NGUYÊN LIỆU ĐẦU VÀO ({items.length})
                </span>
                <button
                  type="button"
                  onClick={addItemRow}
                  style={{
                    border: "1px solid #DFD9CE",
                    background: "#FAF8F5",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#2D3E2F",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={13} /> Thêm nguyên liệu
                </button>
              </div>

              {items.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    border: "1px dashed #DFD9CE",
                    borderRadius: 8,
                    color: "#8A968B",
                    fontSize: 12.5,
                  }}
                >
                  Chưa có nguyên liệu đầu vào. Nhấn "+ Thêm nguyên liệu" để bắt đầu thiết lập mẻ sơ chế.
                </div>
              ) : (
                <div style={{ border: "1px solid #E8E3DA", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#F8F6F1", borderBottom: "1px solid #E8E3DA", color: "#4A5D4D" }}>
                        <th style={{ padding: "8px 10px", fontWeight: 700 }}>Nguyên liệu</th>
                        <th style={{ padding: "8px 10px", fontWeight: 700, width: 110 }}>Định lượng</th>
                        <th style={{ padding: "8px 10px", fontWeight: 700, width: 90 }}>Hao hụt %</th>
                        <th style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>Thành tiền</th>
                        <th style={{ padding: "8px 10px", width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const raw = rawIngredients.find((r) => r.id === item.ingredientId);
                        const unitCost = raw?.costPerUnit || 0;
                        const qty = Number(item.quantity) || 0;
                        const waste = Number(item.wasteRatePercent) || 0;
                        const rowCost = Math.round(unitCost * qty * (1 + waste / 100));

                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #F0ECE4" }}>
                            <td style={{ padding: "8px 10px" }}>
                              <select
                                value={item.ingredientId}
                                onChange={(e) => updateItem(idx, "ingredientId", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #DFD9CE",
                                  fontSize: 12,
                                  color: "#1E261F",
                                  background: "#FFFFFF",
                                  outline: "none",
                                }}
                              >
                                {rawIngredients
                                  .filter((r) => r.id !== semiItem.id)
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} ({r.costPerUnit.toLocaleString("vi-VN")} đ/{r.unit})
                                    </option>
                                  ))}
                              </select>
                            </td>

                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                                  style={{
                                    width: 60,
                                    padding: "5px 6px",
                                    borderRadius: 6,
                                    border: "1px solid #DFD9CE",
                                    fontSize: 12,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                />
                                <span style={{ fontSize: 11.5, color: "#607062" }}>{item.unit}</span>
                              </div>
                            </td>

                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="number"
                                value={item.wasteRatePercent}
                                onChange={(e) => updateItem(idx, "wasteRatePercent", e.target.value)}
                                placeholder="0"
                                style={{
                                  width: 50,
                                  padding: "5px 6px",
                                  borderRadius: 6,
                                  border: "1px solid #DFD9CE",
                                  fontSize: 12,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              />
                            </td>

                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#2D3E2F" }}>
                              {rowCost.toLocaleString("vi-VN")} đ
                            </td>

                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  color: "#DC2626",
                                  padding: 4,
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #E8E3DA",
              background: "#FAF8F5",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#607062" }}>
              Hệ thống sẽ tự động cập nhật giá vốn {costPerUnit.toLocaleString("vi-VN")} đ/{semiItem.unit} cho "{semiItem.name}".
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid #DFD9CE",
                  background: "#FFFFFF",
                  color: "#5A685B",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2D3E2F",
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(45, 62, 47, 0.18)",
                }}
              >
                <Check size={14} />
                {saving ? "Đang lưu..." : "Lưu công thức & Cập nhật giá vốn"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
