import { describe, expect, it } from "vitest";
import type { DayHours } from "../opening-hours";
import type { RuleRow, StoreWithDetails } from "../db/types";
import type { DeliveryEvent, Rule } from "./types";
import { buildOverview, ruleLabel } from "./overview";

// 2026-10-14T09:00:00Z = Wednesday 2026-10-14 12:00 Kyiv (UTC+3)
const NOW = new Date("2026-10-14T09:00:00Z");

const allDays = (opens: string, closes: string): DayHours[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes, isClosed: false }));

function rr(rule: Rule, isActive = true): RuleRow {
  return { id: "r", rule, isActive, timeOfDay: null, note: "" };
}

function store(
  name: string,
  rules: RuleRow[],
  opts: { events?: DeliveryEvent[]; hours?: DayHours[] } = {},
): StoreWithDetails {
  return {
    id: `id-${name}`,
    name,
    address: null,
    lat: null,
    lng: null,
    notes: null,
    createdBy: "u",
    hours: opts.hours ?? allDays("09:00", "20:00"),
    rules,
    events: opts.events ?? [],
  };
}

describe("buildOverview", () => {
  it("sorts today, tomorrow, in 4 days, then null", () => {
    const stores = [
      store("Немає", []),
      store("Через4", [rr({ kind: "weekly", weekday: 0 })]), // Mon 2026-10-19? -> 5 days; use Sun below
      store("Завтра", [rr({ kind: "weekly", weekday: 3 })]), // Thu 10-15
      store("Сьогодні", [rr({ kind: "weekly", weekday: 2 })]), // Wed 10-14
    ];
    stores[1] = store("Через4", [rr({ kind: "weekly", weekday: 6 })]); // Sun 10-18
    const out = buildOverview(stores, NOW);
    expect(out.map((o) => [o.name, o.nextDelivery, o.daysUntil])).toEqual([
      ["Сьогодні", "2026-10-14", 0],
      ["Завтра", "2026-10-15", 1],
      ["Через4", "2026-10-18", 4],
      ["Немає", null, null],
    ]);
  });

  it("passes lat/lng through from the store", () => {
    const a = { ...store("A", []), lat: 50.45, lng: 30.52 };
    const [withCoords] = buildOverview([a], NOW);
    expect([withCoords.lat, withCoords.lng]).toEqual([50.45, 30.52]);
    const [without] = buildOverview([store("B", [])], NOW);
    expect([without.lat, without.lng]).toEqual([null, null]);
  });

  it("store with no rules and no events does not throw", () => {
    const [o] = buildOverview([store("A", [])], NOW);
    expect(o.nextDelivery).toBeNull();
    expect(o.daysUntil).toBeNull();
    expect(o.ruleLabel).toBe("без графіка");
    expect(o.confidence).toEqual({ matched: 0, total: 0, daysSinceLastEvent: null, stale: true });
  });

  it("with two rules takes the earlier date", () => {
    const [o] = buildOverview(
      [store("A", [rr({ kind: "weekly", weekday: 5 }), rr({ kind: "weekly", weekday: 3 })])],
      NOW,
    );
    expect(o.nextDelivery).toBe("2026-10-15");
    expect(o.daysUntil).toBe(1);
    expect(o.ruleLabel).toBe("щотижня, сб; щотижня, чт");
  });

  it("ignores inactive rules", () => {
    const [o] = buildOverview(
      [store("A", [rr({ kind: "weekly", weekday: 2 }, false), rr({ kind: "weekly", weekday: 6 })])],
      NOW,
    );
    expect(o.nextDelivery).toBe("2026-10-18");
    expect(o.ruleLabel).toBe("щотижня, нд");
  });

  it("only inactive rules behaves like no rules", () => {
    const [o] = buildOverview([store("A", [rr({ kind: "weekly", weekday: 2 }, false)])], NOW);
    expect(o.nextDelivery).toBeNull();
    expect(o.ruleLabel).toBe("без графіка");
  });

  it("irregular store with 3 weekly-spaced facts gets a prediction", () => {
    const events = ["2026-09-23", "2026-09-30", "2026-10-07"].map((date) => ({ date, happened: true }));
    const [o] = buildOverview([store("A", [rr({ kind: "irregular" })], { events })], NOW);
    expect(o.nextDelivery).toBe("2026-10-14");
    expect(o.daysUntil).toBe(0);
    expect(o.ruleLabel).toBe("без графіка");
    expect(o.confidence).toEqual({ matched: 0, total: 0, daysSinceLastEvent: 7, stale: false });
  });

  it("store without rules but with facts also gets a prediction", () => {
    const events = ["2026-09-23", "2026-09-30", "2026-10-07"].map((date) => ({ date, happened: true }));
    const [o] = buildOverview([store("A", [], { events })], NOW);
    expect(o.nextDelivery).toBe("2026-10-14");
  });

  it("confidence comes from the winning rule", () => {
    const events = ["2026-10-01", "2026-10-08"].map((date) => ({ date, happened: true }));
    const [o] = buildOverview(
      [store("A", [rr({ kind: "weekly", weekday: 3 })], { events })], // Thursdays
      NOW,
    );
    expect(o.confidence).toEqual({ matched: 2, total: 5, daysSinceLastEvent: 6, stale: false });
  });

  it("ties are ordered by name", () => {
    const r = [rr({ kind: "weekly", weekday: 3 })];
    const out = buildOverview([store("Бета", r), store("Альфа", r), store("Яблуко", r)], NOW);
    expect(out.map((o) => o.name)).toEqual(["Альфа", "Бета", "Яблуко"]);
  });

  it("reports open now with closing time, and closed now", () => {
    const [open] = buildOverview([store("A", [], { hours: allDays("09:00", "20:00") })], NOW);
    expect(open.openNow).toBe(true);
    expect(open.closesAt).toBe("20:00");
    const [closed] = buildOverview([store("A", [], { hours: allDays("13:00", "20:00") })], NOW);
    expect(closed.openNow).toBe(false);
    expect(closed.closesAt).toBeNull();
  });
});

