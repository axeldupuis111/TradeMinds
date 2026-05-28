# PHASE 3 REPORT — Refonte visuelle du Dashboard

**Date :** 2026-05-28  
**Branch :** `feat/design-phase3-dashboard`  
**Objectif :** Refonte présentationnelle complète du Dashboard. Aucune logique métier modifiée.

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `components/dashboard/ScoreRing.tsx` | Anneau SVG réutilisable — couleur sémantique selon score (≥75 profit, ≥40 warning, <40 loss) |
| `components/dashboard/WinRateGauge.tsx` | Jauge semi-circulaire SVG — win rate en profit/warning/loss |
| `components/dashboard/KpiCards.tsx` | Les 4 KPI cards avec Card+Stat+ScoreRing+WinRateGauge |
| `components/dashboard/AiInsights.tsx` | Bloc Insights IA — icônes Lucide, layout colonne, sans emojis |
| `components/dashboard/DayState.tsx` | "État du jour" version Dashboard (DayStatus.tsx inchangé pour /session) |
| `PHASE3-REPORT.md` | Ce fichier |

## Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `components/dashboard/DashboardContent.tsx` | Orchestrateur refactorisé — compose les nouveaux sous-composants, en-tête refondu, badges, tokens |
| `components/charts/EquityCurve.tsx` | Wrap dans `<Card>`, `<CardTitle>`, CartesianGrid vertical=false |

## Fichiers NON modifiés (hors scope)

- `components/DayStatus.tsx` — toujours utilisé par `app/dashboard/session/page.tsx`
- `components/dashboard/GoalsStreaks.tsx` — hors scope Phase 3
- `components/charts/TradingCalendar.tsx` — hors scope
- `app/dashboard/page.tsx` — page serveur non touchée
- Toutes les autres pages

---

## Layout — vue mentale du nouveau Dashboard

```
┌─ Upsell banner (free only) ─────────────────────────────────────────────────┐
│ Bonjour, Axel          [Tous les comptes ▾] [↑ Importer] [✦ Analyser] [▶ Session] │
│ mercredi 28 mai 2026                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │SCORE DISCIP. │ │TRADES SEMAINE│ │P&L AUJOURD'HUI│ │COMPTE ACTIF  │        │
│ │  79/100      │ │  23          │ │  +342 €      │ │  FTMO        │        │
│ │  Bonne       │ │  14g · 9p    │ │  3 trades    │ │  [▓▓▓░░] 60%│        │
│ │  ○ ring vert │ │  [jauge 61%] │ │  [↑ vert]    │ │  Gérer →     │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─── État du jour (DayState) ────────────────────────────────────────────── ┐│
│ │ P&L / Trades du jour / Streak 🔥 (Flame icon) / Budget risque + barre    ││
│ └──────────────────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─── Insights IA ────────────┐ ┌─── Évolution du capital ──────────────────┐│
│ │ ✦ Insights IA  Voir tout → │ │              [area chart]                  ││
│ │ [💡] Pattern description   │ │                                             ││
│ │ [⚠] Recommandation        │ │                                             ││
│ │ [✓] Force identifiée       │ │                                             ││
│ └────────────────────────────┘ └───────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│ [TradingCalendar] · [GoalsStreaks]                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─── Trades récents ─────────┐ ┌─── Dernière analyse ──────────────────────┐│
│ │ 28/05  EURUSD  BUY  +12€   │ │ 28 mai 2026                    91/100 ✓   ││
│ │ 27/05  GBPUSD  SELL -8€   │ │ "Point fort identifié..."                  ││
│ └────────────────────────────┘ └───────────────────────────────────────────┘│
```

---

## Décisions techniques

### DayState vs DayStatus
`DayStatus.tsx` est toujours utilisé par `session/page.tsx`. Création de `DayState.tsx` dans `components/dashboard/` — même logique Supabase, présentation refaite (Card, tokens `foreground-subtle`, Flame icon).

### ScoreRing — couleur sémantique
- ≥ 75 : `rgb(var(--profit))` — vert
- ≥ 40 : `rgb(var(--warning))` — orange/ambre
- < 40 : `rgb(var(--loss))` — rouge
Pas d'accent cyan sur le score de discipline (métier ≠ branding).

### WinRateGauge — SVG semi-circulaire
Arc de 180° (gauche → droite, contournement vers le haut). Calcul :
- `angleDeg = 180 - (winRate/100) * 180`
- `sweep-flag = 0` (sens antihoraire = vers le haut en coords SVG)
- `large-arc-flag = 0` toujours (arc ≤ 180° du cercle complet)
- Couleur : ≥60% profit, ≥40% warning, <40% loss

### Émojis supprimés
- 👋 du greeting → rien (propre)
- 💡📊✅⚡ des insights → Lightbulb, AlertTriangle, CheckCircle2 de Lucide
- 🔥 du streak DayState → `<Flame />` de Lucide
- GoalsStreaks garde ses emojis (hors scope)

### Header action buttons
Links stylisés avec les mêmes classes Tailwind que le composant `Button` (via `cn()`). Pas de conversion en `<Button>` car ce sont des liens de navigation (sémantique HTML correcte).

### Badge BUY/SELL dans Recent Trades
Remplacé les spans inline `bg-profit/10 text-profit` hardcodés par le composant `<Badge variant="success|danger" size="sm">`.

### scoreColor prop conservée
`scoreColor: string` reste dans l'interface Props pour compatibilité avec `dashboard/page.tsx` (qui la passe encore). Elle n'est pas utilisée dans le rendu — KpiCards/ScoreRing calculent la couleur depuis `score` directement.

### EquityCurve
- `<Card padding="lg">` + `<CardTitle>` en lieu et place du div/h2 manuels
- `CartesianGrid vertical={false} strokeOpacity={0.5}` — supprime les lignes verticales, réduit le bruit visuel

---

## Points pour revue humaine

1. **`t("dash_challenge_target")`** — potentiellement manquant dans les fichiers de traduction. Un fallback `"objectif"` est fourni en dur. À vérifier dans `lib/translations/`.

2. **WinRateGauge text fill** — le texte SVG `fill="rgb(var(--foreground))"` est un attribut de présentation SVG (pas une classe Tailwind). Fonctionne en dark et light. Vérifier visuellement.

3. **ScoreRing size "md" / "lg"** — créés mais non utilisés pour l'instant. Utiles pour Phase 4 (Analytics, etc.).

4. **DayStatus.tsx** — toujours en place pour `/session`. Si le style visuel diverge trop du nouveau Dashboard, envisager de factoriser les deux en Phase 4.

5. **GoalsStreaks** — toujours avec emojis (🔥🏆💎🎯⭐🔒). Hors scope Phase 3, à migrer en Phase 4.

6. **KpiCards — card P&L** — fond teinté `bg-profit/[0.02]` uniquement quand positif. En light mode, vérifier que la teinte est visible mais subtile.

7. **`scoreColor` dans `dashboard/page.tsx`** — contient encore `text-green-400`, `text-yellow-400`, `text-orange-400` (non-tokens). Ce sont des valeurs mortes (plus utilisées au rendu). À nettoyer en Phase 4 en remplaçant par tokens dans `page.tsx`.
