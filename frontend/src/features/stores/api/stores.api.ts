import api from "../../../lib/http/axios";

export type StoreLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  lat: number;
  lng: number;
  openHours?: string;
};

export type StoreBusynessLevel = "busy" | "quiet";

export type StoreBusyness = {
  level: StoreBusynessLevel;
  title: string;
  orderCount: number;
};

export type StoreDetail = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  openHours?: string | null;
  description?: string;
  images?: string[];
  busyness?: StoreBusyness | null;
};

/** Lấy danh sách cửa hàng từ API (optional city filter) */
export async function getStoreLocations(params?: { city?: string }): Promise<StoreLocation[]> {
  const r = await api.get("/stores", { params: params?.city ? { city: params.city } : {} });
  return (r.data as { stores: StoreLocation[] }).stores ?? [];
}

export async function getStoreDetail(id: string): Promise<StoreDetail> {
  const r = await api.get(`/stores/${id}`);
  return (r.data as { store: StoreDetail }).store;
}
