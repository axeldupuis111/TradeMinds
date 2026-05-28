---
name: migration-notes-phase1
description: Documented exceptions and ambiguous cases from Phase 1 design token migration
metadata:
  type: project
---

# MIGRATION NOTES — Phase 1 Design Token Migration

## Exceptions — Hardcoded Hex Values Retained Intentionally

### 1. OG Image files (Edge Runtime)

**Files:**
- `app/opengraph-image.tsx`
- `app/[locale]/opengraph-image.tsx`

**Why:** These files run on the Edge Runtime via `next/og` / `ImageResponse`. The JSX is rendered as a static image server-side, not in the browser DOM. CSS custom properties (`var(--accent)`) cannot be resolved in this context because there is no document or computed style cascade available.

**Decision:** Inline hex values are required. The accent color has been updated from `#3b82f6` (old blue) to `#00D4D8` (new cyan-teal) to stay aligned with the new brand accent.

**Background colors** (`#09090b`, `#1a1a1f`) are also kept as hex — OG images are always dark by design.

---

### 2. Email HTML (send-reminders API route)

**File:** `app/api/send-reminders/route.ts`

**Why:** HTML emails are rendered by email clients (Gmail, Outlook, Apple Mail, etc.) which do not support CSS custom properties. All styles in email HTML must use explicit hex or RGB values.

**Decision:** Keep all hardcoded hex values in this file. The accent references in email HTML (`#3b82f6`) should be updated to `#00D4D8` in a future pass dedicated to email templates.

**Status:** Pending — not updated in Phase 1 to avoid scope creep.

---

## Ambiguous Cases — Resolved

### `bg-black/[0.03]` in NavItem hover state

Used in `components/sidebar/NavItem.tsx` for inactive item hover background:
```tsx
"hover:bg-black/[0.03]"
```

**Decision:** Kept as-is. This is an intentional low-opacity black overlay that works on both light and dark themes (slightly darkens whatever is underneath). It is not a semantic token — it's a UI micro-interaction. No equivalent CSS variable needed.

---

### `.hero-gradient` and `glow-*` animations in `globals.css`

These use hardcoded dark hex values (`#09090b`, `#0a1628`, `#0f172a`) for landing page gradients and glow effects.

**Decision:** Kept as-is. These are decorative, landing-page-only visual effects that are always rendered in `.force-dark` context. They would lose their intentional visual character if tokenized.

---

### `input:-webkit-autofill` background

```css
-webkit-box-shadow: 0 0 0 30px #1a1a1a inset !important;
-webkit-text-fill-color: #e5e5e5 !important;
```

**Decision:** Kept as-is. This is a browser hack that requires a concrete hex value — CSS variables are not resolved inside `-webkit-box-shadow` in all browsers that have the autofill yellow injection issue.
