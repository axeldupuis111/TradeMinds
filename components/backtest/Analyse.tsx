"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Constat } from "@/lib/backtest/coherence-plan";
import type { Confluence } from "@/lib/backtest/confluences";
import type { Synthese, EtatPilier } from "@/lib/backtest/synthese";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Filter,
  ListChecks,
  XCircle,
} from "lucide-react";

/**
 * L'ANALYSE DE LA STRATÉGIE, ET NON DES MOLETTES DU MOTEUR.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CET ÉCRAN ─────────────────────────────────
 *
 * Un trader, devant les propositions : « il me parle de passer de 5 à 3 pour
 * reconnaître plus de sommets... on a tous notre façon de reconnaître un
 * sommet. Ce qu'on attend, c'est une vraie analyse : ajouter des confluences, en
 * retirer, et surtout me dire si ma stratégie est viable dans le temps et
 * cohérente. Là il me montre des chiffres sans réellement changer ma stratégie. »
 *
 * Le diagnostic était exact. Les propositions tournaient des paramètres de
 * MOTEUR (largeur de pivot, unité de temps, taille de stop), et aucune ne
 * parlait de sa méthode. Cet écran répond aux trois questions qu'il pose, dans
 * l'ordre où elles se posent :
 *
 * 1. **Est-ce viable ?** Pas une note : une liste de piliers, chacun établi, pas
 *    établi, ou pas encore regardé.
 * 2. **Est-ce cohérent ?** Ce que la fiche annonce contre ce que la mécanique a
 *    réellement produit.
 * 3. **Mes confluences servent-elles ?** Avec et sans chacune, l'écart est-il
 *    seulement mesurable.
 *
 * ⚠️ « PAS REGARDÉ » N'EST PAS « PAS ÉTABLI », et l'écran ne doit jamais les
 * confondre. Ne pas avoir fait le contrôle hors période n'est pas un mauvais
 * résultat : c'est une absence de résultat, donc une action précise à faire, et
 * la couleur doit le dire.
 */

const ICONE: Record<EtatPilier, typeof CheckCircle2> = {
  etabli: CheckCircle2,
  pas_etabli: XCircle,
  pas_regarde: CircleDashed,
};

const TON: Record<EtatPilier, string> = {
  etabli: "text-profit",
  pas_etabli: "text-loss",
  // ⚠️ Ni vert ni rouge : une absence de mesure n'est pas une mauvaise nouvelle.
  pas_regarde: "text-foreground-muted",
};

function r(v: string | number | undefined, d = 3): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}` : String(v);
}

export function Analyse({
  synthese,
  constats,
  confluences,
  nomDuFiltre,
  t,
}: {
  synthese: Synthese;
  constats: Constat[];
  confluences: Confluence[] | undefined;
  /**
   * Le nom du filtre tel qu'il est écrit dans l'éditeur.
   *
   * ⚠️ Passé depuis la page plutôt que redéfini ici : deux tables de noms
   * finiraient par diverger, et le trader lirait « biais_moyenne » ici et
   * « Dans le sens de la moyenne » trois cartes plus haut.
   */
  nomDuFiltre: (type: string) => string;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      {/* ── 1. Est-ce viable ? ────────────────────────────────────────────── */}
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ListChecks className="h-4 w-4" />
        {t("bt_syn_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_syn_intro")}</p>
      <p className="mt-1.5 text-[11px] tabular-nums text-foreground-muted">
        {t("bt_syn_compte", {
          etablis: synthese.etablis,
          pasEtablis: synthese.pasEtablis,
          pasRegardes: synthese.pasRegardes,
        })}
      </p>

      <ul className="mt-3 space-y-2.5">
        {synthese.piliers.map((p) => {
          const Icone = ICONE[p.etat];
          return (
            <li key={p.code} className="flex items-start gap-2.5">
              <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", TON[p.etat])} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {t(`bt_syn_${p.code}`)}{" "}
                  <span className={cn("text-[11px] font-normal", TON[p.etat])}>
                    · {t(`bt_syn_${p.etat}`)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-muted">
                  {t(`bt_syn_${p.code}_${p.etat}`, p.valeurs)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_syn_pas_de_note")}
      </p>

      {/* ── 2. Est-ce cohérent ? ──────────────────────────────────────────── */}
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-foreground">{t("bt_coh_titre")}</h4>
        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_coh_intro")}</p>

        {constats.length === 0 ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-foreground-muted">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
            {t("bt_coh_rien")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {constats.map((c, i) => (
              <li
                key={`${c.code}-${i}`}
                className={cn(
                  "rounded-lg border p-3",
                  c.gravite === "bloquant"
                    ? "border-loss/40 bg-loss/[0.05]"
                    : "border-warning/40 bg-warning/[0.05]",
                )}
              >
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-medium",
                    c.gravite === "bloquant" ? "text-loss" : "text-warning",
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t(`bt_coh_${c.gravite}`)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">
                  {t(`bt_coh_${c.code}`, c.valeurs)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 3. Mes confluences servent-elles ? ──────────────────────────────
          ⚠️ La section n'apparaît qu'une fois la mesure faite. Un bouton par
          carte, c'était sept endroits pour lancer un test et sept façons
          d'effacer le travail des six autres. */}
      {confluences ? (
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4" />
          {t("bt_conf_titre")}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_conf_intro")}</p>

        {/* ⚠️ CE QU'ON REFUSE, DIT AVANT LE TABLEAU. Essayer sept filtres et
            garder le meilleur serait un balayage de plus ; c'est pourquoi ils
            sont tous affichés dans l'ordre du catalogue, sans classement. */}
        <p className="mt-2.5 rounded-lg border border-warning/40 bg-warning/[0.06] p-3 text-[11px] leading-relaxed text-warning">
          {t("bt_conf_avertissement")}
        </p>

        {confluences.length === 0 ? (
          <p className="mt-3 text-xs text-foreground-muted">{t("bt_conf_rien")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {confluences.map((c) => (
              <li
                key={c.type}
                className={cn(
                  "rounded-lg border p-3",
                  // ⚠️ Ce qu'il a DÉJÀ est mis en avant : c'est un fait sur sa
                  // méthode, pas une suggestion, et les deux ne se lisent pas
                  // avec le même poids.
                  c.deja ? "border-accent/40 bg-accent/[0.04]" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-xs font-medium text-foreground">
                    {nomDuFiltre(c.type)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-foreground-muted">
                    {t(c.deja ? "bt_conf_deja" : "bt_conf_candidat")}
                  </p>
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-foreground-muted">
                  {t("bt_conf_chiffres", {
                    avec: c.tradesAvec,
                    sans: c.tradesSans,
                    part: c.partEcarteePct.toFixed(0),
                  })}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-muted">
                  {t(`bt_conf_effet_${c.effet}`, {
                    part: c.partEcarteePct.toFixed(0),
                    avec: r(c.esperanceAvecR ?? undefined),
                    sans: r(c.esperanceSansR ?? undefined),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </Card>
  );
}
