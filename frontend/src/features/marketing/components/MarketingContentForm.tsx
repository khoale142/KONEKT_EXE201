import type { ChangeEvent, ReactNode } from "react";
import {
  MARKETING_CONTENT_STATUS_LABELS,
  MARKETING_CONTENT_TARGET_LABELS,
  MARKETING_CONTENT_TYPE_LABELS,
  type MarketingContentFormValues,
} from "../types/marketingContent.types.ts";

type MarketingContentFormProps = {
  mode: "create" | "edit";
  values: MarketingContentFormValues;
  errors: Partial<Record<keyof MarketingContentFormValues, string>>;
  saving: boolean;
  uploadingCoverImage: boolean;
  onChange: <K extends keyof MarketingContentFormValues>(
    key: K,
    value: MarketingContentFormValues[K],
  ) => void;
  onSubmit: () => void;
  onUploadCoverImage: (file: File) => Promise<void> | void;
};

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  spanFull?: boolean;
};

const CONTENT_TYPES = Object.entries(MARKETING_CONTENT_TYPE_LABELS);
const STATUS_OPTIONS = Object.entries(MARKETING_CONTENT_STATUS_LABELS);
const TARGET_OPTIONS = Object.entries(MARKETING_CONTENT_TARGET_LABELS);

const RESPONSIVE_STYLES = `
  .marketing-content-form-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(340px, 0.92fr);
    gap: 24px;
    align-items: start;
  }

  .marketing-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 20px;
  }

  .marketing-form-grid--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .marketing-field--full {
    grid-column: 1 / -1;
  }

  .marketing-upload-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 132px;
    gap: 14px;
    align-items: stretch;
  }

  .marketing-toggle-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  @media (max-width: 1279px) {
    .marketing-content-form-layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .marketing-preview-card {
      position: static !important;
      top: auto !important;
    }
  }

  @media (max-width: 839px) {
    .marketing-form-grid,
    .marketing-toggle-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .marketing-upload-panel {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

export default function MarketingContentForm({
  mode,
  values,
  errors,
  saving,
  uploadingCoverImage,
  onChange,
  onSubmit,
  onUploadCoverImage,
}: MarketingContentFormProps) {
  const typeLabel = values.type
    ? MARKETING_CONTENT_TYPE_LABELS[values.type]
    : "Chưa chọn loại nội dung";
  const statusLabel = values.status
    ? MARKETING_CONTENT_STATUS_LABELS[values.status]
    : "Chưa chọn trạng thái";

  async function handleCoverImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onUploadCoverImage(file);
  }

  return (
    <>
      <style>{RESPONSIVE_STYLES}</style>

      <div className="marketing-content-form-layout">
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={headerContentStyle}>
              <h1 style={titleStyle}>
                {mode === "create" ? "Tạo nội dung marketing" : "Cập nhật nội dung marketing"}
              </h1>
              <p style={subtitleStyle}>
                Quản lý bài viết marketing, chiến dịch, thông báo, khuyến mãi, voucher và các nội
                dung khám phá cho người dùng.
              </p>
            </div>
          </div>

          <div style={formBodyStyle}>
            <div className="marketing-form-grid">
              <Field label="Tiêu đề" error={errors.title}>
                <input
                  value={values.title}
                  onChange={(event) => onChange("title", event.target.value)}
                  placeholder="Nhập tiêu đề bài viết"
                  style={inputStyle}
                />
              </Field>

              <Field label="Slug" error={errors.slug}>
                <input
                  value={values.slug}
                  onChange={(event) => onChange("slug", event.target.value)}
                  placeholder="slug-bai-viet"
                  style={inputStyle}
                />
              </Field>

              <Field label="Loại nội dung" error={errors.type}>
                <select
                  value={values.type}
                  onChange={(event) =>
                    onChange("type", event.target.value as MarketingContentFormValues["type"])
                  }
                  style={inputStyle}
                >
                  <option value="">Chọn loại nội dung</option>
                  {CONTENT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Trạng thái" error={errors.status}>
                <select
                  value={values.status}
                  onChange={(event) =>
                    onChange("status", event.target.value as MarketingContentFormValues["status"])
                  }
                  style={inputStyle}
                >
                  <option value="">Chọn trạng thái</option>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Nhãn badge" error={errors.badgeLabel}>
                <div style={compactFieldPanelStyle}>
                  <input
                    value={values.badgeLabel}
                    onChange={(event) => onChange("badgeLabel", event.target.value)}
                    placeholder="Mới, Hot, Trending..."
                    style={inputStyle}
                  />
                  <div style={badgeHintRowStyle}>
                    <span style={badgeHintLabelStyle}>Xem nhanh</span>
                    <span style={values.badgeLabel.trim() ? badgeStyle : badgePlaceholderStyle}>
                      {values.badgeLabel.trim() || "Chưa có badge"}
                    </span>
                  </div>
                </div>
              </Field>

              <Field
                label="Ảnh bìa"
                error={errors.coverImageUrl}
                hint="Chọn ảnh từ máy, hệ thống sẽ tự tải lên Cloudinary."
              >
                <div style={uploadFieldStyle}>
                  <div className="marketing-upload-panel">
                    <div style={uploadContentStyle}>
                      <label style={uploadButtonStyle}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageFileChange}
                          disabled={saving || uploadingCoverImage}
                          style={hiddenInputStyle}
                        />
                        {uploadingCoverImage
                          ? "Đang tải ảnh lên..."
                          : values.coverImageUrl.trim()
                            ? "Chọn ảnh khác"
                            : "Chọn ảnh từ máy"}
                      </label>

                      <div style={uploadNoteBlockStyle}>
                        <span style={uploadStatusStyle}>
                          {uploadingCoverImage
                            ? "Ảnh đang được tải lên Cloudinary."
                            : values.coverImageUrl.trim()
                              ? "Ảnh bìa đã sẵn sàng để lưu."
                              : "Chưa có ảnh bìa được chọn."}
                        </span>
                      </div>
                    </div>

                    {values.coverImageUrl.trim() ? (
                      <div style={coverPreviewWrapStyle}>
                        <img src={values.coverImageUrl} alt="Ảnh bìa" style={coverPreviewStyle} />
                      </div>
                    ) : (
                      <div style={coverEmptyStyle}>Chưa tải ảnh bìa</div>
                    )}
                  </div>
                </div>
              </Field>
            </div>

            <div className="marketing-form-grid marketing-form-grid--single">
              <Field label="Mô tả ngắn" error={errors.summary} spanFull>
                <textarea
                  value={values.summary}
                  onChange={(event) => onChange("summary", event.target.value)}
                  placeholder="Mô tả ngắn cho card hoặc danh sách"
                  style={{ ...textareaStyle, minHeight: 126 }}
                />
              </Field>

              <Field label="Nội dung chi tiết" error={errors.content} spanFull>
                <textarea
                  value={values.content}
                  onChange={(event) => onChange("content", event.target.value)}
                  placeholder="Nhập nội dung chi tiết..."
                  style={{ ...textareaStyle, minHeight: 280 }}
                />
              </Field>
            </div>

            <div className="marketing-form-grid">
              <Field label="Ảnh gallery" error={errors.galleryImagesText} hint="Mỗi dòng một URL">
                <textarea
                  value={values.galleryImagesText}
                  onChange={(event) => onChange("galleryImagesText", event.target.value)}
                  placeholder="https://image-1&#10;https://image-2"
                  style={{ ...textareaStyle, minHeight: 148 }}
                />
              </Field>

              <Field
                label="Thẻ"
                error={errors.tagsText}
                hint="Nhập cách nhau bằng dấu phẩy hoặc xuống dòng"
              >
                <textarea
                  value={values.tagsText}
                  onChange={(event) => onChange("tagsText", event.target.value)}
                  placeholder="tra-sua, mua-he, khai-truong"
                  style={{ ...textareaStyle, minHeight: 148 }}
                />
              </Field>
            </div>

            <div className="marketing-form-grid">
              <Field label="Nhãn CTA" error={errors.ctaLabel}>
                <input
                  value={values.ctaLabel}
                  onChange={(event) => onChange("ctaLabel", event.target.value)}
                  placeholder="Xem ngay"
                  style={inputStyle}
                />
              </Field>

              <Field label="URL CTA" error={errors.ctaUrl}>
                <input
                  value={values.ctaUrl}
                  onChange={(event) => onChange("ctaUrl", event.target.value)}
                  placeholder="/promotions/1 hoặc https://..."
                  style={inputStyle}
                />
              </Field>

              <Field label="Loại liên kết" error={errors.targetType}>
                <select
                  value={values.targetType}
                  onChange={(event) =>
                    onChange(
                      "targetType",
                      event.target.value as MarketingContentFormValues["targetType"],
                    )
                  }
                  style={inputStyle}
                >
                  {TARGET_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="ID liên kết" error={errors.targetRefId}>
                <input
                  value={values.targetRefId}
                  onChange={(event) => onChange("targetRefId", event.target.value)}
                  placeholder="123"
                  style={inputStyle}
                />
              </Field>

              <Field label="Ngày xuất bản" error={errors.publishedAt}>
                <input
                  type="datetime-local"
                  value={values.publishedAt}
                  onChange={(event) => onChange("publishedAt", event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Ngày bắt đầu hiển thị" error={errors.displayStartAt}>
                <input
                  type="datetime-local"
                  value={values.displayStartAt}
                  onChange={(event) => onChange("displayStartAt", event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Ngày kết thúc hiển thị" error={errors.displayEndAt}>
                <input
                  type="datetime-local"
                  value={values.displayEndAt}
                  onChange={(event) => onChange("displayEndAt", event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Thứ tự ưu tiên" error={errors.sortOrder}>
                <input
                  type="number"
                  value={String(values.sortOrder)}
                  onChange={(event) => onChange("sortOrder", Number(event.target.value))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={toggleSectionStyle}>
              <div style={toggleSectionTitleStyle}>Tùy chọn hiển thị</div>
              <div className="marketing-toggle-grid">
                <label style={toggleCardStyle}>
                  <div style={toggleTextWrapStyle}>
                    <span style={toggleTitleStyle}>Nổi bật</span>
                    <span style={toggleDescriptionStyle}>
                      Ưu tiên hiển thị ở các khu vực nổi bật của marketing.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={values.isFeatured}
                    onChange={(event) => onChange("isFeatured", event.target.checked)}
                  />
                </label>

                <label style={toggleCardStyle}>
                  <div style={toggleTextWrapStyle}>
                    <span style={toggleTitleStyle}>Đang hiển thị</span>
                    <span style={toggleDescriptionStyle}>
                      Kiểm soát bài viết có hiển thị trong hệ thống hay không.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={values.isActive}
                    onChange={(event) => onChange("isActive", event.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div style={actionRowStyle}>
              <button
                type="button"
                style={submitButtonStyle}
                onClick={onSubmit}
                disabled={saving || uploadingCoverImage}
              >
                {uploadingCoverImage
                  ? "Đang tải ảnh..."
                  : saving
                    ? "Đang lưu..."
                    : mode === "create"
                      ? "Tạo bài viết"
                      : "Cập nhật bài viết"}
              </button>
            </div>
          </div>
        </div>

        <div className="marketing-preview-card" style={previewCardStyle}>
          <div style={previewHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Xem trước</h2>
          </div>

          <div style={previewBodyStyle}>
            {values.coverImageUrl.trim() ? (
              <img src={values.coverImageUrl} alt="Ảnh xem trước" style={previewImageStyle} />
            ) : (
              <div style={previewPlaceholderStyle}>Ảnh xem trước</div>
            )}

            <div style={previewBadgeRowStyle}>
              {values.badgeLabel.trim() ? <span style={badgeStyle}>{values.badgeLabel.trim()}</span> : null}
              <span style={typePillStyle}>{typeLabel}</span>
              {values.isFeatured ? <span style={featurePillStyle}>Nổi bật</span> : null}
              <span style={statusPillStyle}>{statusLabel}</span>
            </div>

            <h3 style={previewTitleStyle}>{values.title.trim() || "Tiêu đề bài viết"}</h3>
            <p style={previewTextStyle}>
              {values.summary.trim() ||
                "Mô tả ngắn của bài viết sẽ hiển thị tại đây để marketing kiểm tra trước khi lưu."}
            </p>

            <div style={metaListStyle}>
              <MetaRow label="Slug" value={values.slug || "-"} />
              <MetaRow
                label="Liên kết"
                value={
                  values.targetType === "NONE"
                    ? "-"
                    : `${values.targetType} #${values.targetRefId || "?"}`
                }
              />
              <MetaRow label="CTA" value={values.ctaLabel || values.ctaUrl || "-"} />
              <MetaRow
                label="Hiển thị"
                value={[values.displayStartAt || "-", values.displayEndAt || "-"].join(" -> ")}
              />
            </div>

            {values.tagsText.trim() ? (
              <div style={previewSectionStyle}>
                <div style={metaHeadingStyle}>Thẻ</div>
                <div style={chipWrapStyle}>
                  {values.tagsText
                    .split(/\r?\n|,/)
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} style={tagStyle}>
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}

            {values.galleryImagesText.trim() ? (
              <div style={previewSectionStyle}>
                <div style={metaHeadingStyle}>Gallery</div>
                <div style={galleryGridStyle}>
                  {values.galleryImagesText
                    .split(/\r?\n|,/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((url) => (
                      <div key={url} style={galleryItemStyle}>
                        <img src={url} alt="Gallery" style={galleryImageStyle} />
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, error, hint, children, spanFull }: FieldProps) {
  return (
    <label className={spanFull ? "marketing-field--full" : undefined} style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
      <div style={fieldMessageSlotStyle}>
        {error ? (
          <span style={errorStyle}>{error}</span>
        ) : hint ? (
          <span style={hintStyle}>{hint}</span>
        ) : (
          <span style={fieldMessagePlaceholderStyle}>&nbsp;</span>
        )}
      </div>
    </label>
  );
}

function MetaRow(props: { label: string; value: string }) {
  return (
    <div style={metaRowStyle}>
      <span style={metaKeyStyle}>{props.label}</span>
      <span style={metaValueStyle}>{props.value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  border: "1px solid #d9dce1",
  padding: 28,
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
};

const headerStyle: React.CSSProperties = {
  paddingBottom: 20,
  borderBottom: "1px solid #eceff3",
};

const headerContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const formBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
  paddingTop: 22,
};

const previewCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  border: "1px solid #d9dce1",
  overflow: "hidden",
  position: "sticky",
  top: 24,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.2,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  lineHeight: 1.7,
  maxWidth: 760,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
  alignContent: "start",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  letterSpacing: 0.1,
};

const fieldMessageSlotStyle: React.CSSProperties = {
  minHeight: 18,
  display: "flex",
  alignItems: "flex-start",
};

const fieldMessagePlaceholderStyle: React.CSSProperties = {
  visibility: "hidden",
  fontSize: 12,
  lineHeight: 1.5,
};

const controlBaseStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  padding: "0 14px",
  fontSize: 14,
  lineHeight: 1.5,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
};

const inputStyle: React.CSSProperties = {
  ...controlBaseStyle,
  minHeight: 48,
};

const textareaStyle: React.CSSProperties = {
  ...controlBaseStyle,
  padding: "13px 14px",
  resize: "vertical",
  fontFamily: "inherit",
};

const compactFieldPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  minHeight: 132,
  padding: 12,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)",
};

const badgeHintRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingTop: 4,
};

const badgeHintLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 600,
};

const badgePlaceholderStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "6px 12px",
  background: "#f3f4f6",
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 700,
};

const hiddenInputStyle: React.CSSProperties = {
  display: "none",
};

const uploadFieldStyle: React.CSSProperties = {
  minHeight: 132,
  borderRadius: 16,
  border: "1px solid #dbe3ea",
  background: "linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)",
  padding: 12,
};

const uploadContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  alignContent: "space-between",
  minWidth: 0,
};

const uploadButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 44,
  borderRadius: 12,
  padding: "0 16px",
  background: "#2f5c4f",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(47, 92, 79, 0.2)",
};

const uploadNoteBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const uploadStatusStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.55,
};

const coverPreviewWrapStyle: React.CSSProperties = {
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  background: "#fff",
  minHeight: 106,
};

const coverPreviewStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 106,
  objectFit: "cover",
  display: "block",
};

const coverEmptyStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px dashed #d1d5db",
  background: "#fff",
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 106,
  display: "grid",
  placeItems: "center",
  padding: 16,
  textAlign: "center",
};

const hintStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  lineHeight: 1.45,
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45,
};

const toggleSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  paddingTop: 4,
};

const toggleSectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
};

const toggleCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  minHeight: 76,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fafaf9",
};

const toggleTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const toggleTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
};

const toggleDescriptionStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.45,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  paddingTop: 8,
  borderTop: "1px solid #eceff3",
};

const submitButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  background: "#2f5c4f",
  color: "#fff",
  fontWeight: 700,
  minHeight: 48,
  padding: "0 20px",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(47, 92, 79, 0.18)",
};

const previewHeaderStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderBottom: "1px solid #eceff3",
};

const previewBodyStyle: React.CSSProperties = {
  padding: 20,
};

const previewImageStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: 14,
  marginBottom: 16,
};

const previewPlaceholderStyle: React.CSSProperties = {
  ...previewImageStyle,
  display: "grid",
  placeItems: "center",
  background: "#ece4d8",
  color: "#7d5a41",
  fontWeight: 700,
};

const previewBadgeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};

const badgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#ead8c1",
  color: "#7d4d2f",
  fontSize: 12,
  fontWeight: 700,
};

const typePillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 700,
};

const featurePillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 700,
};

const statusPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const previewTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  lineHeight: 1.4,
};

const previewTextStyle: React.CSSProperties = {
  marginTop: 0,
  color: "#6b7280",
  lineHeight: 1.7,
};

const metaListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 16,
};

const metaRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr)",
  gap: 10,
};

const metaKeyStyle: React.CSSProperties = {
  color: "#6b7280",
  fontWeight: 700,
};

const metaValueStyle: React.CSSProperties = {
  color: "#111827",
  wordBreak: "break-word",
};

const previewSectionStyle: React.CSSProperties = {
  marginTop: 16,
};

const metaHeadingStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 10,
};

const chipWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const tagStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const galleryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const galleryItemStyle: React.CSSProperties = {
  borderRadius: 12,
  overflow: "hidden",
  background: "#f9fafb",
  border: "1px solid #eceff3",
};

const galleryImageStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover",
  display: "block",
};
