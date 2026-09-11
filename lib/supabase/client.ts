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

/**
 * L'EXPIRATION DE SESSION SE DIT, UNE FOIS.
 *
 * ⚠️⚠️ QUAND LA SESSION EXPIRE, LE PRODUIT NE FAISAIT RIEN DU TOUT. Mesure
 * en production en faisant repondre 401 « JWT expired » a Supabase : le trader
 * change de page de liste, `getUser()` ne rend plus personne, et le motif ecrit
 * quatre-vingt-seize fois dans ce depot, `if (!user) return;`, rend la main en
 * silence. Pas de lecture, pas de message, pas de redirection. L'ecran garde
 * ses anciens chiffres et ne repond plus a rien, indefiniment.
 *
 * ⚠️ LE SIGNAL PART D'ICI, pas des appelants : les corriger un par un
 * demanderait de ne jamais en oublier un, et c'est exactement la forme de
 * defaut que ce depot passe son temps a reparer.
 *
 * ⚠️ ET IL NE PART QUE SI L'ON A DEJA VU QUELQU'UN. Sur la page de
 * connexion, ne rendre aucun utilisateur est la situation normale : prevenir la
 * serait une fausse alerte, et une fausse alerte s'apprend a ignorer.
 */
export const EVENEMENT_SESSION_EXPIREE = "td:session-expiree";

let client: SupabaseClient | null = null;
let enCours: Promise<UserResponse> | null = null;
let dernier: { a: number; reponse: UserResponse } | null = null;
let aVuQuelquun = false;
let dejaSignale = false;

function examiner(reponse: UserResponse): void {
  if (reponse.data?.user) {
    aVuQuelquun = true;
    dejaSignale = false;
    return;
  }
  if (!aVuQuelquun || dejaSignale) return;
  dejaSignale = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE));
  }
}

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
        examiner(reponse);
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

  client.auth.onAuthStateChange((evenement, session) => {
    dernier = null;
    enCours = null;
    if (session?.user) {
      aVuQuelquun = true;
      dejaSignale = false;
    }
    // Une sortie de session VOULUE n'est pas une expiration.
    if (evenement === "SIGNED_OUT") {
      aVuQuelquun = false;
      dejaSignale = false;
    }
  });

  return client;
}
