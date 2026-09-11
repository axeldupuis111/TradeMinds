import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunk, ID_CHUNK } from "@/lib/supabase-paginate";

/**
 * Chiffres d'UN collaborateur, lus par son jeton.
 *
 * VOLONTAIREMENT SANS MONTANTS. Le collaborateur voit combien de personnes il a
 * amenées et combien sont abonnées ; il ne voit aucun euro. Deux raisons :
 *
 *  1. Nous ne le payons pas. Notre contrat est avec sa société, qui redistribue
 *     selon SON découpage. Afficher « ta commission » créerait une créance que
 *     nous n'avons pas, envers quelqu'un que nous ne connaissons pas.
 *  2. Afficher l'encaissé reviendrait à publier la marge que sa société prend
 *     au passage. Ce n'est pas notre information à divulguer.
 *
 * Le jeton donne accès en lecture aux seuls chiffres de son porteur. Pas de
 * compte à créer : un apporteur qui doit s'inscrire pour voir trois nombres ne
 * revient jamais, et on ne construit pas une authentification de plus.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = (params.token ?? "").trim();
    if (token.length < 12) {
      return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data: rep } = await supabase
      .from("partner_reps")
      .select("id, code, display_name, active, partner_id")
      .eq("stats_token", token)
      .maybeSingle();

    if (!rep) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

    const { data: partner } = await supabase
      .from("partners")
      .select("name")
      .eq("id", rep.partner_id)
      .maybeSingle();

    // Comptes créés depuis son lien.
    const { count: signups } = await supabase
      .from("referral_attributions")
      .select("user_id", { count: "exact", head: true })
      .eq("rep_id", rep.id);

    // Parmi eux, ceux qui sont abonnés aujourd'hui. Deux requêtes plutôt qu'une
    // jointure : la liste des filleuls d'un apporteur se compte en dizaines.
    const { data: attributed } = await supabase
      .from("referral_attributions")
      .select("user_id")
      .eq("rep_id", rep.id);

    /**
     * ⚠️ LE COMPTAGE SE FAIT PAR PAQUETS. Les identifiants voyagent dans l'URL
     * (37 caractères par UUID) : un collaborateur qui a rattaché plus de deux
     * cents inscrits faisait échouer sa propre page de statistiques, d'un bloc.
     * Le réseau de partenaires est justement conçu pour ces volumes-là.
     */
    let subscribers = 0;
    const ids = (attributed ?? []).map((a) => a.user_id as string);
    for (const lot of chunk(ids, ID_CHUNK)) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("id", lot)
        .in("plan", ["plus", "premium"]);
      subscribers += count ?? 0;
    }

    return NextResponse.json({
      name: rep.display_name,
      code: rep.code,
      active: rep.active,
      partner: partner?.name ?? null,
      signups: signups ?? 0,
      subscribers,
    });
  } catch (err) {
    console.error("[Partner stats] erreur:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
