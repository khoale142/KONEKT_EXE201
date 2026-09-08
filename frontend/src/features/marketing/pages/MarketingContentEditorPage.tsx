import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { uploadReviewImage } from "../../stores/utils/uploadReviewImage";
import { marketingApi } from "../api/marketing.api";
import MarketingContentForm from "../components/MarketingContentForm";
import {
  buildMarketingFormValues,
  slugifyMarketingContent,
  toMarketingContentPayload,
} from "../lib/marketingContent.utils";
import type {
  MarketingContentBase,
  MarketingContentFormValues,
} from "../types/marketingContent.types";

type MarketingContentFormErrors = Partial<Record<keyof MarketingContentFormValues, string>>;

function validate(values: MarketingContentFormValues) {
  const errors: MarketingContentFormErrors = {};

  if (!values.title.trim()) errors.title = "Vui lòng nhập tiêu đề";
  if (!values.slug.trim()) errors.slug = "Vui lòng nhập slug";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugifyMarketingContent(values.slug || values.title))) {
    errors.slug = "Slug không hợp lệ";
  }

  if (!values.type) errors.type = "Vui lòng chọn loại nội dung";
  if (!values.status) errors.status = "Vui lòng chọn trạng thái";
  if (!values.badgeLabel.trim()) errors.badgeLabel = "Vui lòng nhập nhãn badge";

  if (!values.summary.trim()) {
    errors.summary = "Vui lòng nhập mô tả ngắn";
  } else if (values.summary.trim().length > 600) {
    errors.summary = "Mô tả ngắn tối đa 600 ký tự";
  }

  if (!values.content.trim()) {
    errors.content = "Vui lòng nhập nội dung chi tiết";
  } else if (values.content.trim().length > 100000) {
    errors.content = "Nội dung quá dài";
  }

  if (!values.displayStartAt.trim()) {
    errors.displayStartAt = "Vui lòng chọn ngày bắt đầu hiển thị";
  }

  if (!values.displayEndAt.trim()) {
    errors.displayEndAt = "Vui lòng chọn ngày kết thúc hiển thị";
  }

  if (!values.coverImageUrl.trim()) {
    errors.coverImageUrl = "Vui lòng tải lên ảnh bìa";
  }

  if (!values.publishedAt.trim()) {
    errors.publishedAt = "Vui lòng chọn ngày xuất bản";
  }

  if (values.displayStartAt && values.displayEndAt) {
    const start = new Date(values.displayStartAt);
    const end = new Date(values.displayEndAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() < start.getTime()) {
      errors.displayEndAt = "Ngày kết thúc hiển thị phải sau hoặc bằng ngày bắt đầu hiển thị";
    }
  }

  if (values.targetType !== "NONE" && !values.targetRefId.trim()) {
    errors.targetRefId = "Vui lòng nhập ID liên kết";
  }

  if (values.ctaUrl.trim()) {
    const url = values.ctaUrl.trim();
    const valid =
      url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://");
    if (!valid) errors.ctaUrl = "Liên kết CTA phải là /path hoặc http(s)://";
  }

  return errors;
}

function getCoverImageUploadError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "Tải ảnh bìa thất bại. Vui lòng thử lại.";
  if (message.startsWith("Thiếu cấu hình Cloudinary")) return message;
  return `Tải ảnh bìa thất bại: ${message}`;
}

export default function MarketingContentEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const editingId = params.id ? Number(params.id) : null;
  const isEdit = Number.isFinite(editingId) && editingId != null;
  const [values, setValues] = useState<MarketingContentFormValues>(buildMarketingFormValues());
  const [errors, setErrors] = useState<MarketingContentFormErrors>({});
  const [loading, setLoading] = useState(Boolean(isEdit));
  const [saving, setSaving] = useState(false);
  const [slugDirty, setSlugDirty] = useState(false);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);

  useEffect(() => {
    if (!isEdit || !editingId) {
      setValues(buildMarketingFormValues());
      setErrors({});
      setSlugDirty(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    marketingApi
      .adminGetMarketingContentDetail(editingId)
      .then((item: MarketingContentBase) => {
        if (!cancelled) {
          setValues(buildMarketingFormValues(item));
          setSlugDirty(true);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          window.alert(err?.response?.data?.message || "Không tải được bài viết");
          navigate("/office/marketing/contents", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingId, isEdit, navigate]);

  const normalizedSlug = useMemo(
    () => slugifyMarketingContent(values.slug || values.title),
    [values.slug, values.title],
  );

  function handleChange<K extends keyof MarketingContentFormValues>(
    key: K,
    value: MarketingContentFormValues[K],
  ) {
    setValues((current) => {
      const next = { ...current, [key]: value };

      if (key === "title" && !slugDirty) {
        next.slug = slugifyMarketingContent(String(value));
      }

      return next;
    });

    if (key === "slug") setSlugDirty(true);
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === "title" && !slugDirty ? { slug: undefined } : {}),
    }));
  }

  async function handleUploadCoverImage(file: File) {
    setUploadingCoverImage(true);
    setErrors((current) => ({ ...current, coverImageUrl: undefined }));

    try {
      const coverImageUrl = await uploadReviewImage(file);
      setValues((current) => ({ ...current, coverImageUrl }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        coverImageUrl: getCoverImageUploadError(error),
      }));
    } finally {
      setUploadingCoverImage(false);
    }
  }

  async function handleSubmit() {
    if (uploadingCoverImage) {
      setErrors((current) => ({
        ...current,
        coverImageUrl: "Ảnh bìa đang được tải lên. Vui lòng chờ hoàn tất.",
      }));
      return;
    }

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = toMarketingContentPayload(values);
      if (isEdit && editingId) {
        await marketingApi.adminUpdateMarketingContent(editingId, payload);
      } else {
        await marketingApi.adminCreateMarketingContent(payload);
      }

      navigate("/office/marketing/contents", { replace: true });
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Lưu bài viết thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <Link to="/office/marketing/contents" style={backLinkStyle}>
            ← Về danh sách
          </Link>
          <div style={{ marginTop: 10 }}>
            <div style={subtleStyle}>Slug sẽ được submit: /discover/{normalizedSlug || "slug"}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={loadingPanelStyle}>Đang tải dữ liệu bài viết...</div>
      ) : (
        <MarketingContentForm
          mode={isEdit ? "edit" : "create"}
          values={values}
          errors={errors}
          saving={saving}
          uploadingCoverImage={uploadingCoverImage}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onUploadCoverImage={handleUploadCoverImage}
        />
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  marginBottom: 16,
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#6b7280",
  fontWeight: 700,
};

const subtleStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const loadingPanelStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 24,
  border: "1px solid #d9dce1",
};
