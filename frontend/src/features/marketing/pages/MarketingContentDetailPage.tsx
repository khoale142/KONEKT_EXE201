import { Link, useParams } from "react-router-dom";
import CustomerLayout from "../../../shared/layouts/CustomerLayout";
import { usePublicMarketingDetail } from "../hooks/useMarketingContents";
import { MARKETING_CONTENT_TYPE_LABELS } from "../types/marketingContent.types";
import {
  formatMarketingDateTime,
  formatViewCount,
  getMarketingContentDetailCta,
  getMarketingContentTargetUrl,
} from "../lib/marketingContent.utils";

function renderBody(content?: string | null, summary?: string | null) {
  const html = (content || "").trim();
  if (html) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <p>{summary || "Nội dung đang được cập nhật."}</p>;
}

export default function MarketingContentDetailPage() {
  const params = useParams();
  const { data, loading, error } = usePublicMarketingDetail(params.slug);
  const item = data?.item;
  const relatedItems = data?.relatedItems || [];
  const detailCta = item ? getMarketingContentDetailCta(item) : null;

  return (
    <CustomerLayout>
      <main style={pageStyle}>
        <div style={{ marginBottom: 18 }}>
          <Link to="/discover" style={backLinkStyle}>
            ← Về trang khám phá
          </Link>
        </div>

        {loading ? <div style={panelStyle}>Đang tải chi tiết bài viết...</div> : null}
        {error ? <div style={{ ...panelStyle, color: "#b91c1c" }}>{error}</div> : null}

        {!loading && !error && item ? (
          <>
            <article style={articleStyle}>
              {item.coverImageUrl ? (
                <img src={item.coverImageUrl} alt={item.title} style={coverImageStyle} />
              ) : null}

              <div style={articleBodyStyle}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {item.badgeLabel ? <span style={badgeStyle}>{item.badgeLabel}</span> : null}
                  <span style={typeBadgeStyle}>{MARKETING_CONTENT_TYPE_LABELS[item.type]}</span>
                </div>

                <h1 style={{ marginTop: 0, marginBottom: 16, lineHeight: 1.25 }}>{item.title}</h1>

                <div style={metaWrapStyle}>
                  <span>{formatMarketingDateTime(item.publishedAt)}</span>
                  <span>{formatViewCount(item.viewCount)}</span>
                </div>

                {item.summary ? <p style={summaryStyle}>{item.summary}</p> : null}

                <div style={contentStyle}>{renderBody(item.content, item.summary)}</div>

                {item.tags.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
                    {item.tags.map((tag) => (
                      <span key={tag} style={tagStyle}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {detailCta ? (
                  <section style={ctaSectionStyle}>
                    <div style={ctaSectionTextStyle}>
                      <h2 style={ctaHeadingStyle}>Tiếp tục khám phá</h2>
                      <p style={ctaDescriptionStyle}>
                        Chọn nội dung liên quan để xem thêm sau khi đọc bài viết này.
                      </p>
                    </div>

                    {detailCta.isExternal ? (
                      <a
                        href={detailCta.url}
                        target="_blank"
                        rel="noreferrer"
                        style={ctaStyle}
                      >
                        {detailCta.label}
                      </a>
                    ) : (
                      <Link to={detailCta.url} style={ctaStyle}>
                        {detailCta.label}
                      </Link>
                    )}
                  </section>
                ) : null}
              </div>
            </article>

            {relatedItems.length > 0 ? (
              <section style={{ marginTop: 26 }}>
                <div style={relatedHeaderStyle}>
                  <h2 style={{ margin: 0 }}>Bài liên quan</h2>
                </div>
                <div style={relatedGridStyle}>
                  {relatedItems.map((related) => (
                    <Link
                      key={related.id}
                      to={getMarketingContentTargetUrl(related)}
                      style={relatedCardStyle}
                    >
                      {related.coverImageUrl ? (
                        <img src={related.coverImageUrl} alt={related.title} style={relatedImageStyle} />
                      ) : (
                        <div style={relatedImagePlaceholderStyle}>Chưa có ảnh</div>
                      )}
                      <div style={{ padding: 14 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          {related.badgeLabel ? <span style={badgeStyle}>{related.badgeLabel}</span> : null}
                          <span style={typeBadgeStyle}>{MARKETING_CONTENT_TYPE_LABELS[related.type]}</span>
                        </div>
                        <h3 style={relatedTitleStyle}>{related.title}</h3>
                        <p style={relatedSummaryStyle}>
                          {related.summary || "Nội dung marketing đang được cập nhật."}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </CustomerLayout>
  );
}

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1000,
  margin: "0 auto",
  padding: "28px 20px 64px",
  boxSizing: "border-box",
};

const backLinkStyle: React.CSSProperties = {
  color: "#6b7280",
  fontWeight: 700,
  textDecoration: "none",
};

const panelStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  padding: 24,
  border: "1px solid #d9dce1",
};

const articleStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 24,
  border: "1px solid rgba(83, 55, 40, 0.1)",
  overflow: "hidden",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.06)",
};

const coverImageStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: 420,
  objectFit: "cover",
};

const articleBodyStyle: React.CSSProperties = {
  padding: "28px 28px 30px",
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

const metaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 14,
};

const summaryStyle: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 22,
  color: "#4b5563",
  lineHeight: 1.8,
  fontSize: 16,
};

const contentStyle: React.CSSProperties = {
  color: "#111827",
  lineHeight: 1.9,
  fontSize: 16,
};

const tagStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "4px 10px",
  background: "#eff3f6",
  color: "#3f4a5a",
  fontSize: 12,
  fontWeight: 700,
};

const ctaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  borderRadius: 999,
  background: "#553728",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};

const ctaSectionStyle: React.CSSProperties = {
  marginTop: 28,
  padding: "18px 20px",
  borderRadius: 18,
  border: "1px solid rgba(83, 55, 40, 0.12)",
  background: "linear-gradient(135deg, rgba(247, 242, 235, 0.95), rgba(255, 255, 255, 1))",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const ctaSectionTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  flex: "1 1 260px",
};

const ctaHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "#1f2937",
};

const ctaDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  lineHeight: 1.6,
};

const relatedHeaderStyle: React.CSSProperties = {
  marginBottom: 14,
};

const relatedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const relatedCardStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  background: "#fff",
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(83, 55, 40, 0.1)",
};

const relatedImageStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 10",
  objectFit: "cover",
};

const relatedImagePlaceholderStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 10",
  display: "grid",
  placeItems: "center",
  background: "#eee3d7",
  color: "#7d5a41",
  fontWeight: 700,
};

const relatedTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  lineHeight: 1.4,
};

const relatedSummaryStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  lineHeight: 1.7,
};
