-- ============================================================================
-- LA MOITIÉ QUI RESTAIT : UN COMPTE ORDINAIRE LISAIT ENCORE LES JETONS.
-- ============================================================================
--
-- ── CE QUI EST MESURÉ, ET QUAND ─────────────────────────────────────────────
--
-- `migrations/20260915_anon_column_grants.sql` a fermé la fuite ANONYME, et
-- elle est bien fermée : en production, avec la clé publique, `select * from
-- profiles` rend 401 « permission denied for table profiles », tandis que
-- `select id, username` rend 200. Vérifié le 2026-09-16.
--
-- ⚠️⚠️ MAIS LE CAS CONNECTÉ, LUI, ÉTAIT TOUJOURS OUVERT. Le 2026-09-16, depuis
-- un compte ordinaire du produit et rien d'autre que son propre jeton de
-- session :
--
--   select id, username, email, mt_sync_token, coach_memory, stripe_customer_id
--   from profiles
--
--   -> 200, QUATRE lignes : la sienne, et les TROIS autres profils publics,
--      avec `email`, `mt_sync_token` et `stripe_customer_id` renseignés sur les
--      trois, et `coach_memory` sur deux d'entre eux.
--
-- ⚠️⚠️ `mt_sync_token` N'EST PAS UNE DONNÉE, C'EST UNE CLÉ D'ÉCRITURE.
-- `/api/sync/push` et `/api/sync/tradingview` n'authentifient QUE par elle :
-- son porteur écrit des trades dans le journal de ces comptes, y pousse des
-- soldes, et fausse donc le gardien de challenge.
--
-- ⚠️ ET LA SURFACE GRANDIT. Depuis `e29e2d3`, le profil public n'est plus
-- réservé à un plan payant : chaque nouveau profil rendu public ajoute une
-- ligne lisible par les cinquante et un comptes.
--
-- ── POURQUOI UN PRIVILÈGE DE COLONNE NE SUFFIT PAS ──────────────────────────
--
-- Un GRANT est global au RÔLE. On veut « toutes les colonnes de MA ligne,
-- quelques colonnes des lignes publiques » : les colonnes et les lignes ne se
-- composent pas. Retirer `email` à `authenticated` couperait chacun de son
-- propre e-mail, dont la page Réglages a besoin.
--
-- La correction est donc au niveau RLS : le rôle `authenticated` ne voit plus
-- QUE sa propre ligne. Les profils publics restent lisibles par `anon`, à qui
-- la migration précédente a rendu exactement six colonnes sûres.
--
-- ── CE QUI REND CETTE MIGRATION SÛRE AUJOURD'HUI ────────────────────────────
--
-- Elle ne l'était pas hier, et c'est pour ça qu'elle n'avait pas été écrite :
-- `/profile/[username]` lisait ses données avec `lib/supabase/server.ts`, qui
-- TRANSMET LES COOKIES du visiteur. Un visiteur connecté lisait donc la page en
-- `authenticated` ; lui retirer la vue des lignes publiques aurait affiché
-- « profil introuvable » à tous les utilisateurs connectés du produit.
--
-- La page lit désormais avec `lib/supabase/anonyme.ts`, un client sans cookies.
-- Connecté ou non, le visiteur la lit en `anon`, exactement comme le fait déjà
-- un visiteur déconnecté aujourd'hui, ce qui marche et est vérifiable depuis
-- l'extérieur. L'image Open Graph, elle, lit avec la clé de service, côté
-- serveur, et ne sélectionne que `id` et `username`.
--
-- ⚠️ À APPLIQUER DANS CET ORDRE : le code doit être déployé AVANT cette
-- migration. Le déploiement de `lib/supabase/anonyme.ts` est sans effet tant que
-- la politique reste ouverte ; l'inverse ne l'est pas.
--
-- ⚠️⚠️ APRÈS CETTE MIGRATION, LES JETONS EXPOSÉS RESTENT COMPROMIS. Ils ont été
-- lisibles par tout le monde puis par tout compte. Les faire tourner est une
-- décision d'Axel : elle coupe la synchro des EA installés tant que le trader
-- n'a pas recopié son nouveau jeton.
--
-- ── VÉRIFICATION ────────────────────────────────────────────────────────────
--
--   npm run verif:acces
--
-- Le script regarde le produit du DEHORS, avec la clé publique ET avec un vrai
-- jeton de session, et sort en erreur tant qu'une colonne sensible est lisible.
-- ============================================================================

-- ── Inventaire avant/après, à lire dans la sortie ───────────────────────────
-- (aucun effet, mais la liste des politiques dit ce qui va être remplacé)
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;

-- ── profiles ────────────────────────────────────────────────────────────────
-- ⚠️ ON NE TOUCHE QUE LE SELECT. Les politiques d'INSERT et d'UPDATE restent
-- telles quelles : ce n'est pas l'écriture qui fuit.
--
-- ⚠️ Le nom exact des politiques existantes dépend de ce que l'inventaire
-- ci-dessus affiche. Adapter les DROP si les noms diffèrent, et ne rien
-- supprimer qu'on n'a pas lu.
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

-- 1. Chacun lit sa propre ligne, ENTIÈREMENT. C'est ce dont Réglages a besoin
--    (son e-mail, son jeton de synchro, sa mémoire coach).
create policy "profil: chacun lit le sien"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- 2. Les profils publics restent lisibles SANS COMPTE, et seulement par `anon`,
--    à qui la migration du 2026-09-15 a rendu six colonnes et pas une de plus.
--    C'est par ce rôle que la page /profile/[username] lit désormais, quel que
--    soit le visiteur.
create policy "profil public: lisible sans compte"
  on public.profiles for select
  to anon
  using (public_profile = true);

-- ── trades et session_reviews ───────────────────────────────────────────────
-- Même forme, même raison : la page publique en tire un taux de réussite et une
-- courbe, jamais les notes ni les montants par trade.
--
-- ⚠️ `is_demo` DOIT RESTER ACCORDÉE À `anon` (voir la migration précédente) :
-- le code retombe sur une lecture SANS filtre quand l'erreur mentionne
-- « is_demo », et les trades de démonstration entreraient dans les chiffres
-- montrés à des inconnus.
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename in ('trades', 'session_reviews')
order by tablename, policyname;

-- ⚠️ LES DROP/CREATE DE CES DEUX TABLES NE SONT PAS ÉCRITS ICI À DESSEIN :
-- leurs politiques portent aussi l'accès du tableau de bord de chacun à ses
-- propres lignes, et se tromper de nom enferme tout le monde hors de son
-- journal. À poser après avoir lu l'inventaire ci-dessus, une table à la fois,
-- en revérifiant `npm run verif:acces` entre les deux.
