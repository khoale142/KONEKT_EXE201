import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { marketingApi } from "../api/marketing.api";
import { useAdminMarketingContents } from "../hooks/useMarketingContents";
import {
  formatMarketingDate,
  formatMarketingDateTime,
  getMarketingDisplayStatusLabel,
} from "../lib/marketingContent.utils";
import {
  MARKETING_CONTENT_STATUS_LABELS,
  MARKETING_CONTENT_TYPE_LABELS,
  type MarketingContentBase,
  type MarketingContentStatus,
  type MarketingContentType,
} from "../types/marketingContent.types";

const TYPE_OPTIONS: Array<{ value: "" | MarketingContentType; label: string }> = [
  { value: "", label: "Tất cả" },
  ...Object.entries(MARKETING_CONTENT_TYPE_LABELS).map(([value, label]) => ({
    value: value as MarketingContentType,
    label,
  })),
];

const STATUS_OPTIONS: Array<{ value: "" | MarketingContentStatus; label: string }> = [
  { value: "", label: "Tất cả" },
  ...Object.entries(MARKETING_CONTENT_STATUS_LABELS).map(([value, label]) => ({
    value: value as MarketingContentStatus,
    label,
  })),
];

export default function MarketingContentsPage() {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<"" | MarketingContentType>("");
  const [status, setStatus] = useState<"" | MarketingContentStatus>("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [isFeatured, setIsFeatured] = useState<"" | "true" | "false">("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const { data, loading, error } = useAdminMarketingContents({
    keyword: keyword.trim() || undefined,
    type: type || undefined,
    status: status || undefined,
    isActive: isActive === "" ? undefined : isActive === "true",
    isFeatured: isFeatured === "" ? undefined : isFeatured === "true",
    sortBy,
    sortDirection,
    page,
    limit: 10,
    refreshKey,
  });

  const items = data?.items || [];
  const pagination = data?.pagination;

  const pageLabel = useMemo(() => {
    if (!pagination) return "";
    return `${pagination.total.toLocaleString("vi-VN")} bài viết`;
  }, [pagination]);

  function triggerReload() {
    setRefreshKey((value) => value + 1);
  }

  async function handleToggleActive(item: MarketingContentBase) {
    setSubmittingId(item.id);
    try {
      await marketingApi.adminToggleMarketingContentActive(item.id, !item.isActive);
      triggerReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Cập nhật trạng thái hiển thị thất bại");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleToggleFeature(item: MarketingContentBase) {
    setSubmittingId(item.id);
    try {
      await marketingApi.adminFeatureMarketingContent(item.id, {
        isFeatured: !item.isFeatured,
        sortOrder: item.sortOrder || 0,
      });
      triggerReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Cập nhật bài nổi bật thất bại");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handlePublish(item: MarketingContentBase) {
    setSubmittingId(item.id);
    try {
      await marketingApi.adminUpdateMarketingContentStatus(item.id, {
        status: item.status === "published" ? "archived" : "published",
      });
      triggerReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Cập nhật trạng thái xuất bản thất bại");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleDelete(item: MarketingContentBase) {
    const confirmed = window.confirm(`Xóa bài viết "${item.title}"?`);
    if (!confirmed) return;

    setSubmittingId(item.id);
    try {
      await marketingApi.adminDeleteMarketingContent(item.id);
      triggerReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Xóa bài viết thất bại");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Nội dung marketing</h1>
          <p style={heroTextStyle}>
            Quản lý bài viết, thông báo, nội dung khuyến mãi và dữ liệu khám phá hiển thị trên trang khách hàng.
          </p>
        </div>

        <div style={heroActionsStyle}>
          <Link to="/office/marketing/menu" style={primaryLinkStyle}>
            Quản lý menu
          </Link>
          <Link to="/office/marketing/contents/new" style={primaryLinkStyle}>
            Tạo mới
          </Link>
        </div>
      </section>

      <section style={filterCardStyle}>
        <div style={filterGridStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Từ khóa</span>
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tiêu đề, slug, mô tả..."
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Loại</span>
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as "" | MarketingContentType);
                setPage(1);
              }}
              style={inputStyle}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Trạng thái</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "" | MarketingContentStatus);
                setPage(1);
              }}
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Hiển thị</span>
            <select
              value={isActive}
              onChange={(event) => {
                setIsActive(event.target.value as "" | "true" | "false");
                setPage(1);
              }}
              style={inputStyle}
            >
              <option value="">Tất cả</option>
              <option value="true">Đang hiển thị</option>
              <option value="false">Tạm ẩn</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Nổi bật</span>
            <select
              value={isFeatured}
              onChange={(event) => {
                setIsFeatured(event.target.value as "" | "true" | "false");
                setPage(1);
              }}
              style={inputStyle}
            >
              <option value="">Tất cả</option>
              <option value="true">Có</option>
              <option value="false">Không</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Sắp xếp theo</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={inputStyle}
            >
              <option value="updatedAt">updatedAt</option>
              <option value="createdAt">createdAt</option>
              <option value="publishedAt">publishedAt</option>
              <option value="sortOrder">sortOrder</option>
              <option value="title">title</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Chiều sắp xếp</span>
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              style={inputStyle}
            >
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </label>
        </div>
      </section>

      <section style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Danh sách bài viết</h2>
            <div style={subtleTextStyle}>{pageLabel}</div>
          </div>
        </div>

        {loading ? <div style={panelStyle}>Đang tải...</div> : null}
        {error ? <div style={{ ...panelStyle, color: "#b91c1c" }}>{error}</div> : null}

        {!loading && !error ? (
          items.length > 0 ? (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Bài viết</th>
                    <th style={thStyle}>Loại</th>
                    <th style={thStyle}>Trạng thái</th>
                    <th style={thStyle}>Hiển thị</th>
                    <th style={thStyle}>Nổi bật</th>
                    <th style={thStyle}>Xuất bản</th>
                    <th style={thStyle}>Thời gian hiển thị</th>
                    <th style={thStyle}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        <div style={contentCellStyle}>
                          {item.coverImageUrl ? (
                            <img src={item.coverImageUrl} alt={item.title} style={thumbStyle} />
                          ) : (
                            <div style={thumbPlaceholderStyle}>Chưa có ảnh</div>
                          )}
                          <div>
                            <div style={titleCellStyle}>{item.title}</div>
                            <div style={slugTextStyle}>/{item.slug}</div>
                            <div style={summaryTextStyle}>
                              {item.summary || "Chưa có mô tả ngắn"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{MARKETING_CONTENT_TYPE_LABELS[item.type]}</td>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle}>
                          {MARKETING_CONTENT_STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td style={tdStyle}>{getMarketingDisplayStatusLabel(item)}</td>
                      <td style={tdStyle}>{item.isFeatured ? "Có" : "Không"}</td>
                      <td style={tdStyle}>{formatMarketingDateTime(item.publishedAt)}</td>
                      <td style={tdStyle}>
                        <div>{formatMarketingDate(item.displayStartAt)}</div>
                        <div>{formatMarketingDate(item.displayEndAt)}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={actionWrapStyle}>
                          <Link to={`/office/marketing/contents/${item.id}/edit`} style={actionLinkStyle}>
                            Sửa
                          </Link>
                          <button
                            type="button"
                            style={actionButtonStyle}
                            onClick={() => handlePublish(item)}
                            disabled={submittingId === item.id}
                          >
                            {item.status === "published" ? "Lưu trữ" : "Xuất bản"}
                          </button>
                          <button
                            type="button"
                            style={actionButtonStyle}
                            onClick={() => handleToggleActive(item)}
                            disabled={submittingId === item.id}
                          >
                            {item.isActive ? "Tạm ẩn" : "Hiển thị"}
                          </button>
                          <button
                            type="button"
                            style={actionButtonStyle}
                            onClick={() => handleToggleFeature(item)}
                            disabled={submittingId === item.id}
                          >
                            {item.isFeatured ? "Bỏ nổi bật" : "Đặt nổi bật"}
                          </button>
                          <button
                            type="button"
                            style={{ ...actionButtonStyle, color: "#b91c1c" }}
                            onClick={() => handleDelete(item)}
                            disabled={submittingId === item.id}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={panelStyle}>Chưa có nội dung marketing nào.</div>
          )
        ) : null}

        {pagination ? (
          <div style={paginationStyle}>
            <button
              type="button"
              style={paginationButtonStyle}
              disabled={pagination.page <= 1}
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
      </section>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(125deg, #2e4435 0%, #5b4134 55%, #8c674f 100%)",
  borderRadius: 24,
  padding: "24px 26px",
  color: "#fff",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.88)",
  maxWidth: 700,
  lineHeight: 1.6,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#173227",
  background: "#fff",
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 700,
};

const filterCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #d9dce1",
  padding: 18,
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "12px 14px",
  fontSize: 14,
};

const tableCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #d9dce1",
  padding: 18,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 14,
};

const subtleTextStyle: React.CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.6,
};

const panelStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid #eceff3",
  background: "#fafafa",
  padding: 18,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #eceff3",
  color: "#6b7280",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tdStyle: React.CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  fontSize: 14,
};

const contentCellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "92px 1fr",
  gap: 12,
  minWidth: 320,
};

const thumbStyle: React.CSSProperties = {
  width: 92,
  height: 68,
  objectFit: "cover",
  borderRadius: 12,
};

const thumbPlaceholderStyle: React.CSSProperties = {
  ...thumbStyle,
  display: "grid",
  placeItems: "center",
  background: "#ece4d8",
  color: "#7d5a41",
  fontWeight: 700,
};

const titleCellStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 4,
};

const slugTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  marginBottom: 6,
};

const summaryTextStyle: React.CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.5,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 10px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: 12,
};

const actionWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 220,
};

const actionLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  color: "#111827",
  fontWeight: 700,
  fontSize: 13,
};

const actionButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginTop: 18,
  flexWrap: "wrap",
};

const paginationButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};