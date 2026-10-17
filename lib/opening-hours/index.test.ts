import { describe, expect, it } from "vitest";
import { closesAt, isOpenAt, kyivParts, type DayHours } from "./index";

const day = (weekday: number, opens: string, closes: string): DayHours => ({
  weekday,
  opens,
  closes,
  isClosed: false,
});
const closed = (weekday: number): DayHours => ({ weekday, opens: null, closes: null, isClosed: true });

// 2026-10-12 is a Monday; October is UTC+3 (EEST) until 2026-10-25.
const kyiv = (iso: string) => new Date(`${iso}+03:00`);

describe("kyivParts", () => {
  it("returns date, weekday (0=Mon) and minutes", () => {
    expect(kyivParts(kyiv("2026-10-12T10:30:00"))).toEqual({ date: "2026-10-12", weekday: 0, minutes: 630 });
    expect(kyivParts(kyiv("2026-10-18T23:59:00")).weekday).toBe(6);
  });
  it("midnight is minutes 0, not 1440", () => {
    expect(kyivParts(kyiv("2026-10-13T00:00:00"))).toEqual({ date: "2026-10-13", weekday: 1, minutes: 0 });
  });
});

describe("isOpenAt normal interval", () => {
  const hours = [day(0, "10:00", "19:00")];
  it("opens inclusive, closes exclusive", () => {
    expect(isOpenAt(hours, kyiv("2026-10-12T10:00:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-12T09:59:00"))).toBe(false);
    expect(isOpenAt(hours, kyiv("2026-10-12T18:59:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-12T19:00:00"))).toBe(false);
  });
  it("closesAt returns end of interval when open, null when closed", () => {
    expect(closesAt(hours, kyiv("2026-10-12T12:00:00"))).toBe("19:00");
    expect(closesAt(hours, kyiv("2026-10-12T19:00:00"))).toBeNull();
  });
  it("missing weekday is closed", () => {
    expect(isOpenAt(hours, kyiv("2026-10-13T12:00:00"))).toBe(false);
    expect(closesAt(hours, kyiv("2026-10-13T12:00:00"))).toBeNull();
  });
  it("isClosed row is never open", () => {
    expect(isOpenAt([closed(0)], kyiv("2026-10-12T12:00:00"))).toBe(false);
    expect(closesAt([closed(0)], kyiv("2026-10-12T12:00:00"))).toBeNull();
  });
});

describe("closes at 00:00", () => {
  const hours = [day(0, "22:00", "00:00")];
  it("open 23:30, closed at 00:00 next day", () => {
    expect(isOpenAt(hours, kyiv("2026-10-12T23:30:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-13T00:00:00"))).toBe(false);
    expect(isOpenAt(hours, kyiv("2026-10-12T21:59:00"))).toBe(false);
  });
  it("closesAt is 00:00", () => {
    expect(closesAt(hours, kyiv("2026-10-12T23:30:00"))).toBe("00:00");
  });
});

describe("overnight interval 20:00-02:00 on Monday", () => {
  const hours = [day(0, "20:00", "02:00")];
  it("open Monday evening and Tuesday early morning", () => {
    expect(isOpenAt(hours, kyiv("2026-10-12T20:00:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-12T19:59:00"))).toBe(false);
    expect(isOpenAt(hours, kyiv("2026-10-13T01:00:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-13T01:59:00"))).toBe(true);
    expect(isOpenAt(hours, kyiv("2026-10-13T02:00:00"))).toBe(false);
  });
  it("closesAt is 02:00 for both parts", () => {
    expect(closesAt(hours, kyiv("2026-10-13T01:00:00"))).toBe("02:00");
    expect(closesAt(hours, kyiv("2026-10-12T21:00:00"))).toBe("02:00");
  });
  it("Monday morning is not open from the tail of Sunday", () => {
    expect(isOpenAt(hours, kyiv("2026-10-12T01:00:00"))).toBe(false);
  });
});

describe("Sunday to Monday wraparound", () => {
  const hours = [day(6, "21:00", "03:00")];
  it("Sunday tail continues into Monday (weekday 6 -> 0)", () => {
    expect(isOpenAt(hours, kyiv("2026-10-19T02:30:00"))).toBe(true);
    expect(closesAt(hours, kyiv("2026-10-19T02:30:00"))).toBe("03:00");
    expect(isOpenAt(hours, kyiv("2026-10-19T03:00:00"))).toBe(false);
  });
});

describe("tail of a closed today", () => {
  it("yesterday's tail applies even if today is closed", () => {
    const hours = [day(0, "20:00", "02:00"), closed(1)];
    expect(isOpenAt(hours, kyiv("2026-10-13T01:00:00"))).toBe(true);
  });
});
