import { SITE_URL } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { chargerLaSerieDeDiscipline } from "@/lib/discipline-streak-source";
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
    /**
     * ⚠️⚠️ HORS DES RÉSULTATS DE RECHERCHE, MAIS LISIBLE PAR LES APERÇUS.
     *
     * C'est ici que vit désormais la décision de vie privée, et non plus dans
     * un `Disallow` de robots.txt : un robot doit pouvoir LIRE la page pour y
     * découvrir cette consigne, et pour y trouver la carte de partage. Lui
     * interdire la page revenait à lui cacher les deux.
     *
     * ⚠️ `follow: true` : les liens de la page (l'accueil, les mentions
     * légales) restent suivis, ils n'ont rien de privé.
     */
    robots: { index: false, follow: true },
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
  /**
   * ⚠️⚠️ LA SÉRIE VIENT DU CALCUL PARTAGÉ, PAS D'UN TROISIÈME. Ce profil
   * comptait ses propres « bilans de séance sans violation » et annonçait
   * « 0 jour de discipline » pendant que le tableau de bord en affichait
   * 75, pour le même compte, le même jour. C'est exactement le défaut que
   * `lib/discipline-streak-source.ts` a été écrit pour clore : il l'avait
   * clos entre deux cartes du tableau de bord, et ce troisième calcul, sur
   * la page que le trader PARTAGE, n'avait jamais été rapproché.
   */
  const [tradeRows, { data: reviews }, { count: sessionCount }, { data: achievements }, serie] = await Promise.all([
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
    chargerLaSerieDeDiscipline(supabase, userId, { sansDemo: true }),
  ]);

  // Ordre chronologique refait ici : les pages sont lues dans l'ordre de `id`.
  const trades = (tradeRows ?? [])
    .slice()
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  /**
   * ⚠️⚠️ `complet` EXISTAIT ET PERSONNE NE LE LISAIT. Le calcul partage rend
   * `{ current: 0, complet: false }` quand la lecture echoue, et les quatre
   * appelants ne prenaient que `current` : une lecture ratee affichait donc
   * « 0 jour de discipline » avec un flocon, SUR LA PAGE QUE LE TRADER
   * PARTAGE, la surface ou un chiffre faux est le moins recoupable. C'est
   * exactement le defaut pour lequel ce calcul partage a ete ecrit, atteint
   * par une autre porte.
   */
  return (
    <PublicProfileView
      username={profile.username}
      founding={isFounding}
      trades={trades}
      reviews={reviews || []}
      sessionCount={sessionCount ?? 0}
      achievements={achievements || []}
      serie={serie.complet ? serie.current : null}
    />
  );
}
