-- ============================================================================
-- UN ÉVÉNEMENT PRODUIT PEUT N'APPARTENIR À PERSONNE
-- ============================================================================
--
-- POURQUOI
--
-- Le seul appel IA QUOTIDIEN du produit — le brief macro de 6 h, généré par le
-- cron `/api/macro-analysis/generate` — n'est journalisé nulle part. Il ne peut
-- pas l'être : `product_events.user_id` est NOT NULL et référence `profiles.id`,
-- et ce brief n'appartient à personne. Il est produit UNE fois et servi à tous
-- les abonnés premium.
--
-- Vérifié le 2026-09-18 dans la définition OpenAPI que PostgREST expose :
--   product_events required = ["id","user_id","event","created_at"]
--
-- Ce que ça coûte : sur les 43 jours de journalisation (2026-08-06 → 09-17), le
-- produit a mesuré 96 appels IA pour 2,06 € au total — coach 1,81 €, analyses
-- 0,22 €, stratégies 0,03 €, calendrier 0,001 €. Le brief macro, lui, tourne
-- TOUS LES JOURS avec Sonnet et jusqu'à cinq recherches web, plus trois
-- traductions Haiku. C'est très probablement le premier poste de dépense du
-- produit, et c'est le seul qu'on ne voit pas.
--
-- Attribuer ces appels à un profil (celui de l'administrateur, par exemple)
-- fausserait ses statistiques d'usage et ferait mentir tout calcul de coût par
-- utilisateur. Un événement système n'a pas de propriétaire : la colonne doit
-- pouvoir être nulle.
--
-- CE QUE ÇA NE CHANGE PAS
--
-- Les lignes existantes gardent leur `user_id`. La clé étrangère reste en place
-- pour celles qui en portent un. Les politiques RLS d'insertion par
-- l'utilisateur ne sont pas touchées : le cron écrit avec la clé de service.
-- ============================================================================

ALTER TABLE public.product_events
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.product_events.user_id IS
  'Le propriétaire de l''événement, ou NULL pour un événement SYSTÈME sans '
  'propriétaire (cron macro, tâches planifiées). Un tel événement porte '
  'meta.plan = ''systeme''.';

-- ----------------------------------------------------------------------------
-- LECTURE : les événements système ne doivent être visibles que de l'admin.
--
-- ⚠️ Sans cette policy, une ligne à `user_id IS NULL` n'est visible de personne
-- sous RLS (les policies comparent à auth.uid()), ce qui est le comportement
-- SÛR par défaut : le service role, lui, passe outre et c'est lui qui lit le
-- tableau de bord des coûts. On ne l'ouvre donc à personne d'autre.
-- ----------------------------------------------------------------------------
