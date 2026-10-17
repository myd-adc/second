import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// Next.js 16: `proxy.ts` replaces `middleware.ts`.
// Refreshes the Supabase session cookies and gates every page behind login + the allow-list.

const PUBLIC_PREFIXES = ["/login", "/auth", "/no-access"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();
  let response = NextResponse.next({ request });
  // cache-control headers from @supabase/ssr (private, no-store...) must reach every response that sets cookies
  let ssrHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        ssrHeaders = { ...ssrHeaders, ...headers };
        for (const [k, v] of Object.entries(ssrHeaders)) response.headers.set(k, v);
      },
    },
  });

  // getUser() validates the JWT with the auth server (getSession() would only read the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    // keep refreshed session cookies on the redirect
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    for (const [k, v] of Object.entries(ssrHeaders)) redirect.headers.set(k, v);
    return redirect;
  };

  if (!user) {
    return isPublic(pathname) ? response : redirectTo("/login");
  }

  // /auth/* (callback, sign-out) must work regardless of the allow-list
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return response;

  const { data: allowed, error } = await supabase.rpc("is_allowed");
  if (error) {
    // transient outage: do NOT claim «немає в списку доступу» to an allowed user; let the page's own
    // data load fail into the error boundary (an honest error screen)
    console.error("proxy: is_allowed rpc failed", error);
    return response;
  }

  if (allowed !== true) {
    return pathname === "/no-access" ? response : redirectTo("/no-access");
  }
  if (pathname === "/login" || pathname === "/no-access") return redirectTo("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
