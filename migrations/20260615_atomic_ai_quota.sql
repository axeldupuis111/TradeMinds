-- Atomic AI quota accounting
--
-- Before this migration the daily AI / chat quota was enforced with a
-- read-modify-write in two separate round trips (checkQuota then incrementQuota).
-- Two concurrent requests could both read the same count and both write
-- count + 1, letting a user exceed their limit and triggering extra (paid)
-- Claude calls. These functions make "check and consume" a single atomic
-- statement under a row lock, and add a refund used when the AI call fails
-- after a slot was reserved.
--
-- Columns used on public.profiles:
--   daily_ai_count   / daily_ai_reset    (feature = 'analyze')
--   daily_chat_count / daily_chat_reset  (feature = 'chat')
-- The *_reset column stores the period key (YYYY-MM-DD day, or the Monday of
-- the week for weekly resets). When it does not match p_reset_key the counter
-- is treated as 0, i.e. a new period has started.

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
             when daily_ai_reset is distinct from p_reset_key then 0
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
           daily_ai_reset = p_reset_key
     where id = p_user_id;

    return query select true, v_count + 1;

  elsif p_feature = 'chat' then
    select case
             when daily_chat_reset is distinct from p_reset_key then 0
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
           daily_chat_reset = p_reset_key
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
       and daily_ai_reset = p_reset_key;
  elsif p_feature = 'chat' then
    update profiles
       set daily_chat_count = greatest(0, coalesce(daily_chat_count, 0) - 1)
     where id = p_user_id
       and daily_chat_reset = p_reset_key;
  end if;
end;
$$;

grant execute on function public.consume_quota(uuid, text, int, text) to authenticated, service_role;
grant execute on function public.refund_quota(uuid, text, text)       to authenticated, service_role;
