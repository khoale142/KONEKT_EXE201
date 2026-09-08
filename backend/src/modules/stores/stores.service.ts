import { pool } from "../../config/db";
import { getStoreBusyness } from "./stores.busyness.service";

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

// Lay danh sach cua hang (optional filter by city)
export async function listStores(city?: string | null): Promise<StoreLocation[]> {
  const hasCity = city && String(city).trim().length > 0;
  const q = hasCity
    ? `
    SELECT
      id,
      name,
      address,
      COALESCE(city, '') as city,
      latitude,
      longitude,
      phone,
      open_hours
    FROM stores
    WHERE is_active = true
      AND (city IS NULL OR TRIM(LOWER(city)) = TRIM(LOWER($1)))
    ORDER BY name
  `
    : `
    SELECT
      id,
      name,
      address,
      COALESCE(city, '') as city,
      latitude,
      longitude,
      phone,
      open_hours
    FROM stores
    WHERE is_active = true
    ORDER BY name
  `;

  const r = hasCity ? await pool.query(q, [city!.trim()]) : await pool.query(q);

  return r.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    phone: row.phone ? String(row.phone) : undefined,
    lat: Number(row.latitude ?? 0),
    lng: Number(row.longitude ?? 0),
    openHours: row.open_hours ? String(row.open_hours) : undefined,
  }));
}

// Lay chi tiet cua hang
export async function getStoreDetail(id: string) {
  const q = `
    SELECT
      id,
      name,
      address,
      latitude,
      longitude,
      phone,
      open_hours,
      description,
      images
    FROM stores
    WHERE id = $1
  `;

  const r = await pool.query(q, [id]);

  if (r.rows.length === 0) return null;

  const row = r.rows[0];
  const numericId = Number(row.id);
  const busyness = Number.isFinite(numericId) ? await getStoreBusyness(numericId, row.open_hours ?? null) : null;

  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address),
    lat: Number(row.latitude),
    lng: Number(row.longitude),

    phone: row.phone ?? null,
    openHours: row.open_hours ?? null,
    description: row.description ?? "",
    images: row.images ?? [],
    busyness,
  };
}
