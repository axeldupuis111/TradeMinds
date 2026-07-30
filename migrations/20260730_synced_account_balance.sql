-- Solde réel du compte, poussé par le client de synchronisation (EA MetaTrader).
--
-- Jusqu'ici le solde affiché était reconstitué : account_size + somme des P&L des
-- trades importés. Deux conséquences : une erreur de saisie du capital initial
-- décalait tout, et les dépôts/retraits n'étaient jamais vus. L'EA connaît le
-- vrai solde (ACCOUNT_BALANCE) et l'equity en temps réel (ACCOUNT_EQUITY) : il
-- les envoie désormais à chaque battement de cœur (toutes les 60 s), même sans
-- trade fermé.
--
-- `synced_balance` sert d'ancre : le solde affiché vaut synced_balance + les
-- trades clôturés APRÈS synced_at (imports CSV ou trades manuels ajoutés depuis).
-- `account_size` reste la taille nominale du compte, base des pourcentages
-- d'objectif et de drawdown d'un challenge prop : elle ne bouge pas.

alter table prop_challenges
  add column if not exists synced_balance numeric,
  add column if not exists synced_equity numeric,
  add column if not exists synced_open_positions integer,
  add column if not exists synced_currency text,
  add column if not exists synced_at timestamptz;

comment on column prop_challenges.synced_balance is
  'Solde réel du compte au moment de synced_at, envoyé par le client de sync. Null = jamais synchronisé.';
comment on column prop_challenges.synced_equity is
  'Equity réelle (solde + P&L latent des positions ouvertes) au moment de synced_at.';
comment on column prop_challenges.synced_open_positions is
  'Nombre de positions ouvertes au moment de synced_at. 0 = equity == balance.';
comment on column prop_challenges.synced_currency is
  'Devise du compte telle que déclarée par le broker (EUR, USD...). Indicatif.';
comment on column prop_challenges.synced_at is
  'Horodatage du dernier état de compte reçu. Un écart < 15 min vaut "en direct".';
