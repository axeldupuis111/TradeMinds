# PHASE 2 REPORT — Composants UI réutilisables

**Date :** 2026-05-28  
**Branch :** `feat/design-phase2-ui`  
**Objectif :** Créer le set de composants présentationnels canoniques sans migrer aucune page existante.

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `lib/cn.ts` | Utilitaire de merge de classes — filtre les valeurs falsy et joint avec un espace |
| `components/ui/Button.tsx` | Bouton avec variants, sizes, icônes gauche/droite, état loading |
| `components/ui/Card.tsx` | Card + sous-composants CardHeader, CardTitle, CardContent |
| `components/ui/Badge.tsx` | Badge soft coloré — 5 variants, 2 sizes |
| `components/ui/Stat.tsx` | Bloc KPI — label, valeur, sublabel, trend, visual, icône |
| `app/dashboard/_design-system/page.tsx` | Page de démonstration temporaire (supprimée en Phase 3) |
| `PHASE2-REPORT.md` | Ce fichier |

---

## lib/cn.ts

```ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

Pas de dépendance externe. Usage : `cn("base", condition && "optionnel", className)`.

---

## components/ui/Button.tsx

**Interface :**
```ts
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";  // défaut: "primary"
  size?: "sm" | "md" | "lg";                               // défaut: "md"
  icon?: LucideIcon;       // icône gauche
  iconRight?: LucideIcon;  // icône droite
  loading?: boolean;       // spinner Loader2, désactive le bouton
}
```

**Variants :**
| Variant | Fond | Texte | Hover |
|---------|------|-------|-------|
| `primary` | `bg-accent` | `text-background` | `hover:bg-accent-hover` |
| `secondary` | `bg-surface` | `text-foreground` | `hover:bg-border/60` |
| `ghost` | — | `text-foreground-muted` | `hover:bg-foreground/[0.04]` |
| `danger` | `bg-loss` | `text-white` | `hover:bg-loss/90` |

**Sizes :** `sm` h-8 / `md` h-10 / `lg` h-12

**Exemple :**
```tsx
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

<Button variant="primary" size="md" icon={Plus}>Nouveau trade</Button>
<Button variant="secondary" loading>Enregistrement...</Button>
<Button variant="danger" size="sm">Supprimer</Button>
```

---

## components/ui/Card.tsx

**Interface :**
```ts
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "accent";  // défaut: "default"
  padding?: "none" | "sm" | "md" | "lg";           // défaut: "md"
}
```

**Variants :**
| Variant | Effet |
|---------|-------|
| `default` | `bg-card border border-border rounded-xl` |
| `interactive` | + hover border + hover bg-surface/40 + cursor-pointer |
| `accent` | + `border-accent/30 bg-accent/[0.03]` |

**Sous-composants :** `CardHeader`, `CardTitle`, `CardContent` — tous acceptent `className`.

**Exemple :**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

<Card variant="interactive" padding="lg">
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <Badge variant="success">+2.4%</Badge>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-foreground-muted">Contenu</p>
  </CardContent>
</Card>
```

---

## components/ui/Badge.tsx

**Interface :**
```ts
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "danger" | "warning" | "accent";  // défaut: "neutral"
  size?: "sm" | "md";  // défaut: "sm"
}
```

**Variants (soft — fond très léger + texte coloré) :**
| Variant | Fond | Texte |
|---------|------|-------|
| `neutral` | `bg-foreground/[0.06]` | `text-foreground-muted` |
| `success` | `bg-profit/10` | `text-profit` |
| `danger` | `bg-loss/10` | `text-loss` |
| `warning` | `bg-warning/10` | `text-warning` |
| `accent` | `bg-accent/10` | `text-accent` |

**Exemple :**
```tsx
import { Badge } from "@/components/ui/Badge";

<Badge variant="success" size="md">+2.4%</Badge>
<Badge variant="accent" size="sm">DEMO</Badge>
<Badge variant="danger">LOSS</Badge>
```

---

## components/ui/Stat.tsx

**Interface :**
```ts
interface StatProps {
  label: string;                          // texte uppercase au-dessus
  value: string | number;                 // grande valeur principale
  sublabel?: string;                      // texte secondaire sous la valeur
  trend?: "up" | "down" | "neutral";      // up→text-profit, down→text-loss, neutral/undefined→text-foreground
  visual?: ReactNode;                     // slot droit (anneau, gauge, mini-chart…)
  icon?: LucideIcon;                      // petite icône inline avec le label
  className?: string;
}
```

**Note :** Stat est un bloc de contenu, pas une Card. Il se compose dans une `<Card>` en Phase 3.

**Exemple :**
```tsx
import { Stat } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { TrendingUp } from "lucide-react";

<Card padding="md">
  <Stat
    label="P&L du jour"
    value="+342 €"
    sublabel="3 trades fermés"
    trend="up"
    icon={TrendingUp}
  />
</Card>
```

---

## Page de démo

**URL :** `/dashboard/_design-system`  
**Fichier :** `app/dashboard/_design-system/page.tsx`  
**Note :** Le préfixe `_` est une convention de nommage, pas une protection Next.js. Ajouter une vérification d'environnement si besoin (ex: redirection si `process.env.NODE_ENV === "production"`).

---

## Décisions techniques

### Pas de dépendance externe pour cn()
Version inline suffisante. `tailwind-merge` sera utile seulement si on commence à passer des classes conflictuelles (ex: deux `p-*`) — à ajouter si nécessaire en Phase 3.

### "use client" uniquement sur Button
Button utilise `forwardRef` (API client React). Card, Badge, Stat sont purement présentationnels et fonctionnent en RSC ou client boundary selon le contexte parent.

### text-background sur primary
`text-background` donne `rgb(var(--background))` — foncé sur cyan en dark (#09090b sur #00D4D8 ✓), clair sur cyan légèrement plus foncé en light (#f8f9fa sur #00A8AC ✓). Bon contraste dans les deux modes.

---

## Points pour review humaine

1. **text-background sur primary button** — vérifier visuellement en light mode que le contraste est suffisant (ratio estimé ~4.5:1).
2. **`/dashboard/_design-system` non protégé** — accessible en production. Ajouter une guard `if (process.env.NODE_ENV !== "development") notFound()` si souhaité.
3. **Card `hover:border-border/80`** — en light mode, la bordure est `#e5e7eb` à 80% opacity. Vérifier que l'effet hover est visible mais discret.
4. **`cn()` sans tailwind-merge** — si un appelant passe deux classes conflictuelles (ex: `p-4` via padding + `p-8` via className), la deuxième gagne (CSS specificity). Acceptable pour Phase 2, à améliorer si besoin.
