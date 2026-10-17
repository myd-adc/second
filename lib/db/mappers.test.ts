import { describe, expect, it } from "vitest";
import {
  eventFromRow,
  hoursFromRows,
  hoursToRows,
  mergeEventsByDate,
  ruleFromRow,
  ruleToRow,
  storeInputToPayload,
  timeFromDb,
} from "./mappers";

const base = {
  id: "r1",
  weekday: null,
  interval_weeks: null,
  anchor_date: null,
  nth: null,
  time_of_day: null,
  note: null,
  is_active: true,
};

describe("timeFromDb", () => {
  it("trims seconds, keeps HH:MM, passes null", () => {
    expect(timeFromDb("10:00:00")).toBe("10:00");
    expect(timeFromDb("09:30")).toBe("09:30");
    expect(timeFromDb(null)).toBeNull();
  });
});

describe("ruleFromRow", () => {
  it("weekly", () => {
    expect(ruleFromRow({ ...base, kind: "weekly", weekday: 2 })).toEqual({
      id: "r1",
      rule: { kind: "weekly", weekday: 2 },
      isActive: true,
      timeOfDay: null,
      note: "",
    });
  });
  it("every_n_weeks", () => {
    expect(
      ruleFromRow({ ...base, kind: "every_n_weeks", weekday: 2, interval_weeks: 3, anchor_date: "2026-10-07" }).rule,
    ).toEqual({ kind: "every_n_weeks", weekday: 2, intervalWeeks: 3, anchorDate: "2026-10-07" });
  });
  it("monthly_nth incl. -1", () => {
    expect(ruleFromRow({ ...base, kind: "monthly_nth", weekday: 4, nth: -1 }).rule).toEqual({
      kind: "monthly_nth",
      weekday: 4,
      nth: -1,
    });
    expect(ruleFromRow({ ...base, kind: "monthly_nth", weekday: 0, nth: 2 }).rule).toEqual({
      kind: "monthly_nth",
      weekday: 0,
      nth: 2,
    });
  });
  it("irregular", () => {
    expect(ruleFromRow({ ...base, kind: "irregular" }).rule).toEqual({ kind: "irregular" });
  });
  it("trims time_of_day, maps note and is_active", () => {
    const r = ruleFromRow({ ...base, kind: "irregular", time_of_day: "09:30:00", note: "зранку", is_active: false });
    expect(r.timeOfDay).toBe("09:30");
    expect(r.note).toBe("зранку");
    expect(r.isActive).toBe(false);
  });
});

describe("ruleToRow", () => {
  const nulls = { weekday: null, interval_weeks: null, anchor_date: null, nth: null };
  it("weekly NULLs interval/anchor/nth", () => {
    expect(ruleToRow({ rule: { kind: "weekly", weekday: 1 }, isActive: true })).toEqual({
      ...nulls,
      kind: "weekly",
      weekday: 1,
      time_of_day: null,
      note: null,
      is_active: true,
    });
  });
  it("every_n_weeks keeps interval/anchor, nth null", () => {
    const row = ruleToRow({
      rule: { kind: "every_n_weeks", weekday: 3, intervalWeeks: 2, anchorDate: "2026-10-07" },
      isActive: false,
      timeOfDay: "09:30",
      note: "x",
    });
    expect(row).toEqual({
      kind: "every_n_weeks",
      weekday: 3,
      interval_weeks: 2,
      anchor_date: "2026-10-07",
      nth: null,
      time_of_day: "09:30",
      note: "x",
      is_active: false,
    });
  });
  it("monthly_nth keeps nth, interval/anchor null", () => {
    const row = ruleToRow({ rule: { kind: "monthly_nth", weekday: 4, nth: -1 }, isActive: true });
    expect(row).toMatchObject({ kind: "monthly_nth", weekday: 4, nth: -1, interval_weeks: null, anchor_date: null });
  });
  it("irregular has everything null; empty note becomes null", () => {
    expect(ruleToRow({ rule: { kind: "irregular" }, isActive: true, note: "" })).toEqual({
      ...nulls,
      kind: "irregular",
      time_of_day: null,
      note: null,
      is_active: true,
    });
  });
});

describe("hours mapping", () => {
  it("hoursFromRows trims times, nulls kept, sorted by weekday", () => {
    expect(
      hoursFromRows([
        { weekday: 6, opens: null, closes: null, is_closed: true },
        { weekday: 0, opens: "10:00:00", closes: "20:00:00", is_closed: false },
      ]),
    ).toEqual([
      { weekday: 0, opens: "10:00", closes: "20:00", isClosed: false },
      { weekday: 6, opens: null, closes: null, isClosed: true },
    ]);
  });
  it("hoursToRows nulls times for closed days", () => {
    expect(
      hoursToRows([
        { weekday: 0, opens: "10:00", closes: "20:00", isClosed: false },
        { weekday: 6, opens: "10:00", closes: "12:00", isClosed: true },
      ]),
    ).toEqual([
      { weekday: 0, opens: "10:00", closes: "20:00", is_closed: false },
      { weekday: 6, opens: null, closes: null, is_closed: true },
    ]);
  });
});

describe("eventFromRow", () => {
  it("maps date and happened", () => {
    expect(eventFromRow({ date: "2026-10-01", happened: false })).toEqual({ date: "2026-10-01", happened: false });
  });
});

describe("storeInputToPayload", () => {
  it("maps nulls, hours and rules to snake_case", () => {
    const p = storeInputToPayload({
      name: "S",
      hours: [{ weekday: 0, opens: "10:00", closes: "20:00", isClosed: false }],
      rules: [{ rule: { kind: "weekly", weekday: 2 }, isActive: true }],
    });
    expect(p).toEqual({
      id: null,
      name: "S",
      address: null,
      lat: null,
      lng: null,
      notes: null,
      hours: [{ weekday: 0, opens: "10:00", closes: "20:00", is_closed: false }],
      rules: [
        {
          kind: "weekly",
          weekday: 2,
          interval_weeks: null,
          anchor_date: null,
          nth: null,
          time_of_day: null,
          note: null,
          is_active: true,
        },
      ],
    });
  });
  it("passes id through", () => {
    expect(storeInputToPayload({ id: "abc", name: "S", hours: [], rules: [] }).id).toBe("abc");
  });
});

describe("mergeEventsByDate", () => {
  const e = (date: string, happened: boolean) => ({ date, happened });
  it("two true on one date -> one true", () => {
    expect(mergeEventsByDate([e("2026-10-02", true), e("2026-10-02", true)])).toEqual([e("2026-10-02", true)]);
  });
  it("true + false -> true (either order)", () => {
    expect(mergeEventsByDate([e("2026-10-02", false), e("2026-10-02", true)])).toEqual([e("2026-10-02", true)]);
    expect(mergeEventsByDate([e("2026-10-02", true), e("2026-10-02", false)])).toEqual([e("2026-10-02", true)]);
  });
  it("false + false -> false", () => {
    expect(mergeEventsByDate([e("2026-10-02", false), e("2026-10-02", false)])).toEqual([e("2026-10-02", false)]);
  });
  it("preserves newest-first order of first appearance", () => {
    expect(
      mergeEventsByDate([e("2026-10-03", false), e("2026-10-02", true), e("2026-10-03", true), e("2026-10-01", false)]),
    ).toEqual([e("2026-10-03", true), e("2026-10-02", true), e("2026-10-01", false)]);
  });
});
