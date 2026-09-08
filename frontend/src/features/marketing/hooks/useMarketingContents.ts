import { useEffect, useState } from "react";
import { marketingApi } from "../api/marketing.api";
import type {
  MarketingContentBase,
  MarketingContentListResponse,
  PublicMarketingContent,
  PublicMarketingDetailResponse,
  PublicMarketingHomeResponse,
} from "../types/marketingContent.types.ts";

export function useAdminMarketingContents(params: {
  keyword?: string;
  type?: string;
  status?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  refreshKey?: number;
}) {
  const [data, setData] = useState<MarketingContentListResponse<MarketingContentBase> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    marketingApi
      .adminListMarketingContents(params)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Không tải được danh sách bài viết");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    params.keyword,
    params.type,
    params.status,
    params.isActive,
    params.isFeatured,
    params.page,
    params.limit,
    params.sortBy,
    params.sortDirection,
    params.refreshKey,
  ]);

  return { data, loading, error };
}

export function usePublicMarketingContents(params: {
  keyword?: string;
  type?: string;
  featuredOnly?: boolean;
  limit?: number;
  page?: number;
}) {
  const [data, setData] = useState<MarketingContentListResponse<PublicMarketingContent> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    marketingApi
      .getPublicMarketingContents(params)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Không tải được nội dung marketing");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.keyword, params.type, params.featuredOnly, params.limit, params.page]);

  return { data, loading, error };
}

export function usePublicMarketingHome(params?: {
  featuredLimit?: number;
  latestLimit?: number;
  sectionLimit?: number;
}) {
  const [data, setData] = useState<PublicMarketingHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    marketingApi
      .getHomeMarketingContents(params)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Không tải được nội dung trang chủ");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params?.featuredLimit, params?.latestLimit, params?.sectionLimit]);

  return { data, loading, error };
}

export function usePublicMarketingDetail(slug: string | undefined) {
  const [data, setData] = useState<PublicMarketingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setData(null);
      setError("Slug không hợp lệ");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    marketingApi
      .getPublicMarketingContentDetail(slug)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Không tải được chi tiết bài viết");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { data, loading, error };
}
