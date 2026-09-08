export type HomeHeroSlide = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  primaryCtaTo: string;
  secondaryCtaTo: string;
};

export type HomeActionItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  to: string;
};

export type HomeProductItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  badge?: "Bán chạy" | "Mới" | "Nổi bật";
  priceText: string;
  to: string;
};

export type HomeNewsCategory =
  | "all"
  | "news"
  | "promotion"
  | "voucher"
  | "new_product"
  | "new_store"
  | "trending";

export type HomeNewsItem = {
  id: string;
  category: Exclude<HomeNewsCategory, "all">;
  title: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  views?: number;
  badgeLabel?: string;
  isFeatured?: boolean;
  typeLabel?: string;
  to: string;
};

export type HomeStoreItem = {
  id: string;
  name: string;
  address: string;
  city: string;
  openHours?: string;
  to: string;
};
