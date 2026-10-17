"use server";

import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "sent" } | { status: "error"; message: string };

export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { status: "error", message: "Вкажи email" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = h.get("origin") ?? `${proto}://${host}`;

  const supabase = await createServerClient();
  // default shouldCreateUser: the allowed_emails whitelist is the gate, not sign-up
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent" };
}
