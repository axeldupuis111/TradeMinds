"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { signePourcent } from "@/lib/backtest/format";
import type { ProjectionDuBacktest } from "@/lib/backtest/projection-backtest";
import { AlertTriangle, TrendingDown } from "lucide-react";

/**
 * CE QUE DONNERAIT UNE ANNÉE DE CES TRADES-LÀ.
 *
 * ── POURQUOI CETTE CARTE EXISTE ─────────────────────────────────────────────
 *
 * Le verdict rend une espérance par trade. Ça ne dit rien du CHEMIN, et c'est le
 * chemin qui vide les comptes : une méthode à espérance positive peut très bien
 * traverser un creux de quarante pour cent avant d'y arriver, et personne ne
 * tient quarante pour cent. Le rééchantillonnage par blocs répond à ça, il est
 * déjà écrit pour le journal réel, et le brancher ici ne coûte rien.
 *
 * ⚠️⚠️ ET C'EST PRÉCISÉMENT POUR ÇA QU'IL FAUT DIRE CE QUE CETTE CARTE N'EST PAS.
 *
 * L'onglet Stratégie contient la MÊME projection, sur les trades que le trader a
 * réellement pris : elle prolonge un avantage qu'il a démontré, avec son
 * exécution et ses frais réels. Celle-ci part de trades qui n'ont jamais existé.
 * Les deux écrans se ressemblent, les deux chiffres se ressemblent, et un trader
 * qui les confond croira avoir démontré ce qu'il a seulement supposé. La phrase
 * qui les sépare est donc en tête, en texte visible, pas en note de bas de page.
 */

/**
 * ⚠️⚠️ ON NE PERD PAS PLUS DE 100 % D'UN COMPTE, et l'écran l'affichait :
 * « sur les pires 5 % : -106,1 % ». Le tirage additionne des R à taille de
 * position constante, donc la somme peut dépasser le capital ; le compte, lui,
 * s'arrête à zéro. C'est exactement le défaut déjà corrigé une fois sur le
 * recul (« -148,4 % »), revenu par une autre porte.
 */
function pct(v: number, decimales = 1): string {
  return signePourcent(v, decimales);
}

export function ProjectionCarte({
  donnees,
  t,
}: {
  donnees: ProjectionDuBacktest;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const p = donnees.projection;
  if (p.verdict === "insuffisant") return null;

  const ruinePct = p.risqueDeRuine * 100;
  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <TrendingDown className="h-4 w-4" />
        {t("bt_proj_titre")}
      </h4>

      {/* ⚠️ EN TÊTE, PAS EN NOTE. C'est la phrase qui empêche de confondre cette
          carte avec la projection de l'onglet Stratégie, laquelle prolonge un
          avantage réellement démontré. */}
      <p className="mt-2 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-xs leading-relaxed text-warning">
        {t("bt_proj_pas_le_journal")}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
        {t("bt_proj_intro", {
          risque: donnees.risquePct,
          trades: Math.round(p.tradesParAn),
        })}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-4">
        <Chiffre label={t("bt_proj_pire")} valeur={montant(p.p05, t)} ton="loss" />
        <Chiffre label={t("bt_proj_median")} valeur={montant(p.median, t)} />
        <Chiffre label={t("bt_proj_meilleur")} valeur={montant(p.p95, t)} ton="profit" />
        <Chiffre label={t("bt_proj_creux")} valeur={montant(p.drawdownMedian, t)} ton="loss" />
      </dl>

      {/* ⚠️ LE RISQUE DE RUINE NE SE COLORE JAMAIS EN VERT. Un « 3 % » rassurant
          à côté d'une espérance qui n'est pas démontrée est exactement l'erreur
          que l'onglet Projection a déjà payée : on affiche le fait, pas un
          encouragement. */}
      <p
        className={cn(
          "mt-3 rounded-lg border p-3 text-xs leading-relaxed",
          ruinePct >= 5
            ? "border-loss/40 bg-loss/[0.06] text-loss"
            : "border-border bg-surface/40 text-foreground-muted",
        )}
      >
        {t("bt_proj_ruine", { pct: ruinePct.toFixed(1) })}
      </p>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-muted">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        {t("bt_proj_limite")}
      </p>
    </Card>
  );
}

/** Un montant en % du capital, ou « compte vidé » quand il n'en reste rien. */
function montant(v: number, t: (cle: string) => string): string {
  return v <= -100 ? t("bt_capital_vide") : pct(v);
}

function Chiffre({
  label,
  valeur,
  ton,
}: {
  label: string;
  valeur: string;
  ton?: "profit" | "loss";
}) {
  return (
    <div>
      <dt className="text-[11px] text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          ton === "profit" ? "text-profit" : ton === "loss" ? "text-loss" : "text-foreground",
        )}
      >
        {valeur}
      </dd>
    </div>
  );
}
