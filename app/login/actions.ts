"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export type VerifyState = { error: string | null };

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
  if (error) {
    console.error("signInWithOtp failed:", error);
    return { status: "error", message: "Не вдалося надіслати посилання. Спробуй ще раз трохи пізніше." };
  }
  return { status: "sent", email };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;
const CODE_FAILED = "Невірний або прострочений код. Спробуй ще раз.";

/** Fallback when the magic link cannot be opened in the requesting browser: sign in with the emailed 6-digit code. */
export async function verifyCodeAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  if (!EMAIL_SHAPE.test(email) || !/^\d{6}$/.test(token)) return { error: CODE_FAILED };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    console.error("verifyOtp failed:", error);
    return { error: CODE_FAILED };
  }
  redirect("/"); // outside try/catch: redirect() works by throwing
}
