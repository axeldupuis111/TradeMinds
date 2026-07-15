import { createClient } from "@/lib/supabase/server";
import PublicProfileView from "@/components/profile/PublicProfileView";
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
  const description = `See @${handle}'s trading discipline scorecard: discipline score, win rate, streak and equity curve on TradeDiscipline.`;
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

  // Les trades démo n'apparaissent jamais sur un profil PUBLIC ; fallback
  // sans filtre tant que la colonne is_demo n'existe pas en prod.
  const [{ data: trades }, { data: reviews }, { data: achievements }] = await Promise.all([
    supabase
      .from("trades")
      .select("open_time, pnl, commission, swap")
      .eq("user_id", userId)
      .eq("is_demo", false)
      .order("open_time", { ascending: true })
      .then(async (res) =>
        res.error
          ? await supabase
              .from("trades")
              .select("open_time, pnl, commission, swap")
              .eq("user_id", userId)
              .order("open_time", { ascending: true })
          : res
      ),
    supabase
      .from("session_reviews")
      .select("created_at, discipline_score, analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("achievements")
      .select("key, unlocked_at")
      .eq("user_id", userId),
  ]);

  return (
    <PublicProfileView
      username={profile.username}
      trades={trades || []}
      reviews={reviews || []}
      achievements={achievements || []}
    />
  );
}
