"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { coutsEnPrix, type Instrument } from "@/lib/backtest/instruments";
import { MAX_TENTATIVES_AVANT_ALERTE, type LectureBacktest } from "@/lib/backtest/verdict";
import type { AuditExecution, TradeSimule } from "@/lib/backtest/types";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/lib/useChartColors";

/**
 * CE QUE L'ÉCRAN A LE DROIT DE DIRE.
 *
 * ⚠️ L'INTERFACE N'EST JAMAIS PLUS AFFIRMATIVE QUE LE MOTEUR. Sous le seuil de
 * trades, `lecture.stats` n'existe même pas et cette carte affiche ce qui
 * manque. Au-dessus, l'espérance ne s'affiche JAMAIS sans son intervalle, et le
 * vert n'apparaît que si zéro est hors de cet intervalle.
 *
 * ⚠️ AUCUN VERT SUR UN SCÉNARIO PERDANT. C'est la leçon la plus chère de
 * l'onglet Projection : un « 0 % de risque de ruine » en vert à côté d'une
 * espérance négative disait « tu es sauvé » là où la lecture juste était « tu
 * vas saigner lentement ». Ici la couleur suit le verdict, jamais un sous-chiffre.
 *
 * ⚠️ LE MOT « RENTABLE » N'APPARAÎT NULLE PART, ni ici ni dans les traductions.
 * On dit ce qu'on a mesuré, sur quelle période, avec quels coûts.
 */

export interface ResultatProps {
  lecture: LectureBacktest;
  trades: TradeSimule[];
  audit: AuditExecution;
  instrument: Instrument;
  periode: { de: string; a: string };
  moisManquants: string[];
  tentatives: number;
  ms: number;
  t: (k: string, v?: Record<string, string | number>) => string;
}

const TON: Record<string, { classe: string; anneau: string }> = {
  positif: { classe: "text-profit", anneau: "border-profit/40 bg-profit/[0.06]" },
  negatif: { classe: "text-loss", anneau: "border-loss/40 bg-loss/[0.06]" },
  non_concluant: { classe: "text-warning", anneau: "border-warning/40 bg-warning/[0.06]" },
  insuffisant: { classe: "text-foreground-muted", anneau: "border-border bg-surface/40" },
};

