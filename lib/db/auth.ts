import { getDb } from "./client";

/** Id of the signed-in user, or null when there is no session. */
export async function currentUserId(): Promise<string | null> {
  const db = await getDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/** True when there is a session AND the user passes the allow-list (`is_allowed()`). */
export async function isSignedInAndAllowed(): Promise<boolean> {
  const db = await getDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return false;
  const res = await db.rpc("is_allowed");
  return !res.error && res.data === true;
}
