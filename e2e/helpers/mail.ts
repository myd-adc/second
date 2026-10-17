// Local Supabase ships Mailpit on :54324 (also exposed as "inbucket" in config.toml).
const MAIL_API = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; To: { Address: string }[]; Created: string };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MAIL_API}${path}`);
  if (!res.ok) throw new Error(`Mailpit ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Remove old mail for the address so the next poll can only see the fresh magic link. */
export async function clearMailbox(email: string): Promise<void> {
  const q = encodeURIComponent(`to:${email}`);
  await fetch(`${MAIL_API}/api/v1/search?query=${q}`, { method: "DELETE" });
}

/** Poll Mailpit until a message to `email` arrives; return the magic link found in it. */
export async function waitForMagicLink(email: string, timeoutMs = 20_000): Promise<string> {
  const q = encodeURIComponent(`to:${email}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { messages } = await getJson<{ messages: Summary[] }>(`/api/v1/search?query=${q}`);
    if (messages.length > 0) {
      const newest = [...messages].sort((a, b) => b.Created.localeCompare(a.Created))[0];
      const msg = await getJson<{ HTML: string; Text: string }>(`/api/v1/message/${newest.ID}`);
      const body = `${msg.HTML}\n${msg.Text}`;
      const m = body.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/) ?? body.match(/(http[^\s"<]*\/auth\/v1\/verify[^\s"<]*)/);
      if (m) return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No magic link for ${email} within ${timeoutMs} ms`);
}
