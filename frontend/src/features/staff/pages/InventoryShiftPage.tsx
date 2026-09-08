import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  inventoryAuditApi,
  type InventoryBatch,
  type InventorySheet,
  type InventorySheetItem,
} from "../api/inventoryAudit.api";
import { PageHeader } from "../../shared/components/PageHeader";
import { formatDateTimeVN } from "../../shared/utils/formatDateTime";

function todayLocalYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN") + " đ";
}

function getBatchStatusLabel(status?: string) {
  switch (String(status || "")) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca duyệt";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng duyệt";
    case "submitted_to_dm":
      return "Chờ DM duyệt";
    case "approved_final":
      return "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Bị trưởng ca trả lại";
    case "rejected_by_store_manager":
      return "Bị quản lý cửa hàng trả lại";
    case "rejected_by_dm":
      return "Bị DM trả lại";
    default:
      return status || "--";
  }
}

function getSheetTypeLabel(type?: string) {
  switch (String(type || "")) {
    case "bakery":
      return "Bánh";
    case "ingredient_liquid":
      return "Nguyên liệu nước";
    case "ingredient_dry":
      return "Nguyên liệu khô / topping";
    case "consumable":
      return "Vật phẩm tiêu hao";
    case "merchandise":
      return "Merchandise";
    default:
      return type || "--";
  }
}

type DraftRow = {
  actualClosingQty: string;
  note: string;
};

type SheetDraftMap = Record<number, Record<number, DraftRow>>;

function canEditBatch(status?: string) {
  return [
    "draft",
    "rejected_by_shift_leader",
    "rejected_by_store_manager",
    "rejected_by_dm",
  ].includes(String(status || ""));
}

function canSubmitBatch(status?: string) {
  return canEditBatch(status);
}

