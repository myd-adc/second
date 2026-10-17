import { describe, it, expect } from "vitest";
import { nextOccurrences } from "./occurrences";
import type { Rule } from "./types";

describe("nextOccurrences", () => {
  it("weekly includes from when it is a delivery day", () => {
    const r: Rule = { kind: "weekly", weekday: 0 };
    expect(nextOccurrences(r, "2026-10-12", 3)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
  });
  it("weekly moves to next weekday", () => {
    expect(nextOccurrences({ kind: "weekly", weekday: 0 }, "2026-10-13", 1)[0]).toBe("2026-10-19");
  });
  const biweekly: Rule = { kind: "every_n_weeks", weekday: 2, intervalWeeks: 2, anchorDate: "2026-10-07" };
  it("every_n_weeks skips off-phase week", () => {
    expect(nextOccurrences(biweekly, "2026-10-08", 2)).toEqual(["2026-10-21", "2026-11-04"]);
  });
  it("every_n_weeks includes from when on phase", () => {
    expect(nextOccurrences(biweekly, "2026-10-07", 2)[0]).toBe("2026-10-07");
  });
  it("every_n_weeks extrapolates back from a future anchor", () => {
    const r: Rule = { ...biweekly, anchorDate: "2026-12-02" };
    expect(nextOccurrences(r, "2026-10-07", 1)[0]).toBe("2026-10-07");
  });
  it("every_n_weeks crosses year end", () => {
    const r: Rule = { ...biweekly, anchorDate: "2026-12-23" };
    expect(nextOccurrences(r, "2026-12-23", 2)[1]).toBe("2027-01-06");
  });
  it("monthly_nth first Thursday", () => {
    const r: Rule = { kind: "monthly_nth", weekday: 3, nth: 1 };
    expect(nextOccurrences(r, "2026-10-01", 2)).toEqual(["2026-10-01", "2026-11-05"]);
  });
  it("monthly_nth first Thursday skips past month's date", () => {
    const r: Rule = { kind: "monthly_nth", weekday: 3, nth: 1 };
    expect(nextOccurrences(r, "2026-10-02", 1)).toEqual(["2026-11-05"]);
  });
  it("monthly_nth last Thursday (5-occurrence and 4-occurrence months)", () => {
    const r: Rule = { kind: "monthly_nth", weekday: 3, nth: -1 };
    expect(nextOccurrences(r, "2026-10-01", 2)).toEqual(["2026-10-29", "2026-11-26"]);
  });
  it("monthly_nth crosses year end", () => {
    const r: Rule = { kind: "monthly_nth", weekday: 3, nth: 4 };
    expect(nextOccurrences(r, "2026-12-25", 2)).toEqual(["2027-01-28", "2027-02-25"]);
  });
  // Oct 2026 Thursdays: 1, 8, 15, 22, 29; Nov 2026 Thursdays: 5, 12, 19, 26
  it("monthly_nth second Thursday", () => {
    expect(nextOccurrences({ kind: "monthly_nth", weekday: 3, nth: 2 }, "2026-10-01", 2)).toEqual(["2026-10-08", "2026-11-12"]);
  });
  it("monthly_nth third Thursday", () => {
    expect(nextOccurrences({ kind: "monthly_nth", weekday: 3, nth: 3 }, "2026-10-01", 2)).toEqual(["2026-10-15", "2026-11-19"]);
  });
  it("monthly_nth fourth Thursday", () => {
    expect(nextOccurrences({ kind: "monthly_nth", weekday: 3, nth: 4 }, "2026-10-01", 2)).toEqual(["2026-10-22", "2026-11-26"]);
  });
  it("every_n_weeks with an anchor years in the past", () => {
    // anchor Wed 2024-01-03 + 1008 days (48 x 3 weeks) = Wed 2026-10-07 is on phase, so the next one is 2026-10-28
    const r: Rule = { kind: "every_n_weeks", weekday: 2, intervalWeeks: 3, anchorDate: "2024-01-03" };
    expect(nextOccurrences(r, "2026-10-14", 2)).toEqual(["2026-10-28", "2026-11-18"]);
    expect(nextOccurrences(r, "2026-10-07", 1)).toEqual(["2026-10-07"]);
  });
  it("irregular returns empty", () => {
    expect(nextOccurrences({ kind: "irregular" }, "2026-10-12", 3)).toEqual([]);
  });
  it("count 0 returns empty", () => {
    expect(nextOccurrences({ kind: "weekly", weekday: 0 }, "2026-10-12", 0)).toEqual([]);
  });
});
