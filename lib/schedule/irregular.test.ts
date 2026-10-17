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
});
