-- Devise du compte de trading.
--
-- En prop firm on jongle couramment entre un compte en euros et un compte en
-- dollars. Jusqu'ici l'application suffixait « € » en dur : le montant était
-- juste, le symbole faux. La devise appartient au compte, pas à l'application.
--
-- `currency` est le choix de l'utilisateur à la création. `synced_currency`
-- (migration 20260730_synced_account_balance.sql) est ce que le broker annonce
-- via l'EA et fait autorité à l'affichage : voir lib/account-currency.ts.
-- Les deux colonnes coexistent pour pouvoir signaler un désaccord plutôt que de
-- modifier le choix de l'utilisateur dans son dos.

alter table prop_challenges
  add column if not exists currency text not null default 'EUR';

-- Liste volontairement courte : les devises réellement proposées par les prop
-- firms et les brokers CFD. `synced_currency` n'est pas contrainte, elle, car le
-- broker peut annoncer n'importe quoi (PLN, HUF...) et l'affichage sait retomber
-- sur le code plutôt que sur un symbole faux.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prop_challenges_currency_check'
  ) then
    alter table prop_challenges
      add constraint prop_challenges_currency_check
      check (currency in ('EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD', 'JPY'));
  end if;
end $$;

comment on column prop_challenges.currency is
  'Devise du compte choisie à la création. Repli d''affichage tant que le broker n''a pas annoncé la sienne via synced_currency.';
