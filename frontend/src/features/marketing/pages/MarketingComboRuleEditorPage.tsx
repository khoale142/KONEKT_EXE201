import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { marketingApi } from "../api/marketing.api";

type ComboVariantLookup = Awaited<
  ReturnType<typeof marketingApi.listComboRuleVariants>
>[number];

type ComboRuleDetail = Awaited<
  ReturnType<typeof marketingApi.getComboRuleDetail>
>;

type ComboRuleListResponse = Awaited<
  ReturnType<typeof marketingApi.listComboRules>
>;

type GroupDraft = {
  productVariantId: string;
  keyword: string;
};

type ExistingComboSignature = {
  id: number;
  code: string;
  name: string;
  signature: string;
};

type NoticeState = {
  type: "error" | "info";
  message: string;
} | null;

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString()}đ`;
}

function buildVariantLabel(item: ComboVariantLookup) {
  return `${item.productName}${item.size ? ` (${item.size})` : ""} · ${formatMoney(item.price)}`;
}

function buildSignature(variantIds: number[]) {
  return [...variantIds].sort((a, b) => a - b).join("|");
}

export default function MarketingComboRuleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isCreateMode = !id || id === "new";
  const comboRuleId = !id || id === "new" ? null : Number(id);

  const [variants, setVariants] = useState<ComboVariantLookup[]>([]);
  const [detail, setDetail] = useState<ComboRuleDetail | null>(null);
  const [existingSignatures, setExistingSignatures] = useState<
    ExistingComboSignature[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    comboPrice: "",
    isActive: true,
  });

  const [groups, setGroups] = useState<GroupDraft[]>([
    { productVariantId: "", keyword: "" },
    { productVariantId: "", keyword: "" },
  ]);

  const variantMap = useMemo(() => {
    const map = new Map<number, ComboVariantLookup>();
    for (const item of variants) {
      map.set(Number(item.id), item);
    }
    return map;
  }, [variants]);

  async function loadExistingComboSignatures(list: ComboRuleListResponse) {
    const details = await Promise.all(
      (list.items || []).map((item) => marketingApi.getComboRuleDetail(item.id)),
    );

    const next = details
      .map((item) => {
        const variantIds = (item.groups || [])
          .map((group) => group.productVariantId)
          .filter((x): x is number => Number.isFinite(x as number));

        if (variantIds.length < 2) return null;

        return {
          id: item.id,
          code: item.code,
          name: item.name,
          signature: buildSignature(variantIds),
        };
      })
      .filter(Boolean) as ExistingComboSignature[];

    setExistingSignatures(next);
  }

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const [variantData, comboList] = await Promise.all([
        marketingApi.listComboRuleVariants({ limit: 2000 }),
        marketingApi.listComboRules({ limit: 500, offset: 0 }),
      ]);

      setVariants(variantData);
      await loadExistingComboSignatures(comboList);

      if (!isCreateMode && comboRuleId != null) {
        const data = await marketingApi.getComboRuleDetail(comboRuleId);
        setDetail(data);
        setForm({
          code: data.code || "",
          name: data.name || "",
          comboPrice: String(data.comboPrice ?? 0),
          isActive: data.isActive,
        });

        const nextGroups = (data.groups || []).map((group) => {
          const selected = group.productVariantId
            ? variantData.find(
                (item) => Number(item.id) === Number(group.productVariantId),
              )
            : null;

          return {
            productVariantId:
              group.productVariantId != null ? String(group.productVariantId) : "",
            keyword: selected ? buildVariantLabel(selected) : "",
          };
        });

        setGroups(
          nextGroups.length >= 2
            ? nextGroups
            : [
                ...nextGroups,
                ...Array.from({ length: 2 - nextGroups.length }, () => ({
                  productVariantId: "",
                  keyword: "",
                })),
              ],
        );
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không tải được dữ liệu combo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !isCreateMode &&
      (comboRuleId == null || !Number.isFinite(comboRuleId) || comboRuleId <= 0)
    ) {
      setErr("ID combo không hợp lệ");
      setLoading(false);
      return;
    }
    load();
  }, [id]);

  const selectedVariantIds = useMemo(
    () =>
      groups
        .map((group) =>
          group.productVariantId ? Number(group.productVariantId) : null,
        )
        .filter((x): x is number => x != null && Number.isFinite(x) && x > 0),
    [groups],
  );

  const selectedVariants = useMemo(
    () =>
      selectedVariantIds
        .map((variantId) => variantMap.get(variantId))
        .filter(Boolean) as ComboVariantLookup[],
    [selectedVariantIds, variantMap],
  );

  const baseTotal = useMemo(
    () => selectedVariants.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [selectedVariants],
  );

  const comboPriceValue = useMemo(() => {
    const n = Number(form.comboPrice);
    return Number.isFinite(n) ? n : 0;
  }, [form.comboPrice]);

  const totalSaving = Math.max(0, baseTotal - comboPriceValue);

  const generatedName = useMemo(() => {
    return selectedVariants
      .map((item) => `${item.productName}${item.size ? ` (${item.size})` : ""}`)
      .join(" + ");
  }, [selectedVariants]);

  const previewName =
    form.name.trim() || generatedName || "Tên combo sẽ hiện ở đây";

  const currentSignature = useMemo(() => {
    if (selectedVariantIds.length < 2) return "";
    return buildSignature(selectedVariantIds);
  }, [selectedVariantIds]);

  const duplicateCombo = useMemo(() => {
    if (!currentSignature) return null;
    return (
      existingSignatures.find(
        (item) =>
          item.signature === currentSignature &&
          (!comboRuleId || Number(item.id) !== Number(comboRuleId)),
      ) || null
    );
  }, [existingSignatures, currentSignature, comboRuleId]);

  function showNotice(type: "error" | "info", message: string) {
    setNotice({ type, message });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function updateGroup(index: number, patch: Partial<GroupDraft>) {
    setGroups((current) =>
      current.map((group, i) => (i === index ? { ...group, ...patch } : group)),
    );
  }

  function selectVariant(index: number, item: ComboVariantLookup) {
    updateGroup(index, {
      productVariantId: String(item.id),
      keyword: buildVariantLabel(item),
    });
    setOpenPickerIndex(null);
  }

  function addGroup() {
    setGroups((current) => [...current, { productVariantId: "", keyword: "" }]);
    setOpenPickerIndex(groups.length);
  }

  function removeGroup(index: number) {
    setGroups((current) => current.filter((_, i) => i !== index));
    setOpenPickerIndex(null);
  }

  function getFilteredVariants(keyword: string, index: number) {
    const q = keyword.trim().toLowerCase();

    const selectedIdsExceptCurrent = new Set(
      groups
        .map((group, i) =>
          i === index || !group.productVariantId
            ? null
            : Number(group.productVariantId),
        )
        .filter((x): x is number => x != null && Number.isFinite(x)),
    );

    const result = variants.filter((item) => {
      if (selectedIdsExceptCurrent.has(Number(item.id))) return false;
      if (!q) return true;

      const hay = `${item.productName} ${item.size || ""} ${item.sku || ""} ${
        item.categoryName || ""
      }`.toLowerCase();

      return hay.includes(q);
    });

    return result.slice(0, 8);
  }

  async function handleSave() {
    setNotice(null);

    if (!form.code.trim()) {
      showNotice("error", "Code combo không được để trống.");
      return;
    }

    const finalName = form.name.trim() || generatedName;
    if (!finalName) {
      showNotice("error", "Chọn món trong combo trước khi lưu.");
      return;
    }

    if (groups.length < 2) {
      showNotice("error", "Combo phải có ít nhất 2 món.");
      return;
    }

    const payloadGroups = groups.map((group, index) => ({
      groupNo: index + 1,
      groupName: null,
      matchType: "variant" as const,
      productVariantId: group.productVariantId
        ? Number(group.productVariantId)
        : null,
      requiredSize: null,
    }));

    if (payloadGroups.some((group) => !group.productVariantId)) {
      showNotice("error", "Mỗi dòng phải chọn 1 variant.");
      return;
    }

    const uniqueIds = new Set(payloadGroups.map((group) => group.productVariantId));
    if (uniqueIds.size !== payloadGroups.length) {
      showNotice("error", "Combo không được chứa 2 dòng trùng cùng món.");
      return;
    }

    if (duplicateCombo) {
      showNotice(
        "error",
        `Combo này đã tồn tại: ${duplicateCombo.name} (${duplicateCombo.code}).`,
      );
      return;
    }

    const comboPrice = Number(form.comboPrice);
    if (!Number.isFinite(comboPrice) || comboPrice < 0) {
      showNotice("error", "Giá combo không hợp lệ.");
      return;
    }

    if (baseTotal > 0 && comboPrice >= baseTotal) {
      showNotice(
        "error",
        "Giá combo phải nhỏ hơn giá lẻ để đúng nghiệp vụ giảm giá.",
      );
      return;
    }

    setSaving(true);
    try {
      if (isCreateMode) {
        await marketingApi.createComboRule({
          code: form.code.trim(),
          name: finalName,
          description: null,
          comboPrice,
          priority: 0,
          isActive: form.isActive,
          autoApply: false,
          groups: payloadGroups,
        });

        navigate("/office/marketing/combos", {
          replace: true,
          state: {
            notice: {
              type: "success",
              message: "Tạo combo thành công.",
            },
          },
        });
        return;
      }

      await marketingApi.updateComboRule(Number(comboRuleId), {
        code: form.code.trim(),
        name: finalName,
        description: null,
        comboPrice,
        priority: 0,
        isActive: form.isActive,
        autoApply: false,
      });

      await marketingApi.replaceComboRuleGroups(Number(comboRuleId), {
        groups: payloadGroups,
      });

      navigate("/office/marketing/combos", {
        replace: true,
        state: {
          notice: {
            type: "success",
            message: "Đã lưu combo thành công.",
          },
        },
      });
    } catch (e: any) {
      showNotice("error", e?.response?.data?.message || "Lưu combo thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={panelStyle}>Đang tải dữ liệu combo...</div>;
  if (err) return <div style={{ ...panelStyle, color: "#b91c1c" }}>{err}</div>;

  return (
    <>
      <style>{`
        @media (max-width: 1200px) {
          .combo-editor-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .combo-editor-preview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .combo-editor-info-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .combo-editor-preview-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .combo-editor-group-main {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <div style={pageStyle}>
        {notice ? (
          <div style={notice.type === "error" ? errorNoticeStyle : infoNoticeStyle}>
            {notice.message}
          </div>
        ) : null}

        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <Link to="/office/marketing/combos" style={backLinkStyle}>
              ← Về danh sách combo
            </Link>
            <div style={{ marginTop: 8, color: "#6b7280" }}>
              {isCreateMode ? "Tạo combo mới" : `Combo #${detail?.id ?? comboRuleId}`}
            </div>
          </div>

          <div style={headerRightStyle}>
            <label style={headerStatusBoxStyle}>
              <div style={headerStatusTextWrapStyle}>
                <div style={headerStatusLabelStyle}>Trạng thái</div>
                <div style={form.isActive ? statusOnTextStyle : statusOffTextStyle}>
                  {form.isActive ? "Đang bật" : "Đang tắt"}
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((current) => ({ ...current, isActive: e.target.checked }))
                }
              />
            </label>

            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => navigate("/office/marketing/combos")}
            >
              Quay lại
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : isCreateMode ? "Tạo combo" : "Lưu combo"}
            </button>
          </div>
        </div>

        <section style={cardStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Thông tin combo</h2>
            <div style={sectionSubtleStyle}>
              Form được làm gọn lại để tránh tràn cột và đè khung.
            </div>
          </div>

          <div className="combo-editor-info-grid" style={infoGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Code</span>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((current) => ({ ...current, code: e.target.value }))
                }
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Tên combo</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({ ...current, name: e.target.value }))
                }
                placeholder="Để trống sẽ tự lấy theo món đã chọn"
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Giá combo</span>
              <input
                value={form.comboPrice}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    comboPrice: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div style={previewCardStyle}>
            <div style={previewTitleWrapStyle}>
              <div style={previewEyebrowStyle}>Tên hiển thị</div>
              <div style={previewTitleStyle}>{previewName}</div>
            </div>

            <div className="combo-editor-preview-grid" style={previewStatsGridStyle}>
              <div style={previewStatCardStyle}>
                <div style={previewStatLabelStyle}>Giá lẻ</div>
                <div style={previewStatValueStyle}>
                  {selectedVariants.length
                    ? selectedVariants.map((item) => formatMoney(item.price)).join(" + ")
                    : "Chưa chọn món"}
                </div>
              </div>

              <div style={previewStatCardStyle}>
                <div style={previewStatLabelStyle}>Giá combo</div>
                <div style={previewStatValueStyle}>{formatMoney(comboPriceValue)}</div>
              </div>

              <div style={previewStatCardStyle}>
                <div style={previewStatLabelStyle}>Tiết kiệm</div>
                <div style={previewSavingValueStyle}>{formatMoney(totalSaving)}</div>
              </div>
            </div>
          </div>

          {duplicateCombo ? (
            <div style={warningBoxStyle}>
              Combo này đã tồn tại trong hệ thống:
              <strong>{` ${duplicateCombo.name}`}</strong>
              {duplicateCombo.code ? ` (${duplicateCombo.code})` : ""}. Đổi món
              hoặc sửa combo cũ thay vì tạo mới.
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderRowStyle}>
            <div style={{ minWidth: 0 }}>
              <h2 style={sectionTitleStyle}>Món trong combo</h2>
              <div style={helperTextStyle}>
                Chọn từng variant cụ thể để đảm bảo combo khớp đúng size và giá.
              </div>
            </div>

            <button type="button" style={secondaryButtonStyle} onClick={addGroup}>
              Thêm món
            </button>
          </div>

          <div style={groupsWrapStyle}>
            {groups.map((group, index) => {
              const filteredVariants = getFilteredVariants(group.keyword, index);
              const selected =
                group.productVariantId &&
                Number.isFinite(Number(group.productVariantId))
                  ? variantMap.get(Number(group.productVariantId))
                  : null;

              return (
                <div key={`group-${index}`} style={groupCardStyle}>
                  <div style={groupHeaderStyle}>
                    <div style={groupTitleStyle}>Món #{index + 1}</div>
                    <button
                      type="button"
                      style={dangerButtonStyle}
                      onClick={() => removeGroup(index)}
                      disabled={groups.length <= 2}
                    >
                      Xóa món
                    </button>
                  </div>

                  <div className="combo-editor-group-main" style={groupMainStyle}>
                    <div style={pickerColumnStyle}>
                      <div style={pickerLabelStyle}>Tìm và chọn variant</div>
                      <input
                        value={group.keyword}
                        onFocus={() => setOpenPickerIndex(index)}
                        onChange={(e) => {
                          updateGroup(index, {
                            keyword: e.target.value,
                            productVariantId: "",
                          });
                          setOpenPickerIndex(index);
                        }}
                        placeholder="Gõ tên món / size / sku..."
                        style={inputStyle}
                      />

                      {openPickerIndex === index ? (
                        <div style={inlineResultBoxStyle}>
                          {filteredVariants.length ? (
                            filteredVariants.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                style={inlineResultItemStyle}
                                onClick={() => selectVariant(index, item)}
                              >
                                <div style={{ fontWeight: 700 }}>
                                  {item.productName}
                                  {item.size ? ` (${item.size})` : ""}
                                </div>
                                <div style={inlineItemMetaStyle}>
                                  {item.categoryName || "Khác"}
                                  {item.sku ? ` · ${item.sku}` : ""}
                                  {` · ${formatMoney(item.price)}`}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div style={emptyResultStyle}>Không có món phù hợp.</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div style={selectedColumnStyle}>
                      <div style={pickerLabelStyle}>Đã chọn</div>
                      <div style={selectedInfoCardStyle}>
                        {selected ? (
                          <>
                            <div style={selectedNameStyle}>
                              {selected.productName}
                              {selected.size ? ` (${selected.size})` : ""}
                            </div>
                            <div style={selectedMetaStyle}>
                              {selected.categoryName || "Khác"}
                              {selected.sku ? ` · ${selected.sku}` : ""}
                            </div>
                            <div style={selectedPriceStyle}>
                              {formatMoney(selected.price)}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "#9ca3af" }}>Chưa chọn món</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const headerRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const headerStatusBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  border: "1px solid #d9dce1",
  borderRadius: 14,
  padding: "10px 14px",
  background: "#fff",
  minHeight: 46,
};

const headerStatusTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const headerStatusLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const statusOnTextStyle: React.CSSProperties = {
  color: "#166534",
  fontWeight: 800,
};

const statusOffTextStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontWeight: 800,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 24,
  padding: 24,
  display: "grid",
  gap: 18,
  overflow: "hidden",
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "center",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const sectionSubtleStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  marginTop: 6,
};

const helperTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  marginTop: 6,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#374151",
  fontSize: 15,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #d9dce1",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  background: "#fff",
};

const previewCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  borderRadius: 20,
  padding: 20,
  display: "grid",
  gap: 18,
  overflow: "hidden",
};

const previewTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const previewEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const previewTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.3,
  color: "#111827",
  wordBreak: "break-word",
};

const previewStatsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const previewStatCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: "16px 18px",
  background: "#fff",
  minWidth: 0,
};

const previewStatLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 8,
};

const previewStatValueStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#111827",
  fontWeight: 700,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const previewSavingValueStyle: React.CSSProperties = {
  fontSize: 20,
  color: "#166534",
  fontWeight: 800,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const warningBoxStyle: React.CSSProperties = {
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 16,
  padding: 16,
  lineHeight: 1.6,
};

const groupsWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const groupCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 16,
  background: "#fcfcfd",
  overflow: "hidden",
};

const groupHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const groupTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const groupMainStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.9fr)",
  gap: 18,
  alignItems: "start",
};

const pickerColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const selectedColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const pickerLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#374151",
};

const inlineResultBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  overflow: "auto",
  background: "#fff",
  maxHeight: 220,
  minWidth: 0,
};

const inlineResultItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  border: "none",
  borderBottom: "1px solid #f3f4f6",
  background: "#fff",
  cursor: "pointer",
};

const inlineItemMetaStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  marginTop: 4,
  wordBreak: "break-word",
};

const emptyResultStyle: React.CSSProperties = {
  padding: "14px 16px",
  color: "#6b7280",
};

const selectedInfoCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: "14px 16px",
  minHeight: 110,
  background: "#fff",
  display: "grid",
  gap: 6,
  alignContent: "start",
  minWidth: 0,
  overflow: "hidden",
};

const selectedNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  fontSize: 16,
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const selectedMetaStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const selectedPriceStyle: React.CSSProperties = {
  color: "#2f5c4f",
  fontWeight: 800,
  fontSize: 18,
  marginTop: 4,
};

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 18,
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#6b7280",
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #2f5c4f",
  background: "#2f5c4f",
  color: "#fff",
  borderRadius: 14,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d9dce1",
  background: "#fff",
  color: "#374151",
  borderRadius: 14,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fca5a5",
  background: "#fff",
  color: "#ef4444",
  borderRadius: 14,
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const errorNoticeStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 16,
  padding: "14px 16px",
  fontWeight: 600,
  lineHeight: 1.5,
};

const infoNoticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 16,
  padding: "14px 16px",
  fontWeight: 600,
  lineHeight: 1.5,
};