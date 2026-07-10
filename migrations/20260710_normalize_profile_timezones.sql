-- profiles.timezone stockait les libellés de l'ancien menu Paramètres
-- (« UTC+1 », « UTC-5 »…), qui ne sont pas des identifiants IANA : l'API Intl
-- les rejette et tous les gates « heure locale » des crons (rappel quotidien,
-- rapport hebdo, réactivation, streak-guard, quotas IA) retombaient sur UTC.
-- On convertit chaque libellé vers la zone IANA de la ville affichée dans
-- l'ancien menu (même promesse utilisateur, avec le bon régime d'heure d'été).
-- Le code garde une table de traduction équivalente (lib/timezone.ts) pour les
-- clients pas encore rechargés qui réécriraient une ancienne valeur.

update profiles
set timezone = case timezone
  when 'UTC+1'    then 'Europe/Paris'
  when 'UTC+2'    then 'Europe/Helsinki'
  when 'UTC+3'    then 'Europe/Moscow'
  when 'UTC+4'    then 'Asia/Dubai'
  when 'UTC+5:30' then 'Asia/Kolkata'
  when 'UTC+8'    then 'Asia/Singapore'
  when 'UTC+9'    then 'Asia/Tokyo'
  when 'UTC-5'    then 'America/New_York'
  when 'UTC-6'    then 'America/Chicago'
  when 'UTC-7'    then 'America/Denver'
  when 'UTC-8'    then 'America/Los_Angeles'
end
where timezone in (
  'UTC+1','UTC+2','UTC+3','UTC+4','UTC+5:30',
  'UTC+8','UTC+9','UTC-5','UTC-6','UTC-7','UTC-8'
);
