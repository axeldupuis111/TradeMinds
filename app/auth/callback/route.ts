import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) callback. Supabase redirects here with a `?code=` after the
 * provider consent screen; we exchange it for a session (cookies set on this
 * response) and send the user on to the dashboard.
 *
 * Setup required (one-time, in the dashboards — not in code):
 *   - Supabase → Authentication → Providers → Google: enable + paste the Google
 *     OAuth Client ID/Secret.
 *   - Supabase → Authentication → URL Configuration → Redirect URLs: add
 *     https://tradediscipline.app/auth/callback (and http://localhost:3000/auth/callback for dev).
 *   - Google Cloud Console → OAuth client → Authorized redirect URIs: add the
 *     Supabase callback shown in the provider panel (…supabase.co/auth/v1/callback).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback] exchange failed:", error.message);
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "oauth_failed");
  return NextResponse.redirect(errorUrl);
}
