import { addDays } from "../schedule/dates";
import { todayInKyiv } from "../schedule/today";
import type { DeliveryEvent, ISODate } from "../schedule/types";
import { getDb, unwrap, type Db } from "./client";
import { eventFromRow, journalEntryFromRow, mergeEventsByDate, type DbEventRow, type DbJournalRow } from "./mappers";
import type { JournalEntry } from "./types";

const WINDOW_DAYS = 200;
const PAGE = 1000; // PostgREST caps a response at 1000 rows by default

/** Events of the last 200 days per store (one per date), newest first, uncapped (paged to dodge the row limit). */
export async function fetchEvents(db: Db, storeIds: string[]): Promise<Map<string, DeliveryEvent[]>> {
  const out = new Map<string, DeliveryEvent[]>();
  if (storeIds.length === 0) return out;
  const cutoff = addDays(todayInKyiv(new Date()), -WINDOW_DAYS);

  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(
      await db
        .from("delivery_events")
        .select("id, store_id, date, happened")
        .in("store_id", storeIds)
        .gte("date", cutoff)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1),
      "load delivery events",
    ) as Array<DbEventRow & { store_id: string }>;
    for (const r of rows) out.set(r.store_id, [...(out.get(r.store_id) ?? []), eventFromRow(r)]);
    if (rows.length < PAGE) break;
  }
  // several people may report the same date: collapse to one event per (store, date)
  for (const [id, list] of out) out.set(id, mergeEventsByDate(list));
  return out;
}

/** Upsert the signed-in user's report for (store, date). */
export async function markDelivery(
  storeId: string,
  date: ISODate,
  happened: boolean,
  note?: string,
): Promise<void> {
  const db = await getDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error(`mark delivery: not signed in${error ? ` (${error.message})` : ""}`);

  const res = await db.from("delivery_events").upsert(
    {
      store_id: storeId,
      date,
      happened,
      note: note ? note : null,
      reported_by: data.user.id,
    },
    { onConflict: "store_id,date,reported_by" },
  );
  if (res.error) throw new Error(`mark delivery: ${res.error.message}`);
}

/** Latest per-report entries of a store (newest first) with the reporter's display name. */
export async function getJournal(storeId: string, limit = 10): Promise<JournalEntry[]> {
  const db = await getDb();
  const [rows, user] = await Promise.all([
    db
      .from("delivery_events")
      // to-one embed through the delivery_events.reported_by -> profiles.id FK
      .select("id, date, happened, note, reported_by, profiles!reported_by(display_name)")
      .eq("store_id", storeId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    db.auth.getUser(),
  ]);
  const data = unwrap(rows, "load journal") as unknown as DbJournalRow[];
  const me = user.data.user?.id ?? null;
  return data.map((r) => journalEntryFromRow(r, me));
}
