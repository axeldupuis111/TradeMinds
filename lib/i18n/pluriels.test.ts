import { describe, expect, it } from "vitest";
import fr from "./fr";

/**
 * « 1 LIGNES », « 1 ESSAIS », « 1 ÉCRITES », « 7.05 BOUGIE ».
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX FOIS LA MÊME FAUTE, SIX PILOTAGES DIFFÉRENTS, dont trois dans des
 * phrases que je venais d'écrire :
 *
 *   « 1 essais sur cette stratégie »
 *   « ton stop vaut 7.05 bougie »
 *   « projection sur 1 ans »
 *   « 1 écrites de ta main »
 *   « 1 des 5 lignes sont calculables »
 *   « 1 lignes de ce plan ne sont pas encore écrites »
 *
 * Elle ne se voit JAMAIS en relisant la rédaction : le gabarit dit « {n} lignes »
 * et il a l'air juste. Elle n'apparaît qu'avec la valeur 1, donc seulement à
 * l'écran, donc seulement en pilotant. C'est exactement le genre de défaut qu'un
 * test doit attraper à ma place.
 *
 * ── CE QUE FAIT CE TEST ─────────────────────────────────────────────────────
 *
 * Il rend chaque phrase française qui porte un compte AVEC LA VALEUR 1, et
 * refuse « 1 » suivi d'un mot au pluriel. Rien de plus : c'est mécanique, et
 * c'est suffisant.
 *
 * ⚠️ IL NE VÉRIFIE QUE LE FRANÇAIS, et c'est délibéré. L'anglais accorde peu,
 * l'espagnol et l'allemand ont leurs propres règles, et un garde approximatif
 * sur trois langues serait désarmé au premier faux positif. La faute est
 * française, le garde l'est aussi.
 */

/**
 * Les compteurs : les variables qui portent un nombre.
 *
 * ⚠️ PAS TOUTES LES VARIABLES. « {pct} % » et « {r} R » sont suivis d'une unité
 * invariable ; c'est devant un NOM que l'accord se joue.
 */
const COMPTEURS = [
  "n",
  "total",
  "trades",
  "essais",
  "ouverts",
  "etablis",
  "rendues",
  "mesurees",
  "reglees",
  "ecrites",
  "manquantes",
  "penchent",
  "comparaisons",
  "tranches",
  "fois",
  "mois",
  "ecrits",
  "bougies",
];

/**
 * Ce qu'on refuse : « 1 » puis un mot au pluriel.
 *
 * ⚠️ LES EXCEPTIONS SONT DE VRAIS MOTS INVARIABLES au singulier, pas des
 * tolérances : « 1 fois », « 1 mois », « 1 pas », « 1 cours ». Les lister est
 * plus sûr que d'exclure tout mot en -s, qui laisserait passer « 1 lignes ».
 */
const INVARIABLES = new Set([
  "fois",
  "mois",
  "pas",
  "cours",
  "puis",
  "sans",
  "mais",
  "plus",
  "moins",
  "dans",
  "sous",
  "vers",
  "dès",
  "très",
  "tous",
  "jours",
  // « 1 des 5 lignes » est du francais correct : « un des » est une tournure,
  // pas un accord rate.
  "des",
]);

const PLURIEL_APRES_UN = /\b1\s+([a-zéèêàîôûç]+s)\b/gi;

