import { describe, expect, it } from "vitest";
import { formatDayHours } from "./format";

describe("formatDayHours", () => {
  it("formats a normal day", () => {
    expect(formatDayHours({ weekday: 0, opens: "10:00", closes: "19:00", isClosed: false })).toBe("10:00–19:00");
  });
  it("formats a closed day", () => {
    expect(formatDayHours({ weekday: 6, opens: null, closes: null, isClosed: true })).toBe("вихідний");
  });
  it("formats missing data", () => {
    expect(formatDayHours(undefined)).toBe("немає даних");
    expect(formatDayHours({ weekday: 1, opens: null, closes: null, isClosed: false })).toBe("немає даних");
  });
  it("formats an overnight day", () => {
    expect(formatDayHours({ weekday: 4, opens: "20:00", closes: "02:00", isClosed: false })).toBe("20:00–02:00");
  });
});
