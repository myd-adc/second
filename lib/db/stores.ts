import { getDb, unwrap, type Db } from "./client";
import { fetchEvents } from "./events";
import { fetchHours } from "./hours";
import { storeInputToPayload } from "./mappers";
import { fetchRules } from "./rules";
import type { StoreInput, StoreWithDetails } from "./types";

type DbStoreRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_by: string;
};

const STORE_COLUMNS = "id, name, address, lat, lng, notes, created_by";

async function withDetails(db: Db, stores: DbStoreRow[]): Promise<StoreWithDetails[]> {
  const ids = stores.map((s) => s.id);
  const [hours, rules, events] = await Promise.all([
    fetchHours(db, ids),
    fetchRules(db, ids),
    fetchEvents(db, ids),
  ]);
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    notes: s.notes,
    createdBy: s.created_by,
    hours: hours.get(s.id) ?? [],
    rules: rules.get(s.id) ?? [],
    events: events.get(s.id) ?? [],
  }));
}

export async function listStores(): Promise<StoreWithDetails[]> {
  const db = await getDb();
  const rows = unwrap(
    await db.from("stores").select(STORE_COLUMNS).order("name", { ascending: true }),
    "list stores",
  ) as DbStoreRow[];
  return withDetails(db, rows);
}

export async function getStore(id: string): Promise<StoreWithDetails | null> {
  const db = await getDb();
  const row = unwrap(
    await db.from("stores").select(STORE_COLUMNS).eq("id", id).maybeSingle(),
    "load store",
  ) as DbStoreRow | null;
  if (!row) return null;
  return (await withDetails(db, [row]))[0];
}

/** Creates or (with input.id) updates the store and replaces hours + rules atomically via RPC. */
export async function saveStore(input: StoreInput): Promise<string> {
  const db = await getDb();
  const id = unwrap(await db.rpc("save_store", { payload: storeInputToPayload(input) }), "save store");
  return id as unknown as string;
}

export async function deleteStore(id: string): Promise<void> {
  const db = await getDb();
  const res = await db.from("stores").delete().eq("id", id).select("id");
  if (res.error) throw new Error(`delete store: ${res.error.message}`);
  // RLS lets only the creator delete; a filtered-out row is not an SQL error
  if (res.data.length === 0) throw new Error("delete store: not found or only the creator can delete it");
}