describe("les phrases qui portent un compte", () => {
  const dico = fr as Record<string, string>;

  /**
   * ⚠️ LES CLÉS DE L'ONGLET BACKTEST, ET UNE PAIRE SINGULIER/PLURIEL VAUT
   * ACQUITTEMENT.
   *
   * Le premier passage a signalé une trentaine de clés dans tout le reste de
   * l'application. Beaucoup sont de FAUX POSITIFS : elles ont une sœur au
   * singulier (`_un`, `_one`, `_1`) que l'appelant choisit quand le compte vaut
   * un, exactement comme il faut. Les compter comme des fautes rendrait le
   * garde bruyant, et un garde bruyant finit désactivé.
   *
   * ⚠️ LE RESTE DE L'APPLICATION N'EST PAS EXAMINÉ ICI, et ce n'est pas un
   * oubli : ce garde est né d'une faute répétée six fois dans cet onglet-là.
   * L'étendre sans avoir vérifié les autres écrans transformerait un test qui
   * mord en un test qu'on met en commentaire.
   */
  /**
   * Les comptes qui ne peuvent PAS valoir un, avec la raison.
   *
   * ⚠️⚠️ UNE EXEMPTION EXIGE UN PLANCHER ÉCRIT, et c'est ce qui empêche cette
   * liste de devenir une poubelle. « Ce chiffre ne vaut jamais un » est une
   * affirmation vérifiable ; « cette clé m'embête » ne l'est pas.
   *
   * ⚠️ ET LE DÉFAUT EST L'INVERSE : une clé NON listée est vérifiée. C'est ce
   * qui a rattrapé six fautes, dont trois dans des phrases que je venais
   * d'écrire. Une nouvelle rédaction est gardée sans que personne y pense.
   */
  const PLANCHERS: Record<string, string> = {
    // Aucun chiffre de performance n'est rendu sous cent trades : le verdict,
    // la synthèse et les leviers ne parlent jamais d'un échantillon plus petit.
    bt_verdict_phrase: "MIN_TRADES_CONCLUSION = 100",
    bt_verdict_insuffisant_detail: "affiché seulement sous le seuil, jamais à 1",
    bt_syn_echantillon_etabli: "MIN_TRADES_CONCLUSION = 100",
    bt_syn_echantillon_pas_etabli: "borne basse du même seuil",
    bt_syn_hors_periode_etabli: "contrôle exigeant 30 trades de chaque côté",
    bt_syn_hors_periode_pas_etabli_non_concluant: "idem",
    bt_syn_hors_periode_pas_etabli_insuffisant: "idem",
    bt_hors_trades: "idem",
    bt_ver_controlee: "idem",
    bt_exp_confirmation_ok: "fenêtre de confirmation, minimum 30 trades",
    bt_plan_etat_indecidable: "idem",
    bt_proj_intro: "projection refusée sous cent trades",
    bt_sauver_mesure: "on n'enregistre pas une version sans conclusion",
    bt_coh_objectif_jamais_atteint: "constat exigeant 30 trades",
    bt_levier_unite_de_temps: "un levier ne se propose que sur un rejeu conclu",
    bt_levier_seance: "idem",
    bt_levier_pivots: "idem",
    bt_levier_touches: "idem",
    bt_levier_tolerance: "idem",
    bt_levier_delai: "idem",
    bt_diag_objectif_trop_pres: "MIN_TRADES_TRANCHE = 30",
    bt_diag_heure_qui_perd: "idem",
    bt_diag_sens_qui_perd: "idem",
    bt_cond_cout_annuel: "rythme annuel calculé sur un rejeu conclu",
    bt_cond_risque_contre_serie: "une série qui coupe un compte en deux n'est jamais d'une perte",
    bt_faire_elargir_la_periode: "ne s'affiche que si le rejeu a produit des trades sous le seuil",
    bt_sur_apprentissage_alerte: "MAX_TENTATIVES_AVANT_ALERTE = 20",
    bt_exp_regle: "le nombre de tirages d'une recherche, jamais un",
    bt_syn_recherche_bornee_avec_recherche: "somme des essais, au-delà de un dès qu'il y a une recherche",
    bt_syn_recherche_bornee_avec_recherche_au_dela: "idem, au-delà du seuil de 20",
  };

  /**
   * ⚠️ UN PLANCHER SUR UNE CLÉ MORTE NE PROTÈGE RIEN, et laisse croire le
   * contraire. Si une clé exemptée disparaît, le test le dit.
   */
  it("n'exempte que des clés qui existent encore", () => {
    const fantomes = Object.keys(PLANCHERS).filter((c) => typeof dico[c] !== "string");
    expect(fantomes).toEqual([]);
  });

  const aUneSoeurAuSingulier = (cle: string) =>
    [`${cle}_un`, `${cle}_une`, `${cle}_one`, `${cle}_1`, cle.replace(/_many$/, "_one")].some(
      (c) => c !== cle && typeof dico[c] === "string",
    );

  it("s'accordent quand le compte vaut un", () => {
    const fautes: string[] = [];
    for (const [cle, gabarit] of Object.entries(dico)) {
      if (typeof gabarit !== "string") continue;
      if (!cle.startsWith("bt_")) continue;
      if (aUneSoeurAuSingulier(cle)) continue;
      if (PLANCHERS[cle]) continue;
      const compteurs = COMPTEURS.filter((c) => gabarit.includes(`{${c}}`));
      if (compteurs.length === 0) continue;

      // Un seul compteur à la fois : deux valeurs à 1 dans la même phrase
      // produiraient des faux positifs croisés.
      for (const c of compteurs) {
        let rendu = gabarit.split(`{${c}}`).join("1");
        // Les autres variables prennent une valeur neutre qui n'introduit
        // jamais de « 1 ».
        for (const autre of compteurs) {
          if (autre !== c) rendu = rendu.split(`{${autre}}`).join("7");
        }
        rendu = rendu.replace(/\{[a-zA-Z]+\}/g, "7");

        for (const m of rendu.matchAll(PLURIEL_APRES_UN)) {
          const mot = m[1].toLowerCase();
          if (INVARIABLES.has(mot)) continue;
          fautes.push(`${cle} (avec {${c}} = 1) → « 1 ${m[1]} »`);
        }
      }
    }
    expect(Array.from(new Set(fautes))).toEqual([]);
  });

  /**
   * ⚠️ ET LE GARDE MORD : on lui donne la phrase exacte qui est passée six fois.
   * Un test de garde qu'on ne vérifie pas est un test qu'on croit avoir.
   */
  it("attrape la phrase qui est passée six fois", () => {
    const gabarit = "{n} lignes de ce plan ne sont pas encore écrites.";
    const rendu = gabarit.split("{n}").join("1");
    const trouve = Array.from(rendu.matchAll(PLURIEL_APRES_UN)).filter(
      (m) => !INVARIABLES.has(m[1].toLowerCase()),
    );
    expect(trouve).toHaveLength(1);
    expect(trouve[0][1]).toBe("lignes");
  });

  it("ne crie pas sur un mot réellement invariable", () => {
    const rendu = "Cette règle se serait déclenchée 1 fois sur la période.";
    const trouve = Array.from(rendu.matchAll(PLURIEL_APRES_UN)).filter(
      (m) => !INVARIABLES.has(m[1].toLowerCase()),
    );
    expect(trouve).toHaveLength(0);
  });
});
