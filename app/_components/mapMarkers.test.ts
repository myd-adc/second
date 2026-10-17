import { describe, expect, it } from "vitest";
import type { StoreWithDetails } from "@/lib/db/types";
import type { DayHours } from "@/lib/opening-hours";
import { buildMapMarkers } from "./mapMarkers";

// 2026-10-14T09:00:00Z = Wednesday 2026-10-14 12:00 Kyiv (UTC+3)
const NOW = new Date("2026-10-14T09:00:00Z");

const open = (opens: string, closes: string): DayHours[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes, isClosed: false }));

function store(
  name: string,
  place: { lat: number; lng: number } | null,
  hours: DayHours[],
  weeklyWeekday?: number,
): StoreWithDetails {
  return {
    id: `id-${name}`,
    name,
    address: null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    notes: null,
    createdBy: "u",
    hours,
    rules:
      weeklyWeekday === undefined
        ? []
        : [{ id: "r", rule: { kind: "weekly", weekday: weeklyWeekday }, isActive: true, timeOfDay: null, note: "" }],
    events: [],
  };
}

describe("buildMapMarkers", () => {
  it("only stores with a place become markers; the rest are counted", () => {
    const { markers, withoutPlace } = buildMapMarkers(
      [
        store("A", { lat: 50.45, lng: 30.52 }, open("09:00", "20:00")),
        store("B", null, open("09:00", "20:00")),
        store("C", null, open("09:00", "20:00")),
      ],
      NOW,
    );
    expect(markers.map((m) => m.name)).toEqual(["A"]);
    expect(markers[0]).toMatchObject({ id: "id-A", lat: 50.45, lng: 30.52 });
    expect(withoutPlace).toBe(2);
  });

  it("a store at latitude/longitude 0 still counts as having a place", () => {
    const { markers, withoutPlace } = buildMapMarkers([store("Z", { lat: 0, lng: 0 }, open("09:00", "20:00"))], NOW);
    expect(markers).toHaveLength(1);
    expect(withoutPlace).toBe(0);
  });

  it("open now: green marker data with the closing time", () => {
    const { markers } = buildMapMarkers([store("A", { lat: 1, lng: 1 }, open("09:00", "20:00"))], NOW);
    expect(markers[0].openNow).toBe(true);
    expect(markers[0].statusText).toBe("відкрито до 20:00");
  });

  it("closed now: says when it opens", () => {
    const { markers } = buildMapMarkers([store("A", { lat: 1, lng: 1 }, open("13:00", "20:00"))], NOW);
    expect(markers[0].openNow).toBe(false);
    expect(markers[0].statusText).toBe("зараз зачинено, відкриється сьогодні о 13:00");
  });

  it("closed with no known opening hours: plain closed text", () => {
    const { markers } = buildMapMarkers([store("A", { lat: 1, lng: 1 }, [])], NOW);
    expect(markers[0].statusText).toBe("зараз зачинено");
  });

  it("delivery today is flagged and described", () => {
    const { markers } = buildMapMarkers(
      [store("A", { lat: 1, lng: 1 }, open("09:00", "20:00"), 2), store("B", { lat: 2, lng: 2 }, open("09:00", "20:00"), 3)],
      NOW,
    );
    const a = markers.find((m) => m.name === "A")!;
    const b = markers.find((m) => m.name === "B")!;
    expect(a.deliveryToday).toBe(true);
    expect(a.deliveryText).toBe("ЗАВІЗ СЬОГОДНІ");
    expect(b.deliveryToday).toBe(false);
    expect(b.deliveryText).toBe("завтра");
  });
});
