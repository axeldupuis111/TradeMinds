"use client";

import { Card } from "@/components/ui/Card";
import { nomDuMarche } from "@/lib/backtest/phrases";
import { cn } from "@/lib/cn";
import {
  confronterAuMarche,
  EFFICIENCE_DIRECTIONNELLE,
  EFFICIENCE_SANS_DIRECTION,
  type CaractereMarche,
} from "@/lib/backtest/caractere-marche";
import type { Instrument } from "@/lib/backtest/instruments";
import type { Methode } from "@/lib/backtest/methodes";
import { AlertTriangle, CheckCircle2, Gauge, Info } from "lucide-react";
import { pourcent, nombre } from "@/lib/nombres";

/**
 * CE QUE VAUT CE MARCHÉ, ET SI TA MÉTHODE Y EST CHEZ ELLE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CET ÉCRAN ──────────────────────────────────
 *
 * « Certaines stratégies sont adaptées à des actifs précis. » Répété plusieurs
 * fois, et l'outil n'en faisait rien : il rejouait une méthode sur le marché
 * choisi, et si ça ne marchait pas, il disait non sans jamais dire pourquoi.
 *
 * ── POURQUOI CETTE CARTE N'EST PAS UNE PÊCHE AU BON MARCHÉ ──────────────────
 *
 * ⚠️⚠️ AUCUN CHIFFRE DE PERFORMANCE N'ENTRE ICI. Essayer huit marchés et garder
 * celui où la stratégie sort le mieux, c'est du sur-apprentissage déplacé, et la
 * carte « ta méthode sur d'autres marchés » existe pour le refuser.
 *
 * Celle-ci mesure des propriétés du MARCHÉ sur les bougies seules : le prix
 * est-il allé quelque part, la journée se joue-t-elle en quelques heures, que
 * coûte un aller-retour rapporté à une bougie. Puis elle les confronte à ce que
 * la méthode DÉCLARE exiger. C'est vérifier qu'on apporte un marteau à un clou,
 * pas choisir le clou qui rend le mieux.
 *
 * ⚠️ LES SEUILS SONT AFFICHÉS À CÔTÉ DES CHIFFRES QU'ILS CLASSENT. Un seuil
 * caché est un jugement déguisé en mesure.
 */
export function CaractereDuMarche({
  caractere,
  instrument,
  uniteDeTemps,
  methode,
  onDeclarerMethode,
  t,
}: {
  caractere: CaractereMarche;
  instrument: Instrument;
  uniteDeTemps: number;
  /** La méthode déclarée, quand il en a choisi une. */
  methode?: Methode;
  /**
   * Emmener le trader déclarer sa méthode.
   *
   * ⚠️⚠️ « DÉCLARE TA MÉTHODE PLUS HAUT » DÉSIGNAIT UNE AUTRE ÉTAPE. Ce bloc
   * vit à l'étape « Tes règles » ; « Ta méthode » vit à l'étape « Ta
   * stratégie », dont rien n'est rendu ici. Le trader remonte et ne trouve
   * rien : une indication de direction au lieu du geste.
   */
  onDeclarerMethode: () => void;
  t: (cle: string, params?: Record<string, string | number>) => string;
}) {
  const accords = methode ? confronterAuMarche(methode.besoinsMarche, caractere) : [];

  return (
    <Card className="p-4 sm:p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Gauge className="h-4 w-4" />
        {t("bt_car_titre", { marche: nomDuMarche(instrument.code, instrument.nom, t) })}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("bt_car_intro")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Mesure
          titre={t("bt_car_efficience")}
          valeur={nombre(caractere.efficience, 2)}
          aide={t(
            caractere.efficience >= EFFICIENCE_DIRECTIONNELLE
              ? "bt_car_efficience_haute"
              : caractere.efficience <= EFFICIENCE_SANS_DIRECTION
                ? "bt_car_efficience_basse"
                : "bt_car_efficience_entre",
            {
              haut: EFFICIENCE_DIRECTIONNELLE,
              bas: EFFICIENCE_SANS_DIRECTION,
              minutes: uniteDeTemps,
            },
          )}
        />
        <Mesure
          titre={t("bt_car_seance")}
          valeur={`${pourcent((caractere.concentrationSeance * 100))}`}
          aide={t("bt_car_seance_aide", {
            heure: `${String(caractere.heurePointe).padStart(2, "0")}:00`,
          })}
        />
        <Mesure
          titre={t("bt_car_cout")}
          valeur={`${pourcent((caractere.coutEnBougies * 100))}`}
          aide={t("bt_car_cout_aide", {
            amplitude: nombre(caractere.amplitudePoints, 2),
            minutes: uniteDeTemps,
          })}
        />
      </div>

      {/* ── Ta méthode y est-elle chez elle ? ────────────────────────────── */}
      {methode ? (
        accords.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_car_sans_besoin", { methode: t(`bt_meth_${methode.code}`) })}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {accords.map((a) => (
              <li
                key={a.besoin}
                className={cn(
                  "flex items-start gap-1.5 rounded-lg border p-3 text-[11px] leading-relaxed",
                  a.code === "va_bien"
                    ? "border-profit/40 bg-profit/[0.06] text-foreground-muted"
                    : a.code === "contre_nature" || a.code === "sans_seance"
                      ? "border-warning/40 bg-warning/[0.06] text-warning"
                      : "border-border bg-surface/40 text-foreground-muted",
                )}
              >
                {a.code === "va_bien" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
                ) : a.code === "sans_caractere" ? (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {t(`bt_car_${a.besoin}_${a.code}`, {
                    ...a.valeurs,
                    methode: t(`bt_meth_${methode.code}`),
                    marche: nomDuMarche(instrument.code, instrument.nom, t),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="mt-3">
          <p className="text-[11px] leading-relaxed text-foreground-muted">
            {t("bt_car_sans_methode")}
          </p>
          <button
            type="button"
            onClick={onDeclarerMethode}
            className="mt-2 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground-muted hover:border-accent/50 hover:text-foreground"
          >
            {t("bt_car_aller_methode")}
          </button>
        </div>
      )}

      {/* ⚠️ CE QUE CETTE CARTE NE FAIT PAS, dit ici pour qu'on ne le lui
          demande jamais. */}
      <p className="mt-3 text-[11px] leading-relaxed text-foreground-muted">
        {t("bt_car_pas_un_classement")}
      </p>
    </Card>
  );
}

function Mesure({ titre, valeur, aide }: { titre: string; valeur: string; aide: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-medium text-foreground">{titre}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{valeur}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">{aide}</p>
    </div>
  );
}
