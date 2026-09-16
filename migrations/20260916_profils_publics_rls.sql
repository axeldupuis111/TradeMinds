-- ============================================================================
-- LES LIGNES PUBLIQUES SONT LISIBLES PAR TOUT LE MONDE, Y COMPRIS PAR LES
-- COMPTES. ON LES RÉSERVE AU SEUL RÔLE `anon`.
-- ============================================================================
--
-- ── CE QUI EST MESURÉ, ET QUAND ─────────────────────────────────────────────
--
-- `migrations/20260915_anon_column_grants.sql` a fermé la fuite ANONYME, et
-- elle est bien fermée : en production, avec la clé publique, `select * from
-- profiles` rend 401 « permission denied for table profiles », tandis que
-- `select id, username` rend 200. Vérifié le 2026-09-16.
--
-- ⚠️⚠️ MAIS LE CAS CONNECTÉ, LUI, EST TOUJOURS OUVERT. Le 2026-09-16, depuis
-- un compte ordinaire du produit et rien d'autre que son propre jeton de
-- session :
--
--   select id, username, email, mt_sync_token, coach_memory, stripe_customer_id
--   from profiles
--
--   -> 200, QUATRE lignes : la sienne, et les TROIS autres profils publics,
--      avec `email`, `mt_sync_token` et `stripe_customer_id` renseignés sur
--      les trois. Les quatre profils publics sont en plan premium, donc les
--      quatre jetons sont utilisables.
--
-- ── CE QUE LE JETON PERMET EXACTEMENT, NI PLUS NI MOINS ─────────────────────
--
-- `/api/sync/push` (et `/api/sync/tradingview`) n'authentifient QUE par lui, et
-- ils ÉCRIVENT :
--
--   - insérer des trades clôturés dans le journal de ce compte ;
--   - pousser un solde et une equity (`applyAccountSnapshot`).
--
-- Ils ne RENDENT rien du journal : la réponse ne contient que des compteurs et
-- des motifs de refus. Ce n'est donc pas une lecture des données du trader, et
-- encore moins un accès au compte.
--
-- ⚠️ MAIS UNE ÉCRITURE DANS UN JOURNAL N'EST PAS ANODINE DANS CE PRODUIT-CI :
-- ce journal alimente le score de discipline, les analyses, le profil public et
-- le classement ; et le solde poussé alimente `resolveAccountBalance` et le
-- gardien de challenge, qui peut déclarer un challenge perdu. Le produit vend
-- un journal honnête : y écrire est précisément l'atteinte qui compte.
--
-- ⚠️⚠️ ET LE JETON N'EST PAS LE SEUL CHAMP EXPOSÉ. `email` l'est aussi sur les
-- quatre, ce qui est une donnée personnelle au sens du RGPD, tout comme
-- `coach_memory`, les notes privées que le coach garde sur le trader (vides
-- aujourd'hui : 2 caractères, mais la colonne se remplit à l'usage).
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
-- propre e-mail, dont la page Réglages a besoin. La correction est donc au
-- niveau RLS.
--
-- ── CE QUE L'INVENTAIRE DU 2026-09-16 A MONTRÉ, ET CE QU'IL CHANGE ──────────
--
-- Les politiques publiques sont posées `TO public`, ce qui en PostgreSQL veut
-- dire TOUS LES RÔLES, `anon` comme `authenticated` :
--
--   trades           « Public profile trades readable »   {public} SELECT
--                    « Users manage own trades »          {public} ALL
--                                                          auth.uid() = user_id
--   session_reviews  « Public profile reviews readable »  {public} SELECT
--                    « Users can read own reviews »       {public} SELECT
--                                                          auth.uid() = user_id
--
-- ⚠️ BONNE NOUVELLE : une politique « ses propres lignes » EXISTE DÉJÀ à côté
-- de chaque politique publique. Restreindre la publique au seul rôle `anon` ne
-- retire donc rien à personne sur SES données : les politiques RLS se
-- combinent par OU. C'est ce qui rend ce fichier beaucoup plus léger que prévu.
--
-- ⚠️ ET ON NE SUPPRIME RIEN : `ALTER POLICY ... TO anon` change le rôle en
-- place. Le retour arrière tient en une ligne (`TO public`).
--
-- ── CE QUI REND CETTE MIGRATION SÛRE AUJOURD'HUI ────────────────────────────
--
-- Elle ne l'était pas hier : `/profile/[username]` lisait ses données avec
-- `lib/supabase/server.ts`, qui TRANSMET LES COOKIES du visiteur. Un visiteur
-- connecté lisait donc la page en `authenticated` ; lui retirer la vue des
-- lignes publiques aurait affiché « profil introuvable » à tous les
-- utilisateurs connectés du produit.
--
-- La page lit désormais avec `lib/supabase/anonyme.ts`, un client sans cookies
-- (commit d3787d2, déployé et vérifié en production le 2026-09-16 : profil
-- rendu complet pour un visiteur connecté). L'image Open Graph, elle, lit avec
-- la clé de service et ne sélectionne que `id` et `username`.
--
-- ⚠️ À APPLIQUER DANS CET ORDRE : le code d'abord, cette migration ensuite.
--
-- ⚠️⚠️ APRÈS CETTE MIGRATION, LES QUATRE JETONS EXPOSÉS RESTENT COMPROMIS. Ils
-- ont été lisibles sans compte, puis par tout compte. Les faire tourner est une
-- décision séparée : elle coupe la synchro des EA installés tant que le trader
-- n'a pas recopié son nouveau jeton.
--
-- ── VÉRIFICATION ────────────────────────────────────────────────────────────
--
--   npm run verif:acces                      (cas anonyme)
--   npm run verif:acces -- --jeton <jwt>     (cas connecté)
--
-- Attendu après application : « profils visibles 1 ligne(s) ».
-- ============================================================================

