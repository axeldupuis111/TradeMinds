import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * FERME LES SÉANCES QU'ON A OUBLIÉ DE TERMINER.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE SÉANCE OUVERTE DEPUIS QUATRE-VINGT-DIX-SEPT JOURS. Relevé le
 * 2026-09-16 : sur 88 séances, 7 portaient encore `active = true`, ouvertes
 * depuis 6,7 / 12,1 / 13,3 / 45,6 / 46,6 / 51,4 et 97,5 jours. Treize personnes
 * seulement ont déjà lancé une séance : plus de la moitié d'entre elles en
 * traînaient une, jamais refermée.
 *
 * ⚠️ ET CE N'EST PAS COSMÉTIQUE : le bandeau « n'oublie pas de préparer ta
 * séance » ne s'affiche que s'il n'y a NI séance du jour NI séance active, et
 * sa lecture de « séance active » n'était bornée par aucune date. Une séance
 * fantôme de trois mois éteignait donc DÉFINITIVEMENT la seule invitation du
 * produit à faire ce qu'il vend. Le trader n'était plus relancé, donc ne
 * revenait pas sur la page des séances, donc le ménage qui s'y trouvait ne
 * tournait jamais : le défaut se maintenait tout seul.
 *
 * ── POURQUOI ICI ET PAS DANS LA PAGE ────────────────────────────────────────
 *
 * Le ménage existait, mais UNIQUEMENT au chargement de `/dashboard/session`,
 * c'est-à-dire exactement la page où un trader silencieux ne va jamais. Il
 * tourne désormais aussi depuis la mise en page du tableau de bord, donc
 * derrière n'importe quelle page du produit.
 *
 * ⚠️ RÉSULTAT VOLONTAIREMENT IGNORÉ : c'est un ménage, refait à chaque
 * chargement. Un échec ne change rien à ce qui s'affiche et se rattrape tout
 * seul la fois d'après. La lecture, elle, se borne quand même à la journée en
 * cours, pour qu'un ménage raté n'éteigne pas le bandeau une deuxième fois.
 */
export async function fermerLesSeancesOubliees(
  supabase: SupabaseClient,
  userId: string,
  debutDuJour: string,
): Promise<void> {
  await supabase
    .from("sessions")
    .update({ active: false, ended_at: debutDuJour })
    .eq("user_id", userId)
    .eq("active", true)
    .lt("created_at", debutDuJour);
}
