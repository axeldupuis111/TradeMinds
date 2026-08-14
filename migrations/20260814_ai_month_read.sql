-- Rendre le compteur mensuel LISIBLE par le trader qui le consomme.
--
-- POURQUOI — la migration du 2026-08-06 disait explicitement : « ce n'est PAS
-- un budget mensuel visible, rien n'est affiché, personne d'honnête ne le
-- rencontre jamais ». Ce raisonnement tenait tant que le plafond valait environ
-- 3× l'usage d'un professionnel à plein temps : un fusible qu'on ne voit pas
-- parce qu'on ne le touche pas.
--
-- Il ne tient plus. Le 2026-08-14, le coach Premium est passé sur Sonnet 5 et
-- le plafond mensuel est descendu de 450 à 260 messages, soit 1,5× l'usage
-- intensif au lieu de 2,6×. Un fusible qu'on peut atteindre doit se voir AVANT
-- d'être atteint : découvrir sa limite en la heurtant, après avoir payé
-- 29,99 €, est la pire façon de l'apprendre.
--
-- CE QUE ÇA N'OUVRE PAS — la lecture seule, sur ses propres lignes. Les
-- écritures restent le monopole de `consume_ai_month` / `refund_ai_month`
-- (SECURITY DEFINER) : un client ne peut ni incrémenter, ni remettre à zéro,
-- ni voir l'usage d'un autre compte. Le disjoncteur reste inviolable, il
-- devient seulement honnête.

create policy "read own ai monthly usage"
  on ai_monthly_usage
  for select
  using (auth.uid() = user_id);
