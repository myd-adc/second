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

// Kyiv leaves DST on Sunday 2026-10-25: at 04:00 EEST (UTC+3) clocks go back to 03:00 EET (UTC+2), i.e. at 01:00Z.
// So 03:00-03:59 local happens twice: 00:00Z-01:00Z (still +3) and 01:00Z-02:00Z (already +2).
describe("DST end 2026-10-25", () => {
  it("kyivParts of both 03:30 instants", () => {
    expect(kyivParts(new Date("2026-10-25T00:30:00Z"))).toEqual({ date: "2026-10-25", weekday: 6, minutes: 210 });
    expect(kyivParts(new Date("2026-10-25T01:30:00Z"))).toEqual({ date: "2026-10-25", weekday: 6, minutes: 210 });
  });
  it("Saturday 22:00-02:00 tail: open at 01:30 EEST, closed from 02:00 and in the repeated hour", () => {
    const hours = [day(5, "22:00", "02:00")];
    expect(isOpenAt(hours, new Date("2026-10-24T22:30:00Z"))).toBe(true); // Sun 01:30 EEST
    expect(isOpenAt(hours, new Date("2026-10-24T23:00:00Z"))).toBe(false); // Sun 02:00 EEST
    expect(isOpenAt(hours, new Date("2026-10-25T00:30:00Z"))).toBe(false); // Sun 03:30 EEST
    expect(isOpenAt(hours, new Date("2026-10-25T01:30:00Z"))).toBe(false); // Sun 03:30 EET
  });
  it("Sunday 00:00-02:00: open at 00:30, closed at 02:00 and in the repeated 03:30", () => {
    const hours = [day(6, "00:00", "02:00")];
    expect(isOpenAt(hours, new Date("2026-10-24T21:00:00Z"))).toBe(true); // Sun 00:00 EEST
    expect(isOpenAt(hours, new Date("2026-10-24T21:30:00Z"))).toBe(true); // Sun 00:30 EEST
    expect(isOpenAt(hours, new Date("2026-10-24T23:00:00Z"))).toBe(false); // Sun 02:00 EEST
    expect(isOpenAt(hours, new Date("2026-10-25T00:30:00Z"))).toBe(false);
  });
  it("Sunday 00:00-04:00 is open in both passes of 03:30 and closed at 04:00 EET", () => {
    const hours = [day(6, "00:00", "04:00")];
    expect(isOpenAt(hours, new Date("2026-10-25T00:30:00Z"))).toBe(true);
    expect(isOpenAt(hours, new Date("2026-10-25T01:30:00Z"))).toBe(true);
    expect(isOpenAt(hours, new Date("2026-10-25T02:00:00Z"))).toBe(false); // 04:00 EET
  });
});
