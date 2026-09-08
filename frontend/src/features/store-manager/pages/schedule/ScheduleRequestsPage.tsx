import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../../../app/store/auth.store";
import { managerScheduleApi } from "../../api/schedule/managerSchedule.api";
import Card from "../../../../shared/components/Card";
import Button from "../../../../shared/components/Button";
import {
  getScheduleRequestPresentation,
  type ScheduleRequestDetail,
} from "../../../shared/utils/scheduleRequestDetails";

interface ScheduleRequest {
  id: number;
  userId: number;
  storeId: number;
  requestDate: string;
  requestType: string;
  status: string;
  requesterName: string;
  createdAt: string;
  detail: ScheduleRequestDetail | null;
}

type ProcessDialogState = {
  request: ScheduleRequest;
  status: "approved" | "rejected";
} | null;

type ProcessedResult = {
  requestId: number;
  storeId: number;
  requesterName: string;
  requestType: string;
  status: "approved" | "rejected";
  note: string;
  processedAt: string;
};

function getRequestKindLabel(kind: string) {
  if (kind === "CHANGE_TIME") return "Đổi giờ làm";
  if (kind === "CHANGE_SHIFT") return "Đổi ca";
  if (kind === "DROP_SHIFT") return "Xin nghỉ ca";
  return kind;
}

function getProcessedStatusLabel(status: "approved" | "rejected") {
  return status === "approved" ? "Đã chấp nhận" : "Đã từ chối";
}

function RequestShiftDetail({
  label,
  title,
  timeLabel,
  emphasized = false,
}: {
  label: string;
  title: string;
  timeLabel: string;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        flex: "1 1 220px",
        minWidth: "220px",
        background: emphasized ? "#eff6ff" : "#ffffff",
        border: `1px solid ${emphasized ? "#bfdbfe" : "#e5e7eb"}`,
        borderRadius: "12px",
        padding: "12px",
      }}
    >
      <div
        style={{
          color: emphasized ? "#2563eb" : "#9ca3af",
          fontSize: "12px",
          fontWeight: 600,
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 600, color: "#111827", marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#4b5563" }}>{timeLabel}</div>
    </div>
  );
}

