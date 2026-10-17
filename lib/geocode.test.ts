import { describe, expect, it } from "vitest";
import { buildSearchUrl, parseNominatim, validateQuery } from "./geocode";

describe("validateQuery", () => {
  it("trims and accepts 3–200 chars", () => {
    expect(validateQuery("  Січових Стрільців 10  ")).toEqual({ ok: true, query: "Січових Стрільців 10" });
    expect(validateQuery("abc")).toEqual({ ok: true, query: "abc" });
  });
  it("rejects too short, empty and too long", () => {
    expect(validateQuery("ab")).toEqual({ ok: false, error: "Введи хоча б 3 символи адреси" });
    expect(validateQuery("   ")).toEqual({ ok: false, error: "Введи хоча б 3 символи адреси" });
    expect(validateQuery("x".repeat(201))).toEqual({ ok: false, error: "Адреса задовга" });
  });
});

describe("buildSearchUrl", () => {
  it("builds a Nominatim search url limited to the given countries", () => {
    const u = new URL(buildSearchUrl("Хрещатик 1", "https://nominatim.example/search", "ua"));
    expect(u.origin + u.pathname).toBe("https://nominatim.example/search");
    expect(u.searchParams.get("q")).toBe("Хрещатик 1");
    expect(u.searchParams.get("format")).toBe("jsonv2");
    expect(u.searchParams.get("limit")).toBe("5");
    expect(u.searchParams.get("countrycodes")).toBe("ua");
    expect(u.searchParams.get("accept-language")).toBe("uk");
  });
});

describe("parseNominatim", () => {
  it("maps results, converting string coordinates to numbers", () => {
    expect(
      parseNominatim([
        { display_name: "Хрещатик, 1, Київ", lat: "50.4501", lon: "30.5234" },
        { display_name: "Львів", lat: "49.8397", lon: "24.0297", extra: 1 },
      ]),
    ).toEqual([
      { label: "Хрещатик, 1, Київ", lat: 50.4501, lng: 30.5234 },
      { label: "Львів", lat: 49.8397, lng: 24.0297 },
    ]);
  });
  it("skips malformed entries and non-arrays", () => {
    expect(parseNominatim({})).toEqual([]);
    expect(parseNominatim(null)).toEqual([]);
    expect(
      parseNominatim([
        { display_name: "ok", lat: "1", lon: "2" },
        { display_name: "bad", lat: "x", lon: "2" },
        { lat: "1", lon: "2" },
        { display_name: "out of range", lat: "91", lon: "0" },
      ]),
    ).toEqual([{ label: "ok", lat: 1, lng: 2 }]);
  });
});
