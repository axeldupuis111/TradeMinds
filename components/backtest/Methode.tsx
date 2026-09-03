"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Instrument } from "@/lib/backtest/instruments";
import {
  besoinsNonCouverts,
  diagnostiquerMethode,
  METHODES,
  methodeParCode,
  type Methode as MethodeRef,
} from "@/lib/backtest/methodes";
import type { PlanExecution } from "@/lib/backtest/types";
import { AlertTriangle, BookOpen, Info } from "lucide-react";

/**
 * LA MÉTHODE QUE LE TRADER DÉCLARE, ET CE QU'ELLE EXIGE POUR EXISTER.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CET ÉCRAN ──────────────────────────────────
 *
 * « Je ne veux pas que tu proposes juste d'ajouter le RSI avec ICT. Je veux de
 * vraies stratégies professionnelles. On va tomber sur des utilisateurs avec des
 * stratégies pro comme l'orderflow. Si tu peux le backtester c'est top, mais de
 * mémoire y'a aucun moyen. Je veux quand même que tu aides cet utilisateur. »
 *
 * ⚠️⚠️ CET ÉCRAN NE LANCE RIEN ET NE MESURE RIEN, et c'est exactement pour ça
 * qu'il vaut quelque chose. Un trader d'orderflow sur EUR/USD chez son courtier
 * peut trouver ici toute son explication sans qu'une seule bougie ait été lue :
 * le volume qu'il regarde est celui des clients de son courtier, pas celui du
 * marché.
 *
 * ⚠️ AUCUNE MÉTHODE N'EST DÉCLARÉE MEILLEURE QU'UNE AUTRE. La liste est rangée
 * par famille, jamais par mérite, et rien n'est mis en avant.
 */
export function Methode({
  code,
  instrument,
  plan,
  onChoisir,
  t,
}: {
  /** Le code de la méthode déclarée, ou vide. */
  code: string;
  instrument: Instrument;
  plan?: PlanExecution;
  onChoisir: (code: string) => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const methode = methodeParCode(code);

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <BookOpen className="h-4 w-4" />
        {t("bt_etape_methode")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_meth_intro")}</p>

      <select
        value={code}
        onChange={(e) => onChoisir(e.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">{t("bt_meth_aucune")}</option>
        {(["structure", "flux", "statistique", "tendance", "evenement"] as const).map((famille) => (
          <optgroup key={famille} label={t(`bt_fam_${famille}`)}>
            {METHODES.filter((m) => m.famille === famille).map((m) => (
              <option key={m.code} value={m.code}>
                {t(`bt_meth_${m.code}`)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {methode ? <Detail methode={methode} instrument={instrument} plan={plan} t={t} /> : null}
    </Card>
  );
}

function Detail({
  methode,
  instrument,
  plan,
  t,
}: {
  methode: MethodeRef;
  instrument: Instrument;
  plan?: PlanExecution;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const constats = diagnostiquerMethode(methode, instrument, plan);
  const manquants = besoinsNonCouverts(methode);

  return (
    <>
      <p className="mt-3 text-xs leading-relaxed text-foreground">
        {t(`bt_meth_${methode.code}_quoi`)}
      </p>

      {/* ── Ce dont elle a besoin, et ce qu'on a ─────────────────────────── */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Bloc titre={t("bt_meth_besoins")}>
          <ul className="space-y-1">
            {methode.besoins.map((b) => (
              <li
                key={b}
                className={cn(
                  "flex items-start gap-1.5 text-[11px] leading-relaxed",
                  manquants.includes(b) ? "text-loss" : "text-foreground-muted",
                )}
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
                {t(`bt_besoin_${b}`)}
                {manquants.includes(b) ? ` ${t("bt_meth_manquant")}` : ""}
              </li>
            ))}
          </ul>
        </Bloc>
        <Bloc titre={t("bt_meth_regimes")}>
          <p className="text-[11px] leading-relaxed text-foreground-muted">
            {methode.regimes.map((r) => t(`bt_regime_${r}`)).join(", ")}
          </p>
          {methode.seance ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-muted">
              {t("bt_ref_seance", { plage: `${methode.seance.debut} → ${methode.seance.fin}` })}
            </p>
          ) : null}
        </Bloc>
      </div>

      {/* ── Ce que le moteur peut en faire, dit avant tout chiffre ───────── */}
      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 rounded-lg border p-3 text-xs leading-relaxed",
          methode.mecanisation === "complete"
            ? "border-border bg-surface/40 text-foreground-muted"
            : "border-warning/40 bg-warning/[0.06] text-warning",
        )}
      >
        {methode.mecanisation === "complete" ? (
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        <span>{t(`bt_meca_${methode.mecanisation}`)}</span>
      </p>

      {/* ── Ce que le référentiel reproche, sans avoir lu une bougie ─────── */}
      {constats.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {constats.map((c) => (
            <li
              key={c.code}
              className={cn(
                "rounded-lg border p-3 text-[11px] leading-relaxed",
                c.code === "squelette_seulement"
                  ? "border-border bg-surface/40 text-foreground-muted"
                  : "border-warning/40 bg-warning/[0.06] text-warning",
              )}
            >
              {t(`bt_dmeth_${c.code}`, {
                ...c.valeurs,
                besoins:
                  typeof c.valeurs.besoins === "string"
                    ? c.valeurs.besoins
                        .split(", ")
                        .map((b) => t(`bt_besoin_${b}`))
                        .join(", ")
                    : "",
              })}
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Ce qui la tue, en clair ──────────────────────────────────────── */}
      {methode.tueurs.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">{t("bt_meth_tueurs")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_meth_tueurs_intro")}
          </p>
          <ul className="mt-2 space-y-1">
            {methode.tueurs.map((x) => (
              <li
                key={x}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-muted"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning" />
                {t(`bt_tueur_${x}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-1.5 text-[11px] font-medium text-foreground">{titre}</p>
      {children}
    </div>
  );
}
