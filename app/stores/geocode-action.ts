"use server";

import { GEOCODE_COUNTRIES } from "@/lib/config";
import { isSignedInAndAllowed } from "@/lib/db/auth";
import { buildSearchUrl, parseNominatim, validateQuery, type GeocodeResult } from "@/lib/geocode";

export type SearchAddressResult = { ok: true; results: GeocodeResult[] } | { ok: false; error: string };

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy: an identifying User-Agent and at most ~1 request per second.
const USER_AGENT = "second-hand-tracker (https://github.com/myd-adc/second)";
const MIN_GAP_MS = 1100;
let nextSlot = 0;

const FAILED = "Не вдалося знайти адресу. Спробуй ще раз.";

export async function searchAddressAction(input: string): Promise<SearchAddressResult> {
  if (typeof input !== "string") return { ok: false, error: FAILED };
  const v = validateQuery(input);
  if (!v.ok) return v;
  if (!(await isSignedInAndAllowed())) return { ok: false, error: "Потрібен вхід" };

  const slot = Math.max(Date.now(), nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  const wait = slot - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  try {
    const res = await fetch(buildSearchUrl(v.query, process.env.GEOCODER_URL ?? NOMINATIM, GEOCODE_COUNTRIES), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
    return { ok: true, results: parseNominatim(await res.json()) };
  } catch (err) {
    console.error("searchAddressAction failed", err);
    return { ok: false, error: FAILED };
  }
}