export default function InventoryShiftPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeIds?.[0] ?? user?.storeId;

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isManager = roles.some((r) =>
    String(r).toLowerCase().includes("manager"),
  );

  const [workDate, setWorkDate] = useState(todayLocalYmd());
  const [batch, setBatch] = useState<InventoryBatch | null>(null);
  const [sheets, setSheets] = useState<InventorySheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<InventorySheet | null>(
    null,
  );
  const [items, setItems] = useState<InventorySheetItem[]>([]);
  const [draftMap, setDraftMap] = useState<SheetDraftMap>({});
  const [workspaceDrafts, setWorkspaceDrafts] = useState<InventoryBatch[]>([]);
  const [workspaceHistory, setWorkspaceHistory] = useState<InventoryBatch[]>(
    [],
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  function getItemDraft(
    sheetId: number | null | undefined,
    ingredientId: number,
  ) {
    if (!sheetId) return undefined;
    return draftMap[Number(sheetId)]?.[Number(ingredientId)];
  }

  const totalSheetValue = useMemo(() => {
    return items.reduce((acc, item) => {
      const draft = getItemDraft(selectedSheetId, Number(item.ingredient_id));
      const actual =
        draft?.actualClosingQty == null || draft.actualClosingQty === ""
          ? item.actual_closing_qty
          : Number(draft.actualClosingQty);

      if (actual == null) return acc;
      return acc + actual * Number(item.estimated_unit_cost || 0);
    }, 0);
  }, [items, draftMap, selectedSheetId]);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const text = [
        item.ingredient_code,
        item.ingredient_name,
        item.category,
        item.storage_unit,
        item.usage_unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [items, keyword]);

  function syncSheetDraftFromItems(
    sheetId: number,
    nextItems: InventorySheetItem[],
  ) {
    setDraftMap((prev) => {
      const currentSheetDraft = { ...(prev[Number(sheetId)] || {}) };

      for (const item of nextItems) {
        currentSheetDraft[item.ingredient_id] = {
          actualClosingQty:
            item.actual_closing_qty == null
              ? ""
              : String(item.actual_closing_qty),
          note: item.note || "",
        };
      }

      return {
        ...prev,
        [Number(sheetId)]: currentSheetDraft,
      };
    });
  }

  function replaceSheetInList(nextSheet: InventorySheet) {
    setSheets((prev) =>
      prev.map((sheet) =>
        Number(sheet.id) === Number(nextSheet.id) ? nextSheet : sheet,
      ),
    );
  }

  async function loadWorkspace() {
    if (!storeId) return;

    try {
      setWorkspaceLoading(true);

      const [draftsRes] = await Promise.all([
        inventoryAuditApi.getBatchWorkspace({
          storeId: Number(storeId),
          workDate,
          scope: "drafts",
        }),
      ]);

      setWorkspaceDrafts(Array.isArray(draftsRes.items) ? draftsRes.items : []);
      setWorkspaceHistory([]);
    } catch (err) {
      console.error(err);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function loadCurrent() {
    try {
      setLoading(true);
      setError("");

      if (!storeId) {
        setError("Không tìm thấy cửa hàng");
        return;
      }

      const res = await inventoryAuditApi.getCurrentBatch({
        workDate,
        storeId: Number(storeId),
      });

      const data = res.data;

      if (!data) {
        setBatch(null);
        setSheets([]);
        setSelectedSheet(null);
        setSelectedSheetId(null);
        setItems([]);
        setDraftMap({});
        setBatchNote("");
        setRejectNote("");
        setKeyword("");
        await loadWorkspace();
        return;
      }

      setBatch(data.batch);
      setSheets(data.sheets);
      setBatchNote(data.batch.note || "");
      setRejectNote(data.batch.rejection_note || "");

      if (data.sheets.length > 0) {
        const nextSheetId =
          data.sheets.find((x) => Number(x.id) === Number(selectedSheetId))
            ?.id ?? data.sheets[0].id;
        await loadSheetDetail(Number(nextSheetId));
      } else {
        setSelectedSheet(null);
        setSelectedSheetId(null);
        setItems([]);
        setDraftMap({});
        setKeyword("");
      }

      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được đợt kiểm hàng");
    } finally {
      setLoading(false);
    }
  }

  async function loadSheetDetail(sheetId: number) {
    try {
      const res = await inventoryAuditApi.getSheetDetail(sheetId);
      setSelectedSheet(res.sheet);
      setSelectedSheetId(sheetId);
      setItems(res.items);
      setKeyword("");
      syncSheetDraftFromItems(sheetId, res.items);
      replaceSheetInList(res.sheet);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được phiếu");
    }
  }

  async function handleResumeBatch(target: InventoryBatch) {
    try {
      setSubmitting(true);
      setError("");

      setBatch(target);
      const report = await inventoryAuditApi.getBatchReport(
        Number(target.batch_id || target.id),
      );

      setBatch(report.batch);
      setSheets(report.sheets || []);
      setBatchNote(report.batch?.note || target.note || "");
      setRejectNote(
        report.batch?.rejection_note || target.rejection_note || "",
      );

      const nextSheet =
        Array.isArray(report.sheets) && report.sheets.length > 0
          ? report.sheets[0]
          : null;

      if (nextSheet?.id) {
        await loadSheetDetail(Number(nextSheet.id));
      } else {
        setSelectedSheet(null);
        setSelectedSheetId(null);
        setItems([]);
        setDraftMap({});
        setKeyword("");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không mở lại được phiếu nháp");
    } finally {
      setSubmitting(false);
    }
  }

  function updateDraft(ingredientId: number, patch: Partial<DraftRow>) {
    if (!selectedSheetId) return;

    setDraftMap((prev) => {
      const sheetDraft = prev[Number(selectedSheetId)] || {};

      return {
        ...prev,
        [Number(selectedSheetId)]: {
          ...sheetDraft,
          [ingredientId]: {
            actualClosingQty: sheetDraft[ingredientId]?.actualClosingQty ?? "",
            note: sheetDraft[ingredientId]?.note ?? "",
            ...patch,
          },
        },
      };
    });
  }

  function buildPayloadItems(onlyDirty = false) {
    const rows = items.map((item) => {
      const draft = getItemDraft(selectedSheetId, Number(item.ingredient_id));
      const actualValue =
        draft?.actualClosingQty == null || draft.actualClosingQty === ""
          ? null
          : Number(draft.actualClosingQty);

      const next = {
        ingredientId: Number(item.ingredient_id),
        actualClosingQty: actualValue,
        note: draft?.note?.trim() ? draft.note.trim() : null,
      };

      if (!onlyDirty) return { item, next };

      const prevActual =
        item.actual_closing_qty == null
          ? null
          : Number(item.actual_closing_qty);
      const prevNote = item.note?.trim() || null;

      const changed =
        prevActual !== next.actualClosingQty || prevNote !== next.note;

      return changed ? { item, next } : null;
    });

    return rows.filter(Boolean).map((x: any) => x.next);
  }

  async function handleOpenBatch() {
    try {
      setSubmitting(true);
      setError("");

      await inventoryAuditApi.openBatch({
        workDate,
        storeId: Number(storeId),
        note: batchNote || null,
      });

      await loadCurrent();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không mở được đợt kiểm hàng");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSheet(
    type:
      | "bakery"
      | "ingredient_liquid"
      | "ingredient_dry"
      | "consumable"
      | "merchandise",
  ) {
    if (!batch?.batch_id && !batch?.id) return;

    try {
      setSubmitting(true);
      setError("");

      const batchId = Number(batch.batch_id || batch.id);

      await inventoryAuditApi.createSheet({
        batchId,
        sheetType: type,
        responsibleUserId: Number(user?.id),
      });

      await loadCurrent();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tạo được phiếu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedSheet?.id) return;

    try {
      setSubmitting(true);
      setError("");

      const res = await inventoryAuditApi.saveSheetDraft({
        sheetId: Number(selectedSheet.id),
        note: selectedSheet.note || null,
        items: buildPayloadItems(true),
      });

      setSelectedSheet(res.sheet);
      setItems(res.items);
      replaceSheetInList(res.sheet);
      syncSheetDraftFromItems(Number(res.sheet.id), res.items);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không lưu được phiếu nháp");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitSheet() {
    if (!selectedSheet?.id) return;

    try {
      setSubmitting(true);
      setError("");

      const res = await inventoryAuditApi.submitSheet({
        sheetId: Number(selectedSheet.id),
        note: selectedSheet.note || null,
        items: buildPayloadItems(true),
      });

      setSelectedSheet(res.sheet);
      setItems(res.items);
      replaceSheetInList(res.sheet);
      syncSheetDraftFromItems(Number(res.sheet.id), res.items);
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không gửi được phiếu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitBatch() {
    if (!batch?.batch_id && !batch?.id) return;

    try {
      setSubmitting(true);
      setError("");

      const res = await inventoryAuditApi.submitBatch(
        Number(batch.batch_id || batch.id),
        batchNote || null,
      );

      if (res?.batch) {
        setBatch(res.batch);
        setBatchNote(res.batch.note || batchNote || "");
        setRejectNote(res.batch.rejection_note || "");
      }

      if (Array.isArray(res?.sheets)) {
        setSheets(res.sheets);
        if (selectedSheetId) {
          const nextSelected =
            res.sheets.find(
              (x: InventorySheet) => Number(x.id) === Number(selectedSheetId),
            ) || null;
          if (nextSelected) {
            setSelectedSheet(nextSelected);
          }
        }
      }

      await loadWorkspace();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không gửi được đợt kiểm");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecallBatch() {
    if (!batch?.batch_id && !batch?.id) return;

    try {
      setLoading(true);
      setError("");
      await inventoryAuditApi.recallBatch(
        Number(batch.batch_id || batch.id),
        batchNote || null,
      );
      await loadCurrent();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Không thể thu hồi batch để sửa",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, workDate]);

  const isEditable = canEditBatch(batch?.status);
  const hasSheetType = (type: string) =>
    sheets.some((x) => x.sheet_type === type);

  if (loading) {
    return <div style={{ padding: 24 }}>Đang tải đợt kiểm hàng...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        backTo={isManager ? "/store/manager" : "/store/staff"}
        backLabel={isManager ? "Trang quản lý" : "Trang nhân viên"}
        title="Kiểm hàng theo ca"
        subtitle="Mỗi đợt kiểm có nhiều phiếu con, nhân sự nhập số thực đếm và ghi chú theo từng phiếu."
      />

      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <div />

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label htmlFor="inventory-work-date" style={{ fontWeight: 600 }}>
              Ngày làm việc
            </label>
            <input
              id="inventory-work-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              style={inputStyle}
            />

            {!batch && (
              <button
                onClick={handleOpenBatch}
                disabled={submitting}
                style={primaryBtn}
              >
                Tạo đợt kiểm mới
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
            marginTop: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 14,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Nháp / bị trả lại
            </div>
            {workspaceLoading ? (
              <div>Đang tải...</div>
            ) : workspaceDrafts.length === 0 ? (
              <div style={{ color: "#6b7280" }}>Chưa có batch nháp nào</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {workspaceDrafts.map((x) => (
                  <button
                    key={Number(x.batch_id || x.id)}
                    type="button"
                    onClick={() => handleResumeBatch(x)}
                    style={{
                      textAlign: "left",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {`Phiếu tồn ${
                        x.work_date
                          ? new Date(x.work_date).toLocaleDateString("vi-VN")
                          : "--"
                      } - Lần ${x.cycle_no || 1}`}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {getBatchStatusLabel(x.status)}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {x.store_name || `Store #${x.store_id}`} •{" "}
                      {x.work_date || workDate}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 14,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Lịch sử đã gửi
            </div>
            {workspaceLoading ? (
              <div>Đang tải...</div>
            ) : workspaceHistory.length === 0 ? (
              <div style={{ color: "#6b7280" }}>Chưa có batch đã gửi</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {workspaceHistory.map((x) => (
                  <div
                    key={Number(x.batch_id || x.id)}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {`Phiếu tồn ${
                        x.work_date
                          ? new Date(x.work_date).toLocaleDateString("vi-VN")
                          : "--"
                      } - Lần ${x.cycle_no || 1}`}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {getBatchStatusLabel(x.status)}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {x.store_name || `Store #${x.store_id}`} •{" "}
                      {x.work_date || workDate}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 12,
            padding: 14,
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Lịch sử kiểm hàng</div>
            <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
              Tách riêng lịch sử để màn staff chỉ tập trung vào batch đang nhập hoặc bị trả lại.
            </div>
          </div>

          <Link
            to="/store/staff/inventory-history"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              color: "#111827",
              fontWeight: 600,
              background: "#fff",
              alignSelf: "flex-start",
            }}
          >
            Xem trang lịch sử riêng
          </Link>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        {batch && (
          <>
            <div style={summaryGrid}>
              <div style={cardStyle}>
                <div style={labelStyle}>Cửa hàng</div>
                <div style={valueStyle}>
                  {batch.store_name || user?.storeName || `Store #${storeId}`}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Mã quán</div>
                <div style={valueStyle}>{batch.store_code || "--"}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Ngày làm việc</div>
                <div style={valueStyle}>{batch.work_date}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Batch</div>
                <div style={valueStyle}>#{batch.cycle_no}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Trạng thái</div>
                <div style={valueStyle}>
                  {getBatchStatusLabel(batch.status)}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Người tạo đợt</div>
                <div style={valueStyle}>{batch.created_by_name || "--"}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng phiếu</div>
                <div style={valueStyle}>
                  {batch.total_sheets ?? sheets.length}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng giá trị ước tính</div>
                <div style={valueStyle}>
                  {fmtMoney(batch.total_estimated_value)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Ghi chú đợt kiểm
              </label>
              <textarea
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                rows={3}
                placeholder="Ví dụ: kiểm hàng cuối ca sáng"
                style={textareaStyle}
                disabled={!isEditable}
              />
            </div>

            {(batch.rejection_note || rejectNote) && (
              <div style={warningBox}>
                <strong>Lý do trả lại:</strong>{" "}
                {batch.rejection_note || rejectNote}
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Phiếu con</div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                {!hasSheetType("bakery") && isEditable && (
                  <button
                    type="button"
                    onClick={() => handleCreateSheet("bakery")}
                    disabled={submitting}
                    style={secondaryBtn}
                  >
                    + Phiếu bánh
                  </button>
                )}

                {!hasSheetType("ingredient_liquid") && isEditable && (
                  <button
                    type="button"
                    onClick={() => handleCreateSheet("ingredient_liquid")}
                    disabled={submitting}
                    style={secondaryBtn}
                  >
                    + Phiếu nguyên liệu nước
                  </button>
                )}

                {!hasSheetType("ingredient_dry") && isEditable && (
                  <button
                    type="button"
                    onClick={() => handleCreateSheet("ingredient_dry")}
                    disabled={submitting}
                    style={secondaryBtn}
                  >
                    + Phiếu nguyên liệu khô / topping
                  </button>
                )}

                {!hasSheetType("consumable") && isEditable && (
                  <button
                    type="button"
                    onClick={() => handleCreateSheet("consumable")}
                    disabled={submitting}
                    style={secondaryBtn}
                  >
                    + Phiếu vật phẩm tiêu hao
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    onClick={() => loadSheetDetail(Number(sheet.id))}
                    style={{
                      ...sheetCardStyle,
                      borderColor:
                        selectedSheetId === Number(sheet.id)
                          ? "#111827"
                          : "#e5e7eb",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {sheet.title}
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      Loại: {getSheetTypeLabel(sheet.sheet_type)}
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      Người chịu trách nhiệm:{" "}
                      {sheet.responsible_user_name || "--"}
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      Trạng thái phiếu:{" "}
                      {sheet.status === "submitted" ? "Đã gửi" : "Nháp"}
                    </div>
                    <div style={{ color: "#111827", fontWeight: 700 }}>
                      Giá trị ước tính: {fmtMoney(sheet.total_estimated_value)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!batch && (
          <p style={{ marginTop: 20, color: "#666" }}>
            Chưa có đợt kiểm cho ngày này. Bấm “Tạo đợt kiểm mới” để bắt đầu.
          </p>
        )}

        {selectedSheet && (
          <>
            <div style={{ marginTop: 28, marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>
                {selectedSheet.title} -{" "}
                {getSheetTypeLabel(selectedSheet.sheet_type)}
              </h3>
              <div style={{ color: "#666", marginTop: 8 }}>
                Quán: {selectedSheet.store_name || batch?.store_name || "--"} |
                Người chịu trách nhiệm:{" "}
                {selectedSheet.responsible_user_name || "--"} | Giá trị ước tính
                hiện tại: {fmtMoney(totalSheetValue)}
              </div>
            </div>

            {batch?.rejection_note ? (
              <div
                style={{
                  marginTop: 12,
                  marginBottom: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  color: "#9a3412",
                  fontWeight: 500,
                }}
              >
                Lý do trả lại: {batch.rejection_note}
              </div>
            ) : null}

            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 12,
                  alignItems: "center",
                }}
              >
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm theo mã hàng / tên hàng..."
                  style={{
                    width: 320,
                    maxWidth: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    outline: "none",
                  }}
                />
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  Hiển thị {filteredItems.length}/{items.length} dòng
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 980,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Mã hàng</th>
                    <th style={thStyle}>Tên hàng</th>
                    <th style={thStyle}>Đơn vị</th>
                    <th style={thStyle}>Số thực đếm</th>
                    <th style={thStyle}>Giá trị ước tính</th>
                    <th style={thStyle}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const draft = getItemDraft(
                      selectedSheetId,
                      Number(item.ingredient_id),
                    ) || {
                      actualClosingQty: "",
                      note: "",
                    };

                    const actual =
                      draft.actualClosingQty === ""
                        ? null
                        : Number(draft.actualClosingQty);

                    const lineValue =
                      actual == null
                        ? 0
                        : actual * Number(item.estimated_unit_cost || 0);

                    return (
                      <tr key={item.id}>
                        <td style={tdStyle}>{item.ingredient_code}</td>
                        <td style={tdStyle}>{item.ingredient_name}</td>
                        <td style={tdStyle}>{item.usage_unit || "--"}</td>
                        <td style={tdStyle}>
                          <input
                            id={`inventory-actual-qty-${selectedSheetId}-${item.ingredient_id}`}
                            type="number"
                            step="0.001"
                            value={draft.actualClosingQty}
                            onChange={(e) =>
                              updateDraft(item.ingredient_id, {
                                actualClosingQty: e.target.value,
                              })
                            }
                            disabled={!isEditable}
                            aria-label={`Số thực đếm cho ${item.ingredient_name || item.ingredient_code}`}
                            style={{ ...inputStyle, width: 140 }}
                          />
                        </td>
                        <td style={tdStyle}>{fmtMoney(lineValue)}</td>
                        <td style={tdStyle}>
                          <input
                            id={`inventory-note-${item.ingredient_id}`}
                            type="text"
                            value={draft.note}
                            onChange={(e) =>
                              updateDraft(item.ingredient_id, {
                                note: e.target.value,
                              })
                            }
                            disabled={!isEditable}
                            placeholder="Ghi chú..."
                            style={{ ...inputStyle, width: 240 }}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: 16,
                          textAlign: "center",
                          color: "#666",
                        }}
                      >
                        {items.length === 0
                          ? "Chưa có dòng hàng để kiểm."
                          : "Không tìm thấy dòng hàng phù hợp."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {isEditable && (
                <>
                  <button
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    style={secondaryBtn}
                  >
                    Lưu nháp phiếu
                  </button>
                  <button
                    onClick={handleSubmitSheet}
                    disabled={submitting}
                    style={primaryBtn}
                  >
                    Gửi phiếu này
                  </button>
                </>
              )}

              {isEditable && sheets.length > 0 && (
                <button
                  onClick={handleSubmitBatch}
                  disabled={
                    submitting ||
                    !canSubmitBatch(batch?.status) ||
                    sheets.some((x) => x.status !== "submitted")
                  }
                  style={primaryBtn}
                >
                  Gửi cả đợt kiểm
                </button>
              )}

              {batch?.status === "submitted_to_shift_leader" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                  <div>
                    Đợt kiểm đã chuyển sang trang xác nhận của trưởng ca. Nếu
                    cần sửa, hãy thu hồi batch trước khi trưởng ca duyệt.
                  </div>

                  <button
                    type="button"
                    onClick={handleRecallBatch}
                    disabled={loading}
                  >
                    Thu hồi để sửa
                  </button>
                </div>
              )}

              {batch?.status === "submitted_to_store_manager" && (
                <div style={infoBox}>
                  Đợt kiểm đã chuyển sang trang duyệt của quản lý cửa hàng.
                </div>
              )}

              {batch?.status === "submitted_to_dm" && (
                <div style={infoBox}>
                  Đợt kiểm đã chuyển lên DM duyệt trên office.
                </div>
              )}

              {batch?.status === "approved_final" && (
                <div style={successBox}>Đợt kiểm đã được duyệt cuối.</div>
              )}
            </div>

            {selectedSheet?.submitted_at && (
              <div style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
                Thời gian gửi phiếu:{" "}
                {formatDateTimeVN(selectedSheet.submitted_at)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 12,
  resize: "vertical",
  background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#fafafa",
};

const sheetCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
  textAlign: "left",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 6,
};

const valueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const summaryGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "12px 10px",
  whiteSpace: "nowrap",
  background: "#f9fafb",
  position: "sticky",
  top: 0,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: "12px 10px",
  whiteSpace: "nowrap",
  verticalAlign: "top",
};

const errorBox: React.CSSProperties = {
  marginTop: 16,
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 10,
};

const warningBox: React.CSSProperties = {
  marginTop: 16,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fdba74",
  padding: 12,
  borderRadius: 10,
};

const infoBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 600,
};

const successBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#ecfdf5",
  color: "#065f46",
  fontWeight: 700,
};