export default function ScheduleRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [requestHistory, setRequestHistory] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [processDialog, setProcessDialog] = useState<ProcessDialogState>(null);
  const [processNote, setProcessNote] = useState("");
  const [processedResults, setProcessedResults] = useState<ProcessedResult[]>([]);
  const historyCount = requestHistory.filter(
    (item) => String(item.status || "").toLowerCase() !== "pending",
  ).length;
  const historyHref =
    selectedStoreId != null
      ? `/store/manager/schedule-requests/history?storeId=${selectedStoreId}`
      : "/store/manager/schedule-requests/history";

  useEffect(() => {
    if (user && selectedStoreId == null) {
      const queryStoreId = Number(searchParams.get("storeId"));
      const sid =
        (Number.isFinite(queryStoreId) && queryStoreId > 0 ? queryStoreId : null) ??
        user.storeId ?? user.storeIds?.[0] ?? user.stores?.[0]?.id ?? null;
      setSelectedStoreId(sid != null ? Number(sid) : null);
    }
  }, [user, selectedStoreId, searchParams]);

  useEffect(() => {
    const queryStoreId = Number(searchParams.get("storeId"));
    if (Number.isFinite(queryStoreId) && queryStoreId > 0 && queryStoreId !== selectedStoreId) {
      setSelectedStoreId(queryStoreId);
    }
  }, [searchParams, selectedStoreId]);

  const fetchRequests = async () => {
    if (!selectedStoreId) {
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    try {
      setError("");
      const [pendingData, historyData] = await Promise.all([
        managerScheduleApi.getStoreScheduleRequests(selectedStoreId, "pending"),
        managerScheduleApi.getStoreScheduleRequests(selectedStoreId),
      ]);
      setRequests(pendingData.requests || []);
      setRequestHistory(historyData.requests || []);
    } catch (fetchError) {
      console.error("Failed to fetch requests", fetchError);
      setRequests([]);
      setRequestHistory([]);
      setError("Không tải được danh sách yêu cầu. Vui lòng thử tải lại trang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRequests();
  }, [selectedStoreId]);

  const closeProcessDialog = () => {
    if (processingId != null) return;
    setProcessDialog(null);
    setProcessNote("");
    setError("");
  };

  const openProcessDialog = (request: ScheduleRequest, status: "approved" | "rejected") => {
    setProcessDialog({ request, status });
    setProcessNote("");
    setError("");
  };

  const submitProcessRequest = async () => {
    if (!processDialog) return;

    const request = processDialog.request;
    const status = processDialog.status;
    const trimmedNote = processNote.trim();

    if (status === "rejected" && !trimmedNote) {
      setError("Vui lòng nhập lý do từ chối để nhân viên biết cần điều chỉnh gì.");
      return;
    }

    setProcessingId(request.id);
    try {
      setError("");
      await managerScheduleApi.processScheduleRequest(request.id, status, trimmedNote || "");
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      setRequestHistory((prev) => [
        {
          ...request,
          status,
          detail: {
            ...(request.detail && typeof request.detail === "object" ? request.detail : {}),
            decision: {
              status,
              note: trimmedNote || null,
              processedAt: new Date().toISOString(),
            },
          },
        },
        ...prev.filter((item) => item.id !== request.id),
      ]);
      setProcessedResults((prev) => [
        {
          requestId: request.id,
          storeId: request.storeId,
          requesterName: request.requesterName,
          requestType: request.detail?.requestType ?? request.requestType,
          status,
          note: trimmedNote,
          processedAt: new Date().toISOString(),
        },
        ...prev.filter((item) => item.requestId !== request.id),
      ]);
      setProcessDialog(null);
      setProcessNote("");
    } catch (processError: any) {
      console.error("Failed to process request", processError);
      setError(
        processError?.response?.data?.message ||
          "Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Đang tải danh sách yêu cầu...</div>;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>
            Duyệt yêu cầu đổi ca
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Xem và phê duyệt các yêu cầu thay đổi lịch làm việc từ nhân viên trong cửa hàng.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link
            to={historyHref}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Xem lịch sử ({historyCount})
          </Link>

          {user?.stores && user.stores.length > 1 && (
            <div style={{ minWidth: "200px" }}>
              <label htmlFor="store-select" style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px", fontWeight: 500 }}>
                Chọn cửa hàng:
              </label>
              <select
                id="store-select"
                value={selectedStoreId || ""}
                onChange={(e) => {
                  const nextStoreId = Number(e.target.value);
                  setSelectedStoreId(nextStoreId);
                  setSearchParams(nextStoreId ? { storeId: String(nextStoreId) } : {});
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontSize: "14px",
                  color: "#111827",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {user.stores.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {error && (
        <Card style={{ padding: "16px 20px", marginBottom: "16px", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca" }}>
          {error}
        </Card>
      )}

      {processedResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          {processedResults.map((result) => (
            <Card
              key={result.requestId}
              style={{
                padding: "16px 18px",
                border: result.status === "approved" ? "1px solid #bbf7d0" : "1px solid #fecaca",
                background: result.status === "approved" ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>
                    {getProcessedStatusLabel(result.status)} yêu cầu của {result.requesterName}
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563" }}>
                    Loại yêu cầu: {getRequestKindLabel(result.requestType)}
                  </div>
                  {result.note && (
                    <div style={{ fontSize: "13px", color: "#4b5563", marginTop: "6px" }}>
                      Ghi chú xử lý: {result.note}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  {new Date(result.processedAt).toLocaleString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        <Card style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>
          Hiện không có yêu cầu nào đang chờ xử lý.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {requests.map((req) => {
            const kind = req.detail?.requestType ?? req.requestType;
            const detailView = getScheduleRequestPresentation({
              kind,
              detail: req.detail,
              fallbackWorkDate: req.requestDate,
            });

            return (
              <Card key={req.id} style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 520px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "16px", color: "#111827" }}>{req.requesterName}</span>
                      <span
                        style={{
                          fontSize: "12px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          fontWeight: 500,
                        }}
                      >
                        {getRequestKindLabel(kind)}
                      </span>
                    </div>

                    <div style={{ fontSize: "14px", color: "#4b5563", marginBottom: "12px" }}>
                      {detailView.hasDetail && (
                        <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
                          <div style={{ marginBottom: "4px" }}>
                            <span style={{ color: "#9ca3af" }}>Ngày làm việc:</span> {detailView.workDateLabel}
                          </div>
                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
                            <RequestShiftDetail
                              label="Ca hiện tại"
                              title={detailView.currentTitle}
                              timeLabel={detailView.currentTimeLabel}
                            />
                            <RequestShiftDetail
                              label={detailView.desiredPanelLabel}
                              title={detailView.desiredTitle}
                              timeLabel={detailView.desiredTimeLabel}
                              emphasized
                            />
                          </div>
                          {detailView.reason && (
                            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #e5e7eb", fontSize: "13px", color: "#6b7280" }}>
                              <strong>Lý do:</strong> {detailView.reason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                      Gửi lúc: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Button
                      variant="ghost"
                      onClick={() => openProcessDialog(req, "rejected")}
                      disabled={processingId === req.id}
                    >
                      Từ chối
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => openProcessDialog(req, "approved")}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? "Đang xử lý..." : "Duyệt yêu cầu"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {processDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "16px",
          }}
        >
          <div style={{ width: "100%", maxWidth: "520px", background: "#fff", borderRadius: "18px", padding: "24px", boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", color: "#111827" }}>
              {processDialog.status === "approved" ? "Duyệt yêu cầu đổi ca" : "Từ chối yêu cầu đổi ca"}
            </h2>
            <p style={{ margin: "0 0 16px", color: "#4b5563", lineHeight: 1.5 }}>
              Nhân viên <strong>{processDialog.request.requesterName}</strong> đang gửi yêu cầu{" "}
              <strong>{getRequestKindLabel(processDialog.request.detail?.requestType ?? processDialog.request.requestType)}</strong>.
            </p>

            <label style={{ display: "block", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                {processDialog.status === "approved" ? "Ghi chú cho nhân viên (không bắt buộc)" : "Lý do từ chối"}
              </div>
              <textarea
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
                rows={4}
                placeholder={
                  processDialog.status === "approved"
                    ? "Ví dụ: Đã duyệt, ca này sẽ được cập nhật trên lịch làm việc."
                    : "Nêu rõ lý do để nhân viên biết cần điều chỉnh gì."
                }
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: "12px",
                  border: "1px solid #d1d5db",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </label>

            {processDialog.status === "rejected" && (
              <div style={{ fontSize: "12px", color: "#b91c1c", marginBottom: "12px" }}>
                Từ chối yêu cầu cần có lý do để nhân viên nhận được phản hồi rõ ràng.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" onClick={closeProcessDialog} disabled={processingId === processDialog.request.id}>
                Đóng
              </Button>
              <Button variant="primary" onClick={submitProcessRequest} disabled={processingId === processDialog.request.id}>
                {processingId === processDialog.request.id
                  ? "Đang xử lý..."
                  : processDialog.status === "approved"
                    ? "Xác nhận duyệt"
                    : "Xác nhận từ chối"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
