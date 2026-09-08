import { pool } from "../../../config/db";

export type StoreInfo = {
  id: number;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  openHours: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type StoreMatchResult = {
  stores: StoreInfo[];
  specific: boolean;
};

function normalizeStoreText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedText || !normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(normalizedText);
}

function buildMapsLink(store: StoreInfo): string | null {
  if (store.latitude == null || store.longitude == null) return null;
  return `https://www.google.com/maps?q=${store.latitude},${store.longitude}`;
}

function scoreStore(messageNormalized: string, store: StoreInfo): number {
  let score = 0;
  const name = normalizeStoreText(store.name);
  const city = normalizeStoreText(store.city || "");
  const address = normalizeStoreText(store.address || "");
  const code = normalizeStoreText(store.code || "");

  if (name && containsPhrase(messageNormalized, name)) score += 60;
  if (code && containsPhrase(messageNormalized, code)) score += 40;
  if (city && containsPhrase(messageNormalized, city)) score += 20;
  if (address && containsPhrase(messageNormalized, address)) score += 18;

  const nameTokens = name.split(" ").filter((token) => token.length >= 3);
  const matchedNameTokens = nameTokens.filter((token) => messageNormalized.includes(token));
  score += matchedNameTokens.length * 4;

  return score;
}

export async function getActiveStores(limit: number = 20): Promise<StoreInfo[]> {
  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      address,
      phone,
      open_hours,
      city,
      latitude,
      longitude
    FROM coffee_chain_db.stores
    WHERE is_active = TRUE
    ORDER BY city NULLS LAST, name ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    code: row.code ? String(row.code) : null,
    name: String(row.name || ""),
    address: row.address ? String(row.address) : null,
    phone: row.phone ? String(row.phone) : null,
    openHours: row.open_hours ? String(row.open_hours) : null,
    city: row.city ? String(row.city) : null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
  }));
}

export async function findStoresForMessage(message: string, limit: number = 3): Promise<StoreMatchResult> {
  const activeStores = await getActiveStores(50);
  if (activeStores.length === 0) {
    return { stores: [], specific: false };
  }

  const normalizedMessage = normalizeStoreText(message);
  const rankedStores = activeStores
    .map((store) => ({ store, score: scoreStore(normalizedMessage, store) }))
    .sort((a, b) => b.score - a.score || a.store.name.localeCompare(b.store.name));

  const matchedStores = rankedStores.filter((item) => item.score > 0).map((item) => item.store);
  if (matchedStores.length > 0) {
    return {
      stores: matchedStores.slice(0, limit),
      specific: true,
    };
  }

  return {
    stores: activeStores.slice(0, limit),
    specific: false,
  };
}

export function formatHoursAnswer(stores: StoreInfo[], specific: boolean): string {
  if (stores.length === 0) {
    return "Da hien tai minh chua lay duoc gio mo cua cua chi nhanh nao. Ban vui long thu lai sau nhe.";
  }

  const lines = specific
    ? [`Da day la gio hoat dong cua chi nhanh ban dang quan tam:`]
    : [`Da gio mo cua co the khac nhau theo tung chi nhanh. Minh gui ban mot vai chi nhanh dang hoat dong:`];

  for (const store of stores) {
    lines.push(`- ${store.name}: ${store.openHours || "Dang cap nhat"}`);
  }

  if (!specific) {
    lines.push("");
    lines.push("Neu ban muon kiem tra mot chi nhanh cu the, ban chi can gui ten chi nhanh hoac thanh pho nhe.");
  }

  return lines.join("\n");
}

export function formatAddressAnswer(stores: StoreInfo[], specific: boolean): string {
  if (stores.length === 0) {
    return "Da hien tai minh chua lay duoc dia chi chi nhanh. Ban vui long thu lai sau nhe.";
  }

  const lines = specific
    ? [`Da day la thong tin chi nhanh ban dang tim:`]
    : [`Da hien KOHI dang co cac chi nhanh sau:`];

  for (const store of stores) {
    lines.push(`- ${store.name}: ${store.address || "Dang cap nhat dia chi"}`);
    const mapsLink = buildMapsLink(store);
    if (mapsLink) {
      lines.push(`  Google Maps: ${mapsLink}`);
    }
  }

  if (!specific) {
    lines.push("");
    lines.push("Neu ban muon minh loc theo khu vuc, ban gui them ten thanh pho hoac ten chi nhanh nhe.");
  }

  return lines.join("\n");
}

export function formatContactAnswer(stores: StoreInfo[], specific: boolean): string {
  const storesWithPhone = stores.filter((store) => store.phone);
  if (storesWithPhone.length === 0) {
    return "Da hien tai minh chua lay duoc so dien thoai chi nhanh. Ban vui long xem them trong app hoac website nhe.";
  }

  const lines = specific
    ? [`Da day la thong tin lien he cua chi nhanh ban dang quan tam:`]
    : [`Da day la mot vai so dien thoai chi nhanh dang hoat dong:`];

  for (const store of storesWithPhone) {
    lines.push(`- ${store.name}: ${store.phone}`);
  }

  if (!specific) {
    lines.push("");
    lines.push("Neu ban can dung chi nhanh nao, ban gui them ten chi nhanh hoac thanh pho nhe.");
  }

  return lines.join("\n");
}

export function formatNearestStoreAnswer(store: StoreInfo): string {
  const lines = [
    "Da minh tam goi y chi nhanh sau:",
    `- ${store.name}`,
    `- Dia chi: ${store.address || "Dang cap nhat"}`,
  ];

  if (store.openHours) {
    lines.push(`- Gio mo cua: ${store.openHours}`);
  }

  if (store.phone) {
    lines.push(`- So dien thoai: ${store.phone}`);
  }

  const mapsLink = buildMapsLink(store);
  if (mapsLink) {
    lines.push(`- Google Maps: ${mapsLink}`);
  }

  lines.push("");
  lines.push("Neu ban muon chi nhanh theo khu vuc cu the, ban gui them ten thanh pho hoac ten chi nhanh nhe.");

  return lines.join("\n");
}
