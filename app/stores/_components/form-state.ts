import { formatCoordinates, parseCoordinates } from "@/lib/coordinates";
import type { StoreWithDetails } from "@/lib/db/types";
import { weekdayOf } from "@/lib/schedule/dates";
import type { ISODate } from "@/lib/schedule/types";

export type RuleKind = "weekly" | "every_n_weeks" | "monthly_nth" | "irregular";

export type HoursState = { closed: boolean; opens: string; closes: string };

export type RuleState = {
  key: string; // client-only React key
  kind: RuleKind;
  weekday: number;
  intervalWeeks: string;
  anchorDate: string;
  nth: string; // "1" | "2" | "3" | "4" | "-1"
  timeOfDay: string;
  note: string;
  isActive: boolean;
};

export type FormState = {
  id?: string;
  name: string;
  address: string;
  notes: string;
  coordinates: string; // raw "lat, lng" text; parsed in toPayload
  hours: HoursState[]; // index = weekday (0 = Monday)
  rules: RuleState[];
};

const DEFAULT_HOURS: HoursState = { closed: false, opens: "10:00", closes: "19:00" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function emptyFormState(): FormState {
  return {
    name: "",
    address: "",
    notes: "",
    coordinates: "",
    hours: Array.from({ length: 7 }, () => ({ ...DEFAULT_HOURS })),
    rules: [],
  };
}

export function newRuleState(today: ISODate, key: string): RuleState {
  return {
    key,
    kind: "weekly",
    weekday: 0,
    intervalWeeks: "2",
    anchorDate: today,
    nth: "1",
    timeOfDay: "",
    note: "",
    isActive: true,
  };
}

/** Edit page: every weekday without a stored row falls back to the new-store default (open 10:00-19:00). */
export function formStateFromStore(store: StoreWithDetails): FormState {
  const hours = Array.from({ length: 7 }, (_, weekday): HoursState => {
    const h = store.hours.find((x) => x.weekday === weekday);
    if (!h) return { ...DEFAULT_HOURS };
    if (h.isClosed || h.opens === null || h.closes === null) {
      return { closed: h.isClosed, opens: h.opens ?? DEFAULT_HOURS.opens, closes: h.closes ?? DEFAULT_HOURS.closes };
    }
    return { closed: false, opens: h.opens, closes: h.closes };
  });
  const rules = store.rules.map((r, i): RuleState => {
    const base = { ...newRuleState("", `r${i}`), kind: r.rule.kind, isActive: r.isActive, timeOfDay: r.timeOfDay ?? "", note: r.note };
    switch (r.rule.kind) {
      case "weekly":
        return { ...base, weekday: r.rule.weekday };
      case "every_n_weeks":
        return { ...base, weekday: r.rule.weekday, intervalWeeks: String(r.rule.intervalWeeks), anchorDate: r.rule.anchorDate };
      case "monthly_nth":
        return { ...base, weekday: r.rule.weekday, nth: String(r.rule.nth) };
      case "irregular":
        return base;
    }
  });
  return {
    id: store.id,
    name: store.name,
    address: store.address ?? "",
    notes: store.notes ?? "",
    coordinates: formatCoordinates(store.lat, store.lng),
    hours,
    rules,
  };
}

function ruleToPayload(r: RuleState): unknown {
  switch (r.kind) {
    case "weekly":
      return { kind: "weekly", weekday: r.weekday };
    case "every_n_weeks":
      return {
        kind: "every_n_weeks",
        // derived from the anchor; 0 as a harmless fallback so the anchor error is what the user sees
        weekday: ISO.test(r.anchorDate) ? weekdayOf(r.anchorDate) : 0,
        intervalWeeks: r.intervalWeeks.trim() === "" ? null : Number(r.intervalWeeks),
        anchorDate: r.anchorDate,
      };
    case "monthly_nth":
      return { kind: "monthly_nth", weekday: r.weekday, nth: Number(r.nth) };
    case "irregular":
      return { kind: "irregular" };
  }
}

/** Serialisable object for the hidden `payload` field; the server re-validates everything. */
export function toPayload(s: FormState): Record<string, unknown> {
  const coords = parseCoordinates(s.coordinates);
  return {
    ...(s.id ? { id: s.id } : {}),
    name: s.name,
    address: s.address,
    notes: s.notes,
    lat: coords === null || coords === "invalid" ? null : coords.lat,
    lng: coords === null || coords === "invalid" ? null : coords.lng,
    // the server turns this into a visible validation error instead of silently dropping the text
    ...(coords === "invalid" ? { coordinatesInvalid: true } : {}),
    hours: s.hours.map((h, weekday) => ({
      weekday,
      isClosed: h.closed,
      opens: h.closed ? null : h.opens,
      closes: h.closed ? null : h.closes,
    })),
    rules: s.rules.map((r) => ({
      rule: ruleToPayload(r),
      isActive: r.isActive,
      timeOfDay: r.timeOfDay === "" ? null : r.timeOfDay,
      note: r.note,
    })),
  };
}
