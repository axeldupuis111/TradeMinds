-- Generic per-user, per-feature, per-day rate limit for the secondary AI routes
-- (session-debrief, monthly-review, goals/interpret, parse-strategy,
-- economic-calendar/explain). analyze + chat-coach keep their own plan quotas.
--
-- Anti-abuse only: the limits are generous; the goal is to stop a single account
-- from running up Anthropic costs by spamming an endpoint.
--
-- The route helper (lib/api-auth rateLimitAi) fails OPEN if this isn't deployed
-- yet, so applying it is safe at any time.

create table if not exists ai_usage (
  user_id uuid  not null references profiles(id) on delete cascade,
  feature text  not null,
  day     date  not null,
  count   int   not null default 0,
  primary key (user_id, feature, day)
);

alter table ai_usage enable row level security;
-- No RLS policy: only the SECURITY DEFINER function below touches this table.

-- Atomically reserve one usage unit. Returns allowed + the post-increment count.
create or replace function consume_ai_usage(
  p_user_id uuid,
  p_feature text,
  p_limit   int,
  p_day     date
)
returns table(allowed boolean, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into ai_usage(user_id, feature, day, count)
  values (p_user_id, p_feature, p_day, 1)
  on conflict (user_id, feature, day)
    do update set count = ai_usage.count + 1
  returning count into new_count;

  if new_count > p_limit then
    -- over the limit: undo the increment so the count can't run away
    update ai_usage set count = count - 1
      where user_id = p_user_id and feature = p_feature and day = p_day;
    return query select false, p_limit;
  end if;

  return query select true, new_count;
end;
$$;

grant execute on function consume_ai_usage(uuid, text, int, date) to authenticated;

-- Housekeeping: callers can periodically delete old rows; small table otherwise.
