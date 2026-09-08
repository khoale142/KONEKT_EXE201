import type {
  MarketingContentBase,
  MarketingContentFormValues,
  MarketingContentStatus,
  MarketingContentType,
  PublicMarketingContent,
} from "../types/marketingContent.types.ts";

const MARKETING_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;
const DATE_TIME_LOCAL_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;

const marketingDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: MARKETING_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const marketingDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: MARKETING_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const marketingDateTimeLocalFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MARKETING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toValidDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeLocalInVietnam(date: Date) {
  const parts = marketingDateTimeLocalFormatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}T${map.get("hour")}:${map.get("minute")}`;
}

function parseVietnamDateTimeInput(value: string) {
  const match = value.match(DATE_TIME_LOCAL_REGEX);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00", millisecond = "0"] = match;
  const normalizedMillisecond = millisecond.padEnd(3, "0").slice(0, 3);
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute) - VIETNAM_UTC_OFFSET_MINUTES,
    Number(second),
    Number(normalizedMillisecond),
  );

  return new Date(utcTime);
}

export function slugifyMarketingContent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatMarketingDate(value?: string | null) {
  if (!value) return "-";
  const date = toValidDate(value);
  if (!date) return value;
  return marketingDateFormatter.format(date);
}

export function formatMarketingDateTime(value?: string | null) {
  if (!value) return "-";
  const date = toValidDate(value);
  if (!date) return value;
  return marketingDateTimeFormatter.format(date);
}

export function formatViewCount(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")} lượt xem`;
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = toValidDate(value);
  if (date) return formatDateTimeLocalInVietnam(date);
  return value.slice(0, 16);
}

export function toNullableDateTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const vietnamDate = parseVietnamDateTimeInput(trimmed);
  if (vietnamDate) return vietnamDate.toISOString();

  const date = toValidDate(trimmed);
  return date ? date.toISOString() : trimmed;
}

