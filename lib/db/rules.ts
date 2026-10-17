import { unwrap, type Db } from "./client";
import { ruleFromRow, type DbRuleRow } from "./mappers";
import type { RuleRow } from "./types";

export async function fetchRules(db: Db, storeIds: string[]): Promise<Map<string, RuleRow[]>> {
  const out = new Map<string, RuleRow[]>();
  if (storeIds.length === 0) return out;
  const rows = unwrap(
    await db
      .from("delivery_rules")
      .select("id, store_id, kind, weekday, interval_weeks, anchor_date, nth, time_of_day, note, is_active")
      .in("store_id", storeIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    "load delivery rules",
  ) as Array<DbRuleRow & { store_id: string }>;
  for (const r of rows) out.set(r.store_id, [...(out.get(r.store_id) ?? []), ruleFromRow(r)]);
  return out;
}
