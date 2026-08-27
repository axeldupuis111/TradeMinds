"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Instrument } from "@/lib/backtest/instruments";
import type { Apercu } from "@/app/dashboard/backtest/worker";
import { echelleApercu } from "@/lib/backtest/apercu";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * VOIR LES TRADES SUR LES VRAIES BOUGIES.
 *
 * ── POURQUOI CETTE SECTION EXISTE ───────────────────────────────────────────
 *
 * Trois fois de suite, en construisant cet outil, la fiche écrite d'un trader a
 * été traduite en une mécanique qui n'était PAS sa méthode : une trendline
 * devenue un plus-haut horizontal, un « stop derrière le dernier sommet » posé
 * sur la bougie de signal, une stratégie de M3 rejouée en M1. À chaque fois,
 * l'approximation était DÉCLARÉE à l'écran, en petit, et à chaque fois c'est un
 * graphique qui a révélé l'erreur, jamais une relecture du texte.
 *
 * ⚠️ AUCUN CHIFFRE DE CETTE PAGE NE VAUT TANT QUE LE TRADER N'A PAS REGARDÉ
 * TROIS DE CES TRADES. Une méthode de price action se définit sur un graphique,
 * pas en prose : « derrière le dernier sommet » est limpide pour celui qui
 * l'écrit et admet trois lectures mécaniques qui donnent des risques du simple
 * au vingtuple.
 *
 * ⚠️ ON MONTRE DES TRADES RÉPARTIS SUR TOUTE LA PÉRIODE, PAS LES PLUS BEAUX.
 * Sélectionner les gagnants ferait de cette section une vitrine, alors qu'elle
 * existe pour permettre de dire « ce n'est pas mon setup ».
 */

export interface InspectionProps {
  apercus: Apercu[];
  instrument: Instrument;
  /** Vrai quand le trader a confirmé reconnaître sa méthode. */
  verifie: boolean;
  onVerifie: (v: boolean) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}

const LARGEUR = 720;
const HAUTEUR = 300;

