-- Community challenges: which users have joined which challenge.
-- The challenges themselves are defined in code (lib/community-challenges.ts),
-- so no challenges table is needed — just who participates.

create table if not exists challenge_participations (
  user_id       uuid        not null references profiles(id) on delete cascade,
  challenge_key text        not null,
  joined_at     timestamptz not null default now(),
  primary key (user_id, challenge_key)
);

alter table challenge_participations enable row level security;

-- Users manage their own participation. The leaderboard aggregate is read by the
-- API with the service role, so no public read policy is needed here.
create policy "own participations"
  on challenge_participations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
