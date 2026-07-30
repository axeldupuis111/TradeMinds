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

Note sur le format `token_hash`, au-delà de la délivrabilité : `{{ .ConfirmationURL }}`
déclenche le flux PKCE, qui exige un secret (le code verifier) stocké par le
navigateur **au moment de la demande**. Demander la réinitialisation depuis
l'appli installée puis ouvrir le lien dans le navigateur du téléphone = deux
stockages distincts, secret introuvable, aucune session ouverte. `token_hash` est
vérifié côté serveur et ne dépend d'aucun état local : c'est le seul des deux
formats qui fonctionne d'un appareil ou d'un contexte à l'autre.

## Migration à appliquer (2026-07-12) — récompenses de badges
- [ ] SQL Editor : exécuter `migrations/20260712_create_badge_awards.sql`
  (table badge_awards — badges persistants + récompenses : certificats,
  gels bonus, emblème classement. Fail-open : sans la table, le site
  fonctionne, seules les récompenses restent inactives.)
