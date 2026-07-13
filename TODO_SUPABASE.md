# Actions manuelles dans Supabase Dashboard

## Authentication > URL Configuration
- [ ] Site URL = https://tradediscipline.vercel.app (ou domaine custom si branché)
- [ ] Redirect URLs : ajouter
  - https://tradediscipline.vercel.app/**
  - https://tradediscipline.app/** (si domaine custom)
  - http://localhost:3000/** (pour dev local)

## Authentication > Email Templates
- [ ] Reset Password : coller le HTML de email-templates/reset-password.html
- [ ] Confirm Signup : à customiser
- [ ] Magic Link : à customiser
- [ ] Change Email Address : à customiser
- [ ] Invite User : à customiser

## Migration à appliquer (2026-07-12) — récompenses de badges
- [ ] SQL Editor : exécuter `migrations/20260712_create_badge_awards.sql`
  (table badge_awards — badges persistants + récompenses : certificats,
  gels bonus, emblème classement. Fail-open : sans la table, le site
  fonctionne, seules les récompenses restent inactives.)
