import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAuthStore,
  type AuthStoreItem,
} from "../../../app/store/auth.store";
import {
  inventoryAuditApi,
  type InventoryBatch,
  type InventorySheet,
  type InventorySheetItem,
} from "../../staff/api/inventoryAudit.api";

function fmtQty(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN") + " đ";
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN");
}

function formatWorkDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
}

function todayLocalYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getAuditLabel(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "Nghiêm trọng";
  if (s === "audit") return "Cần kiểm tra";
  return "Bình thường";
}

function getAuditBg(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "#dc2626";
  if (s === "audit") return "#d97706";
  return "#16a34a";
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

function getBatchStatusLabel(status?: string) {
  switch (String(status || "")) {
    case "draft":
      return "Nháp";
    case "submitted_to_shift_leader":
      return "Chờ trưởng ca";
    case "submitted_to_store_manager":
      return "Chờ quản lý cửa hàng";
    case "submitted_to_dm":
      return "Chờ DM duyệt";
    case "approved_final":
      return "Đã duyệt cuối";
    case "rejected_by_shift_leader":
      return "Bị trả bởi trưởng ca";
    case "rejected_by_store_manager":
      return "Bị trả bởi quản lý cửa hàng";
    case "rejected_by_dm":
      return "Bị trả bởi DM";
    default:
      return status || "--";
  }
}

type StoreOption = {
  id: number;
  code?: string;
  name: string;
};

function normalizeStoreOptions(
  rawStores?: AuthStoreItem[],
  storeIds?: number[],
  singleStoreId?: number,
  singleStoreName?: string,
) {
  const unique = new Map<number, StoreOption>();

  if (Array.isArray(rawStores)) {
    for (const item of rawStores) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      unique.set(id, {
        id,
        code: item?.code ? String(item.code).trim() : undefined,
        name: String(item?.name || "").trim() || `Store #${id}`,
      });
    }
  }

  if (Array.isArray(storeIds)) {
    for (const rawId of storeIds) {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) continue;

      if (!unique.has(id)) {
        unique.set(id, {
          id,
          name: `Store #${id}`,
        });
      }
    }
  }

  if (singleStoreId) {
    const id = Number(singleStoreId);
    if (!unique.has(id)) {
      unique.set(id, {
        id,
        name: String(singleStoreName || "").trim() || `Store #${id}`,
      });
    } else if (singleStoreName) {
      unique.set(id, {
        ...(unique.get(id) as StoreOption),
        name: String(singleStoreName).trim(),
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
}

function mergeStoreOptions(base: StoreOption[], batches: InventoryBatch[]) {
  const map = new Map<number, StoreOption>();

  for (const item of base) {
    map.set(Number(item.id), item);
  }

  for (const batch of batches) {
    const id = Number(batch.store_id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const old = map.get(id);
    const nextName = String(batch.store_name || "").trim();
    const nextCode = String(batch.store_code || "").trim();

    map.set(id, {
      id,
      code: nextCode || old?.code,
      name: nextName || old?.name || `Store #${id}`,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
}

function getStoreSearchText(store: StoreOption) {
  return [store.name, store.code, String(store.id)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getStoreDisplay(store: StoreOption | null) {
  if (!store) return "Chọn quán";
  if (store.code) return `${store.name} (${store.code})`;
  return store.name;
}

function getBatchDisplayName(batch?: InventoryBatch | null) {
  if (!batch) return "--";
  const dateText = formatWorkDate(batch.work_date);
  const storeCode = batch.store_code || `Store ${batch.store_id || ""}`;
  return `Phiếu tồn ${dateText} - ${storeCode} - Lần ${batch.cycle_no || 1}`;
}

export default function InventoryAuditApprovalPage({
  isEmbedded = false,
}: { isEmbedded?: boolean } = {}) {
  const user = useAuthStore((s) => s.user);

  const rawStoreOptions = useMemo(
    () =>
      normalizeStoreOptions(
        user?.stores,
        user?.storeIds,
        user?.storeId,
        user?.storeName,
      ),
    [user],
  );

  const [selectedStoreId, setSelectedStoreId] = useState<number | "">("");
  const [storeKeyword, setStoreKeyword] = useState("");
  const [storePickerOpen, setStorePickerOpen] = useState(false);

  const [workDate, setWorkDate] = useState(todayLocalYmd());
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchOptions, setBatchOptions] = useState<InventoryBatch[]>([]);
  const [batch, setBatch] = useState<InventoryBatch | null>(null);
  const [sheets, setSheets] = useState<
    Array<InventorySheet & { items: InventorySheetItem[] }>
  >([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const pickerRef = useRef<HTMLDivElement | null>(null);

  const storeOptions = useMemo(
    () => mergeStoreOptions(rawStoreOptions, batchOptions),
    [rawStoreOptions, batchOptions],
  );

  const filteredStores = useMemo(() => {
    const keyword = storeKeyword.trim().toLowerCase();
    if (!keyword) return storeOptions;
    return storeOptions.filter((store) =>
      getStoreSearchText(store).includes(keyword),
    );
  }, [storeKeyword, storeOptions]);

  const selectedStore = useMemo(
    () => storeOptions.find((x) => x.id === Number(selectedStoreId)) || null,
    [storeOptions, selectedStoreId],
  );

  const selectedBatch = useMemo(
    () =>
      batchOptions.find(
        (x) => String(x.batch_id || x.id) === String(selectedBatchId),
      ) || null,
    [batchOptions, selectedBatchId],
  );

  useEffect(() => {
    if (storeOptions.length === 1) {
      setSelectedStoreId(storeOptions[0].id);
    }
  }, [storeOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target as Node)) {
        setStorePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadReportByBatchId(id: number) {
    try {
      setLoading(true);
      setError("");
      const res = await inventoryAuditApi.getBatchReport(id);
      setBatch(res.batch);
      setSheets(res.sheets);
      setNote(res.batch.note || "");
      setSelectedBatchId(String(res.batch.batch_id || res.batch.id || ""));
    } catch (err: any) {
      setBatch(null);
      setSheets([]);
      setNote("");
      setError(err?.response?.data?.message || "Không tải được đợt kiểm");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchBatches() {
    if (!selectedStoreId) {
      setError("Phải chọn quán");
      return;
    }
    if (!workDate) {
      setError("Phải chọn ngày làm việc");
      return;
    }

    try {
      setSearching(true);
      setError("");
      setBatch(null);
      setSheets([]);
      setNote("");
      setSelectedBatchId("");

      const res = await inventoryAuditApi.searchBatches({
        storeId: Number(selectedStoreId),
        workDate,
      });

      const items = Array.isArray(res.items) ? res.items : [];
      setBatchOptions(items);

      if (items.length === 0) {
        setError("Không tìm thấy đợt kiểm nào theo quán và ngày đã chọn");
        return;
      }

      if (items.length === 1) {
        const onlyId = Number(items[0].batch_id || items[0].id);
        setSelectedBatchId(String(onlyId));
        await loadReportByBatchId(onlyId);
      }
    } catch (err: any) {
      setBatchOptions([]);
      setBatch(null);
      setSheets([]);
      setNote("");
      setError(err?.response?.data?.message || "Không tìm được đợt kiểm");
    } finally {
      setSearching(false);
    }
  }

  async function handleLoadSelectedBatch() {
    if (!selectedBatchId) {
      setError("Phải chọn batch");
      return;
    }

    await loadReportByBatchId(Number(selectedBatchId));
  }

  async function handleApproveDm() {
    if (!batch?.batch_id && !batch?.id) return;

    try {
      setLoading(true);
      setError("");
      await inventoryAuditApi.approveDm(
        Number(batch.batch_id || batch.id),
        note || null,
      );
      await loadReportByBatchId(Number(batch.batch_id || batch.id));
      await handleRefreshBatchOptions();
    } catch (err: any) {
      setError(err?.response?.data?.message || "DM duyệt thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!batch?.batch_id && !batch?.id) return;
    if (!note.trim()) {
      setError("Phải nhập lý do trả lại");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await inventoryAuditApi.rejectBatch(
        Number(batch.batch_id || batch.id),
        note.trim(),
      );
      await loadReportByBatchId(Number(batch.batch_id || batch.id));
      await handleRefreshBatchOptions();
    } catch (err: any) {
      setError(err?.response?.data?.message || "DM trả lại thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshBatchOptions() {
    if (!selectedStoreId || !workDate) return;

    try {
      const res = await inventoryAuditApi.searchBatches({
        storeId: Number(selectedStoreId),
        workDate,
      });
      setBatchOptions(Array.isArray(res.items) ? res.items : []);
    } catch {
      // bỏ qua lỗi refresh nhẹ
    }
  }

  function handleSelectStore(store: StoreOption) {
    setSelectedStoreId(store.id);
    setStorePickerOpen(false);
    setStoreKeyword("");
    setBatchOptions([]);
    setBatch(null);
    setSheets([]);
    setNote("");
    setSelectedBatchId("");
    setError("");
  }

  const totalBatchCount = batchOptions.length;
  const totalAuditLines = batchOptions.reduce(
    (acc, x) => acc + Number(x.audit_lines || 0),
    0,
  );
  const totalCriticalLines = batchOptions.reduce(
    (acc, x) => acc + Number(x.critical_lines || 0),
    0,
  );
  const totalVarianceValue = batchOptions.reduce(
    (acc, x) => acc + Number(x.total_estimated_variance_value || 0),
    0,
  );

  const dmApprovedAt = (
    batch as (InventoryBatch & { dm_approved_at?: string | null }) | null
  )?.dm_approved_at;

  return (
    <div style={{ padding: isEmbedded ? 0 : 24 }}>
      <div style={panelStyle}>
        {!isEmbedded && (
          <>
            <h2 style={{ marginTop: 0 }}>DM duyệt đợt kiểm hàng (batch)</h2>
            <p style={{ color: "#666" }}>
              Chỉ khi batch ở trạng thái <strong>chờ DM duyệt</strong> và DM xác
              nhận đợt thì hệ thống mới cập nhật lại tồn kho theo{" "}
              <strong>tồn thực tế</strong> của batch đó.
            </p>
          </>
        )}

        {error && <div style={errorBox}>{error}</div>}

        <div style={filterGrid}>
          <div style={{ position: "relative" }} ref={pickerRef}>
            <label style={filterLabel}>Quán</label>

            <button
              type="button"
              onClick={() => setStorePickerOpen((v) => !v)}
              style={selectButtonStyle}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedStore ? getStoreDisplay(selectedStore) : "Chọn quán"}
              </span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>▼</span>
            </button>

            {storePickerOpen && (
              <div style={storeDropdownStyle}>
                <input
                  autoFocus
                  value={storeKeyword}
                  onChange={(e) => setStoreKeyword(e.target.value)}
                  placeholder="Tìm theo tên quán, mã quán, store id..."
                  style={inputStyle}
                />

                <div style={storeListStyle}>
                  {filteredStores.length === 0 ? (
                    <div style={emptyStoreStyle}>Không có quán phù hợp</div>
                  ) : (
                    filteredStores.map((store) => {
                      const isSelected = Number(selectedStoreId) === store.id;
                      return (
                        <button
                          key={store.id}
                          type="button"
                          onClick={() => handleSelectStore(store)}
                          style={{
                            ...storeItemStyle,
                            background: isSelected ? "#eff6ff" : "#fff",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#111827" }}>
                            {store.code
                              ? `${store.name} (${store.code})`
                              : store.name}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "#6b7280",
                            }}
                          >
                            ID: {store.id}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={filterLabel}>Ngày làm việc</label>
            <input
              id="work-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              style={inputStyle}
              aria-label="Ngày làm việc"
            />
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              onClick={handleSearchBatches}
              disabled={searching || loading}
              style={primaryBtn}
            >
              {searching ? "Đang tìm..." : "Tải đợt kiểm"}
            </button>
          </div>
        </div>

        {batchOptions.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                margin: "18px 0 16px",
              }}
            >
              <div style={summaryBadge}>
                Tổng batch: <b>{totalBatchCount}</b>
              </div>
              <div
                style={{
                  ...summaryBadge,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                }}
              >
                Audit lines: <b>{totalAuditLines}</b>
              </div>
              <div
                style={{
                  ...summaryBadge,
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                }}
              >
                Critical lines: <b>{totalCriticalLines}</b>
              </div>
              <div
                style={{
                  ...summaryBadge,
                  background: "#eff6ff",
                  border: "1px solid #93c5fd",
                }}
              >
                Tổng lệch ước tính:{" "}
                <b>{totalVarianceValue.toLocaleString("vi-VN")} đ</b>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Các đợt kiểm tìm thấy
              </div>

              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 1200,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>Chọn</th>
                      <th style={thStyle}>Tên đợt</th>
                      <th style={thStyle}>Batch ID</th>
                      <th style={thStyle}>Cycle</th>
                      <th style={thStyle}>Quán</th>
                      <th style={thStyle}>Ngày</th>
                      <th style={thStyle}>Trạng thái</th>
                      <th style={thStyle}>Người tạo</th>
                      <th style={thStyle}>Gửi lúc</th>
                      <th style={thStyle}>Tổng phiếu</th>
                      <th style={thStyle}>Tổng dòng</th>
                      <th style={thStyle}>Audit</th>
                      <th style={thStyle}>Critical</th>
                      <th style={thStyle}>Tổng lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchOptions.map((item) => {
                      const id = String(item.batch_id || item.id);
                      const checked = id === selectedBatchId;

                      return (
                        <tr
                          key={id}
                          style={{
                            background: checked ? "#eff6ff" : "#fff",
                          }}
                        >
                          <td style={tdStyle}>
                            <input
                              type="radio"
                              name="selectedBatch"
                              checked={checked}
                              onChange={() => setSelectedBatchId(id)}
                              aria-label={`Chọn batch ${getBatchDisplayName(item)}`}
                            />
                          </td>
                          <td style={tdStyle}>{getBatchDisplayName(item)}</td>
                          <td style={tdStyle}>{id}</td>
                          <td style={tdStyle}>{item.cycle_no ?? "--"}</td>
                          <td style={tdStyle}>
                            {item.store_code
                              ? `${item.store_name || "--"} (${item.store_code})`
                              : item.store_name || "--"}
                          </td>
                          <td style={tdStyle}>
                            {formatWorkDate(item.work_date)}
                          </td>
                          <td style={tdStyle}>
                            {getBatchStatusLabel(item.status)}
                          </td>
                          <td style={tdStyle}>
                            {item.created_by_name || "--"}
                          </td>
                          <td style={tdStyle}>
                            {formatDateTime(item.submitted_at)}
                          </td>
                          <td style={tdStyle}>{fmtQty(item.total_sheets)}</td>
                          <td style={tdStyle}>{fmtQty(item.total_lines)}</td>
                          <td style={tdStyle}>{fmtQty(item.audit_lines)}</td>
                          <td style={tdStyle}>{fmtQty(item.critical_lines)}</td>
                          <td style={tdStyle}>
                            {fmtMoney(item.total_estimated_variance_value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleLoadSelectedBatch}
                  disabled={!selectedBatchId || loading}
                  style={primaryBtn}
                >
                  Xem batch đã chọn
                </button>

                {selectedBatch && (
                  <div style={selectedHint}>
                    Đã chọn: {getBatchDisplayName(selectedBatch)} -{" "}
                    {getBatchStatusLabel(selectedBatch.status)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {batch && (
          <>
            <div style={summaryGrid}>
              <div style={cardStyle}>
                <div style={labelStyle}>Tên đợt</div>
                <div style={valueStyle}>{getBatchDisplayName(batch)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Batch ID</div>
                <div style={valueStyle}>{batch.batch_id || batch.id}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Quán</div>
                <div style={valueStyle}>
                  {batch.store_code
                    ? `${batch.store_name || "--"} (${batch.store_code})`
                    : batch.store_name || "--"}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Ngày làm việc</div>
                <div style={valueStyle}>{formatWorkDate(batch.work_date)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Trạng thái</div>
                <div style={valueStyle}>{getBatchStatusLabel(batch.status)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Người tạo đợt</div>
                <div style={valueStyle}>{batch.created_by_name || "--"}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Đã gửi lúc</div>
                <div style={valueStyle}>
                  {formatDateTime(batch.submitted_at)}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>SM duyệt lúc</div>
                <div style={valueStyle}>
                  {formatDateTime(batch.store_manager_approved_at)}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>DM duyệt lúc</div>
                <div style={valueStyle}>{formatDateTime(dmApprovedAt)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng phiếu</div>
                <div style={valueStyle}>
                  {batch.total_sheets || sheets.length}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng dòng</div>
                <div style={valueStyle}>{batch.total_lines || "--"}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Audit lines</div>
                <div style={valueStyle}>{fmtQty(batch.audit_lines)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Critical lines</div>
                <div style={valueStyle}>{fmtQty(batch.critical_lines)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng giá trị ước tính</div>
                <div style={valueStyle}>
                  {fmtMoney(batch.total_estimated_value)}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Tổng lệch ước tính</div>
                <div style={valueStyle}>
                  {fmtMoney(batch.total_estimated_variance_value)}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${
                  batch.status === "approved_final" ? "#86efac" : "#fcd34d"
                }`,
                background:
                  batch.status === "approved_final" ? "#f0fdf4" : "#fffbeb",
                color: batch.status === "approved_final" ? "#166534" : "#92400e",
                lineHeight: 1.6,
              }}
            >
              {batch.status === "approved_final"
                ? "Batch này đã duyệt cuối. Tồn kho đã được cập nhật theo số lượng tồn thực tế (actual closing quantity)."
                : "Batch này chưa duyệt cuối ở bước DM, nên tồn kho chưa được cập nhật."}
            </div>

            <div style={{ marginTop: 16 }}>
              <label
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Ghi chú / lý do trả lại
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                style={textareaStyle}
                aria-label="Ghi chú"
              />
            </div>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {sheets.map((sheet) => (
                <div
                  key={sheet.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "#f9fafb",
                      padding: 14,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {sheet.title}
                    </div>
                    <div style={{ marginTop: 6, color: "#666" }}>
                      Loại: {getSheetTypeLabel(sheet.sheet_type)} | Người chịu
                      trách nhiệm: {sheet.responsible_user_name || "--"} | Giá
                      trị: {fmtMoney(sheet.total_estimated_value)}
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: 1300,
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={thStyle}>Mã hàng</th>
                          <th style={thStyle}>Tên hàng</th>
                          <th style={thStyle}>Đơn vị</th>
                          <th style={thStyle}>Tồn đầu</th>
                          <th style={thStyle}>Dùng lý thuyết</th>
                          <th style={thStyle}>Tồn cuối lý thuyết</th>
                          <th style={thStyle}>Tồn thực tế</th>
                          <th style={thStyle}>Lệch</th>
                          <th style={thStyle}>% lệch</th>
                          <th style={thStyle}>Giá trị</th>
                          <th style={thStyle}>Cảnh báo</th>
                          <th style={thStyle}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.items.map((item) => {
                          const rowBg =
                            item.audit_status === "critical"
                              ? "#fef2f2"
                              : item.audit_status === "audit"
                                ? "#fffbeb"
                                : "#ffffff";

                          return (
                            <tr key={item.id} style={{ background: rowBg }}>
                              <td style={tdStyle}>{item.ingredient_code}</td>
                              <td style={tdStyle}>{item.ingredient_name}</td>
                              <td style={tdStyle}>
                                {item.usage_unit || item.storage_unit || "--"}
                              </td>
                              <td style={tdStyle}>
                                {fmtQty(item.opening_qty)}
                              </td>
                              <td style={tdStyle}>
                                {fmtQty(item.theoretical_used_qty)}
                              </td>
                              <td style={tdStyle}>
                                {fmtQty(item.theoretical_closing_qty)}
                              </td>
                              <td style={tdStyle}>
                                {fmtQty(item.actual_closing_qty)}
                              </td>
                              <td style={tdStyle}>
                                {fmtQty(item.variance_qty)}
                              </td>
                              <td style={tdStyle}>
                                {item.variance_percent == null ||
                                Number.isNaN(Number(item.variance_percent))
                                  ? "--"
                                  : `${fmtQty(item.variance_percent)}%`}
                              </td>
                              <td style={tdStyle}>
                                {fmtMoney(item.estimated_line_value)}
                              </td>
                              <td style={tdStyle}>
                                <span
                                  style={{
                                    color: "#fff",
                                    background: getAuditBg(item.audit_status),
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {getAuditLabel(item.audit_status)}
                                </span>
                              </td>
                              <td style={tdStyle}>{item.note || "--"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {batch.status === "submitted_to_dm" && (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 16,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleApproveDm}
                  disabled={loading}
                  style={primaryBtn}
                >
                  DM xác nhận đợt & cập nhật tồn
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  style={dangerBtn}
                >
                  Trả lại cửa hàng
                </button>
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

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1.4fr) minmax(220px, 1fr) auto",
  gap: 12,
  marginTop: 16,
  alignItems: "end",
};

const filterLabel: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  minWidth: 180,
  boxSizing: "border-box",
};

const selectButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  minHeight: 42,
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  cursor: "pointer",
  color: "#111827",
  boxSizing: "border-box",
};

const storeDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  zIndex: 30,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
  padding: 12,
};

const storeListStyle: React.CSSProperties = {
  marginTop: 10,
  maxHeight: 260,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const storeItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
};

const emptyStoreStyle: React.CSSProperties = {
  padding: "12px 10px",
  color: "#6b7280",
  textAlign: "center",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 12,
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  height: 42,
};

const dangerBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#b91c1c",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  height: 42,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#fafafa",
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
  marginTop: 18,
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
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: "12px 10px",
  whiteSpace: "nowrap",
  verticalAlign: "top",
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 10,
};

const selectedHint: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#f3f4f6",
  color: "#111827",
  fontWeight: 600,
};

const summaryBadge: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};