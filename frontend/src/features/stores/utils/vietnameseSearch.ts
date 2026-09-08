/**
 * Chuan hoa chuoi tieng Viet de tim kiem khong phan biet dau.
 * Dung Unicode normalization de tranh phu thuoc vao bang map ky tu.
 */
export function normalizeVietnamese(str: string): string {
  if (!str) return "";

  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

/** Kiem tra text co chua query khong, khong phan biet dau tieng Viet. */
export function matchesVietnameseSearch(text: string, query: string): boolean {
  const normalizedText = normalizeVietnamese(text);
  const normalizedQuery = normalizeVietnamese(query.trim());
  return normalizedQuery.length === 0 || normalizedText.includes(normalizedQuery);
}

/**
 * Lay thanh pho tu store.
 * Uu tien truong city, fallback tu address o phan cuoi sau dau phay.
 */
export function getStoreCity(store: {
  city?: string | null;
  address?: string | null;
}): string {
  const city = (store.city || "").trim();
  if (city) return city;

  const address = (store.address || "").trim();
  if (!address) return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/**
 * Lay quan/huyen tu dia chi cua hang.
 * Gia dinh cau truc dia chi Viet Nam:
 * "... , Phuong/Xa, Quan/Huyen, Thanh pho/Tinh".
 */
export function getStoreDistrict(store: { address?: string | null }): string {
  const address = (store.address || "").trim();
  if (!address) return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return "";
  return parts[parts.length - 2] || "";
}

/**
 * Lay phuong/xa tu dia chi cua hang.
 * Gia dinh cau truc tuong tu nhu tren.
 */
export function getStoreWard(store: { address?: string | null }): string {
  const address = (store.address || "").trim();
  if (!address) return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return "";
  return parts[parts.length - 3] || "";
}
