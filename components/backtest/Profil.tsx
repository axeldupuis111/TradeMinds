"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { ConstatProfil } from "@/lib/backtest/profil";
import { CheckCircle2, TriangleAlert, UserRound } from "lucide-react";

/**
 * LE TRADER RÉEL, CONFRONTÉ À LA STRATÉGIE QU'IL A ÉCRITE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CET ÉCRAN ──────────────────────────────────
 *
 * « Je veux que tu aides chaque utilisateur vers une stratégie pro et adaptée à
 * SON trading. Ce se trouve il trade le mauvais actif au mauvais moment. »
 *
 * ⚠️⚠️ TOUT ÉTAIT DÉJÀ DANS L'APPLICATION, ET CET ONGLET L'IGNORAIT. Ses heures
 * réelles, ses instruments réels, son rythme réel : c'est son journal, et le
 * backtest mesurait des bougies sans jamais regarder l'homme qui allait les
 * trader.
 *
 * ⚠️ UN ÉCART N'EST PAS UNE FAUTE, ET L'ÉCRAN NE LE DIT PAS AINSI. Un trader
 * dont 78 % des trades tombent hors de sa plage horaire a peut-être une mauvaise
 * discipline, ou une plage écrite au hasard qu'il faut corriger pour qu'elle
 * décrive sa vie. Les deux lectures sont légitimes : on rend l'écart, il
 * tranche.
 */
export function Profil({
  constats,
  t,
}: {
  constats: ConstatProfil[];
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  if (constats.length === 0) return null;
  const conforme = constats.length === 1 && constats[0].code === "conforme";
  const court = constats.length === 1 && constats[0].code === "journal_trop_court";

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <UserRound className="h-4 w-4" />
        {t("bt_prof_titre")}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_prof_intro")}</p>

      <ul className="mt-3 space-y-2">
        {constats.map((c) => {
          const neutre = c.code === "conforme" || c.code === "journal_trop_court";
          return (
            <li
              key={c.code}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-[11px] leading-relaxed",
                c.code === "conforme"
                  ? "border-profit/40 bg-profit/[0.06] text-foreground-muted"
                  : neutre
                    ? "border-border bg-surface/40 text-foreground-muted"
                    : "border-warning/40 bg-warning/[0.06] text-warning",
              )}
            >
              {c.code === "conforme" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
              ) : neutre ? null : (
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{t(`bt_prof_${c.code}`, c.valeurs)}</span>
            </li>
          );
        })}
      </ul>

      {/* ⚠️ LA CONCLUSION QUE L'OUTIL NE SAVAIT PAS FORMULER, et qui est
          pourtant la plus fréquente : « ta méthode tient debout, c'est ton
          exécution qui te coûte ». Elle ne s'affiche que quand un écart de
          comportement existe vraiment. */}
      {!conforme && !court ? (
        <p className="mt-3 rounded-lg border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-foreground-muted">
          {t("bt_prof_lecture")}
        </p>
      ) : null}
    </Card>
  );
}
