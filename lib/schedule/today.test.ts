import { describe, expect, it } from "vitest";
import { formatTodayHeader, todayInKyiv } from "./today";

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

describe("formatTodayHeader", () => {
  it("formats Kyiv weekday, day and month", () => {
    expect(formatTodayHeader(new Date("2026-10-14T09:00:00Z"))).toBe("Сьогодні, середа 14 жовтня");
    expect(formatTodayHeader(new Date("2026-10-14T21:30:00Z"))).toBe("Сьогодні, четвер 15 жовтня");
    expect(formatTodayHeader(new Date("2026-03-02T10:00:00Z"))).toBe("Сьогодні, понеділок 2 березня");
  });
});
