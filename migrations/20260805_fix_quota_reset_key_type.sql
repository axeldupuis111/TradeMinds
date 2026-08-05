-- Fix : les quotas atomiques ne fonctionnaient pas en production.
--
-- profiles.daily_ai_reset / daily_chat_reset sont des colonnes DATE, alors que
-- consume_quota / refund_quota (migration 20260615_atomic_ai_quota.sql) les
-- comparent à un paramètre TEXT. Postgres levait donc systématiquement :
--   « operator does not exist: date = text »
--
-- Conséquences observées en prod (incident du 2026-08-03, 17:59 UTC) :
--   * consume_quota échouait → repli silencieux sur le chemin legacy
--     (non atomique) : la consommation marchait, mais sans verrou de ligne ;
--   * refund_quota échouait AUSSI → une analyse IA qui plante était quand même
--     décomptée du quota du trader. C'est le bug qui a coûté une analyse.
--
-- Correctif : comparer la colonne castée en texte (`::text` donne YYYY-MM-DD,
-- exactement le format produit par localDateKey / weekStartLocalKey) et écrire
-- la clé castée en date. Fonctionne que la colonne soit date ou text.

create or replace function public.consume_quota(
  p_user_id  uuid,
  p_feature  text,
  p_limit    int,
  p_reset_key text
)
returns table(allowed boolean, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Serialize concurrent consumers of the same profile row.
  perform 1 from profiles where id = p_user_id for update;

  if p_feature = 'analyze' then
    select case
             when daily_ai_reset::text is distinct from p_reset_key then 0
             else coalesce(daily_ai_count, 0)
           end
      into v_count
      from profiles
     where id = p_user_id;

    if v_count >= p_limit then
      return query select false, v_count;
      return;
    end if;

    update profiles
       set daily_ai_count = v_count + 1,
           daily_ai_reset = p_reset_key::date
     where id = p_user_id;

    return query select true, v_count + 1;

  elsif p_feature = 'chat' then
    select case
             when daily_chat_reset::text is distinct from p_reset_key then 0
             else coalesce(daily_chat_count, 0)
           end
      into v_count
      from profiles
     where id = p_user_id;

    if v_count >= p_limit then
      return query select false, v_count;
      return;
    end if;

    update profiles
       set daily_chat_count = v_count + 1,
           daily_chat_reset = p_reset_key::date
     where id = p_user_id;

    return query select true, v_count + 1;

  else
    raise exception 'consume_quota: unknown feature %', p_feature;
  end if;
end;
$$;

create or replace function public.refund_quota(
  p_user_id  uuid,
  p_feature  text,
  p_reset_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_feature = 'analyze' then
    update profiles
       set daily_ai_count = greatest(0, coalesce(daily_ai_count, 0) - 1)
     where id = p_user_id
       and daily_ai_reset::text = p_reset_key;
  elsif p_feature = 'chat' then
    update profiles
       set daily_chat_count = greatest(0, coalesce(daily_chat_count, 0) - 1)
     where id = p_user_id
       and daily_chat_reset::text = p_reset_key;
  end if;
end;
$$;

grant execute on function public.consume_quota(uuid, text, int, text) to authenticated, service_role;
grant execute on function public.refund_quota(uuid, text, text)       to authenticated, service_role;
