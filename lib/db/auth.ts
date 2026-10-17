import { getDb } from "./client";

/** Id of the signed-in user, or null when there is no session. */
export async function currentUserId(): Promise<string | null> {
  const db = await getDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
