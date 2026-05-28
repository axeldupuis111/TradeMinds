# PHASE 5 — Direction artistique "Terminal de précision" (KPI Dashboard)

## Périmètre

Uniquement les 4 KPI cards du haut du Dashboard. Aucune autre page/section touchée.

## Fichiers créés / modifiés

| Fichier | Statut | Rôle |
|---|---|---|
| `app/globals.css` | Modifié | Nouveaux tokens `--accent-glow`, `--card-grad-top/bot`, `--glow-shadow`, `--sheen` + classes `.kpi-premium`, `.sparkline-line` |
| `components/dashboard/KpiCardPremium.tsx` | **Nouveau** | Composant carte premium réutilisable |
| `components/dashboard/Sparkline.tsx` | **Nouveau** | Mini-sparkline SVG animée |
| `components/dashboard/ScoreRing.tsx` | Modifié | Animation RAF, dégradé gradient, glow filter dark |
| `components/dashboard/WinRateGauge.tsx` | Modifié | Animation RAF via strokeDasharray, glow filter dark |
| `components/dashboard/KpiCards.tsx` | **Réécrit** | Utilise KpiCardPremium + CountUp + Sparkline |
| `components/dashboard/DashboardContent.tsx` | Modifié | Ajout `todayPnlSeries` (cumul P&L du jour) |

## Ce qui a été implémenté

### Tokens effet (globals.css)
- `--accent-glow`: cyan vif `#00E5D0` en dark, teal atténué `#00A8AC` en light
- `--card-grad-top/bot`: dégradé `#121218 → #0b0b11` en dark, `#fff → #fafafc` en light
- `--glow-shadow`: ombre portée profonde dark / ombre colorée cyan subtile light
- `--sheen`: `rgba(255,255,255,.14)` en dark / `rgba(0,0,0,.04)` en light

### KpiCardPremium
- Fond en dégradé 160° via `linear-gradient(rgb(var(--card-grad-top/bot)))`
- Sheen supérieur : div 1px hauteur avec `background: var(--sheen)`
  - Dark → ligne lumineuse blanche subtile
  - Light → ombre intérieure top (dark 4%) façon Stripe/Linear
- Aura colorée **dark uniquement** : `radial-gradient` elliptique en coin top-right
  - `rgb(var(--accent-glow) / 0.18)` pour cyan
  - `rgb(var(--profit) / 0.18)` pour green  
  - `rgb(var(--warning) / 0.18)` pour amber
- Ombre portée via `var(--glow-shadow)` inline style
- Hover lift `translateY(-4px)` via `.kpi-premium` CSS class
- `@media (prefers-reduced-motion)` : transition none, transform none

### Mode clair — pas d'aura, profondeur par l'ombre colorée
Décision : en light mode, l'aura est **supprimée** (bloc conditionnel `{isDark && ...}`).
La profondeur vient du gradient clair-sur-clair + `--glow-shadow` avec un cyan teinté.
Résultat : raffiné façon Stripe, sans taches de couleur sur fond blanc.

### ScoreRing amélioré
- Animation RAF `circumference → targetOffset` ease-out cubique en 1.5s
- Dégradé `linearGradient` profit → accent-glow **uniquement pour score ≥ 75 en dark**
  (préserve la couleur sémantique : warning/loss gardent leur couleur solide)
- Filtre SVG `feGaussianBlur(2) + feMerge` en dark mode uniquement
- IDs SVG uniques via `useId()` (évite les conflits entre instances)

### WinRateGauge amélioré
- Abandonne `buildFillPath()` dynamique → plein arc `TRACK_PATH` avec `strokeDasharray/strokeDashoffset`
- Animation RAF identique à ScoreRing
- Même filtre glow dark-only

### Sparkline
- Courbe SVG avec dégradé area (`linearGradient` vertical couleur → transparent)
- Couleur sémantique : `rgb(var(--profit))` ou `rgb(var(--loss))` selon `positive` prop
- Animation de tracé via trick CSS `stroke-dasharray: 1000 + @keyframes sparkline-draw`
  (pas besoin de JS/getTotalLength — marche pour tout path < 1000px)
- `@media (prefers-reduced-motion)` : animation désactivée, tracé immédiat
- Si `data.length < 2` : retourne `null` (pas de fake data)

### KpiCards réécrit
- Card 1 Score : CountUp(score) + "/100" réduit + ScoreRing md + aura cyan
- Card 2 Trades : CountUp(weekCount) + WinRateGauge + aura green
- Card 3 P&L : CountUp(|todayPnl|, prefix sign, suffix "€") + Sparkline (ou icône arrow fallback)
- Card 4 Compte : firm name + icône Wallet + barre challengePct + lien manage

### Data flow Sparkline
`DashboardContent` calcule `todayPnlSeries = filteredToday.map(cumul P&L)` via `useMemo`.
Passe à `<KpiCards todayPnlSeries={...} />`. Nouveau prop ajouté à `KpiCardsProps`.

## Décisions techniques

| Choix | Raison |
|---|---|
| Aura rendue via `useTheme()` | Détection client-side, init "dark" → pas de hydration mismatch |
| Tokens dans `var(--xxx)` pour gradient inline | Évite tout hex hardcodé hors SVG internes |
| `stroke-dasharray: 1000` pour sparkline | Plus simple que getTotalLength(), fiable pour paths < 1000px |
| Animation RAF one-shot (no infinite) | Performance : pas de JS/GPU tournant en continu |
| `will-change: transform` sur `.kpi-premium` | Crée un compositor layer pour un hover smooth |
| Gradient ScoreRing : score ≥ 75 dark seulement | Pas de gradient sur les états warning/loss (moins esthétique) |

## Points à revoir avant merge

- [ ] Valider le preview Vercel en **dark mode** : dégradé de fond, sheen, aura, glow rings
- [ ] Valider en **light mode** : fond clair propre, ombre colorée, pas d'aura
- [ ] Vérifier l'animation des rings sur mobile (performance RAF sur mid-range Android)
- [ ] Vérifier CountUp avec `todayPnl = 0` (prefix "+" affiche "+0,00 €" — acceptable)
- [ ] Si la Sparkline semble trop petite à 80×36, augmenter à 100×44 dans KpiCards
- [ ] Le dégradé `linearGradient` sur ScoreRing en `sm` size (analytics KPI row) peut être visually subtle — acceptable
- [ ] Tester `prefers-reduced-motion` activé : affichage immédiat des valeurs finales ✓

## Non fait (hors périmètre)

- Extension aux autres sections du Dashboard (GoalsStreaks, DayState, equity curve)
- Extension à la page Analytics
- Dark/light toggle de screenshot pour validation visuelle