function signe(v: number, decimales = 3): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimales)}`;
}

export function Resultat({
  lecture,
  trades,
  audit,
  instrument,
  periode,
  moisManquants,
  tentatives,
  ms,
  t,
}: ResultatProps) {
  const c = useChartColors();
  const ton = TON[lecture.verdict] ?? TON.insuffisant;

  // ── Sous le seuil, on ne rend AUCUN chiffre de performance. Le moteur est
  //    sorti avant de les calculer : il n'y a rien à masquer ici, et c'est
  //    exactement l'intérêt de la règle.
  if (!lecture.stats) {
    return (
      <Card className={cn("border", ton.anneau)}>
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-foreground-muted" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("bt_verdict_insuffisant")}</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("bt_verdict_insuffisant_detail", {
                trades: trades.length,
                manquants: lecture.tradesManquants ?? 0,
              })}
            </p>
            <p className="mt-2 text-xs text-foreground-muted">
              {t("bt_insuffisant_pistes")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const s = lecture.stats;
  const couts = lecture.couts!;
  const prix = coutsEnPrix(instrument, {
    spreadTicks: couts.coutApplique,
    glissementTicks: 0,
    commissionTicks: 0,
  });

  // Courbe cumulée en R. Échantillonnée si le journal est long : dix mille
  // points dans un SVG font ramer la page sans rien montrer de plus.
  const pas = Math.max(1, Math.ceil(trades.length / 600));
  const courbe: { i: number; r: number }[] = [];
  let cumul = 0;
  for (let i = 0; i < trades.length; i++) {
    cumul += trades[i].r;
    if (i % pas === 0 || i === trades.length - 1) courbe.push({ i: i + 1, r: Number(cumul.toFixed(2)) });
  }

  const gagne = lecture.verdict === "positif";

  return (
    <div className="space-y-4">
      {/* ── Le verdict ───────────────────────────────────────────────────── */}
      <Card className={cn("border", ton.anneau)}>
        <div className="flex items-start gap-3">
          {gagne ? (
            <TrendingUp className={cn("mt-0.5 h-5 w-5 shrink-0", ton.classe)} />
          ) : lecture.verdict === "negatif" ? (
            <TrendingDown className={cn("mt-0.5 h-5 w-5 shrink-0", ton.classe)} />
          ) : (
            <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", ton.classe)} />
          )}
          <div className="min-w-0 flex-1">
            <h3 className={cn("text-base font-semibold", ton.classe)}>
              {t(`bt_verdict_${lecture.verdict}`)}
            </h3>
            {/* ⚠️ L'espérance ne voyage JAMAIS sans son intervalle. */}
            <p className="mt-1 text-sm text-foreground">
              {t("bt_verdict_phrase", {
                instrument: instrument.nom,
                de: periode.de,
                a: periode.a,
                esperance: signe(s.esperanceR, 4),
                bas: s.borneBasse.toFixed(3),
                haut: s.borneHaute.toFixed(3),
                trades: s.nbTrades,
              })}
            </p>
            {lecture.verdict === "non_concluant" ? (
              <p className="mt-2 text-xs text-foreground-muted">{t("bt_zero_dans_intervalle")}</p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Les chiffres ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre label={t("bt_trades")} valeur={String(s.nbTrades)} />
        <Chiffre label={t("bt_taux_reussite")} valeur={`${(s.tauxReussite * 100).toFixed(1)} %`} />
        <Chiffre
          label={t("bt_total_r")}
          valeur={`${signe(s.totalR, 1)} R`}
          ton={s.totalR >= 0 && gagne ? "profit" : s.totalR < 0 ? "loss" : "neutre"}
        />
        <Chiffre label={t("bt_drawdown")} valeur={`${s.drawdownMaxR.toFixed(1)} R`} />
      </div>

      {/* ── La courbe ────────────────────────────────────────────────────── */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t("bt_courbe")}</h4>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={courbe} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis dataKey="i" tick={{ fontSize: 11, fill: c.axis }} stroke={c.grid} />
              <YAxis tick={{ fontSize: 11, fill: c.axis }} stroke={c.grid} width={48} />
              <ReferenceLine y={0} stroke={c.axis} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  background: c.tooltipBg,
                  border: `1px solid ${c.grid}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [`${signe(Number(v), 2)} R`, t("bt_cumul")]}
                labelFormatter={(v) => t("bt_trade_n", { n: String(v) })}
              />
              <Area
                type="monotone"
                dataKey="r"
                stroke={s.totalR >= 0 ? c.profit : c.loss}
                fill={s.totalR >= 0 ? c.profit : c.loss}
                fillOpacity={0.14}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── L'audit de coûts ─────────────────────────────────────────────── */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t("bt_audit_couts")}</h4>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Ligne label={t("bt_esperance_brute")} valeur={`${signe(couts.esperanceBruteR, 4)} R`} />
          <Ligne label={t("bt_esperance_nette")} valeur={`${signe(couts.esperanceNetteR, 4)} R`} />
          <Ligne
            label={t("bt_cout_par_trade")}
            valeur={`${couts.coutParTradeR.toFixed(4)} R`}
          />
          <Ligne
            label={t("bt_risque_moyen")}
            valeur={`${(couts.risqueMoyenTicks * instrument.tailleTick).toFixed(instrument.decimales)}`}
          />
          <Ligne
            label={t("bt_cout_aller_retour")}
            valeur={`${prix.spread.toFixed(instrument.decimales)} (${(
              (couts.coutApplique / Math.max(1, couts.risqueMoyenTicks)) *
              100
            ).toFixed(1)} % ${t("bt_du_risque")})`}
          />
          <Ligne
            label={t("bt_cout_break_even")}
            valeur={`${(couts.coutBreakEvenTicks * instrument.tailleTick).toFixed(instrument.decimales)}`}
          />
        </dl>
        {couts.edgeDetruitParLesCouts ? (
          <p className="mt-3 rounded-lg border border-loss/40 bg-loss/[0.06] p-3 text-xs text-loss">
            {t("bt_edge_detruit")}
          </p>
        ) : null}
      </Card>

      {/* ── Ce qui relativise le chiffre ─────────────────────────────────── */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold text-foreground">{t("bt_reserves")}</h4>
        <ul className="space-y-2 text-xs text-foreground-muted">
          {lecture.horsEchantillon?.applicable ? (
            <li className={lecture.horsEchantillon.neSurvitPas ? "text-warning" : undefined}>
              {t("bt_hors_echantillon", {
                debut: signe(lecture.horsEchantillon.esperanceDebutR),
                fin: signe(lecture.horsEchantillon.esperanceFinR),
              })}
              {lecture.horsEchantillon.neSurvitPas ? ` ${t("bt_hors_echantillon_alerte")}` : ""}
            </li>
          ) : null}
          <li className={lecture.partCollisions > 0.15 ? "text-warning" : undefined}>
            {t("bt_collisions", {
              n: audit.collisions,
              pct: (lecture.partCollisions * 100).toFixed(1),
            })}
          </li>
          <li>{t("bt_signaux", { signaux: audit.signaux, refuses: audit.refusesParGestion })}</li>
          {audit.refusesRisqueTropPetit > 0 ? (
            <li className="text-warning">
              {t("bt_refuses_risque", { n: audit.refusesRisqueTropPetit })}
            </li>
          ) : null}
          {moisManquants.length > 0 ? (
            <li className="text-warning">
              {t("bt_mois_manquants", { n: moisManquants.length, liste: moisManquants.slice(0, 3).join(", ") })}
            </li>
          ) : null}
          <li className={lecture.risqueDeSurApprentissage ? "text-warning" : undefined}>
            {lecture.risqueDeSurApprentissage
              ? t("bt_sur_apprentissage_alerte", { n: tentatives })
              : t("bt_tentatives", { n: tentatives, max: MAX_TENTATIVES_AVANT_ALERTE })}
          </li>
          <li>{t("bt_duree_calcul", { ms })}</li>
        </ul>
      </Card>
    </div>
  );
}

function Chiffre({
  label,
  valeur,
  ton = "neutre",
}: {
  label: string;
  valeur: string;
  ton?: "profit" | "loss" | "neutre";
}) {
  return (
    <Card padding="sm">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums",
          ton === "profit" && "text-profit",
          ton === "loss" && "text-loss",
          ton === "neutre" && "text-foreground",
        )}
      >
        {valeur}
      </p>
    </Card>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1.5">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-mono tabular-nums text-foreground">{valeur}</dd>
    </div>
  );
}
