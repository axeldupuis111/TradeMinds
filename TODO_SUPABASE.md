# Actions manuelles dans Supabase Dashboard

## Authentication > URL Configuration
- [ ] Site URL = https://tradediscipline.vercel.app (ou domaine custom si branché)
- [ ] Redirect URLs : ajouter
  - https://tradediscipline.vercel.app/**
  - https://tradediscipline.app/** (si domaine custom)
  - http://localhost:3000/** (pour dev local)

## Authentication > Emails (templates)

Règle générale, apprise le 2026-07-30 : **aucun template ne doit utiliser
`{{ .ConfirmationURL }}`**. Cette variable pointe vers `<projet>.supabase.co`,
alors que l'expéditeur est `noreply@tradediscipline.app`. Un mail signé d'un
domaine dont le bouton mène ailleurs est le schéma type du phishing : iCloud le
classait en indésirable (Gmail, plus tolérant, laissait passer). Tous les
templates passent donc par `/auth/confirm` sur notre domaine, avec
`{{ .TokenHash }}`. Le contenu à coller est versionné dans `email-templates/`,
prêt à copier tel quel dans le champ Body.

| Template Supabase | Fichier | Sujet |
|---|---|---|
| Confirm sign up | `email-templates/confirm-signup.html` | Confirme ton compte TradeDiscipline |
| Reset password | `email-templates/reset-password.html` | Réinitialise ton mot de passe TradeDiscipline |
| Magic link or OTP | `email-templates/magic-link.html` | Ton lien de connexion TradeDiscipline |
| Change email address | `email-templates/change-email.html` | Confirme ta nouvelle adresse email |
| Invite user | `email-templates/invite-user.html` | Tu es invité sur TradeDiscipline |

- [x] Confirm sign up (2026-07-30, testé bout en bout)
- [x] Reset password (2026-07-30, testé bout en bout)
- [x] Magic link or OTP
- [x] Change email address
- [x] Invite user

### À recoller (2026-08-17) — avertissement sur les risques

Les cinq fichiers ont été modifiés : ils portent désormais l'avertissement sur
les risques exigé par le NinjaTrader Vendor Program, dont l'annexe A vise
« all emails sent and received ». La version en ligne dans Supabase est donc
périmée tant que les fichiers n'ont pas été recollés.

- [ ] Confirm sign up
- [ ] Reset password
- [ ] Magic link or OTP
- [ ] Change email address
- [ ] Invite user

Le reste des emails (rappel quotidien, rapport hebdo, réactivation,
félicitations d'abonnement) part de notre code et porte déjà l'avertissement :
il est posé dans `lib/email-template.ts`, dans le gabarit partagé, pour qu'aucun
email de marque ne puisse partir sans. Rien à faire côté dashboard pour ceux-là.

Note sur le format `token_hash`, au-delà de la délivrabilité : `{{ .ConfirmationURL }}`
fait transiter le visiteur par `<projet>.supabase.co`, alors que `token_hash`
laisse le lien sur notre domaine et se vérifie par un appel serveur, dans
`app/auth/confirm/route.ts`.

**Correction du 2026-08-17.** Ce paragraphe affirmait que `token_hash` « sort du
flux PKCE ». C'est faux, et il vaut mieux le savoir avant de bâtir un
raisonnement dessus. Le jeton émis est bien préfixé `pkce_`, parce que
`lib/supabase/client.ts` utilise `createBrowserClient` de `@supabase/ssr`, dont
le flux PKCE est le défaut. Ce n'est pas le format du lien qui décide, c'est le
client qui a fait la demande.

Ce qui a été vérifié le 2026-08-17, en cliquant réellement le lien d'un email de
réinitialisation : `verifyOtp({ type, token_hash })` renvoie une session côté
serveur **malgré** le préfixe `pkce_`, et la page de choix du mot de passe
s'ouvre normalement. Le flux fonctionne.

Ce qui n'a PAS été vérifié : le cas d'un appareil à l'autre (demander depuis
l'appli installée, ouvrir le lien dans le navigateur du téléphone). C'est le
scénario que l'ancienne note prétendait couvrir. Ne pas le tenir pour acquis
sans l'avoir essayé.

## Migration à appliquer (2026-07-12) — récompenses de badges
- [ ] SQL Editor : exécuter `migrations/20260712_create_badge_awards.sql`
  (table badge_awards — badges persistants + récompenses : certificats,
  gels bonus, emblème classement. Fail-open : sans la table, le site
  fonctionne, seules les récompenses restent inactives.)
