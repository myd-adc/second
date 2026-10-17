import type { DayHours } from "../opening-hours";
import { unwrap, type Db } from "./client";
import { hoursFromRows, type DbHoursRow } from "./mappers";

export async function fetchHours(db: Db, storeIds: string[]): Promise<Map<string, DayHours[]>> {
  const out = new Map<string, DayHours[]>();
  if (storeIds.length === 0) return out;
  const rows = unwrap(
    await db.from("opening_hours").select("store_id, weekday, opens, closes, is_closed").in("store_id", storeIds),
    "load opening hours",
  ) as Array<DbHoursRow & { store_id: string }>;
  const grouped = new Map<string, DbHoursRow[]>();
  for (const r of rows) grouped.set(r.store_id, [...(grouped.get(r.store_id) ?? []), r]);
  for (const [id, list] of grouped) out.set(id, hoursFromRows(list));
  return out;
}
