-- Cache du « plan de la semaine ».
--
-- Le composant WeeklyPlanCard appelle /api/weekly-plan à CHAQUE montage (donc à
-- chaque visite du dashboard) et à chaque changement de langue, et la route
-- régénérait le plan via Claude à chaque fois. Relevé en prod : un utilisateur
-- a déclenché 89 générations en un mois là où 4 suffisent.
--
-- Deux conséquences, l'une financière et l'autre produit : on payait 20 fois le
-- même plan, et le trader voyait un plan DIFFÉRENT à chaque chargement de page,
-- ce qui rend impossible de s'y tenir pendant la semaine.
--
-- Le plan est donc figé par (utilisateur, semaine ISO, langue) : généré une
-- fois, resservi ensuite. La route fait fail-open si cette table n'existe pas
-- encore, donc l'appliquer est sans risque à tout moment.

create table if not exists weekly_plans (
  user_id   uuid  not null references profiles(id) on delete cascade,
  week_key  text  not null,               -- clé ISO, ex. "2026-W32"
  lang      text  not null,               -- fr | en | de | es
  headline  text  not null,
  focuses   jsonb not null,               -- string[]
  created_at timestamptz not null default now(),
  primary key (user_id, week_key, lang)
);

alter table weekly_plans enable row level security;

-- Le trader lit son propre plan. L'écriture passe par la route serveur
-- (client user-scoped), donc une policy d'insertion sur soi-même suffit.
create policy "weekly_plans_select_own" on weekly_plans
  for select using (auth.uid() = user_id);

create policy "weekly_plans_insert_own" on weekly_plans
  for insert with check (auth.uid() = user_id);

-- Purge : les plans de plus de 8 semaines n'ont plus d'usage.
create index if not exists weekly_plans_created_at_idx on weekly_plans (created_at);
