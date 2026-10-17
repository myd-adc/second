import type { DayHours } from "../opening-hours";
import type { DeliveryEvent, ISODate, Rule } from "../schedule/types";
import type { JournalEntry, RuleRow, StoreInput } from "./types";

// Pure row <-> domain mapping. DB snake_case never leaves lib/db.

export type DbRuleRow = {
  id: string;
  kind: Rule["kind"];
  weekday: number | null;
  interval_weeks: number | null;
  anchor_date: string | null;
  nth: number | null;
  time_of_day: string | null;
  note: string | null;
  is_active: boolean;
};

export type DbHoursRow = {
  weekday: number;
  opens: string | null;
  closes: string | null;
  is_closed: boolean;
};

export type DbEventRow = { date: string; happened: boolean };

/** Postgres `time` comes back as "HH:MM:SS"; the domain uses "HH:MM". */
export function timeFromDb(t: string | null): string | null {
  return t === null ? null : t.slice(0, 5);
}

function ruleFromDb(row: DbRuleRow): Rule {
  const weekday = row.weekday as number;
  switch (row.kind) {
    case "weekly":
      return { kind: "weekly", weekday };
    case "every_n_weeks":
      return {
        kind: "every_n_weeks",
        weekday,
        intervalWeeks: row.interval_weeks as number,
        anchorDate: row.anchor_date as ISODate,
      };
    case "monthly_nth":
      return { kind: "monthly_nth", weekday, nth: row.nth as 1 | 2 | 3 | 4 | -1 };
    case "irregular":
      return { kind: "irregular" };
  }
}

export function ruleFromRow(row: DbRuleRow): RuleRow {
  return {
    id: row.id,
    rule: ruleFromDb(row),
    isActive: row.is_active,
    timeOfDay: timeFromDb(row.time_of_day),
    note: row.note ?? "",
  };
}

export type RuleDbPayload = Omit<DbRuleRow, "id">;

/** Fields that belong to other kinds are forced to null (DB CHECK rejects stale values). */
export function ruleToRow(input: StoreInput["rules"][number]): RuleDbPayload {
  const { rule } = input;
  return {
    kind: rule.kind,
    weekday: rule.kind === "irregular" ? null : rule.weekday,
    interval_weeks: rule.kind === "every_n_weeks" ? rule.intervalWeeks : null,
    anchor_date: rule.kind === "every_n_weeks" ? rule.anchorDate : null,
    nth: rule.kind === "monthly_nth" ? rule.nth : null,
    time_of_day: input.timeOfDay || null,
    note: input.note ? input.note : null,
    is_active: input.isActive,
  };
}

export function hoursFromRows(rows: DbHoursRow[]): DayHours[] {
  return rows
    .map((r) => ({
      weekday: r.weekday,
      opens: timeFromDb(r.opens),
      closes: timeFromDb(r.closes),
      isClosed: r.is_closed,
    }))
    .sort((a, b) => a.weekday - b.weekday);
}

export function hoursToRows(hours: DayHours[]): DbHoursRow[] {
  return hours.map((h) => ({
    weekday: h.weekday,
    opens: h.isClosed ? null : h.opens,
    closes: h.isClosed ? null : h.closes,
    is_closed: h.isClosed,
  }));
}

export function eventFromRow(row: DbEventRow): DeliveryEvent {
  return { date: row.date, happened: row.happened };
}

/** jsonb argument of the `save_store` RPC. */
export function storeInputToPayload(input: StoreInput) {
  return {
    id: input.id ?? null,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    notes: input.notes ?? null,
    hours: hoursToRows(input.hours),
    rules: input.rules.map(ruleToRow),
  };
}

/** One event per date (happened = any report true); keeps the order of first appearance. */
export function mergeEventsByDate(events: DeliveryEvent[]): DeliveryEvent[] {
  const byDate = new Map<ISODate, DeliveryEvent>();
  for (const e of events) {
    const prev = byDate.get(e.date);
    if (prev) prev.happened = prev.happened || e.happened;
    else byDate.set(e.date, { date: e.date, happened: e.happened });
  }
  return [...byDate.values()];
}

type ProfileEmbed = { display_name: string | null };
export type DbJournalRow = {
  id: string;
  date: string;
  happened: boolean;
  note: string | null;
  reported_by: string;
  // PostgREST returns a to-one embed as an object (an array in some typings)
  profiles: ProfileEmbed | ProfileEmbed[] | null;
};

export function journalEntryFromRow(row: DbJournalRow, currentUserId: string | null): JournalEntry {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const name = profile?.display_name?.trim();
  return {
    id: row.id,
    date: row.date,
    happened: row.happened,
    note: row.note,
    reporterName: name ? name : "Хтось",
    reportedByMe: currentUserId !== null && row.reported_by === currentUserId,
  };
}
