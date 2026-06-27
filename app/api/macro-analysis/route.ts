import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

/**
 * Read the daily macro briefings for the current premium member.
 *
 * Premium-only: free/plus members get `{ locked: true }` so the UI can render an
 * upsell instead of an error. The table has no RLS read policy, so we read with
 * the service role here AFTER checking the plan — this is the access gate.
 *
 * Returns the most recent briefings for the requested language (default 30), so
 * the client gets today's analysis plus the history in a single call. Each row
 * is small (~1-2KB), so 30 of them is cheap.
 */

export const dynamic = "force-dynamic";

const LANGS = ["fr", "en", "de", "es"] as const;
type Lang = (typeof LANGS)[number];

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Macro briefings are a premium feature.
  if (auth.plan !== "premium") {
    return NextResponse.json({ locked: true, analyses: [] });
  }

  const url = new URL(req.url);
  const lang: Lang = LANGS.includes(url.searchParams.get("lang") as Lang)
    ? (url.searchParams.get("lang") as Lang)
    : "en";

  let supabase;
  try {
    supabase = serviceClient();
  } catch {
    return NextResponse.json({ analyses: [] });
  }

  const fetchWith = (cols: string) =>
    supabase
      .from("macro_analyses")
      .select(cols)
      .eq("lang", lang)
      .order("analysis_date", { ascending: false })
      .limit(30);

  try {
    // Prefer the full row (with outlook). If the `outlook` column isn't migrated
    // yet, gracefully fall back to the columns that always exist, so the page
    // still renders the analysis (minus the impacts section) during the window
    // between deploy and migration.
    const full = await fetchWith(
      "analysis_date, headline, overview, themes, watchlist, outlook, takeaway, created_at",
    );
    if (!full.error) return NextResponse.json({ analyses: full.data ?? [] });

    const base = await fetchWith(
      "analysis_date, headline, overview, themes, watchlist, takeaway, created_at",
    );
    if (!base.error) return NextResponse.json({ analyses: base.data ?? [] });

    // Table not migrated yet → empty state rather than a 500.
    return NextResponse.json({ analyses: [] });
  } catch {
    return NextResponse.json({ analyses: [] });
  }
}
