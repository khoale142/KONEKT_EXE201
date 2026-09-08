/**
 * Parse open_hours string (e.g. "8:00-22:00" or "08:00 - 22:00") and compute if store is open now.
 * Uses local time. Returns null if cannot parse.
 */
export function getStoreOpenStatus(openHours: string | null | undefined): boolean | null {
    if (!openHours || typeof openHours !== "string") return null;
    const trimmed = openHours.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/(\d{1,2})\s*:\s*(\d{2})\s*[-–]\s*(\d{1,2})\s*:\s*(\d{2})/i);
    if (!match) return null;

    const openH = parseInt(match[1], 10);
    const openM = parseInt(match[2], 10);
    const closeH = parseInt(match[3], 10);
    const closeM = parseInt(match[4], 10);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;
    if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) return true;
    if (closeMinutes > 24 * 60 && currentMinutes < closeMinutes - 24 * 60) return true;
    return false;
}
