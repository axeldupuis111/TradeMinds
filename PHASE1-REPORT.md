# PHASE 1 REPORT — Design System Foundation Cleanup

**Date:** 2026-05-27  
**Branch:** `feat/exchange-sync`  
**Objective:** Make the codebase refactorable — migrate all color references to CSS token system without changing the visual appearance.

---

## Summary

6 steps completed. No visual regressions introduced. Light mode preserved. Public pages unaffected.

---

## Files Modified

### Design Tokens & Configuration

| File | Change |
|------|--------|
| `app/globals.css` | Extended `:root` and `html.light` with `--accent`, `--accent-hover`, `--accent-muted`, `--profit`, `--loss`, `--warning`, `--gold`, `--foreground-muted`, `--foreground-subtle`. Removed ~80-line hex override block. Removed duplicate `.tabular-nums`. Replaced global `*` transition with `.theme-transition`. Fixed `tbody tr:hover` to use CSS var. |
| `tailwind.config.ts` | Migrated all color definitions to CSS variable references. Added `foreground-muted`, `foreground-subtle`, `accent-hover`, `profit`, `loss`, `warning`, `gold` tokens. |

### Hooks & Context

| File | Change |
|------|--------|
| `lib/useChartColors.ts` | Completely rewritten to use `getComputedStyle(document.documentElement)` instead of hardcoded hex. Now theme-reactive. |
| `lib/ThemeContext.tsx` | `toggleTheme` updated to add/remove `.theme-transition` class during 300ms switch window. |
| `lib/ict-constants.ts` | `EMOTION_COLORS` updated to CSS variable references. |

### Components

| File | Change |
|------|--------|
| `components/Sidebar.tsx` | Completely rewritten with Lucide icons. All icon SVGs replaced with typed `LucideIcon` components. `NavItem` extracted to its own file. |
| `components/sidebar/NavItem.tsx` | **NEW FILE** — extracted from Sidebar, standalone NavItem component with Lucide icon support. |
| `components/charts/EquityCurve.tsx` | Chart colors via `useChartColors()` hook. |
| `components/charts/EmotionalTrendChart.tsx` | Line stroke and tooltip colors via CSS vars. |
| `components/dashboard/DashboardContent.tsx` | `MiniScoreCircle` color ternary via CSS vars. |
| `components/landing/LandingPage.tsx` | Mass replacement of ~30 hardcoded hex Tailwind classes with token equivalents. SVG colors tokenized. |
| `components/auth/PasswordRequirements.tsx` | `bg-[#1e1e1e]` → `bg-surface`. |
| `components/pages/LoginPage.tsx` | Input classes: hardcoded hex → semantic tokens. |
| `components/pages/ResetPasswordPage.tsx` | Input classes: hardcoded hex → semantic tokens. |
| `components/pages/MentionsLegalesPage.tsx` | `text-[#3b82f6]` → `text-accent`, border token. |
| `components/PublicHeader.tsx` | Border and background: hardcoded hex → tokens. |
| `components/profile/PublicProfileView.tsx` | SVG gradient and stroke colors → CSS var references. |
| `components/trades/TradeDetailPanel.tsx` | Checklist progress bar colors → CSS var references. |

### Pages

| File | Change |
|------|--------|
| `app/dashboard/analytics/page.tsx` | `PROFIT_COLOR`, `LOSS_COLOR`, `TOOLTIP_STYLE` constants; all chart inline styles tokenized. |
| `app/dashboard/analysis/page.tsx` | `ScoreCircle` strokeColor ternary → CSS vars. |
| `app/dashboard/upgrade/page.tsx` | `bg-[#1a1a1a]` → `bg-surface`. |
| `app/opengraph-image.tsx` | `ACCENT_COLOR` updated `#3b82f6` → `#00D4D8`. |
| `app/[locale]/opengraph-image.tsx` | `ACCENT_COLOR` updated `#3b82f6` → `#00D4D8`. |

### Documentation

| File | Change |
|------|--------|
| `AUDIT-DESIGN.md` | Created during audit phase. |
| `MIGRATION-NOTES.md` | **NEW** — documents exceptions and ambiguous cases. |
| `PHASE1-REPORT.md` | **NEW** — this file. |

---

## Dependencies Added

| Package | Reason |
|---------|--------|
| `lucide-react` | Replaces inline SVG icons in Sidebar with typed, consistent icon components. |

---

## Key Decisions

### New Brand Accent: `#00D4D8` (cyan-teal)
Replaced `#3b82f6` (blue) as the primary accent across all token references. Updated in both OG images. Email templates pending (see MIGRATION-NOTES.md).

### CSS Variable Format: RGB Channels
All CSS custom properties use space-separated RGB channels (`34 197 94`) rather than hex or `rgb()` syntax. This enables:
- Tailwind alpha utilities: `bg-profit/10`, `text-accent/50`  
- Modern CSS alpha: `rgb(var(--profit) / 0.1)`

### `.theme-transition` Class Instead of Global `*` Transition
The global `* { transition: ... }` rule was causing conflicts with Framer Motion and Recharts animations. Replaced with a targeted class added/removed during the 300ms theme-switch window only.

### `useChartColors` SSR Safety
The `readVar` helper returns an empty string when `window` is undefined (SSR). Chart colors are filled on mount via `useEffect`. Charts show correct colors after hydration.

---

## Exceptions (Not Tokenized)

See `MIGRATION-NOTES.md` for full details.

1. **OG image files** — Edge Runtime, no DOM, CSS vars not resolvable. Hex values required.
2. **Email HTML** (`app/api/send-reminders/route.ts`) — Email clients don't support CSS vars.
3. **`bg-black/[0.03]`** in NavItem hover — intentional transparent black overlay, not a semantic token.
4. **Hero gradient / glow animations** in `globals.css` — decorative, always in `.force-dark`.
5. **`input:-webkit-autofill`** override — browser hack requiring concrete hex values.

---

## Points for Human Review

1. **Email template accent color** — `app/api/send-reminders/route.ts` still references `#3b82f6` (old blue) in HTML email strings. Should be updated to `#00D4D8` in a dedicated email template pass.

2. **`hover:bg-black/[0.03]`** in NavItem — works on dark, verify it's subtle enough on light mode (white card background + near-transparent black = very slight gray). Currently the only place using raw `black` outside tokens.

3. **Recharts SVG color resolution** — inline `stroke="rgb(var(--profit))"` works in all modern browsers because SVG presentation attributes resolve CSS custom properties via the cascade. Verify this works in Safari 15 if that's a target.

4. **OG images visual** — both OG images now use `#00D4D8` (cyan-teal). The generated PNG should be reviewed visually to confirm the new accent color looks correct on the dark gradient background.

5. **`lucide-react` version pin** — check `package.json` to confirm the installed version is stable and compatible with the Next.js version in use.
