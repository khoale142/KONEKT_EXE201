import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../../shared/layouts/CustomerLayout";
import { usePublicMarketingContents } from "../hooks/useMarketingContents";
import {
  MARKETING_CONTENT_TYPE_LABELS,
  type MarketingContentType,
} from "../types/marketingContent.types";
import {
  formatMarketingDate,
  getMarketingContentTargetUrl,
} from "../lib/marketingContent.utils";

const FILTERS: Array<{ value: "" | MarketingContentType; label: string }> = [
  { value: "", label: "Tất cả" },
  { value: "NEWS", label: "Tin tức" },
  { value: "PROMOTION", label: "Khuyến mãi" },
  { value: "VOUCHER", label: "Voucher" },
  { value: "NEW_PRODUCT", label: "Món mới" },
  { value: "NEW_STORE", label: "Quán mới" },
  { value: "TRENDING", label: "Thịnh hành" },
];

export default function DiscoverPage() {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<"" | MarketingContentType>("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = usePublicMarketingContents({
    keyword: keyword.trim() || undefined,
    type: type || undefined,
    page,
    limit: 12,
  });

  const items = data?.items || [];
  const pagination = data?.pagination;

  const title = useMemo(() => {
    return type ? MARKETING_CONTENT_TYPE_LABELS[type] : "Tin tức & ưu đãi";
  }, [type]);

  return (
    <CustomerLayout>
      <main style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 12 }}>Khám phá từ thương hiệu</h1>
            <p style={heroTextStyle}>
              Theo dõi bài viết mới nhất, chiến dịch theo mùa, khuyến mãi, voucher và các thông tin
              nổi bật từ hệ thống cafe.
            </p>
          </div>
        </section>

        <section style={filterPanelStyle}>
          <div style={filterGridStyle}>
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm bài viết, thẻ, ưu đãi..."
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {FILTERS.map((filter) => (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => {
                    setType(filter.value);
                    setPage(1);
                  }}
                  style={{
                    ...filterButtonStyle,
                    background: type === filter.value ? "#2f5c4f" : "#fff",
                    color: type === filter.value ? "#fff" : "#374151",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>{title}</h2>
              <p style={subtleTextStyle}>Danh sách nội dung đã xuất bản và còn trong thời gian hiển thị.</p>
            </div>
            {pagination ? (
              <div style={subtleTextStyle}>{pagination.total.toLocaleString("vi-VN")} bài viết</div>
            ) : null}
          </div>

          {loading ? <div style={panelStyle}>Đang tải dữ liệu...</div> : null}
          {error ? <div style={{ ...panelStyle, color: "#b91c1c" }}>{error}</div> : null}

          {!loading && !error ? (
            <>
              <div style={cardGridStyle}>
                {items.map((item) => (
                  <article key={item.id} style={cardStyle}>
                    <Link to={getMarketingContentTargetUrl(item)} style={cardLinkStyle}>
                      {item.coverImageUrl ? (
                        <img src={item.coverImageUrl} alt={item.title} style={cardImageStyle} />
                      ) : (
                        <div style={cardImagePlaceholderStyle}>Chưa có ảnh</div>
                      )}
                      <div style={cardBodyStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          {item.badgeLabel ? <span style={badgeStyle}>{item.badgeLabel}</span> : null}
                          <span style={typeBadgeStyle}>{MARKETING_CONTENT_TYPE_LABELS[item.type]}</span>
                        </div>

                        <h3 style={cardTitleStyle}>{item.title}</h3>
                        <p style={cardSummaryStyle}>
                          {item.summary || "Nội dung marketing sẽ được hiển thị tại đây."}
                        </p>

                        <div style={metaWrapStyle}>
                          <span>{formatMarketingDate(item.publishedAt)}</span>
                          <span>{item.viewCount.toLocaleString("vi-VN")} lượt xem</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>

              {items.length === 0 ? <div style={panelStyle}>Không có bài viết phù hợp.</div> : null}

              {pagination ? (
                <div style={paginationStyle}>
                  <button
                    type="button"
                    style={paginationButtonStyle}
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Trang trước
                  </button>
                  <span style={subtleTextStyle}>
                    Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}
                  </span>
                  <button
                    type="button"
                    style={paginationButtonStyle}
                    disabled={pagination.page >= Math.max(pagination.totalPages, 1)}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </CustomerLayout>
  );
}

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
  padding: "28px 20px 64px",
  boxSizing: "border-box",
};

const heroStyle: React.CSSProperties = {
  padding: "30px 28px",
  borderRadius: 28,
  background: "linear-gradient(125deg, #2e4435 0%, #5b4134 55%, #8c674f 100%)",
  color: "#fff",
  boxShadow: "0 20px 40px rgba(45, 57, 45, 0.24)",
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.7,
  maxWidth: 720,
  color: "rgba(255,255,255,0.9)",
};

const filterPanelStyle: React.CSSProperties = {
  marginTop: 22,
  background: "#fff",
  borderRadius: 24,
  border: "1px solid rgba(83, 55, 40, 0.1)",
  padding: 18,
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #d5d9df",
  padding: "12px 14px",
  fontSize: 14,
  boxSizing: "border-box",
};

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid #d5d9df",
  background: "#fff",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const subtleTextStyle: React.CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.6,
};

const panelStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  border: "1px solid #d9dce1",
};

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 22,
  overflow: "hidden",
  background: "linear-gradient(180deg, #fff 0%, #f9f7f2 100%)",
  border: "1px solid rgba(83, 55, 40, 0.1)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
};

const cardLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
  height: "100%",
};

const cardImageStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 10",
  objectFit: "cover",
};

const cardImagePlaceholderStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 10",
  display: "grid",
  placeItems: "center",
  background: "#eee3d7",
  color: "#7d5a41",
  fontWeight: 700,
};

const cardBodyStyle: React.CSSProperties = {
  padding: 18,
};

const badgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#2e5d50",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
};

const typeBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#efe7db",
  color: "#704f39",
  fontWeight: 700,
  fontSize: 12,
};

const cardTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  lineHeight: 1.4,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minHeight: "2.8em",
};

const cardSummaryStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  color: "#6b7280",
  lineHeight: 1.7,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minHeight: "5.1em",
};

const metaWrapStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 13,
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 22,
};

const paginationButtonStyle: React.CSSProperties = {
  border: "1px solid #d0d7de",
  borderRadius: 999,
  background: "#fff",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
