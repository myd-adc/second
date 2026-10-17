/** Address search (Nominatim) helpers: pure, so the network call stays a thin wrapper around them. */
export type GeocodeResult = { label: string; lat: number; lng: number };

const MIN_QUERY = 3;
const MAX_QUERY = 200;

export function validateQuery(input: string): { ok: true; query: string } | { ok: false; error: string } {
  const query = input.trim();
  if (query.length < MIN_QUERY) return { ok: false, error: "Введи хоча б 3 символи адреси" };
  if (query.length > MAX_QUERY) return { ok: false, error: "Адреса задовга" };
  return { ok: true, query };
}

export function buildSearchUrl(query: string, base: string, countryCodes: string): string {
  const u = new URL(base);
  u.searchParams.set("q", query);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "5");
  u.searchParams.set("countrycodes", countryCodes);
  u.searchParams.set("accept-language", "uk");
  return u.toString();
}

export function parseNominatim(json: unknown): GeocodeResult[] {
  if (!Array.isArray(json)) return [];
  const out: GeocodeResult[] = [];
  for (const item of json) {
    if (typeof item !== "object" || item === null) continue;
    const { display_name, lat, lon } = item as Record<string, unknown>;
    if (typeof display_name !== "string" || display_name === "") continue;
    const la = Number(lat);
    const ln = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) continue;
    out.push({ label: display_name, lat: la, lng: ln });
  }
  return out;
}
