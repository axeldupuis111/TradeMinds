-- ============================================================================
-- LE PROFIL PUBLIC EXPOSAIT LE JETON DE SYNCHRONISATION, ET LES E-MAILS.
-- ============================================================================
--
-- ── CE QUI ÉTAIT LISIBLE, PAR N'IMPORTE QUI ─────────────────────────────────
--
-- La clé `anon` est publiée dans le bundle de chaque page : tout le monde l'a.
-- La seule chose qui protège les données est la politique RLS de chaque table,
-- et RLS filtre les LIGNES, jamais les COLONNES.
--
-- La politique de `profiles` laisse lire les lignes `public_profile = true`,
-- ce dont la page /profile/[username] a besoin. Mais elle les laisse lire EN
-- ENTIER. Mesuré le 2026-09-15 sur la production, sans aucun compte :
--
--   select * from profiles  ->  4 lignes, 31 colonnes, dont
--       mt_sync_token       le jeton de synchronisation
--       email               l'adresse du trader
--       stripe_customer_id  son identifiant de facturation
--       coach_memory        les notes privées que le coach garde sur lui
--
-- ⚠️⚠️ `mt_sync_token` N'EST PAS UNE DONNÉE, C'EST UNE CLÉ D'ÉCRITURE.
-- `/api/sync/push` et `/api/sync/tradingview` n'authentifient QUE par lui :
-- son porteur peut écrire des trades dans le journal de ces comptes, y pousser
-- des soldes, et donc fausser le gardien de challenge. Il est publié avec le
-- profil depuis que le profil public existe.
--
-- `trades` laissait aussi lire `notes`, les notes personnelles que le trader
-- écrit sur ses propres trades. La page publique n'affiche ni P&L par trade ni
-- notes : elle en calcule un taux de réussite.
--
-- ── LA CORRECTION ───────────────────────────────────────────────────────────
--
-- PostgreSQL sait restreindre par COLONNE, ce que RLS ne sait pas faire. On
-- retire à `anon` le droit de tout lire, et on lui rend exactement les colonnes
-- que la page publique consulte, filtres et tris compris.
--
-- ⚠️ `authenticated` n'est PAS touché : un utilisateur connecté garde son accès
-- complet, borné à ses propres lignes par RLS.
--
-- ⚠️⚠️ APRÈS CETTE MIGRATION, LES QUATRE JETONS EXPOSÉS RESTENT COMPROMIS.
-- Ils ont été publiquement lisibles ; les faire tourner est une décision qui
-- appartient à Axel, parce qu'elle coupe la synchro des EA installés tant que
-- le trader n'a pas recopié son nouveau jeton.
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
-- La page lit : username (recherche), id, username, public_profile, plan,
-- founding_member. Rien d'autre.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id,
  username,
  public_profile,
  plan,
  founding_member,
  founding_since
) ON public.profiles TO anon;

-- ── trades ──────────────────────────────────────────────────────────────────
-- La page lit open_time, pnl, commission, swap pour en tirer un taux de
-- réussite et une courbe, et emotion pour la série de discipline. `user_id`,
-- `is_demo` et `id` sont nécessaires parce qu'ils servent de FILTRE et de TRI :
-- PostgREST exige le droit de lecture sur une colonne filtrée.
--
-- ⚠️⚠️ `is_demo` DOIT ÊTRE ACCORDÉE, ET CE N'EST PAS UN DÉTAIL. Le code retombe
-- sur une lecture SANS le filtre quand l'erreur mentionne « is_demo » (repli
-- prévu pour une base non migrée). Un refus de permission porterait ce mot dans
-- son message : les trades de démonstration entreraient alors dans les chiffres
-- montrés à des inconnus, ce que la règle écrite dans la page interdit.
REVOKE SELECT ON public.trades FROM anon;
GRANT SELECT (
  id,
  user_id,
  open_time,
  pnl,
  commission,
  swap,
  emotion,
  is_demo
) ON public.trades TO anon;

-- ── session_reviews ─────────────────────────────────────────────────────────
-- La page lit created_at, discipline_score, analysis, et compte les lignes.
REVOKE SELECT ON public.session_reviews FROM anon;
GRANT SELECT (
  id,
  user_id,
  created_at,
  discipline_score,
  analysis
) ON public.session_reviews TO anon;

-- `achievements` n'expose que id, user_id, key, unlocked_at : rien à restreindre.
