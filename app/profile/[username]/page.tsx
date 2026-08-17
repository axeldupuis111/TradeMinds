import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase-paginate";
import PublicProfileView from "@/components/profile/PublicProfileView";

/** Colonnes du profil public (voir la lecture paginée plus bas). */
interface ProfileTradeRow {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}
import { isUsernameDisplayable } from "@/lib/username-moderation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: { username: string };
}

const SITE_URL = "https://tradediscipline.app";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Pseudo bloqué par la modération → même comportement qu'un profil inexistant.
  if (!isUsernameDisplayable(params.username)) return { title: "Profile - TradeDiscipline" };

  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", params.username)
    .eq("public_profile", true)
    .maybeSingle();

  if (!data) return { title: "Profile - TradeDiscipline" };

  const handle = data.username as string;
  const title = `@${handle} - TradeDiscipline`;
  const description = `See @${handle}'s trading discipline scorecard: discipline score, win rate, streak and sessions reviewed on TradeDiscipline.`;
  const url = `${SITE_URL}/profile/${handle}`;

  // The OG/Twitter image is wired automatically from opengraph-image.tsx in this
  // route segment; here we just provide the dynamic title/description + canonical.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "TradeDiscipline", type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  // Pseudo bloqué par la modération → même comportement qu'un profil inexistant.
  if (!isUsernameDisplayable(params.username)) {
    notFound();
  }

  const supabase = createClient();

  // Find profile by username (public_profile must be true)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, public_profile, plan")
    .eq("username", params.username)
    .eq("public_profile", true)
    .single();

  if (!profile) {
    notFound();
  }

  const userId = profile.id;

  // Statut « membre fondateur » (emblème à côté du pseudo). Requête séparée et
  // fail-open : sans la colonne founding_member, le profil s'affiche normalement.
  const { data: foundingRow } = await supabase
    .from("profiles")
    .select("founding_member")
    .eq("id", userId)
    .single();
  const isFounding = foundingRow?.founding_member === true;

  // Les trades démo n'apparaissent jamais sur un profil PUBLIC ; fallback
  // sans filtre tant que la colonne is_demo n'existe pas en prod.
  const [tradeRows, { data: reviews }, { count: sessionCount }, { data: achievements }] = await Promise.all([
    // Lecture paginée : ce profil est PUBLIC et affiche un nombre de trades et
    // un winrate. Non bornée, la lecture s'arrête à 1 000 trades en silence
    // (voir lib/supabase-paginate.ts), et le profil publierait des chiffres
    // faux. Le tri de lecture est `id` ; l'ordre chronologique se refait après.
    fetchAllRows<ProfileTradeRow>((from, to) =>
      supabase
        .from("trades")
        .select("open_time, pnl, commission, swap")
        .eq("user_id", userId)
        .eq("is_demo", false)
        .order("id", { ascending: true })
        .range(from, to)
        .then(async (res) =>
          res.error
            ? await supabase
                .from("trades")
                .select("open_time, pnl, commission, swap")
                .eq("user_id", userId)
                .order("id", { ascending: true })
                .range(from, to)
            : res
        ),
    ),
    supabase
      .from("session_reviews")
      .select("created_at, discipline_score, analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    // Total réel des bilans : la lecture ci-dessus est bornée à 60 pour la
    // courbe, le compteur affiché ne doit pas plafonner avec elle.
    supabase
      .from("session_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("achievements")
      .select("key, unlocked_at")
      .eq("user_id", userId),
  ]);

  // Ordre chronologique refait ici : les pages sont lues dans l'ordre de `id`.
  const trades = (tradeRows ?? [])
    .slice()
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  return (
    <PublicProfileView
      username={profile.username}
      founding={isFounding}
      trades={trades}
      reviews={reviews || []}
      sessionCount={sessionCount ?? 0}
      achievements={achievements || []}
    />
  );
}
