import { describe, expect, it } from "vitest";
import { predictIrregular } from "./irregular";

const ev = (date: string, happened = true) => ({ date, happened });

describe("predictIrregular", () => {
  it("returns null with fewer than 3 facts", () => {
    expect(predictIrregular([], "2026-09-16")).toBeNull();
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08")], "2026-09-16")).toBeNull();
  });
  it("uses median interval from last fact", () => {
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-15")], "2026-09-16")).toBe("2026-09-22");
  });
  it("ignores happened:false and unsorted input", () => {
    expect(
      predictIrregular([ev("2026-09-15"), ev("2026-09-10", false), ev("2026-09-01"), ev("2026-09-08")], "2026-09-16"),
    ).toBe("2026-09-22");
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-12", false)], "2026-09-16")).toBeNull();
  });
  it("steps forward until >= from", () => {
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-15")], "2026-10-01")).toBe("2026-10-06");
  });
  it("rounds average of even interval count, ties up", () => {
    // intervals 7, 8 -> 7.5 -> 8
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-16")], "2026-09-17")).toBe("2026-09-24");
  });
  it("dedupes repeated dates before computing intervals", () => {
    expect(
      predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-08"), ev("2026-09-15")], "2026-09-16"),
    ).toBe("2026-09-22");
    // only 2 distinct dates -> not enough facts
    expect(predictIrregular([ev("2026-09-01"), ev("2026-09-08"), ev("2026-09-08")], "2026-09-16")).toBeNull();
  });
  it("with exactly 5 facts uses all four intervals", () => {
    // intervals 7, 7, 14, 14 -> even count: floor((7 + 14 + 1) / 2) = 11; 2026-09-14 + 11
    const facts = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-31", "2026-09-14"].map((d) => ev(d));
    expect(predictIrregular(facts, "2026-09-15")).toBe("2026-09-25");
  });
  it("with 6+ facts only the last 5 count", () => {
    // 2026-07-01 -> 2026-08-03 is 33 days; if it leaked in, intervals 7,7,14,14,33 would give median 14 (-> 09-28)
    const facts = ["2026-07-01", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-31", "2026-09-14"].map((d) => ev(d));
    expect(predictIrregular(facts, "2026-09-15")).toBe("2026-09-25");
  });
});