export function parseCommaLineValues(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMarketingType(value?: string | null): MarketingContentType | "" {
  const trimmed = (value || "").trim();
  return trimmed ? (trimmed as MarketingContentType) : "";
}

function normalizeMarketingStatus(value?: string | null): MarketingContentStatus | "" {
  const trimmed = (value || "").trim();
  return trimmed ? (trimmed as MarketingContentStatus) : "";
}

export function buildMarketingFormValues(
  item?: MarketingContentBase | null,
): MarketingContentFormValues {
  return {
    title: item?.title || "",
    slug: item?.slug || "",
    summary: item?.summary || "",
    content: item?.content || "",
    coverImageUrl: item?.coverImageUrl || "",
    galleryImagesText: item?.galleryImages.join("\n") || "",
    type: normalizeMarketingType(item?.type),
    badgeLabel: item?.badgeLabel || "",
    ctaLabel: item?.ctaLabel || "",
    ctaUrl: item?.ctaUrl || "",
    targetType: item?.targetType || "NONE",
    targetRefId: item?.targetRefId != null ? String(item.targetRefId) : "",
    tagsText: item?.tags.join(", ") || "",
    isFeatured: Boolean(item?.isFeatured),
    sortOrder: Number(item?.sortOrder || 0),
    status: normalizeMarketingStatus(item?.status),
    isActive: item?.isActive ?? true,
    publishedAt: toDateTimeLocalValue(item?.publishedAt),
    displayStartAt: toDateTimeLocalValue(item?.displayStartAt),
    displayEndAt: toDateTimeLocalValue(item?.displayEndAt),
  };
}

export function toMarketingContentPayload(values: MarketingContentFormValues) {
  return {
    title: values.title.trim(),
    slug: slugifyMarketingContent(values.slug || values.title),
    summary: values.summary.trim() || null,
    content: values.content.trim() || null,
    coverImageUrl: values.coverImageUrl.trim() || null,
    galleryImages: parseCommaLineValues(values.galleryImagesText),
    type: values.type as MarketingContentType,
    badgeLabel: values.badgeLabel.trim() || null,
    ctaLabel: values.ctaLabel.trim() || null,
    ctaUrl: values.ctaUrl.trim() || null,
    targetType: values.targetType,
    targetRefId:
      values.targetType === "NONE" || !values.targetRefId.trim()
        ? null
        : Number(values.targetRefId),
    tags: parseCommaLineValues(values.tagsText),
    isFeatured: values.isFeatured,
    sortOrder: Number(values.sortOrder || 0),
    status: values.status as MarketingContentStatus,
    isActive: values.isActive,
    publishedAt: toNullableDateTimeInput(values.publishedAt),
    displayStartAt: toNullableDateTimeInput(values.displayStartAt),
    displayEndAt: toNullableDateTimeInput(values.displayEndAt),
  };
}

export function getMarketingDisplayStatusLabel(
  item: Pick<
    MarketingContentBase,
    "status" | "isActive" | "displayStartAt" | "displayEndAt"
  >,
  now = new Date(),
) {
  if (item.status === "draft") return "Bản nháp";
  if (item.status === "archived") return "Đã lưu trữ";
  if (!item.isActive) return "Tạm ẩn";

  const currentDate = toValidDate(now);
  const displayStartAt = toValidDate(item.displayStartAt);
  const displayEndAt = toValidDate(item.displayEndAt);

  if (currentDate && displayStartAt && currentDate < displayStartAt) {
    return "Chưa hiển thị";
  }

  if (currentDate && displayEndAt && currentDate > displayEndAt) {
    return "Đã kết thúc";
  }

  return "Đang hiển thị";
}

export function getMarketingContentTargetUrl(item: Pick<
  PublicMarketingContent,
  "destinationPath" | "resolvedUrl"
>) {
  return item.resolvedUrl || item.destinationPath || "/discover";
}

type MarketingContentDetailCta = {
  label: string;
  url: string;
  isExternal: boolean;
};

const MARKETING_DETAIL_CTA_BY_TARGET_TYPE = {
  PROMOTION: {
    label: "Xem khuyến mãi",
    url: "/customer/promotions",
  },
  VOUCHER: {
    label: "Xem voucher",
    url: "/customer/vouchers",
  },
  PRODUCT: {
    label: "Xem menu",
    url: "/menu",
  },
  STORE: {
    label: "Xem cửa hàng",
    url: "/stores",
  },
} as const;

const MARKETING_DETAIL_CTA_BY_TYPE: Partial<
  Record<MarketingContentType, { label: string; url: string }>
> = {
  NEW_PRODUCT: {
    label: "Xem menu",
    url: "/menu",
  },
  PROMOTION: {
    label: "Xem khuyến mãi",
    url: "/customer/promotions",
  },
  VOUCHER: {
    label: "Xem voucher",
    url: "/customer/vouchers",
  },
  NEW_STORE: {
    label: "Xem cửa hàng",
    url: "/stores",
  },
  TRENDING: {
    label: "Xem menu",
    url: "/menu",
  },
};

function normalizeMarketingString(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed || null;
}

function isExternalMarketingUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isInternalMarketingPath(value: string) {
  return value.startsWith("/");
}

function normalizeMarketingDestination(value?: string | null) {
  const trimmed = normalizeMarketingString(value);
  if (!trimmed) return null;
  if (isExternalMarketingUrl(trimmed) || isInternalMarketingPath(trimmed)) {
    return trimmed;
  }
  return null;
}

function getComparableMarketingPath(value: string) {
  if (isInternalMarketingPath(value)) {
    return value.split(/[?#]/, 1)[0];
  }

  if (isExternalMarketingUrl(value)) {
    try {
      return new URL(value).pathname;
    } catch {
      return null;
    }
  }

  return null;
}

function isCurrentMarketingDetailPath(url: string, detailPath: string) {
  return getComparableMarketingPath(url) === detailPath;
}

function getDefaultMarketingDetailCta(item: Pick<
  PublicMarketingContent,
  "type" | "targetType"
>) {
  if (item.targetType !== "NONE") {
    return MARKETING_DETAIL_CTA_BY_TARGET_TYPE[item.targetType];
  }

  return MARKETING_DETAIL_CTA_BY_TYPE[item.type] || null;
}

function getMarketingDetailCtaLabel(params: {
  item: Pick<PublicMarketingContent, "ctaLabel" | "type" | "targetType">;
  hasDestination: boolean;
}) {
  const customLabel = normalizeMarketingString(params.item.ctaLabel);
  if (customLabel) return customLabel;

  const defaultCta = getDefaultMarketingDetailCta(params.item);
  if (defaultCta) return defaultCta.label;

  return params.hasDestination ? "Khám phá thêm" : null;
}

export function getMarketingContentDetailCta(
  item: Pick<
    PublicMarketingContent,
    "slug" | "type" | "targetType" | "ctaLabel" | "ctaUrl" | "destinationPath" | "resolvedUrl"
  >,
): MarketingContentDetailCta | null {
  const detailPath = `/discover/${item.slug}`;
  const explicitDestination = [
    item.resolvedUrl,
    item.destinationPath,
    item.ctaUrl,
  ]
    .map(normalizeMarketingDestination)
    .find((value): value is string => Boolean(value));

  if (explicitDestination && !isCurrentMarketingDetailPath(explicitDestination, detailPath)) {
    const label = getMarketingDetailCtaLabel({
      item,
      hasDestination: true,
    });

    if (!label) return null;

    return {
      label,
      url: explicitDestination,
      isExternal: isExternalMarketingUrl(explicitDestination),
    };
  }

  const fallbackCta = getDefaultMarketingDetailCta(item);
  if (!fallbackCta) return null;

  return {
    label: getMarketingDetailCtaLabel({
      item,
      hasDestination: true,
    }) || fallbackCta.label,
    url: fallbackCta.url,
    isExternal: false,
  };
}