describe("ruleLabel", () => {
  it("weekly", () => {
    expect(ruleLabel({ kind: "weekly", weekday: 0 })).toBe("щотижня, пн");
  });
  it("every_n_weeks", () => {
    const base = { kind: "every_n_weeks" as const, weekday: 2, anchorDate: "2026-10-07" };
    expect(ruleLabel({ ...base, intervalWeeks: 2 })).toBe("кожні 2 тижні, ср");
    expect(ruleLabel({ ...base, intervalWeeks: 4 })).toBe("кожні 4 тижні, ср");
    expect(ruleLabel({ ...base, intervalWeeks: 5 })).toBe("кожні 5 тижнів, ср");
  });
  it("monthly_nth", () => {
    expect(ruleLabel({ kind: "monthly_nth", weekday: 3, nth: 1 })).toBe("кожен 1-й чт місяця");
    expect(ruleLabel({ kind: "monthly_nth", weekday: 3, nth: 2 })).toBe("кожен 2-й чт місяця");
    expect(ruleLabel({ kind: "monthly_nth", weekday: 3, nth: 4 })).toBe("кожен 4-й чт місяця");
    expect(ruleLabel({ kind: "monthly_nth", weekday: 3, nth: -1 })).toBe("останній чт місяця");
  });
  it("irregular", () => {
    expect(ruleLabel({ kind: "irregular" })).toBe("без графіка");
  });
  it("all weekday names", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((weekday) => ruleLabel({ kind: "weekly", weekday }))).toEqual(
      ["пн", "вт", "ср", "чт", "пт", "сб", "нд"].map((d) => `щотижня, ${d}`),
    );
  });
});
