import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  inventoryDisposalsApi,
  type DisposalIngredientOption,
  type DisposalPhysicalState,
  type DisposalReasonCode,
  type DisposalReportType,
  type DisposalVariantOption,
} from "../api/inventoryDisposals.api";
import {
  getDefaultStoreId,
  getUserStores,
  hasAnyRole,
  loadDisposalUser,
  type DisposalUser,
} from "../../shared/utils/disposalAuth";
import { uploadImagesToCloudinary } from "../../shared/utils/cloudinaryUpload";
import { REASON_OPTIONS } from "../../shared/utils/disposalLabels";

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

export default function StoreDisposalReportCreatePage() {
  const nav = useNavigate();
  const [user, setUser] = useState<DisposalUser | null>(null);
  const [storeId, setStoreId] = useState(0);

  const [reportType, setReportType] = useState<DisposalReportType>("finished_product");
  const [physicalState, setPhysicalState] = useState<DisposalPhysicalState>("already_disposed");
  const [reasonCode, setReasonCode] = useState<DisposalReasonCode>("wrong_recipe");
  const [description, setDescription] = useState("");
  const [quantityReported, setQuantityReported] = useState("1");
  const [unitName, setUnitName] = useState("");
  const [note, setNote] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState("");

  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientOptions, setIngredientOptions] = useState<DisposalIngredientOption[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<DisposalIngredientOption | null>(null);

  const [variantQuery, setVariantQuery] = useState("");
  const [variantOptions, setVariantOptions] = useState<DisposalVariantOption[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<DisposalVariantOption | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchingIngredient, setSearchingIngredient] = useState(false);
  const [searchingVariant, setSearchingVariant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stores = useMemo(() => getUserStores(user), [user]);
  const allowed = hasAnyRole(user, ["staff", "shift_leader", "store_manager"]);

  const getBackPath = () => {
    if (hasAnyRole(user, ["store_manager"])) return "/store/manager";
    return "/store/staff";
  };

  useEffect(() => {
    loadDisposalUser()
      .then((u) => {
        setUser(u);
        setStoreId(getDefaultStoreId(u));
      })
      .catch(() => setError("Không tải được thông tin đăng nhập"));
  }, []);

  useEffect(() => {
    if (reportType === "finished_product") {
      setPhysicalState("already_disposed");
      setSelectedIngredient(null);
      setIngredientQuery("");
      setUnitName("");
    } else {
      setPhysicalState("quarantined");
      setSelectedVariant(null);
      setVariantQuery("");
      setRelatedOrderId("");
    }
  }, [reportType]);

  useEffect(() => {
    const q = ingredientQuery.trim();
    if (reportType !== "ingredient" || q.length < 2) {
      setIngredientOptions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingIngredient(true);
        const r = await inventoryDisposalsApi.listIngredientOptions({ q, limit: 20 });
        setIngredientOptions(r.items || []);
      } catch {
        setIngredientOptions([]);
      } finally {
        setSearchingIngredient(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [ingredientQuery, reportType]);

  useEffect(() => {
    const q = variantQuery.trim();
    if (reportType !== "finished_product" || q.length < 2) {
      setVariantOptions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingVariant(true);
        const r = await inventoryDisposalsApi.listVariantOptions({ q, limit: 20 });
        setVariantOptions(r.items || []);
      } catch {
        setVariantOptions([]);
      } finally {
        setSearchingVariant(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [variantQuery, reportType]);

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      if (reportType === "ingredient" && !selectedIngredient) {
        throw new Error("Vui lòng chọn nguyên liệu");
      }
      if (reportType === "finished_product" && !selectedVariant) {
        throw new Error("Vui lòng chọn món");
      }

      const evidenceUrls = files.length ? await uploadImagesToCloudinary(files) : [];

      await inventoryDisposalsApi.createReport({
        storeId,
        reportType,
        physicalState,
        reasonCode,
        relatedOrderId:
          reportType === "finished_product" && relatedOrderId ? Number(relatedOrderId) : undefined,
        description: description.trim() || undefined,
        lines: [
          {
            ingredientId: reportType === "ingredient" ? selectedIngredient?.id : undefined,
            productVariantId: reportType === "finished_product" ? selectedVariant?.id : undefined,
            unitName:
              reportType === "ingredient"
                ? unitName.trim() || selectedIngredient?.usageUnit || selectedIngredient?.storageUnit || undefined
                : undefined,
            quantityReported: Number(quantityReported || 0),
            note: note.trim() || undefined,
            evidenceUrls,
          },
        ],
      });

      alert("Tạo report hủy hàng thành công");
      nav("/inventory/disposals/my");
    } catch (e: any) {
      setError(e?.message || e?.response?.data?.message || "Tạo report thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div style={{ padding: 16 }}>Đang tải...</div>;
  if (user.portal !== "STORE" || !allowed) {
    return <div style={{ padding: 16 }}>Bạn không có quyền vào trang này.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Tạo báo cáo hủy hàng</h2>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Chọn 1 kiểu hủy: theo món hoặc theo nguyên liệu.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...btn, background: "#e5e7eb", color: "#111827" }}
            onClick={() => nav(getBackPath(), { replace: true })}
          >
            Về dashboard
          </button>

          <button
            type="button"
            style={{ ...btn, background: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db" }}
            onClick={() => nav("/inventory/disposals/my")}
          >
            Xem report của tôi
          </button>
        </div>
      </div>

      {error && <div style={{ ...box, color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}

      <div style={box}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>Cửa hàng</div>
            <select style={input} value={storeId} onChange={(e) => setStoreId(Number(e.target.value))}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Kiểu hủy</div>
            <select
              style={input}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as DisposalReportType)}
            >
              <option value="finished_product">Hủy theo món</option>
              <option value="ingredient">Hủy theo nguyên liệu</option>
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Trạng thái vật lý</div>
            <select
              style={input}
              value={physicalState}
              onChange={(e) => setPhysicalState(e.target.value as DisposalPhysicalState)}
            >
              <option value="already_disposed">Đã bỏ / không còn dùng được</option>
              <option value="quarantined">Đang cách ly</option>
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Lý do</div>
            <select
              style={input}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as DisposalReasonCode)}
            >
              {REASON_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>

          {reportType === "finished_product" ? (
            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <div style={{ marginBottom: 6 }}>Tìm món</div>
              <input
                style={input}
                value={variantQuery}
                onChange={(e) => {
                  setVariantQuery(e.target.value);
                  setSelectedVariant(null);
                }}
                placeholder="Gõ tên món / size / sku..."
              />
              {searchingVariant && <div style={{ marginTop: 6, color: "#6b7280" }}>Đang tìm món...</div>}
              {!selectedVariant && variantOptions.length > 0 && (
                <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  {variantOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariant(item);
                        setVariantQuery(item.label);
                        setVariantOptions([]);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: 10,
                        border: "none",
                        background: "#fff",
                        cursor: "pointer",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {selectedVariant && (
                <div style={{ marginTop: 8, color: "#065f46" }}>
                  Đã chọn: <strong>{selectedVariant.label}</strong>
                </div>
              )}
            </div>
          ) : (
            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <div style={{ marginBottom: 6 }}>Tìm nguyên liệu</div>
              <input
                style={input}
                value={ingredientQuery}
                onChange={(e) => {
                  setIngredientQuery(e.target.value);
                  setSelectedIngredient(null);
                }}
                placeholder="Gõ tên nguyên liệu / code..."
              />
              {searchingIngredient && <div style={{ marginTop: 6, color: "#6b7280" }}>Đang tìm nguyên liệu...</div>}
              {!selectedIngredient && ingredientOptions.length > 0 && (
                <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  {ingredientOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedIngredient(item);
                        setIngredientQuery(item.label);
                        setUnitName(item.usageUnit || item.storageUnit || "");
                        setIngredientOptions([]);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: 10,
                        border: "none",
                        background: "#fff",
                        cursor: "pointer",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {selectedIngredient && (
                <div style={{ marginTop: 8, color: "#065f46" }}>
                  Đã chọn: <strong>{selectedIngredient.label}</strong>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ marginBottom: 6 }}>Số lượng</div>
            <input
              style={input}
              value={quantityReported}
              onChange={(e) => setQuantityReported(e.target.value)}
              placeholder="VD: 1"
            />
          </div>

          {reportType === "ingredient" ? (
            <div>
              <div style={{ marginBottom: 6 }}>Đơn vị</div>
              <input
                style={input}
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="VD: chai / gram / ml"
              />
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 6 }}>Order liên quan (nếu có)</div>
              <input
                style={input}
                value={relatedOrderId}
                onChange={(e) => setRelatedOrderId(e.target.value)}
                placeholder="VD: 1340"
              />
            </div>
          )}

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ marginBottom: 6 }}>Ghi chú</div>
            <textarea
              style={{ ...input, minHeight: 80 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ marginBottom: 6 }}>Mô tả chung</div>
            <textarea
              style={{ ...input, minHeight: 90 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn vụ việc"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ marginBottom: 6 }}>Ảnh minh chứng</div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <div style={{ marginTop: 8, color: "#4b5563" }}>
                Đã chọn {files.length} ảnh
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          style={{ ...btn, background: "#111827", color: "#fff" }}
          onClick={submit}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Tạo report"}
        </button>

        <button
          type="button"
          style={{ ...btn, background: "#e5e7eb", color: "#111827" }}
          onClick={() => nav("/inventory/disposals/my")}
        >
          Xem report của tôi
        </button>

        <button
          type="button"
          style={{ ...btn, background: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db" }}
          onClick={() => nav(getBackPath(), { replace: true })}
        >
          Về dashboard
        </button>
      </div>
    </div>
  );
}
