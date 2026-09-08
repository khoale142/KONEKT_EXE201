/**
 * Build Google Maps embed URL from lat/lng or address.
 * Format: https://www.google.com/maps?q=LAT,LNG&z=15&output=embed
 */
export function getMapEmbedUrl(store: {
    lat?: number;
    lng?: number;
    address?: string | null;
}): string {
    const lat = store.lat ?? 0;
    const lng = store.lng ?? 0;

    if (lat && lng && (lat !== 0 || lng !== 0)) {
        return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    }

    const addr = encodeURIComponent(String(store.address ?? "").trim());
    if (addr) {
        return `https://maps.google.com/maps?q=${addr}&output=embed`;
    }

    return "https://www.google.com/maps?q=0,0&z=15&output=embed";
}
