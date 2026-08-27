"use client";

import { Bascule, Bloc, Champ, Heure, Liste, Nombre } from "./Controles";
import type { Instrument } from "@/lib/backtest/instruments";
import { UNITES_DE_TEMPS, champDeBase } from "@/lib/backtest/compilation";
import type {
  BlocConfirmation,
  Couts,
  JourSemaine,
  PlanExecution,
} from "@/lib/backtest/types";

/**
 * LE PLAN, ENTIÈREMENT MODIFIABLE.
 *
 * C'est la moitié de la demande d'origine : « il faut pouvoir modifier et créer
 * tous les paramètres ». L'autre moitié est le compilateur, qui pré-remplit
 * depuis la fiche. Les deux servent le même écran, et le trader doit pouvoir
 * partir de rien aussi bien que de sa fiche.
 *
 * ⚠️ AUCUN CHAMP N'EST CACHÉ « POUR SIMPLIFIER ». Un paramètre invisible est un
 * paramètre que le trader subit : il verrait un chiffre sans savoir de quoi il
 * dépend, ce qui est précisément le défaut des outils de backtest qu'on essaie
 * de ne pas reproduire.
 *
 * ⚠️ LES COÛTS SE SAISISSENT EN UNITÉS DE PRIX, JAMAIS EN TICKS. « 20 » ne veut
 * rien dire pour un trader : 0,20 $ de spread sur l'or, si. La conversion en
 * ticks se fait à l'enregistrement, une seule fois.
 */

const JOURS: { valeur: JourSemaine; label: string }[] = [
  { valeur: 1, label: "L" },
  { valeur: 2, label: "M" },
  { valeur: 3, label: "M" },
  { valeur: 4, label: "J" },
  { valeur: 5, label: "V" },
  { valeur: 6, label: "S" },
  { valeur: 0, label: "D" },
];

export interface EditeurProps {
  plan: PlanExecution;
  instrument: Instrument;
  onChange: (p: PlanExecution) => void;
  /**
   * Blocs que le trader a marqués « ce n'est pas ça » depuis la carte de
   * couverture. Ils s'entourent de rouge ici : c'est ce qui relie le refus au
   * réglage à corriger.
   */
  contestes: Set<string>;
  t: (k: string, v?: Record<string, string | number>) => string;
}

