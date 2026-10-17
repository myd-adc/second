import { describe, expect, it } from "vitest";
import { todayInKyiv } from "./today";

describe("todayInKyiv", () => {
  it("autumn DST night (fall back on 2026-10-25)", () => {
    expect(todayInKyiv(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    expect(todayInKyiv(new Date("2026-10-24T21:30:00Z"))).toBe("2026-10-25");
    expect(todayInKyiv(new Date("2026-10-24T20:59:00Z"))).toBe("2026-10-24");
  });
  it("spring DST night (2026-03-29)", () => {
    expect(todayInKyiv(new Date("2026-03-28T21:30:00Z"))).toBe("2026-03-28");
    expect(todayInKyiv(new Date("2026-03-28T22:00:00Z"))).toBe("2026-03-29");
  });
});
