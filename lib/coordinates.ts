/** One optional "lat, lng" text field (as pasted from Google Maps) <-> numbers. Dot decimals only. */
const NUM = "[-+]?\\d+(?:\\.\\d+)?";
const PAIR = new RegExp(`^(${NUM})(?:\\s*,\\s*|\\s+)(${NUM})$`);

export type Coordinates = { lat: number; lng: number };

/** Empty -> null; a valid pair -> numbers; anything else (one number, junk, out of range) -> "invalid". */
export function parseCoordinates(text: string): Coordinates | null | "invalid" {
  const t = text.trim();
  if (t === "") return null;
  const m = PAIR.exec(t);
  if (!m) return "invalid";
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return "invalid";
  return { lat, lng };
}

export function formatCoordinates(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? "" : `${lat}, ${lng}`;
}
