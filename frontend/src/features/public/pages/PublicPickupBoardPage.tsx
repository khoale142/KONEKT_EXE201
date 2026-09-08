import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  publicPickupBoardApi,
  type PickupBoardItem,
} from "../api/publicPickupBoard.api";

const POLL_MS = Math.max(
  3000,
  Number(import.meta.env.VITE_PICKUP_BOARD_POLL_MS || 10000)
);

function BoardColumn(props: {
  title: string;
  items: PickupBoardItem[];
  emptyText: string;
}) {
  const { title, items, emptyText } = props;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 320,
        background: "#fff",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 28 }}>
        {title}
      </h2>

      {items.length === 0 ? (
        <div
          style={{
            minHeight: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.65,
            fontSize: 22,
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 16,
          }}
        >
          {items.map((item) => (
            <div
              key={item.orderId}
              style={{
                borderRadius: 18,
                border: "2px solid #e7e2dc",
                padding: 20,
                textAlign: "center",
                background: "#faf7f3",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  opacity: 0.7,
                  marginBottom: 8,
                  wordBreak: "break-word",
                }}
              >
                {item.orderCode}
              </div>

              <div
                style={{
                  fontSize: 42,
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                {item.pickupNumber ?? "-"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PublicPickupBoardPage() {
  const { storeId } = useParams();
  const numericStoreId = Number(storeId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState<PickupBoardItem[]>([]);
  const [ready, setReady] = useState<PickupBoardItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    if (!Number.isFinite(numericStoreId) || numericStoreId <= 0) {
      setError("Store không hợp lệ");
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const res = await publicPickupBoardApi.getBoard(numericStoreId);
        if (!mounted) return;

        setPreparing(res.preparing || []);
        setReady(res.ready || []);
        setGeneratedAt(res.generatedAt || "");
        setError("");
      } catch (e: any) {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Không tải được màn hình pickup"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, POLL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [numericStoreId]);

  const updatedText = useMemo(() => {
    if (!generatedAt) return "";
    const d = new Date(generatedAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("vi-VN");
  }, [generatedAt]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3eee8",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 42 }}>Bảng nhận món</h1>
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 18 }}>
              Store #{numericStoreId}
            </div>
          </div>

          <div style={{ fontSize: 16, opacity: 0.7 }}>
            {updatedText ? `Cập nhật lúc ${updatedText}` : ""}
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: "#fdecec",
              color: "#a33",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontSize: 24 }}>
            Đang tải...
          </div>
        ) : (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <BoardColumn
              title="Đang chuẩn bị"
              items={preparing}
              emptyText="Chưa có đơn đang làm"
            />
            <BoardColumn
              title="Sẵn sàng nhận món"
              items={ready}
              emptyText="Chưa có đơn sẵn sàng"
            />
          </div>
        )}
      </div>
    </div>
  );
}
