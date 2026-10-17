import type { PostgrestError } from "@supabase/supabase-js";
import { createServerClient } from "../supabase/server";

export type Db = Awaited<ReturnType<typeof createServerClient>>;

export function getDb(): Promise<Db> {
  return createServerClient();
}

/** Throws a readable Error when Supabase reports one; otherwise returns the data. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}
