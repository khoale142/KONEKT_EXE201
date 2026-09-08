export type MarketingContentType =
  | "NEWS"
  | "NEW_PRODUCT"
  | "NEW_STORE"
  | "TRENDING"
  | "PROMOTION"
  | "VOUCHER"
  | "CAMPAIGN"
  | "EVENT"
  | "ANNOUNCEMENT";

export type MarketingContentStatus = "draft" | "published" | "archived";
export type MarketingContentTargetType =
  | "NONE"
  | "PROMOTION"
  | "VOUCHER"
  | "PRODUCT"
  | "STORE";

export type MarketingContentDestinationType =
  | "CONTENT"
  | "PROMOTION"
  | "VOUCHER"
  | "PRODUCT"
  | "STORE"
  | "CUSTOM";

export type MarketingContentBase = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  type: MarketingContentType;
  status: MarketingContentStatus;
  isActive: boolean;
  publishedAt: string | null;
  displayStartAt: string | null;
  displayEndAt: string | null;
  viewCount: number;
  isFeatured: boolean;
  sortOrder: number;
  targetType: MarketingContentTargetType;
  targetRefId: number | null;
  badgeLabel: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  tags: string[];
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicMarketingContent = MarketingContentBase & {
  destinationType: MarketingContentDestinationType;
  destinationPath: string;
  resolvedUrl: string;
};

export type MarketingContentListResponse<TItem> = {
  items: TItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PublicMarketingHomeResponse = {
  featuredBanners: PublicMarketingContent[];
  latestPosts: PublicMarketingContent[];
  promotions: PublicMarketingContent[];
  trendingItems: PublicMarketingContent[];
  newStores: PublicMarketingContent[];
  newProducts: PublicMarketingContent[];
};

export type PublicMarketingDetailResponse = {
  item: PublicMarketingContent;
  relatedItems: PublicMarketingContent[];
};

export type MarketingContentFormValues = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImageUrl: string;
  galleryImagesText: string;
  type: MarketingContentType | "";
  badgeLabel: string;
  ctaLabel: string;
  ctaUrl: string;
  targetType: MarketingContentTargetType;
  targetRefId: string;
  tagsText: string;
  isFeatured: boolean;
  sortOrder: number;
  status: MarketingContentStatus | "";
  isActive: boolean;
  publishedAt: string;
  displayStartAt: string;
  displayEndAt: string;
};

export const MARKETING_CONTENT_TYPE_LABELS: Record<MarketingContentType, string> = {
  NEWS: "Tin tức",
  NEW_PRODUCT: "Món mới",
  NEW_STORE: "Quán mới",
  TRENDING: "Trending",
  PROMOTION: "Khuyến mãi",
  VOUCHER: "Voucher",
  CAMPAIGN: "Chiến dịch",
  EVENT: "Sự kiện",
  ANNOUNCEMENT: "Thông báo",
};

export const MARKETING_CONTENT_STATUS_LABELS: Record<MarketingContentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const MARKETING_CONTENT_TARGET_LABELS: Record<MarketingContentTargetType, string> = {
  NONE: "Bài viết thường",
  PROMOTION: "Promotion",
  VOUCHER: "Voucher",
  PRODUCT: "Sản phẩm",
  STORE: "Cửa hàng",
};
