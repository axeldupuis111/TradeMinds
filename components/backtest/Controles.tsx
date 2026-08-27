"use client";

import { cn } from "@/lib/cn";

/**
 * Les briques de saisie du plan de backtest.
 *
 * Sorties ici plutôt que laissées dans la page pour une raison précise : le plan
 * compte une trentaine de paramètres, et l'exigence produit est que le trader
 * puisse TOUS les modifier. Répéter trente fois la même structure de label et
 * d'input dans la page rendrait cette exigence impossible à tenir dans le temps,
 * et le premier paramètre qu'on renoncerait à exposer serait le plus ennuyeux à
 * câbler, pas le moins important.
 */

export function Champ({
  label,
  aide,
  children,
  className,
}: {
  label: string;
  aide?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      {children}
      {aide ? <span className="text-[11px] leading-snug text-foreground-muted/80">{aide}</span> : null}
    </label>
  );
}

const CLASSE_SAISIE =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Nombre({
  valeur,
  onChange,
  min,
  max,
  pas = 1,
  suffixe,
}: {
  valeur: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  suffixe?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={cn(CLASSE_SAISIE, suffixe && "pr-12")}
        value={Number.isFinite(valeur) ? valeur : ""}
        min={min}
        max={max}
        step={pas}
        onChange={(e) => {
          const v = Number(e.target.value);
          // Une saisie vide ou absurde ne doit pas propager NaN jusqu'au moteur :
          // un NaN dans un prix rend un backtest sans trade et sans explication.
          if (!Number.isFinite(v)) return;
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
        }}
      />
      {suffixe ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">
          {suffixe}
        </span>
      ) : null}
    </div>
  );
}

export function Liste<T extends string>({
  valeur,
  options,
  onChange,
}: {
  valeur: T;
  options: { valeur: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select className={CLASSE_SAISIE} value={valeur} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Heure({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <input type="time" className={CLASSE_SAISIE} value={valeur} onChange={(e) => onChange(e.target.value)} />
  );
}

export function Bascule({
  actif,
  onChange,
  label,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!actif)}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        actif
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-background text-foreground-muted hover:border-accent/40",
      )}
    >
      {label}
    </button>
  );
}

/** Encadré de section du plan, pour que trente réglages restent lisibles. */
export function Bloc({
  titre,
  soustitre,
  alerte,
  children,
}: {
  titre: string;
  soustitre?: string;
  /** Message affiché en tête quand le trader a contesté ce bloc. */
  alerte?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        // ⚠️ L'anneau n'est pas décoratif : il relie le « ce n'est pas ça »
        // cliqué plus haut au réglage exact qu'il faut corriger ici. Sans lui,
        // le trader sait que quelque chose est faux sans savoir quoi toucher.
        alerte ? "border-loss/50 bg-loss/[0.05]" : "border-border bg-surface/40",
      )}
    >
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">{titre}</h4>
        {soustitre ? <p className="mt-0.5 text-xs text-foreground-muted">{soustitre}</p> : null}
        {alerte ? <p className="mt-1.5 text-xs font-medium text-loss">{alerte}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
