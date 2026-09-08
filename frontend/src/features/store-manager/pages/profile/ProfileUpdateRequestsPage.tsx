import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { storeStaffApi } from "../../../staff/api/storeStaff.api";
import {
  profileUpdateRequestApi,
  type ProfileDocument,
  type ProfileUpdateRequestItem,
  type RequestDetail,
} from "../../../staff/api/profileUpdateRequest.api";
import { PROFILE_REQUEST_FIELD_LABELS_VI } from "../../../staff/pages/profile/profileRequestFieldMeta";
import { PageHeader } from "../../../shared/components/PageHeader";

const cardStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.96)",
  borderRadius: 24,
  padding: 24,
  border: "1px solid #e6ede3",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.06)",
};

const filterCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: 22,
  background: "linear-gradient(180deg, #ffffff 0%, #fcfdf9 100%)",
};

const actionButtonBase: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: "0.92rem",
  borderRadius: 12,
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

type StoreItem = { id: number; name: string };

const FIELD_LABELS: Record<string, string> = { ...PROFILE_REQUEST_FIELD_LABELS_VI };

type ChangeRow = {
  fieldKey: string;
  fieldLabel: string;
  previousValue: string;
  nextValue: string;
};

function formatRequestedValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function RequestedDataBlock({ data }: { data: Record<string, unknown> }) {
  const prev = data._previousValues as Record<string, unknown> | undefined;
  const mainEntries = Object.entries(data).filter(([k]) => !k.startsWith("_"));
  return (
    <>
      {mainEntries.map(([k, v]) => (
        <div key={k}>
          <strong>{FIELD_LABELS[k] ?? k}:</strong> {formatRequestedValue(v)}
        </div>
      ))}
      {prev && typeof prev === "object" && Object.keys(prev).length > 0 ? (
        <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: "0.85rem", color: "#475569" }}>
            Hồ sơ tại thời điểm nhân viên gửi yêu cầu (để đối chiếu)
          </div>
          {Object.entries(prev).map(([k, v]) => (
            <div key={k} style={{ fontSize: "0.9rem" }}>
              <strong>{FIELD_LABELS[k] ?? k}:</strong> {formatRequestedValue(v)}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function buildChangeRows(
  data: Record<string, unknown>,
  currentProfile: RequestDetail["currentProfile"] | null | undefined
): ChangeRow[] {
  const prev =
    data._previousValues && typeof data._previousValues === "object" && !Array.isArray(data._previousValues)
      ? (data._previousValues as Record<string, unknown>)
      : {};

  const currentProfileMap: Record<string, unknown> = {
    fullName: currentProfile?.fullName ?? null,
    phone: currentProfile?.phone ?? null,
    email: currentProfile?.email ?? null,
  };

  return Object.entries(data)
    .filter(([key]) => !key.startsWith("_"))
    .map(([fieldKey, value]) => ({
      fieldKey,
      fieldLabel: FIELD_LABELS[fieldKey] ?? fieldKey,
      previousValue: formatRequestedValue(
        Object.prototype.hasOwnProperty.call(prev, fieldKey) ? prev[fieldKey] : currentProfileMap[fieldKey]
      ),
      nextValue: formatRequestedValue(value),
    }));
}

function getFullFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base =
    (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return url;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function DocumentPreviewList({ documents }: { documents: ProfileDocument[] }) {
  if (documents.length === 0) {
    return <p style={{ color: "#666", margin: 0 }}>Chưa có hồ sơ đính kèm để xem.</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {documents.map((document) => (
        <a
          key={document.id}
          href={getFullFileUrl(document.fileUrl)}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            minWidth: 180,
            maxWidth: 220,
            padding: "12px 14px",
            borderRadius: 16,
            background: "#fbfcfa",
            border: "1px solid #e3ece0",
            color: "#2a392d",
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
          }}
        >
          {document.mimeType?.startsWith("image/") ? (
            <img
              src={getFullFileUrl(document.fileUrl)}
              alt={document.fileName}
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
                borderRadius: 12,
                marginBottom: 10,
                border: "1px solid #e5ece3",
              }}
            />
          ) : null}
          <div style={{ fontWeight: 700, wordBreak: "break-word", lineHeight: 1.5 }}>{document.fileName}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
            {document.uploadedAt ? new Date(document.uploadedAt).toLocaleString("vi-VN") : "—"}
          </div>
        </a>
      ))}
    </div>
  );
}

function formatStatus(status: string) {
  if (status === "pending_hr") return { label: "Chờ HR", color: "#975a16", bg: "#fef3c7" };
  if (status === "pending" || status === "pending_sm") {
    return { label: "Chờ SM duyệt", color: "#b7791f", bg: "#fefcbf" };
  }
  if (status === "approved") return { label: "Đã duyệt", color: "#276749", bg: "#c6f6d5" };
  if (status.startsWith("rejected")) return { label: "Đã từ chối", color: "#c53030", bg: "#fed7d7" };
  return { label: "Chưa xác định", color: "#718096", bg: "#edf2f7" };
}

export default function ProfileUpdateRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdParam = searchParams.get("storeId");
  const requestIdParam = searchParams.get("requestId");
  const rawStatusParam = searchParams.get("status") || searchParams.get("requestStatus") || "pending";
  const statusParam =
    rawStatusParam === "pending_sm"
      ? "pending"
      : rawStatusParam === "rejected_by_sm" || rawStatusParam === "rejected_by_hr"
        ? "rejected"
        : rawStatusParam;
  const storeId = storeIdParam ? Number(storeIdParam) : 0;

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next);
  };

  const openDetail = (requestId: number) => {
    setDetailId(requestId);
    updateSearchParams({ requestId: String(requestId) });
  };

  const closeDetail = () => {
    setDetailId(null);
    updateSearchParams({ requestId: null });
  };

  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const [requests, setRequests] = useState<ProfileUpdateRequestItem[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshRequests = async () => {
    if (!storeId || !Number.isFinite(storeId)) return;
    setLoadingRequests(true);
    setActionError(null);
    try {
      const res = await profileUpdateRequestApi.listRequests(storeId, statusParam || undefined);
      setRequests(res.requests ?? []);
    } catch {
      setError("Không tải được danh sách yêu cầu.");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    storeStaffApi
      .getMyStores()
      .then((res: unknown) => {
        const stores = Array.isArray(res)
          ? res
          : Array.isArray((res as { stores?: StoreItem[] })?.stores)
            ? (res as { stores: StoreItem[] }).stores
            : [];
        setStoreList(stores);
        if (stores.length > 0 && !storeIdParam) {
          updateSearchParams({ storeId: String(stores[0].id), status: statusParam });
        }
      })
      .catch(() => setError("Không tải được danh sách cửa hàng."))
      .finally(() => setLoadingStores(false));
  }, []);

  useEffect(() => {
    if (!storeId || !Number.isFinite(storeId)) {
      setRequests([]);
      return;
    }
    setError("");
    void refreshRequests();
  }, [storeId, statusParam]);

  useEffect(() => {
    const requestId = Number(requestIdParam);
    if (Number.isFinite(requestId) && requestId > 0) {
      setDetailId(requestId);
      return;
    }
    setDetailId(null);
  }, [requestIdParam]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    profileUpdateRequestApi
      .getRequestDetail(detailId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [detailId]);

  return (
    <div
      style={{
        padding: 28,
        maxWidth: 980,
        minHeight: "100%",
        background: "linear-gradient(180deg, #f7fbf7 0%, #eef5ee 100%)",
        borderRadius: 28,
      }}
    >
      <PageHeader
        backTo="/store/manager"
        backLabel="Trang quản lý"
        title="Theo dõi yêu cầu chỉnh sửa hồ sơ"
        subtitle="Quản lý tiến trình duyệt các yêu cầu chỉnh sửa hồ sơ nhân viên theo phạm vi cửa hàng."
      />

      <div style={filterCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#223126" }}>Bộ lọc yêu cầu</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "#6b7b6f" }}>
              Chọn cửa hàng và trạng thái để theo dõi phiếu cần xử lý hoặc đã chuyển HR.
            </div>
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "#eff6ef",
              border: "1px solid #d7e5d5",
              color: "#46604a",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Tổng phiếu: {requests.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 4, flexWrap: "wrap" }}>
          <div>
            <label className="cafe-label" htmlFor="profile-requests-filter-store">
              Cửa hàng
            </label>
            <select
              id="profile-requests-filter-store"
              className="cafe-input"
              value={storeId || ""}
              onChange={(e) => updateSearchParams({ storeId: e.target.value, status: statusParam, requestId: null })}
              disabled={loadingStores}
              style={{ minWidth: 200 }}
            >
              <option value="">-- Chọn cửa hàng --</option>
              {storeList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="cafe-label" htmlFor="profile-requests-filter-status">
              Trạng thái
            </label>
            <select
              id="profile-requests-filter-status"
              className="cafe-input"
              value={statusParam}
              onChange={(e) => updateSearchParams({ storeId: String(storeId), status: e.target.value, requestId: null })}
              style={{ minWidth: 160 }}
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="pending_hr">Đã chuyển HR</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
            {error}
          </div>
        )}
        {actionError && (
          <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
            {actionError}
          </div>
        )}

        {loadingRequests ? (
          <p>Đang tải...</p>
        ) : !storeId ? (
          <p style={{ color: "#666" }}>Chọn cửa hàng để xem yêu cầu.</p>
        ) : requests.length === 0 ? (
          <div
            style={{
              marginTop: 12,
              padding: "22px 18px",
              borderRadius: 18,
              border: "1px dashed #cedbc9",
              background: "#f8fbf6",
              color: "#6b7b6f",
              textAlign: "center",
            }}
          >
            Không có yêu cầu nào.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {requests.map((r) => {
              const st = formatStatus(r.status);
              const pendingForSm = r.status === "pending_sm" || r.status === "pending";
              const pendingForHr = r.status === "pending_hr";
              return (
                <div
                  key={r.id}
                  style={{
                    padding: 20,
                    border: pendingForSm
                      ? "1px solid #eadfbe"
                      : pendingForHr
                        ? "1px solid #d8e3ef"
                        : "1px solid #e4ece2",
                    borderRadius: 20,
                    background: pendingForSm
                      ? "linear-gradient(180deg, #fffdf6 0%, #fffaf0 100%)"
                      : pendingForHr
                        ? "linear-gradient(180deg, #fbfcff 0%, #f6f8fb 100%)"
                        : "#ffffff",
                    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>{r.fullName ?? "—"}</strong>
                      <span style={{ color: "#666", marginLeft: 8 }}>{r.roleName ?? ""}</span>
                      <div style={{ fontSize: "0.875rem", color: "#718096", marginTop: 4 }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "—"}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "7px 12px",
                        borderRadius: 999,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: st.bg,
                        color: st.color,
                        border: "1px solid rgba(0,0,0,0.04)",
                      }}
                    >
                      {st.label}
                    </span>
                  </div>

                  {r.requestedData && Object.keys(r.requestedData as object).length > 0 && (
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: "0.92rem",
                        color: "#4a5568",
                        padding: "14px 16px",
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.72)",
                        border: "1px solid #eef2e8",
                      }}
                    >
                      <RequestedDataBlock data={r.requestedData as Record<string, unknown>} />
                    </div>
                  )}

                  {pendingForHr ? (
                    <div
                      style={{
                        marginTop: 12,
                        color: "#5e6d82",
                        fontSize: "0.92rem",
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: "#f4f7fb",
                        border: "1px solid #dde7f1",
                      }}
                    >
                      Phiếu này đã được Store Manager chuyển lên HR. Store Manager chỉ còn theo dõi trạng thái.
                    </div>
                  ) : null}

                  {r.status.startsWith("rejected") && r.rejectReason && (
                    <div style={{ marginTop: 8, color: "#c53030", fontSize: "0.9rem" }}>
                      Lý do từ chối: {r.rejectReason}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="cafe-btn-primary"
                        style={{
                          ...actionButtonBase,
                          background: "#7b624d",
                          color: "#fff",
                          borderColor: "#7b624d",
                        }}
                        onClick={() => openDetail(r.id)}
                      >
                        Xem chi tiết
                      </button>
                      {pendingForSm ? (
                        <>
                          <button
                            className="cafe-btn-primary"
                            disabled={actionLoadingId === r.id}
                            style={{
                              ...actionButtonBase,
                              background: "#6b8b69",
                              color: "#fff",
                              borderColor: "#6b8b69",
                            }}
                            onClick={async () => {
                              setActionLoadingId(r.id);
                              setActionError(null);
                              try {
                                await profileUpdateRequestApi.approveRequest(r.id);
                                await refreshRequests();
                              } catch (e: any) {
                                const msg = e?.response?.data?.message || "Lỗi duyệt yêu cầu.";
                                setActionError(msg);
                              } finally {
                                setActionLoadingId(null);
                              }
                            }}
                          >
                            {actionLoadingId === r.id ? "Đang duyệt..." : "Duyệt"}
                          </button>
                          <button
                            className="cafe-btn-secondary"
                            disabled={actionLoadingId === r.id}
                            style={{
                              ...actionButtonBase,
                              background: "#fff",
                              borderColor: "#e7d7cf",
                              color: "#9d5e4d",
                            }}
                            onClick={async () => {
                              const reason = prompt("Lý do từ chối:");
                              if (reason === null) return;
                              if (reason.trim().length === 0) {
                                alert("Vui lòng nhập lý do từ chối.");
                                return;
                              }
                              setActionLoadingId(r.id);
                              setActionError(null);
                              try {
                                await profileUpdateRequestApi.rejectRequest(r.id, reason);
                                await refreshRequests();
                              } catch (e: any) {
                                const msg = e?.response?.data?.message || "Lỗi từ chối yêu cầu.";
                                setActionError(msg);
                              } finally {
                                setActionLoadingId(null);
                              }
                            }}
                          >
                            {actionLoadingId === r.id ? "Đang xử lý..." : "Từ chối"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(35, 47, 39, 0.22)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closeDetail}
        >
          <div
            style={{
              ...cardStyle,
              maxWidth: 820,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              background: "linear-gradient(180deg, #ffffff 0%, #fcfdfb 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                paddingBottom: 14,
                borderBottom: "1px solid #edf2e8",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: "#223126" }}>Chi tiết yêu cầu</h3>
                <div style={{ marginTop: 4, fontSize: 14, color: "#708074" }}>
                  Đối chiếu hồ sơ hiện tại với thông tin nhân viên muốn cập nhật.
                </div>
              </div>
              <button
                style={{
                  padding: "8px 14px",
                  border: "1px solid #d8e2d4",
                  borderRadius: 12,
                  background: "#fff",
                  cursor: "pointer",
                  color: "#3d4b40",
                }}
                onClick={closeDetail}
              >
                Đóng
              </button>
            </div>
            {loadingDetail ? (
              <p>Đang tải...</p>
            ) : detail ? (
              <>
                {(() => {
                  const changeRows = buildChangeRows(
                    (detail.requestedData as Record<string, unknown>) ?? {},
                    detail.currentProfile
                  );

                  return (
                    <>
                <div
                  style={{
                    marginBottom: 18,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "#f5f8f3",
                    border: "1px solid #e3ece0",
                  }}
                >
                  <strong style={{ color: "#223126", fontSize: 18 }}>{detail.fullName ?? "—"}</strong>
                  <span style={{ color: "#667769", marginLeft: 8 }}>{detail.roleName ?? "—"}</span>
                </div>
                {detail.currentProfile && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: 16,
                      background: "#f7faf8",
                      borderRadius: 16,
                      border: "1px solid #e3ece0",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 10, color: "#314235" }}>Hồ sơ hiện tại</div>
                    <div>Họ tên: {detail.currentProfile.fullName ?? "—"}</div>
                    <div>SĐT: {detail.currentProfile.phone ?? "—"}</div>
                    <div>Email: {detail.currentProfile.email ?? "—"}</div>
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: "#314235" }}>Dữ liệu yêu cầu thay đổi</div>
                  {changeRows.length > 0 ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {changeRows.map((row) => (
                        <div
                          key={row.fieldKey}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(140px, 180px) minmax(0, 1fr) minmax(0, 1fr)",
                            gap: 10,
                            alignItems: "stretch",
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              background: "#f8faf7",
                              border: "1px solid #e3ece0",
                              fontWeight: 700,
                              color: "#334155",
                            }}
                          >
                            {row.fieldLabel}
                          </div>
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              background: "#fcf7ef",
                              border: "1px solid #f0debf",
                              color: "#7c5b2b",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Hiện tại</div>
                            <div>{row.previousValue}</div>
                          </div>
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              background: "#f3faf3",
                              border: "1px solid #d5e9d2",
                              color: "#2f6840",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Đề xuất mới</div>
                            <div>{row.nextValue}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#666" }}>Không có dữ liệu.</p>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: "#314235" }}>Hồ sơ đính kèm hiện có</div>
                  <DocumentPreviewList documents={detail.documents ?? []} />
                </div>
                {detail.status === "pending_hr" ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      background: "#f4f7fb",
                      borderRadius: 14,
                      color: "#5e6d82",
                      fontSize: "0.92rem",
                      border: "1px solid #dde7f1",
                    }}
                  >
                    Phiếu đã chuyển sang HR duyệt. Store Manager chỉ theo dõi, không xử lý tiếp ở bước này.
                  </div>
                ) : null}
                {detail.status === "pending" || detail.status === "pending_sm" ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      background: "#f3faf3",
                      borderRadius: 14,
                      color: "#43624a",
                      fontSize: "0.92rem",
                      border: "1px solid #dcead8",
                    }}
                  >
                    Yêu cầu đang chờ Store Manager duyệt hoặc từ chối.
                  </div>
                ) : null}
                {detail.status.startsWith("rejected") && detail.rejectReason && (
                  <div style={{ color: "#c53030" }}>Lý do từ chối: {detail.rejectReason}</div>
                )}
                    </>
                  );
                })()}
              </>
            ) : (
              <p>Không tải được chi tiết.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

