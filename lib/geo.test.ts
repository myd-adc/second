import { describe, expect, it } from "vitest";
import { distanceKm, formatDistance } from "./geo";

const kyiv = { lat: 50.4501, lng: 30.5234 };
const lviv = { lat: 49.8397, lng: 24.0297 };

describe("distanceKm", () => {
  it("Kyiv to Lviv is about 468 km", () => {
    expect(Math.abs(distanceKm(kyiv, lviv) - 468)).toBeLessThanOrEqual(3);
  });
  it("identical points are 0", () => {
    expect(distanceKm(kyiv, kyiv)).toBe(0);
  });
  it("is symmetric", () => {
    expect(distanceKm(kyiv, lviv)).toBeCloseTo(distanceKm(lviv, kyiv), 9);
  });
  it("handles the antimeridian", () => {
    const d = distanceKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
    expect(Math.abs(d - 22)).toBeLessThanOrEqual(1);
  });
});

describe("formatDistance", () => {
  it.each([
    [0.35, "350 м"],
    [0.354, "350 м"],
    [0.356, "360 м"],
    [0, "0 м"],
    [1, "1,0 км"],
    [1.2, "1,2 км"],
    [9.94, "9,9 км"],
    [10, "10 км"],
    [46.6, "47 км"],
  ])("%s -> %s", (km, text) => {
    expect(formatDistance(km)).toBe(text);
  });
});
