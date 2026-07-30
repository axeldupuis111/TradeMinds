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

- [x] Confirm sign up (fait le 2026-07-30, testé bout en bout)
- [ ] Reset password (retester le parcours complet après collage : le lien passe
      désormais par /auth/confirm avec `type=recovery`)
- [ ] Magic link or OTP
- [ ] Change email address
- [ ] Invite user

## Migration à appliquer (2026-07-12) — récompenses de badges
- [ ] SQL Editor : exécuter `migrations/20260712_create_badge_awards.sql`
  (table badge_awards — badges persistants + récompenses : certificats,
  gels bonus, emblème classement. Fail-open : sans la table, le site
  fonctionne, seules les récompenses restent inactives.)
