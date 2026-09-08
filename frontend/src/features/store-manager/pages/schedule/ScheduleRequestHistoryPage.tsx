import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../../../app/store/auth.store";
import { managerScheduleApi } from "../../api/schedule/managerSchedule.api";
import Card from "../../../../shared/components/Card";
import ScheduleRequestHistoryList, {
  type ScheduleRequestHistoryItem,
} from "../../../shared/components/ScheduleRequestHistoryList";
import type { ScheduleRequestDetail } from "../../../shared/utils/scheduleRequestDetails";

type ScheduleRequest = ScheduleRequestHistoryItem & {
  id: number;
  userId: number;
  storeId: number;
  requestDate: string;
  requestType: string;
  status: string;
  requesterName: string;
  createdAt: string;
  detail: ScheduleRequestDetail | null;
};

const PAGE_SIZE = 10;

export default function ScheduleRequestHistoryPage() {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [historyItems, setHistoryItems] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && selectedStoreId == null) {
      const queryStoreId = Number(searchParams.get("storeId"));
      const nextStoreId =
        (Number.isFinite(queryStoreId) && queryStoreId > 0 ? queryStoreId : null) ??
        user.storeId ??
        user.storeIds?.[0] ??
        user.stores?.[0]?.id ??
        null;
      setSelectedStoreId(nextStoreId != null ? Number(nextStoreId) : null);
    }
  }, [searchParams, selectedStoreId, user]);

  useEffect(() => {
    const queryStoreId = Number(searchParams.get("storeId"));
    if (Number.isFinite(queryStoreId) && queryStoreId > 0 && queryStoreId !== selectedStoreId) {
      setSelectedStoreId(queryStoreId);
    }
  }, [searchParams, selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId) {
      setLoading(false);
      setHistoryItems([]);
      return;
    }

    setLoading(true);
    setError("");
    managerScheduleApi
      .getStoreScheduleRequests(selectedStoreId)
      .then((data) => {
        const rows = Array.isArray(data?.requests) ? data.requests : [];
        setHistoryItems(rows);
      })
      .catch((fetchError) => {
        console.error("Failed to fetch schedule request history", fetchError);
        setError("Không tải được lịch sử yêu cầu đổi ca.");
        setHistoryItems([]);
      })
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  const processedHistory = useMemo(() => {
    return [...historyItems]
      .filter((item) => String(item.status || "").toLowerCase() !== "pending")
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime || Number(right.id) - Number(left.id);
      });
  }, [historyItems]);

  const totalPages = Math.max(1, Math.ceil(processedHistory.length / PAGE_SIZE));
  const currentPageParam = Number(searchParams.get("page"));
  const currentPage =
    Number.isFinite(currentPageParam) && currentPageParam > 0
      ? Math.min(currentPageParam, totalPages)
      : 1;

  useEffect(() => {
    const queryPage = Number(searchParams.get("page"));
    if (!Number.isFinite(queryPage) || queryPage < 1 || queryPage > totalPages) {
      const next = new URLSearchParams(searchParams);
      if (selectedStoreId) next.set("storeId", String(selectedStoreId));
      if (totalPages > 1) next.set("page", "1");
      else next.delete("page");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedStoreId, setSearchParams, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedHistory.slice(start, start + PAGE_SIZE);
  }, [currentPage, processedHistory]);

  const historyLink =
    selectedStoreId != null
      ? `/store/manager/schedule-requests?storeId=${selectedStoreId}`
      : "/store/manager/schedule-requests";

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>
            Lịch sử yêu cầu đổi ca
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Theo dõi các yêu cầu đã được xử lý, chia trang để xem gọn hơn.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          {user?.stores && user.stores.length > 1 ? (
            <div style={{ minWidth: 220 }}>
              <label
                htmlFor="schedule-history-store-select"
                style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 500 }}
              >
                Chọn cửa hàng:
              </label>
              <select
                id="schedule-history-store-select"
                value={selectedStoreId || ""}
                onChange={(event) => {
                  const nextStoreId = Number(event.target.value);
                  setSelectedStoreId(nextStoreId);
                  const next = new URLSearchParams();
                  if (nextStoreId) next.set("storeId", String(nextStoreId));
                  setSearchParams(next);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontSize: 14,
                  color: "#111827",
                }}
              >
                {user.stores.map((store: any) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Link
            to={historyLink}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              fontWeight: 600,
            }}
          >
            Quay lại duyệt yêu cầu
          </Link>
        </div>
      </header>

      {error ? (
        <Card
          style={{
            padding: "16px 20px",
            marginBottom: 16,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </Card>
      ) : null}

      {loading ? (
        <Card style={{ padding: 36, textAlign: "center", color: "#6b7280" }}>
          Đang tải lịch sử yêu cầu...
        </Card>
      ) : (
        <ScheduleRequestHistoryList
          items={pagedItems}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            const next = new URLSearchParams();
            if (selectedStoreId) next.set("storeId", String(selectedStoreId));
            if (page > 1) next.set("page", String(page));
            setSearchParams(next);
          }}
          emptyText="Chưa có yêu cầu nào đã xử lý."
        />
      )}
    </div>
  );
}