-- ── 1. AVANT : ce qui est en place ──────────────────────────────────────────
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'trades', 'session_reviews')
order by tablename, policyname;

-- ── 2. Filet : chacun doit pouvoir lire SA ligne de `profiles` ──────────────
-- ⚠️ POSÉ AVANT DE RESTREINDRE QUOI QUE CE SOIT. Sur `trades` et
-- `session_reviews`, l'inventaire montre que cette politique existe déjà ; sur
-- `profiles`, on ne le sait qu'après avoir lu la sortie de l'étape 1. La créer
-- est sans risque : deux politiques permissives se combinent par OU, donc au
-- pire elle fait double emploi.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profil: chacun lit le sien'
  ) then
    execute 'create policy "profil: chacun lit le sien" on public.profiles '
         || 'for select to authenticated using (auth.uid() = id)';
    raise notice 'filet posé : « profil: chacun lit le sien »';
  else
    raise notice 'filet déjà en place';
  end if;
end $$;

-- ── 3. Les politiques « profil public » passent au seul rôle `anon` ─────────
-- On ne cible pas des NOMS (ils diffèrent d'une table à l'autre) mais la FORME :
-- une politique de SELECT, ouverte à tous les rôles, dont la condition parle de
-- `public_profile`. C'est exactement la définition de ce qu'on veut restreindre.
do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'trades', 'session_reviews')
      and cmd = 'SELECT'
      and roles = '{public}'
      and qual like '%public_profile%'
  loop
    execute format('alter policy %I on public.%I to anon', p.policyname, p.tablename);
    raise notice 'restreinte à anon : %.%', p.tablename, p.policyname;
  end loop;
end $$;

-- ── 4. APRÈS : la même liste, pour lire ce qui a changé ─────────────────────
-- Attendu : les politiques « public profile … » portent maintenant {anon},
-- les politiques « own » restent {public}.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'trades', 'session_reviews')
order by tablename, policyname;

-- ── RETOUR ARRIÈRE, si le profil public cassait ─────────────────────────────
-- Rien n'a été supprimé : il suffit de remettre le rôle.
--
--   alter policy "Public profile trades readable"  on public.trades          to public;
--   alter policy "Public profile reviews readable" on public.session_reviews to public;
--   -- et la politique équivalente sur profiles, dont le nom sort de l'étape 1.
