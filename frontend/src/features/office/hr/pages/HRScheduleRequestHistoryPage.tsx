import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import HrPageHeader from "../components/HrPageHeader";
import {
  fetchHrScheduleRequests,
  type ScheduleChangeRequest,
} from "../api/hrAttendance.api";
import { listOfficeStoresForHr } from "../api/hrInventory.api";
import ScheduleRequestHistoryList from "../../../shared/components/ScheduleRequestHistoryList";

type StoreItem = { id: number; name: string };

const PAGE_SIZE = 10;

export default function HRScheduleRequestHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ScheduleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const storeIdParam = searchParams.get("storeId");
  const storeId =
    storeIdParam && Number.isFinite(Number(storeIdParam)) ? Number(storeIdParam) : "";

  useEffect(() => {
    listOfficeStoresForHr()
      .then((stores) => {
        setStoreList(stores);
        if (stores.length === 1 && !storeIdParam) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("storeId", String(stores[0].id));
            return next;
          }, { replace: true });
        }
      })
      .catch(() => setStoreList([]));
  }, []);

  useEffect(() => {
    const sid = Number(storeId);
    if (!Number.isFinite(sid) || sid <= 0) {
      setLoading(false);
      setHistoryItems([]);
      return;
    }

    setLoading(true);
    setError("");
    fetchHrScheduleRequests({ storeId: sid })
      .then((rows) => setHistoryItems(Array.isArray(rows) ? rows : []))
      .catch((fetchError: any) => {
        console.error("Failed to fetch HR schedule request history", fetchError);
        setError(fetchError?.response?.data?.message || "Không tải được lịch sử yêu cầu đổi ca.");
        setHistoryItems([]);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

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
      if (storeId) next.set("storeId", String(storeId));
      if (totalPages > 1) next.set("page", "1");
      else next.delete("page");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, storeId, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedHistory.slice(start, start + PAGE_SIZE);
  }, [currentPage, processedHistory]);

  const backLink = storeId
    ? `/office/hr/schedules?storeId=${storeId}`
    : "/office/hr/schedules";

  return (
    <div>
      <HrPageHeader
        title="Lịch sử yêu cầu đổi ca"
        description="HR xem lại các yêu cầu đổi ca đã xử lý theo từng cửa hàng, chia trang để dễ theo dõi."
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            to={backLink}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Quay lại màn lịch
          </Link>
        </div>
      </HrPageHeader>

      <div
        style={{
          background: "#fffdf9",
          borderRadius: 18,
          padding: 20,
          border: "1px solid #ddd8cc",
          boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 20 }}>
          <div style={{ minWidth: 220 }}>
            <label className="cafe-label" htmlFor="hr-request-history-store">
              Cửa hàng
            </label>
            <select
              id="hr-request-history-store"
              className="cafe-input"
              value={storeId || ""}
              onChange={(event) => {
                const nextStoreId = Number(event.target.value);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (nextStoreId > 0) next.set("storeId", String(nextStoreId));
                  else next.delete("storeId");
                  next.delete("page");
                  return next;
                });
              }}
              style={{ width: "100%" }}
            >
              <option value="">Chọn cửa hàng</option>
              {storeList.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#718096" }}>
            Đang tải lịch sử yêu cầu...
          </div>
        ) : (
          <ScheduleRequestHistoryList
            items={pagedItems}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (storeId) next.set("storeId", String(storeId));
                if (page > 1) next.set("page", String(page));
                else next.delete("page");
                return next;
              });
            }}
            emptyText="Chưa có yêu cầu đổi ca nào đã xử lý."
          />
        )}
      </div>
    </div>
  );
}
