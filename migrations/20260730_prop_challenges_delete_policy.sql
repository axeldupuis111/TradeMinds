-- ============================================================
-- prop_challenges : politique de SUPPRESSION manquante.
--
-- La table n'avait que INSERT / SELECT / UPDATE. Or la page Compte propose bien
-- de supprimer un compte de trading (handleDeleteAccount et handleDeleteHistory
-- dans app/dashboard/challenge/page.tsx).
--
-- Sans policy DELETE, PostgREST ne renvoie AUCUNE erreur : RLS filtre les lignes
-- et le delete en supprime zéro. Le code part donc dans sa branche succès,
-- affiche « compte supprimé », puis le rechargement fait réapparaître le compte.
-- Sur le plan gratuit (1 compte maximum), un utilisateur qui s'est trompé de
-- saisie se retrouvait bloqué sans recours.
--
-- Même cause que l'accumulation des comptes de démonstration du 2026-07-30.
--
-- ⚠️ À vérifier après application : le comportement de la clé étrangère
-- trades.challenge_id. Si elle est en RESTRICT, supprimer un compte auquel des
-- trades sont rattachés renverra désormais une vraie erreur de contrainte (ce
-- qui est déjà mieux qu'un faux succès, mais mérite alors un message clair ou
-- un ON DELETE SET NULL).
-- ============================================================

DROP POLICY IF EXISTS "Users can delete own challenges" ON prop_challenges;

CREATE POLICY "Users can delete own challenges"
ON prop_challenges
FOR DELETE
USING (auth.uid() = user_id);
