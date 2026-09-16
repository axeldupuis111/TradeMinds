import { createClient as creerClient } from "@supabase/supabase-js";

/**
 * CLIENT DÉLIBÉRÉMENT ANONYME, POUR LES PAGES PUBLIQUES.
 *
 * ── POURQUOI IL EXISTE ──────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE PAGE PUBLIQUE LUE AVEC LA SESSION DU VISITEUR N'EST PAS LUE COMME
 * UNE PAGE PUBLIQUE. `lib/supabase/server.ts` transmet les cookies : la même
 * page tourne donc en rôle `anon` pour un visiteur déconnecté, et en rôle
 * `authenticated` pour quelqu'un qui a un compte. Or ces deux rôles n'ont pas
 * les mêmes DROITS DE COLONNE.
 *
 * Mesuré en production le 2026-09-16, depuis un compte ordinaire : une requête
 * `select id, username, email, mt_sync_token, coach_memory, stripe_customer_id`
 * sur `profiles` rendait 200 et TROIS lignes d'autres personnes, colonnes
 * sensibles comprises. La même requête en `anon` rend 401 (« permission denied
 * for table profiles ») depuis `migrations/20260915_anon_column_grants.sql`,
 * qui a rendu à `anon` exactement six colonnes sûres.
 *
 * ⚠️⚠️ `mt_sync_token` N'EST PAS UNE DONNÉE, C'EST UNE CLÉ D'ÉCRITURE :
 * `/api/sync/push` et `/api/sync/tradingview` n'authentifient QUE par elle.
 *
 * ── CE QUE CE CLIENT CHANGE, ET CE QU'IL NE CHANGE PAS ──────────────────────
 *
 * Il ne referme pas le trou : un compte curieux peut toujours interroger
 * PostgREST directement. Il enlève la DERNIÈRE raison de laisser la politique
 * RLS ouverte aux comptes connectés : la page publique n'a plus besoin d'eux.
 * La fermeture elle-même est une migration, `20260916_profils_publics_rls.sql`.
 *
 * ⚠️ ET IL NE CHANGE RIEN À L'AFFICHAGE : la page `/profile/[username]` ne lit
 * jamais la session du visiteur et montre la même chose à tout le monde. Son
 * rendu pour un visiteur connecté devient simplement identique à celui qu'un
 * visiteur déconnecté obtient déjà.
 */
export function creerClientAnonyme() {
  return creerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
