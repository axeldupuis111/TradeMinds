-- Disjoncteur mensuel des routes IA.
--
-- POURQUOI — les plafonds étaient uniquement JOURNALIERS. « 2 analyses/jour »
-- semble raisonnable mais autorise 60 analyses par mois, là où un trader
-- professionnel à plein temps en fait 12. L'exposition mensuelle n'était donc
-- bornée par rien : pire cas mesuré à 83,49 €/mois pour un abonné Premium à
-- 29,99 €.
--
-- CE QUE CE N'EST PAS — un budget mensuel visible. Les plafonds journaliers ne
-- bougent pas, rien n'est affiché, il n'y a aucun crédit à gérer ni reliquat à
-- perdre en fin de mois. C'est un fusible, calé à environ 3× l'usage d'un
-- utilisateur intensif : personne d'honnête ne le rencontre jamais.
--
-- Le helper lib/api-auth fail-open si cette table n'est pas déployée, donc
-- l'appliquer est sans risque à tout moment.

create table if not exists ai_monthly_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  feature text not null,
  month   text not null,            -- "2026-08", dans le fuseau du trader
  count   int  not null default 0,
  -- Horodatage du déclenchement, pour n'alerter qu'une fois par mois.
  tripped_at timestamptz,
  primary key (user_id, feature, month)
);

alter table ai_monthly_usage enable row level security;
-- Aucune policy : seule la fonction SECURITY DEFINER ci-dessous y touche.

-- Relèvement manuel par compte. Un vrai passionné qui touche le plafond n'est
-- pas un abuseur : on lui remonte sa limite plutôt que de le murer.
alter table profiles
  add column if not exists ai_ceiling_multiplier numeric not null default 1;

-- Réserve une unité mensuelle de façon atomique.
-- Renvoie allowed, le compteur après incrément, et si l'alerte a déjà été
-- envoyée ce mois-ci (pour ne pas spammer à chaque appel bloqué).
create or replace function consume_ai_month(
  p_user_id uuid,
  p_feature text,
  p_limit   int,
  p_month   text
)
returns table(allowed boolean, current_count int, already_alerted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
  effective_limit int;
  was_tripped timestamptz;
begin
  -- Plafond effectif = plafond du plan × multiplicateur du compte.
  select greatest(1, round(p_limit * coalesce(ai_ceiling_multiplier, 1)))
    into effective_limit
    from profiles where id = p_user_id;
  if effective_limit is null then
    effective_limit := p_limit;
  end if;

  insert into ai_monthly_usage(user_id, feature, month, count)
  values (p_user_id, p_feature, p_month, 1)
  on conflict (user_id, feature, month)
    do update set count = ai_monthly_usage.count + 1
  returning count, tripped_at into new_count, was_tripped;

  if new_count > effective_limit then
    -- Au-delà : on annule l'incrément (le compteur ne s'emballe pas) et on
    -- marque le déclenchement la première fois seulement.
    update ai_monthly_usage
       set count = count - 1,
           tripped_at = coalesce(tripped_at, now())
     where user_id = p_user_id and feature = p_feature and month = p_month;
    return query select false, effective_limit, (was_tripped is not null);
  end if;

  return query select true, new_count, true;
end;
$$;

grant execute on function consume_ai_month(uuid, text, int, text) to authenticated;

-- Rendre une unité mensuelle quand le travail en aval a échoué (l'IA a planté,
-- la réponse était inexploitable…). Symétrique du remboursement journalier.
create or replace function refund_ai_month(
  p_user_id uuid,
  p_feature text,
  p_month   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_monthly_usage
     set count = greatest(0, count - 1)
   where user_id = p_user_id and feature = p_feature and month = p_month;
end;
$$;

grant execute on function refund_ai_month(uuid, text, text) to authenticated;

create index if not exists ai_monthly_usage_tripped_idx
  on ai_monthly_usage (tripped_at) where tripped_at is not null;
