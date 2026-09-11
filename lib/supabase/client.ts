import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, UserResponse } from "@supabase/supabase-js";

/**
 * LE CLIENT SUPABASE DU NAVIGATEUR, EN UN SEUL EXEMPLAIRE.
 *
 * ── CE QUE LE RÉSEAU MONTRAIT ───────────────────────────────────────────────
 *
 * ⚠️⚠️ DIX-NEUF APPELS À `/auth/v1/user` POUR UNE SEULE OUVERTURE DU TABLEAU DE
 * BORD. Mesuré sur la page déployée, `performance.getEntriesByType("resource")`
 * à l'appui. Ce n'est pas une lecture locale : `getUser()` fait un aller-retour
 * HTTPS jusqu'à Supabase pour faire VALIDER le jeton, à chaque fois.
 *
 * ⚠️ ET CHACUN DE CES ALLERS-RETOURS BLOQUE UNE REQUÊTE DE DONNÉES : le motif
 * du produit est partout `const { data: { user } } = await getUser()` PUIS la
 * vraie lecture. Quatre-vingt-seize endroits l'écrivent. La page attend donc
 * deux allers-retours en série là où un seul est nécessaire.
 *
 * ⚠️ LA CAUSE EST ICI, PAS DANS LES APPELANTS : `createClient()` fabriquait un
 * client NEUF à chaque appel. Chaque composant avait donc le sien, avec son
 * propre état d'authentification, son propre minuteur de rafraîchissement de
 * jeton, et aucune mémoire partagée.
 *
 * ── CE QU'ON FAIT ───────────────────────────────────────────────────────────
 *
 * Un seul client pour l'onglet, et `getUser()` mutualisé : les appels qui se
 * chevauchent partagent la MÊME promesse, et le résultat reste valable quelques
 * secondes.
 *
 * ⚠️ LA FENÊTRE EST COURTE ET C'EST VOULU. Elle ne sert qu'à absorber la rafale
 * d'un chargement de page. Et elle ne relâche aucune garantie : ce qu'un
 * utilisateur a le droit de lire est décidé par les politiques RLS, côté base,
 * à chaque requête. Ce cache ne décide que de l'affichage.
 *
 * ⚠️ UNE SORTIE DE SESSION LE VIDE TOUT DE SUITE, sans attendre la fenêtre.
 */
const TTL_MS = 3_000;

let client: SupabaseClient | null = null;
let enCours: Promise<UserResponse> | null = null;
let dernier: { a: number; reponse: UserResponse } | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const origine = client.auth.getUser.bind(client.auth);

  client.auth.getUser = ((jwt?: string) => {
    // Un appel qui désigne SON jeton veut une vérification à lui : on ne
    // mutualise jamais celui-là.
    if (jwt) return origine(jwt);

    if (dernier && Date.now() - dernier.a < TTL_MS) return Promise.resolve(dernier.reponse);
    if (enCours) return enCours;

    enCours = origine().then(
      (reponse) => {
        enCours = null;
        // Une réponse en erreur n'est pas mise de côté : le prochain appelant
        // doit pouvoir retenter tout de suite.
        if (!reponse.error) dernier = { a: Date.now(), reponse };
        return reponse;
      },
      (err) => {
        enCours = null;
        throw err;
      },
    );
    return enCours;
  }) as typeof client.auth.getUser;

  client.auth.onAuthStateChange(() => {
    dernier = null;
    enCours = null;
  });

  return client;
}
