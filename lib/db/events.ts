import { addDays } from "../schedule/dates";
import { todayInKyiv } from "../schedule/today";
import type { DeliveryEvent, ISODate } from "../schedule/types";
import { getDb, unwrap, type Db } from "./client";
import { eventFromRow, type DbEventRow } from "./mappers";

const WINDOW_DAYS = 200;
const PAGE = 1000; // PostgREST caps a response at 1000 rows by default

/** Events of the last 200 days per store, newest first, uncapped (paged to dodge the row limit). */
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
