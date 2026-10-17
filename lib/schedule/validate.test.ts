import { describe, expect, it } from "vitest";
import { validateRule } from "./validate";

const bad = (input: unknown) => {
  const r = validateRule(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
};

describe("validateRule valid", () => {
  it("weekly", () => {
    expect(validateRule({ kind: "weekly", weekday: 2 })).toEqual({ ok: true, rule: { kind: "weekly", weekday: 2 } });
  });
  it("every_n_weeks (2026-10-14 is Wednesday = 2)", () => {
    expect(validateRule({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 3, anchorDate: "2026-10-14" })).toEqual({
      ok: true,
      rule: { kind: "every_n_weeks", weekday: 2, intervalWeeks: 3, anchorDate: "2026-10-14" },
    });
  });
  it("monthly_nth incl. last", () => {
    expect(validateRule({ kind: "monthly_nth", weekday: 0, nth: -1 })).toEqual({
      ok: true,
      rule: { kind: "monthly_nth", weekday: 0, nth: -1 },
    });
  });
  it("irregular, with null/undefined weekday", () => {
    expect(validateRule({ kind: "irregular" })).toEqual({ ok: true, rule: { kind: "irregular" } });
    expect(validateRule({ kind: "irregular", weekday: null })).toEqual({ ok: true, rule: { kind: "irregular" } });
  });
  it("intervalWeeks 8 is the upper bound", () => {
    const r = validateRule({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 8, anchorDate: "2026-10-14" });
    expect(r.ok).toBe(true);
  });
  it("strips unknown fields", () => {
    expect(validateRule({ kind: "weekly", weekday: 1, evil: 1, nth: 3 })).toEqual({
      ok: true,
      rule: { kind: "weekly", weekday: 1 },
    });
  });
});

describe("validateRule rejects", () => {
  it("non-object input", () => {
    bad(null);
    bad("weekly");
    bad(5);
    bad([]);
  });
  it("unknown kind", () => bad({ kind: "daily", weekday: 1 }));
  it("weekday 7, -1, 1.5, string, missing", () => {
    bad({ kind: "weekly", weekday: 7 });
    bad({ kind: "weekly", weekday: -1 });
    bad({ kind: "weekly", weekday: 1.5 });
    bad({ kind: "weekly", weekday: "1" });
    bad({ kind: "weekly" });
    bad({ kind: "monthly_nth", weekday: 7, nth: 1 });
  });
  it("interval_weeks < 2", () =>
    bad({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 1, anchorDate: "2026-10-14" }));
  it("intervalWeeks 9", () =>
    bad({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 9, anchorDate: "2026-10-14" }));
  it("intervalWeeks 1.5", () =>
    bad({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 1.5, anchorDate: "2026-10-14" }));
  it("missing anchor", () => bad({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 2 }));
  it("anchor on the wrong weekday", () =>
    bad({ kind: "every_n_weeks", weekday: 0, intervalWeeks: 2, anchorDate: "2026-10-14" }));
  it("2026-02-30 anchor", () =>
    bad({ kind: "every_n_weeks", weekday: 0, intervalWeeks: 2, anchorDate: "2026-02-30" }));
  it("malformed anchor", () =>
    bad({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 2, anchorDate: "14.10.2026" }));
  it("nth 5, 0, missing", () => {
    bad({ kind: "monthly_nth", weekday: 1, nth: 5 });
    bad({ kind: "monthly_nth", weekday: 1, nth: 0 });
    bad({ kind: "monthly_nth", weekday: 1 });
  });
  it("irregular with weekday", () => {
    bad({ kind: "irregular", weekday: 1 });
    bad({ kind: "irregular", weekday: 0 });
  });
});
