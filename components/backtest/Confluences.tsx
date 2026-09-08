"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { signe } from "@/lib/backtest/format";
import type { Confluence } from "@/lib/backtest/confluences";
import { Filter } from "lucide-react";

function r(v: string | number | undefined, d = 3): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  // ⚠️ Les valeurs des constats arrivent parfois déjà formatées en chaîne :
  // on ne reformate que ce qui est vraiment un nombre.
  return Number.isFinite(n) ? signe(n, d) : String(v);
}

/**
 * TES CONFLUENCES, UNE PAR UNE.
 *
 * ── POURQUOI CE FICHIER EXISTE À PART ───────────────────────────────────────
 *
 * ⚠️⚠️ VU À L'ÉCRAN : ce tableau s'affichait sur « Ton plan », la dernière
 * étape, celle du document à emporter. Sept cartes de filtres que le trader
 * n'utilise pas, posées APRÈS son plan, alors que c'est un produit du bouton
 * « Analyser à fond » et que les trois autres produits de ce bouton (la
 * recherche, les marchés comparables, le voisinage des réglages) sont sur
 * « L'améliorer ».
 *
 * ⚠️ ELLES ÉTAIENT DANS LE MÊME COMPOSANT QUE LES PILIERS, et c'est la seule
 * raison pour laquelle elles étaient là : un découpage de fichier avait décidé
 * d'une place dans le parcours. Personne ne l'avait choisi.
 */
export function Confluences({
  confluences,
  nomDuFiltre,
  t,
}: {
  confluences: Confluence[];
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
    {/* ── 3. Mes confluences servent-elles ? ──────────────────────────────
        ⚠️ La section n'apparaît qu'une fois la mesure faite. Un bouton par
        carte, c'était sept endroits pour lancer un test et sept façons
        d'effacer le travail des six autres. */}
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
                  // ⚠️ Le compte brut, pour la phrase du filtre presque
                  // inerte : c est precisement parce que le pourcentage
                  // s arrondit a zero qu elle existe.
                  n: c.tradesSans - c.tradesAvec,
                  total: c.tradesSans,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
    </Card>
  );
}
