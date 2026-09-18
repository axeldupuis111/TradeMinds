import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * LE GARDE DES ROUTES D'ADMINISTRATION, ÉCRIT UNE SEULE FOIS.
 *
 * ── LE DÉFAUT, ET SA CONSÉQUENCE DÉJÀ PAYÉE ─────────────────────────────────
 *
 * ⚠️⚠️ HUIT COPIES, ET L'UNE D'ELLES A DIVERGÉ JUSQU'À RENDRE SA ROUTE
 * INAPPELABLE. Chaque route d'administration réécrivait les mêmes quinze
 * lignes — client Supabase sur les cookies, lecture de l'utilisateur, découpe
 * de `ADMIN_EMAILS`, comparaison en minuscules — et chacune portait un
 * commentaire du genre « Même garde admin que /api/admin/funnel », désignant à
 * chaque fois une sœur DIFFÉRENTE. Huit fichiers affirmaient se ressembler ;
 * rien ne les y obligeait.
 *
 * ⚠️ CE QUE ÇA A COÛTÉ, POUR DE VRAI :
 * `/api/admin/recompute-trade-derivation` s'était mise à se garder par un
 * en-tête `x-admin-secret` comparé à `ADMIN_SECRET` — la seule des huit à ne
 * pas lire `ADMIN_EMAILS`. Or cette variable N'EXISTE PAS en production
 * (vérifié le 2026-09-18 : Vercel connaît `ADMIN_EMAILS`, `CRON_SECRET`,
 * `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, les clés VAPID — pas
 * `ADMIN_SECRET`). Chaque appel repartait en 401, y compris ceux d'Axel, et la
 * correction du calcul ICT n'a donc jamais pu être appliquée : onze trades de
 * production portent une killzone que le code contredit, et 213 sur 288 n'en
 * ont aucune.
 *
 * Une copie qui diverge n'est pas une hypothèse dans ce dépôt. C'est arrivé.
 *
 * ── CE QUI EST PRÉSERVÉ ─────────────────────────────────────────────────────
 *
 * ⚠️ DEUX FORMES DE RÉPONSE, ET ON GARDE LES DEUX. Cinq routes répondent
 * `{ error }` et trois `{ success: false, message }` ; le front lit l'une ou
 * l'autre. Uniformiser ici casserait des écrans sans rien corriger, donc la
 * forme est un paramètre et chaque route garde la sienne.
 *
 * ⚠️ LISTE VIDE = PERSONNE. Le jour où `ADMIN_EMAILS` disparaît, ces routes
 * doivent se FERMER, pas s'ouvrir : `[].includes(x)` rend faux, et c'est
 * exactement le comportement voulu.
 */

export type FormeDeRefus = "error" | "success";

function refus(forme: FormeDeRefus, texte: string, statut: number): NextResponse {
  return forme === "success"
    ? NextResponse.json({ success: false, message: texte }, { status: statut })
    : NextResponse.json({ error: texte }, { status: statut });
}

/** Les adresses autorisées, en minuscules. Tableau vide = personne. */
export function adressesAdmin(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * `null` si l'appelant est administrateur, sinon la réponse à renvoyer telle
 * quelle.
 *
 * @param forme la forme de réponse attendue par l'écran appelant
 */
export async function refusDAdministrateur(
  forme: FormeDeRefus = "error",
): Promise<NextResponse | null> {
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Lecture seule : on vérifie une session, on n'en pose jamais.
        setAll() {},
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabaseUser.auth.getUser();
  if (error || !user) return refus(forme, "Non authentifié", 401);

  const admins = adressesAdmin();
  if (!user.email || !admins.includes(user.email.toLowerCase())) {
    return refus(forme, "Accès refusé", 403);
  }
  return null;
}
