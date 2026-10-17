import { describe, expect, it } from "vitest";
import { confidence } from "./confidence";
import type { Rule } from "./types";

const ev = (date: string, happened = true) => ({ date, happened });
const weekly: Rule = { kind: "weekly", weekday: 0 };
// 2026-10-12 is a Monday
const mondays = ["2026-10-12", "2026-10-05", "2026-09-28", "2026-09-21", "2026-09-14"];

describe("confidence", () => {
  it("counts 5 matched mondays", () => {
    const c = confidence(weekly, mondays.map((d) => ev(d)), "2026-10-14");
    expect(c.matched).toBe(5);
    expect(c.total).toBe(5);
  });
  it("accepts +1 day shift", () => {
    const c = confidence(weekly, [ev("2026-10-13")], "2026-10-14");
    expect(c.matched).toBe(1);
    expect(c.total).toBe(5);
  });
  it("events on the wrong weekday (Wednesdays, 2 days off) match nothing", () => {
    const wednesdays = ["2026-10-07", "2026-09-30", "2026-09-23", "2026-09-16", "2026-09-09"];
    const c = confidence(weekly, wednesdays.map((d) => ev(d)), "2026-10-14");
    expect(c.matched).toBe(0);
    expect(c.total).toBe(5);
  });
  it("accepts -1 day shift (Sunday before Monday 2026-10-12)", () => {
    const c = confidence(weekly, [ev("2026-10-11")], "2026-10-14");
    expect(c.matched).toBe(1);
    expect(c.total).toBe(5);
  });
  it("ignores happened:false for matching", () => {
    expect(confidence(weekly, [ev("2026-10-12", false)], "2026-10-14").matched).toBe(0);
  });
  it("no events", () => {
    const c = confidence(weekly, [], "2026-10-14");
    expect(c.matched).toBe(0);
    expect(c.daysSinceLastEvent).toBeNull();
    expect(c.stale).toBe(true);
  });
  it("works for monthly_nth", () => {
    const rule: Rule = { kind: "monthly_nth", weekday: 0, nth: 1 };
    const c = confidence(rule, [ev("2026-10-05"), ev("2026-09-07")], "2026-10-14");
    expect(c.matched).toBe(2);
    expect(c.total).toBe(5);
  });
  it("stale for every_n_weeks", () => {
    const rule: Rule = { kind: "every_n_weeks", weekday: 0, intervalWeeks: 2, anchorDate: "2026-01-05" };
    expect(confidence(rule, [ev("2026-09-15", false)], "2026-10-14").stale).toBe(true); // 29
    expect(confidence(rule, [ev("2026-09-17", false)], "2026-10-14").stale).toBe(false); // 27
    expect(confidence(rule, [ev("2026-09-16", false)], "2026-10-14").stale).toBe(false); // 28
  });
  it("irregular threshold 30", () => {
    const r: Rule = { kind: "irregular" };
    const c = confidence(r, [ev("2026-09-14")], "2026-10-14");
    expect(c).toEqual({ matched: 0, total: 0, daysSinceLastEvent: 30, stale: false });
    expect(confidence(r, [ev("2026-09-13")], "2026-10-14").stale).toBe(true);
  });
  it("uses latest event of any kind for daysSinceLastEvent", () => {
    const c = confidence(weekly, [ev("2026-10-01"), ev("2026-10-10", false)], "2026-10-14");
    expect(c.daysSinceLastEvent).toBe(4);
  });
});
