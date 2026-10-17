import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createBrowserClient() {
  const { url, anonKey } = supabaseEnv();
  return createSsrBrowserClient(url, anonKey);
}