export function Inspection({ apercus, instrument, verifie, onVerifie, t }: InspectionProps) {
  const [index, setIndex] = useState(0);

  if (apercus.length === 0) return null;
  const a = apercus[Math.min(index, apercus.length - 1)];

  // ⚠️ L'échelle est calée sur LE TRADE, pas sur les bougies. Voir l'en-tête de
  // `lib/backtest/apercu.ts` : caler sur les bougies écrase les trades à petit
  // risque en une bande illisible, et le graphique cesse alors de servir.
  const { haut, bas, niveauVisible } = echelleApercu(
    {
      hautBougies: Math.max(...a.bougies.map((b) => b.h)),
      basBougies: Math.min(...a.bougies.map((b) => b.l)),
      entree: a.entree,
      stop: a.stop,
      objectif: a.objectif,
      sortie: a.sortie,
      niveau: a.niveau,
    },
    instrument.tailleTick,
  );

  const y = (prix: number) => ((haut - prix) / (haut - bas)) * HAUTEUR;
  const largeurBougie = LARGEUR / a.bougies.length;
  const x = (i: number) => i * largeurBougie + largeurBougie / 2;

  const iSignal = a.bougies.findIndex((b) => b.t === a.trade.signalMs);
  const iEntree = a.bougies.findIndex((b) => b.t === a.trade.entreeMs);
  const iSortie = a.bougies.findIndex((b) => b.t === a.trade.sortieMs);

  const fmt = (p: number) => p.toFixed(instrument.decimales);
  const gagnant = a.trade.r > 0;

  /** Un trait horizontal légendé, tracé de l'entrée à la sortie. */
  function Repere({
    prix,
    couleur,
    label,
    tirets,
  }: {
    prix: number;
    couleur: string;
    label: string;
    tirets?: boolean;
  }) {
    const depart = iEntree >= 0 ? x(iEntree) : 0;
    // Le libellé passe sous le trait quand il est trop haut dans le cadre,
    // pour ne pas sortir du SVG.
    const yTexte = y(prix) < 12 ? y(prix) + 12 : y(prix) - 4;
    return (
      <g>
        <line
          x1={depart}
          x2={LARGEUR}
          y1={y(prix)}
          y2={y(prix)}
          stroke={couleur}
          strokeWidth={1.5}
          strokeDasharray={tirets ? "5 4" : undefined}
        />
        <text x={depart + 4} y={yTexte} fontSize={11} fill={couleur}>
          {label} {fmt(prix)}
        </text>
      </g>
    );
  }

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t("bt_inspection")}</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg border border-border p-1 text-foreground-muted disabled:opacity-40"
            aria-label={t("bt_precedent")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs tabular-nums text-foreground-muted">
            {index + 1} / {apercus.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(apercus.length - 1, i + 1))}
            disabled={index >= apercus.length - 1}
            className="rounded-lg border border-border p-1 text-foreground-muted disabled:opacity-40"
            aria-label={t("bt_suivant")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-foreground-muted">{t("bt_inspection_aide")}</p>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
          className="h-[300px] w-full min-w-[520px]"
          role="img"
          aria-label={t("bt_inspection")}
        >
          {/* Les bougies rognées ne débordent pas du cadre. */}
          <defs>
            <clipPath id="cadre-apercu">
              <rect x={0} y={0} width={LARGEUR} height={HAUTEUR} />
            </clipPath>
          </defs>

          {/* Zones de risque et de gain, comme sur une plateforme. */}
          {iEntree >= 0 ? (
            <>
              <rect
                x={x(iEntree)}
                y={Math.min(y(a.entree), y(a.stop))}
                width={LARGEUR - x(iEntree)}
                height={Math.abs(y(a.stop) - y(a.entree))}
                className="fill-loss/10"
              />
              <rect
                x={x(iEntree)}
                y={Math.min(y(a.entree), y(a.objectif))}
                width={LARGEUR - x(iEntree)}
                height={Math.abs(y(a.objectif) - y(a.entree))}
                className="fill-profit/10"
              />
            </>
          ) : null}

          {/* Le niveau franchi : c'est LUI que le trader doit reconnaître.
              ⚠️ Il n'est tracé que s'il tombe dans le cadre. Sur un retest de
              déséquilibre, l'entrée se fait parfois très loin du niveau cassé :
              l'y forcer écraserait le trade, on le renvoie alors en marge. */}
          {niveauVisible ? (
            <>
              <line
                x1={0}
                x2={LARGEUR}
                y1={y(a.niveau)}
                y2={y(a.niveau)}
                className="stroke-accent"
                strokeWidth={1.5}
                strokeDasharray="2 3"
              />
              <text x={4} y={y(a.niveau) - 4} fontSize={11} className="fill-accent">
                {t("bt_niveau_franchi")} {fmt(a.niveau)}
              </text>
            </>
          ) : null}

          <g clipPath="url(#cadre-apercu)">
          {a.bougies.map((b, i) => {
            const monte = b.c >= b.o;
            const corpsHaut = Math.min(y(b.o), y(b.c));
            const corpsBas = Math.max(y(b.o), y(b.c));
            return (
              <g key={b.t} className={monte ? "stroke-profit fill-profit" : "stroke-loss fill-loss"}>
                <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} strokeWidth={1} />
                <rect
                  x={x(i) - largeurBougie * 0.32}
                  y={corpsHaut}
                  width={Math.max(1, largeurBougie * 0.64)}
                  height={Math.max(1, corpsBas - corpsHaut)}
                  strokeWidth={0}
                />
              </g>
            );
          })}
          </g>

          {/* Bougie de signal et bougie d'entrée : une bougie d'écart, toujours. */}
          {iSignal >= 0 ? (
            <line
              x1={x(iSignal)}
              x2={x(iSignal)}
              y1={0}
              y2={HAUTEUR}
              className="stroke-foreground-muted"
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.5}
            />
          ) : null}

          <Repere prix={a.entree} couleur="currentColor" label={t("bt_entree_courte")} />
          <Repere prix={a.stop} couleur="rgb(var(--loss))" label={t("bt_stop")} />
          <Repere prix={a.objectif} couleur="rgb(var(--profit))" label={t("bt_objectif")} tirets />

          {iSortie >= 0 ? (
            <circle cx={x(iSortie)} cy={y(a.sortie)} r={4} className={gagnant ? "fill-profit" : "fill-loss"} />
          ) : null}
        </svg>
      </div>

      {!niveauVisible ? (
        <p className="mt-2 text-xs text-accent">
          {t("bt_niveau_hors_cadre", { prix: fmt(a.niveau) })}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <Ligne label={t("bt_sens")} valeur={t(a.trade.sens === "long" ? "bt_sens_long" : "bt_sens_short")} />
        <Ligne
          label={t("bt_date")}
          valeur={new Date(a.trade.entreeMs).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        />
        <Ligne
          label={t("bt_risque_du_trade")}
          valeur={`${fmt(a.trade.risqueTicks * instrument.tailleTick)} ${t("bt_unite_prix")}`}
        />
        <Ligne
          label={t("bt_resultat")}
          valeur={`${a.trade.r >= 0 ? "+" : ""}${a.trade.r.toFixed(2)} R · ${t(`bt_motif_${a.trade.motif}`)}`}
        />
      </dl>

      {/* ⚠️ La confirmation n'est pas une formalité : c'est elle qui décide si
          le verdict porte un avertissement « non vérifié ». */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface/40 p-3">
        <input
          type="checkbox"
          checked={verifie}
          onChange={(e) => onVerifie(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
        />
        <span className={cn("text-xs leading-snug", verifie ? "text-foreground" : "text-foreground-muted")}>
          {t("bt_confirmer_mecanisation")}
        </span>
      </label>
    </Card>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-mono tabular-nums text-foreground">{valeur}</dd>
    </div>
  );
}
