import { createClient } from "@/lib/supabase/server";
import PublicProfileView from "@/components/profile/PublicProfileView";
import { notFound } from "next/navigation";

interface Props {
  params: { username: string };
}

export default async function PublicProfilePage({ params }: Props) {
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

  const [{ data: trades }, { data: reviews }, { data: achievements }] = await Promise.all([
    supabase
      .from("trades")
      .select("open_time, pnl, commission, swap")
      .eq("user_id", userId)
      .order("open_time", { ascending: true }),
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
