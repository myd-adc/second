import { describe, expect, it } from "vitest";
import type { DayHours } from "./index";
import { formatNextOpening, nextOpening } from "./next-open";

const day = (weekday: number, opens: string, closes: string): DayHours => ({
  weekday,
  opens,
  closes,
  isClosed: false,
});
const closed = (weekday: number): DayHours => ({ weekday, opens: null, closes: null, isClosed: true });

// 2026-10-12 is a Monday; October is UTC+3 (EEST) until 2026-10-25.
const kyiv = (iso: string) => new Date(`${iso}+03:00`);

describe("nextOpening", () => {
  const hours = [day(0, "10:00", "19:00"), day(1, "10:00", "19:00")];

  it("before opening today -> today at the opening time", () => {
    expect(nextOpening(hours, kyiv("2026-10-12T08:00:00"))).toEqual({ daysAhead: 0, weekday: 0, time: "10:00" });
  });
  it("after closing -> the next open day", () => {
    expect(nextOpening(hours, kyiv("2026-10-12T19:00:00"))).toEqual({ daysAhead: 1, weekday: 1, time: "10:00" });
  });
  it("open right now -> null (nothing to announce)", () => {
    expect(nextOpening(hours, kyiv("2026-10-12T12:00:00"))).toBeNull();
  });
  it("skips closed and missing days", () => {
    const h = [closed(0), day(2, "11:30", "20:00")];
    expect(nextOpening(h, kyiv("2026-10-12T12:00:00"))).toEqual({ daysAhead: 2, weekday: 2, time: "11:30" });
  });
  it("only one weekday open, already past it -> same weekday next week", () => {
    const h = [day(2, "10:00", "19:00")];
    expect(nextOpening(h, kyiv("2026-10-14T20:00:00"))).toEqual({ daysAhead: 7, weekday: 2, time: "10:00" });
  });
  it("never opens -> null", () => {
    expect(nextOpening([closed(0), closed(1)], kyiv("2026-10-12T12:00:00"))).toBeNull();
    expect(nextOpening([], kyiv("2026-10-12T12:00:00"))).toBeNull();
  });
  it("overnight interval: before it starts -> today; inside its tail -> null; after the tail -> next week", () => {
    const h = [day(0, "22:00", "02:00")];
    expect(nextOpening(h, kyiv("2026-10-12T21:00:00"))).toEqual({ daysAhead: 0, weekday: 0, time: "22:00" });
    expect(nextOpening(h, kyiv("2026-10-13T01:00:00"))).toBeNull();
    expect(nextOpening(h, kyiv("2026-10-13T03:00:00"))).toEqual({ daysAhead: 6, weekday: 0, time: "22:00" });
  });
});

describe("formatNextOpening", () => {
  it("today / tomorrow / weekday", () => {
    expect(formatNextOpening({ daysAhead: 0, weekday: 0, time: "10:00" })).toBe("сьогодні о 10:00");
    expect(formatNextOpening({ daysAhead: 1, weekday: 1, time: "10:00" })).toBe("завтра о 10:00");
    expect(formatNextOpening({ daysAhead: 2, weekday: 2, time: "11:30" })).toBe("у ср о 11:30");
    expect(formatNextOpening({ daysAhead: 7, weekday: 0, time: "09:00" })).toBe("у пн о 09:00");
  });
});