export function EditeurPlan({ plan, instrument, onChange, contestes, t }: EditeurProps) {
  const maj = (partiel: Partial<PlanExecution>) => onChange({ ...plan, ...partiel });

  /**
   * Message d'alerte si l'un des champs de ce bloc a été contesté.
   *
   * ⚠️ ON COMPARE SUR LA BASE DU NOM, PAS SUR LE NOM ENTIER. Le modèle rend
   * volontiers « niveau - pivots » ou « stop - bufferTicks » : en comparant
   * bêtement, le bloc ne s'entourait jamais de rouge alors que la carte venait
   * de promettre qu'il le serait, et le trader cherchait sans trouver.
   */
  const bases = new Set(Array.from(contestes, champDeBase));
  const alerte = (...champs: string[]) =>
    champs.some((c) => bases.has(c)) ? t("bt_bloc_conteste") : undefined;

  /** Les coûts vivent en ticks dans le plan, en prix à l'écran. */
  const prix = (ticks: number) => Number((ticks * instrument.tailleTick).toFixed(instrument.decimales + 1));
  const enTicks = (p: number) => Math.max(0, Math.round(p / instrument.tailleTick));
  const majCouts = (c: Partial<Couts>) => maj({ couts: { ...plan.couts, ...c } });

  const aConfirmation = (type: BlocConfirmation["type"]) =>
    plan.confirmations.some((c) => c.type === type);

  const basculerConfirmation = (conf: BlocConfirmation) => {
    const presente = aConfirmation(conf.type);
    maj({
      confirmations: presente
        ? plan.confirmations.filter((c) => c.type !== conf.type)
        : [...plan.confirmations, conf],
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Quand on regarde ─────────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_contexte")} soustitre={t("bt_bloc_contexte_aide")} alerte={alerte("uniteDeTemps", "sens", "contexte", "seance")}>
        {/* ⚠️ En tête, parce que c'est le réglage le plus lourd de la page :
            lire une stratégie de M3 sur des bougies M1 change la taille des
            stops structurels d'un facteur dix, et donc tout le résultat. */}
        <Champ label={t("bt_unite_de_temps")} aide={t("bt_unite_de_temps_aide")}>
          <Liste
            valeur={String(plan.uniteDeTemps ?? 1)}
            onChange={(v) => maj({ uniteDeTemps: Number(v) })}
            options={UNITES_DE_TEMPS.map((m) => ({
              valeur: String(m),
              label: m < 60 ? `M${m}` : `H${m / 60}`,
            }))}
          />
        </Champ>
        <Champ label={t("bt_sens")}>
          <Liste
            valeur={plan.sens}
            onChange={(sens) => maj({ sens })}
            options={[
              { valeur: "les_deux", label: t("bt_sens_deux") },
              { valeur: "long", label: t("bt_sens_long") },
              { valeur: "short", label: t("bt_sens_short") },
            ]}
          />
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ label={t("bt_heure_debut")}>
            <Heure valeur={plan.contexte.debut} onChange={(debut) => maj({ contexte: { ...plan.contexte, debut } })} />
          </Champ>
          <Champ label={t("bt_heure_fin")}>
            <Heure valeur={plan.contexte.fin} onChange={(fin) => maj({ contexte: { ...plan.contexte, fin } })} />
          </Champ>
        </div>
        <Champ label={t("bt_jours")} aide={t("bt_jours_aide")} className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {JOURS.map((j, i) => (
              <Bascule
                key={`${j.valeur}-${i}`}
                label={j.label}
                actif={plan.contexte.jours.includes(j.valeur)}
                onChange={(actif) =>
                  maj({
                    contexte: {
                      ...plan.contexte,
                      jours: actif
                        ? [...plan.contexte.jours, j.valeur]
                        : plan.contexte.jours.filter((x) => x !== j.valeur),
                    },
                  })
                }
              />
            ))}
          </div>
        </Champ>
      </Bloc>

      {/* ── Le niveau ────────────────────────────────────────────────────── */}
      <Bloc
        titre={t("bt_bloc_niveau")}
        soustitre={
          plan.niveau.type === "trendline" ? t("bt_bloc_niveau_trendline_aide") : t("bt_bloc_niveau_aide")
        }
        alerte={alerte("niveau")}
      >
        <Champ label={t("bt_type")}>
          <Liste
            valeur={plan.niveau.type}
            onChange={(type) => {
              if (type === "range_horaire") maj({ niveau: { type, debut: "15:30", fin: "15:35" } });
              else if (type === "extremes_n_bougies") maj({ niveau: { type, n: 20 } });
              else if (type === "liquidite_swing") maj({ niveau: { type, pivots: 20 } });
              else if (type === "trendline")
                maj({ niveau: { type, pivots: 10, touchesMin: 3, toleranceTicks: enTicks(instrument.spread * 2) } });
              else maj({ niveau: { type: "extremes_veille" } });
            }}
            options={[
              { valeur: "trendline", label: t("bt_niveau_trendline") },
              { valeur: "liquidite_swing", label: t("bt_niveau_liquidite") },
              { valeur: "range_horaire", label: t("bt_niveau_range") },
              { valeur: "extremes_n_bougies", label: t("bt_niveau_extremes") },
              { valeur: "extremes_veille", label: t("bt_niveau_veille") },
            ]}
          />
        </Champ>
        {plan.niveau.type === "liquidite_swing" ? (
          <Champ label={t("bt_pivots")} aide={t("bt_pivots_aide")}>
            <Nombre
              valeur={plan.niveau.pivots}
              min={2}
              max={500}
              onChange={(pivots) => maj({ niveau: { type: "liquidite_swing", pivots } })}
              suffixe={t("bt_unite_bougies")}
            />
          </Champ>
        ) : null}
        {plan.niveau.type === "trendline" ? (
          <>
            {/* ⚠️ L'ORDRE COMPTE. Une trendline SE DÉFINIT par « au moins trois
                sommets alignés » : c'est ça, le réglage. La largeur du pivot
                n'est qu'un détail d'implémentation, la réponse à « qu'est-ce
                qu'un sommet ». En l'affichant en premier, on faisait passer
                l'accessoire pour la définition, et un trader y lisait à juste
                titre qu'on avait mal compris sa méthode. */}
            <Champ label={t("bt_touches_min")} aide={t("bt_touches_min_aide")}>
              <Nombre
                valeur={plan.niveau.touchesMin}
                min={3}
                max={20}
                onChange={(touchesMin) =>
                  maj({ niveau: { ...(plan.niveau as Extract<typeof plan.niveau, { type: "trendline" }>), touchesMin } })
                }
              />
            </Champ>
            <Champ label={t("bt_tolerance_touche")} aide={t("bt_tolerance_touche_aide")}>
              <Nombre
                valeur={prix(plan.niveau.toleranceTicks)}
                min={0}
                pas={instrument.tailleTick}
                onChange={(v) =>
                  maj({
                    niveau: {
                      ...(plan.niveau as Extract<typeof plan.niveau, { type: "trendline" }>),
                      toleranceTicks: enTicks(v),
                    },
                  })
                }
              />
            </Champ>
            <Champ
              label={t("bt_definition_sommet")}
              aide={t("bt_definition_sommet_aide")}
              className="sm:col-span-2"
            >
              <Nombre
                valeur={plan.niveau.pivots}
                min={2}
                max={500}
                suffixe={t("bt_unite_bougies")}
                onChange={(pivots) =>
                  maj({ niveau: { ...(plan.niveau as Extract<typeof plan.niveau, { type: "trendline" }>), pivots } })
                }
              />
            </Champ>
          </>
        ) : null}
        {plan.niveau.type === "extremes_n_bougies" ? (
          <Champ label={t("bt_n_bougies")}>
            <Nombre
              valeur={plan.niveau.n}
              min={2}
              max={500}
              onChange={(n) => maj({ niveau: { type: "extremes_n_bougies", n } })}
              suffixe={t("bt_unite_bougies")}
            />
          </Champ>
        ) : null}
        {plan.niveau.type === "range_horaire" ? (
          <div className="grid grid-cols-2 gap-3">
            <Champ label={t("bt_range_debut")}>
              <Heure
                valeur={plan.niveau.debut}
                onChange={(debut) =>
                  maj({ niveau: { type: "range_horaire", debut, fin: (plan.niveau as { fin: string }).fin } })
                }
              />
            </Champ>
            <Champ label={t("bt_range_fin")}>
              <Heure
                valeur={plan.niveau.fin}
                onChange={(fin) =>
                  maj({ niveau: { type: "range_horaire", debut: (plan.niveau as { debut: string }).debut, fin } })
                }
              />
            </Champ>
          </div>
        ) : null}
      </Bloc>

      {/* ── Le déclencheur ───────────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_declencheur")} soustitre={t("bt_bloc_declencheur_aide")} alerte={alerte("declencheur")}>
        <Champ label={t("bt_type")} className="sm:col-span-2">
          <Liste
            valeur={plan.declencheur.type}
            onChange={(type) => {
              if (type === "cassure") maj({ declencheur: { type, mode: "cloture" } });
              else if (type === "balayage_retour") maj({ declencheur: { type } });
              else if (type === "retest_apres_cassure")
                maj({ declencheur: { type, delaiMaxBarres: 10, toleranceTicks: 2 } });
              else if (type === "fvg_puis_retest") maj({ declencheur: { type, delaiMaxBarres: 5 } });
              else maj({ declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 } });
            }}
            options={[
              { valeur: "balayage_puis_fvg", label: t("bt_decl_balayage_fvg") },
              { valeur: "balayage_retour", label: t("bt_decl_balayage") },
              { valeur: "fvg_puis_retest", label: t("bt_decl_fvg") },
              { valeur: "retest_apres_cassure", label: t("bt_decl_retest") },
              { valeur: "cassure", label: t("bt_decl_cassure") },
            ]}
          />
        </Champ>
        {plan.declencheur.type === "cassure" ? (
          <Champ label={t("bt_mode")} aide={t("bt_mode_aide")}>
            <Liste
              valeur={plan.declencheur.mode}
              onChange={(mode) => maj({ declencheur: { type: "cassure", mode } })}
              options={[
                { valeur: "cloture", label: t("bt_mode_cloture") },
                { valeur: "meche", label: t("bt_mode_meche") },
              ]}
            />
          </Champ>
        ) : null}
        {plan.declencheur.type === "balayage_puis_fvg" ? (
          <>
            <Champ label={t("bt_delai_reaction")} aide={t("bt_delai_reaction_aide")}>
              <Nombre
                valeur={plan.declencheur.delaiReaction}
                min={1}
                max={500}
                suffixe={t("bt_unite_bougies")}
                onChange={(delaiReaction) =>
                  maj({
                    declencheur: {
                      type: "balayage_puis_fvg",
                      delaiReaction,
                      delaiRetest: (plan.declencheur as { delaiRetest: number }).delaiRetest,
                    },
                  })
                }
              />
            </Champ>
            <Champ label={t("bt_delai_retest")} aide={t("bt_delai_retest_aide")}>
              <Nombre
                valeur={plan.declencheur.delaiRetest}
                min={1}
                max={500}
                suffixe={t("bt_unite_bougies")}
                onChange={(delaiRetest) =>
                  maj({
                    declencheur: {
                      type: "balayage_puis_fvg",
                      delaiReaction: (plan.declencheur as { delaiReaction: number }).delaiReaction,
                      delaiRetest,
                    },
                  })
                }
              />
            </Champ>
          </>
        ) : null}
        {plan.declencheur.type === "fvg_puis_retest" ? (
          <Champ label={t("bt_delai_retest")}>
            <Nombre
              valeur={plan.declencheur.delaiMaxBarres}
              min={1}
              max={500}
              suffixe={t("bt_unite_bougies")}
              onChange={(delaiMaxBarres) => maj({ declencheur: { type: "fvg_puis_retest", delaiMaxBarres } })}
            />
          </Champ>
        ) : null}
        {plan.declencheur.type === "retest_apres_cassure" ? (
          <>
            <Champ label={t("bt_delai_retest")}>
              <Nombre
                valeur={plan.declencheur.delaiMaxBarres}
                min={1}
                max={500}
                suffixe={t("bt_unite_bougies")}
                onChange={(delaiMaxBarres) =>
                  maj({
                    declencheur: {
                      type: "retest_apres_cassure",
                      delaiMaxBarres,
                      toleranceTicks: (plan.declencheur as { toleranceTicks: number }).toleranceTicks,
                    },
                  })
                }
              />
            </Champ>
            <Champ label={t("bt_tolerance")}>
              <Nombre
                valeur={prix(plan.declencheur.toleranceTicks)}
                min={0}
                pas={instrument.tailleTick}
                onChange={(v) =>
                  maj({
                    declencheur: {
                      type: "retest_apres_cassure",
                      delaiMaxBarres: (plan.declencheur as { delaiMaxBarres: number }).delaiMaxBarres,
                      toleranceTicks: enTicks(v),
                    },
                  })
                }
              />
            </Champ>
          </>
        ) : null}
      </Bloc>

      {/* ── Confirmations ────────────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_confirmations")} soustitre={t("bt_bloc_confirmations_aide")} alerte={alerte("confirmations")}>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2">
          <Bascule
            label={t("bt_conf_reaction")}
            actif={aConfirmation("bougie_reaction")}
            onChange={() => basculerConfirmation({ type: "bougie_reaction" })}
          />
          <Bascule
            label={t("bt_conf_moyenne")}
            actif={aConfirmation("biais_moyenne")}
            onChange={() => basculerConfirmation({ type: "biais_moyenne", periode: 50 })}
          />
          <Bascule
            label={t("bt_conf_amplitude")}
            actif={aConfirmation("amplitude_min")}
            onChange={() => basculerConfirmation({ type: "amplitude_min", ticks: enTicks(instrument.spread * 3) })}
          />
        </div>
      </Bloc>

      {/* ── Entrée, stop, objectif ───────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_execution")} soustitre={t("bt_bloc_execution_aide")} alerte={alerte("entree", "stop", "objectif")}>
        <Champ label={t("bt_entree")}>
          <Liste
            valeur={plan.entree.type}
            onChange={(type) =>
              maj({
                entree:
                  type === "limite_au_niveau"
                    ? { type, valableNBarres: 10 }
                    : { type: "open_bougie_suivante" },
              })
            }
            options={[
              { valeur: "open_bougie_suivante", label: t("bt_entree_open") },
              { valeur: "limite_au_niveau", label: t("bt_entree_limite") },
            ]}
          />
        </Champ>
        {plan.entree.type === "limite_au_niveau" ? (
          <Champ label={t("bt_limite_validite")}>
            <Nombre
              valeur={plan.entree.valableNBarres}
              min={1}
              max={500}
              suffixe={t("bt_unite_bougies")}
              onChange={(valableNBarres) => maj({ entree: { type: "limite_au_niveau", valableNBarres } })}
            />
          </Champ>
        ) : null}

        <Champ label={t("bt_stop")}>
          <Liste
            valeur={plan.stop.type}
            onChange={(type) => {
              if (type === "fixe") maj({ stop: { type, ticks: enTicks(instrument.spread * 10) } });
              else maj({ stop: { type, bufferTicks: 1 } });
            }}
            options={[
              { valeur: "dernier_pivot", label: t("bt_stop_dernier_pivot") },
              { valeur: "extreme_balayage", label: t("bt_stop_balayage") },
              { valeur: "structurel", label: t("bt_stop_structurel") },
              { valeur: "niveau_oppose", label: t("bt_stop_oppose") },
              { valeur: "fixe", label: t("bt_stop_fixe") },
            ]}
          />
        </Champ>
        {plan.stop.type === "fixe" ? (
          <Champ label={t("bt_stop_distance")}>
            <Nombre
              valeur={prix(plan.stop.ticks)}
              min={instrument.tailleTick}
              pas={instrument.tailleTick}
              onChange={(v) => maj({ stop: { type: "fixe", ticks: Math.max(1, enTicks(v)) } })}
            />
          </Champ>
        ) : (
          <Champ label={t("bt_stop_buffer")} aide={t("bt_stop_buffer_aide")}>
            <Nombre
              valeur={prix(plan.stop.bufferTicks)}
              min={0}
              pas={instrument.tailleTick}
              onChange={(v) =>
                maj({
                  stop: {
                    type: plan.stop.type as
                      | "structurel"
                      | "niveau_oppose"
                      | "extreme_balayage"
                      | "dernier_pivot",
                    bufferTicks: enTicks(v),
                  },
                })
              }
            />
          </Champ>
        )}

        <Champ label={t("bt_objectif")}>
          <Liste
            valeur={plan.objectif.type}
            onChange={(type) =>
              maj({ objectif: type === "multiple_r" ? { type, r: 2 } : { type: "niveau_oppose" } })
            }
            options={[
              { valeur: "multiple_r", label: t("bt_objectif_r") },
              { valeur: "niveau_oppose", label: t("bt_objectif_oppose") },
            ]}
          />
        </Champ>
        {plan.objectif.type === "multiple_r" ? (
          <Champ label={t("bt_objectif_valeur")}>
            <Nombre
              valeur={plan.objectif.r}
              min={0.1}
              max={20}
              pas={0.1}
              suffixe="R"
              onChange={(r) => maj({ objectif: { type: "multiple_r", r } })}
            />
          </Champ>
        ) : null}
      </Bloc>

      {/* ── Sorties auxiliaires ──────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_sorties")} soustitre={t("bt_bloc_sorties_aide")} alerte={alerte("sortiesAuxiliaires")}>
        <Champ label={t("bt_break_even")} aide={t("bt_break_even_aide")}>
          <Nombre
            valeur={plan.sortiesAuxiliaires.breakEvenApresR ?? 0}
            min={0}
            max={20}
            pas={0.1}
            suffixe="R"
            onChange={(v) =>
              maj({
                sortiesAuxiliaires: {
                  ...plan.sortiesAuxiliaires,
                  breakEvenApresR: v > 0 ? v : undefined,
                },
              })
            }
          />
        </Champ>
        <Champ label={t("bt_fin_session")} aide={t("bt_fin_session_aide")}>
          <Heure
            valeur={plan.sortiesAuxiliaires.finDeSession ?? ""}
            onChange={(finDeSession) =>
              maj({
                sortiesAuxiliaires: {
                  ...plan.sortiesAuxiliaires,
                  finDeSession: finDeSession || undefined,
                },
              })
            }
          />
        </Champ>
      </Bloc>

      {/* ── Gestion du risque ────────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_gestion")} soustitre={t("bt_bloc_gestion_aide")} alerte={alerte("gestion", "risque")}>
        <Champ label={t("bt_max_trades")}>
          <Nombre
            valeur={plan.gestion.maxTradesParJour ?? 0}
            min={0}
            max={100}
            onChange={(v) => maj({ gestion: { ...plan.gestion, maxTradesParJour: v > 0 ? v : undefined } })}
          />
        </Champ>
        <Champ label={t("bt_max_pertes")}>
          <Nombre
            valeur={plan.gestion.maxPertesConsecutives ?? 0}
            min={0}
            max={50}
            onChange={(v) =>
              maj({ gestion: { ...plan.gestion, maxPertesConsecutives: v > 0 ? v : undefined } })
            }
          />
        </Champ>
        <Champ label={t("bt_max_perte_jour")} aide={t("bt_max_perte_jour_aide")}>
          <Nombre
            valeur={plan.gestion.maxPerteJournaliereR ?? 0}
            min={0}
            max={100}
            pas={0.5}
            suffixe="R"
            onChange={(v) =>
              maj({ gestion: { ...plan.gestion, maxPerteJournaliereR: v > 0 ? v : undefined } })
            }
          />
        </Champ>
      </Bloc>

      {/* ── Coûts ────────────────────────────────────────────────────────── */}
      <Bloc titre={t("bt_bloc_couts")} soustitre={t("bt_bloc_couts_aide")}>
        <Champ label={t("bt_spread")}>
          <Nombre
            valeur={prix(plan.couts.spreadTicks)}
            min={0}
            pas={instrument.tailleTick}
            onChange={(v) => majCouts({ spreadTicks: enTicks(v) })}
          />
        </Champ>
        <Champ label={t("bt_glissement")}>
          <Nombre
            valeur={prix(plan.couts.glissementTicks)}
            min={0}
            pas={instrument.tailleTick}
            onChange={(v) => majCouts({ glissementTicks: enTicks(v) })}
          />
        </Champ>
        <Champ label={t("bt_commission")} aide={t("bt_commission_aide")}>
          <Nombre
            valeur={prix(plan.couts.commissionTicks)}
            min={0}
            pas={instrument.tailleTick}
            onChange={(v) => majCouts({ commissionTicks: enTicks(v) })}
          />
        </Champ>
        <div className="flex items-end sm:col-span-2">
          {/* ⚠️ Le rappel n'est pas décoratif : un backtest à coûts nuls rend
              positives des stratégies qui perdent de l'argent, et c'est le
              défaut exact qu'on a mesuré sur l'outil qui a inspiré celui-ci. */}
          <p className="text-xs leading-snug text-warning">{t("bt_couts_avertissement")}</p>
        </div>
      </Bloc>
    </div>
  );
}
