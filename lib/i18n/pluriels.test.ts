import { describe, expect, it } from "vitest";
import { remplir } from "../backtest/phrases";
import de from "./de";
import en from "./en";
import es from "./es";
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
/**
 * TOUT TROU DE PHRASE EST UN COMPTEUR POTENTIEL.
 *
 * ⚠️⚠️ J'AVAIS ÉCRIT LA LISTE À LA MAIN, ET ELLE A LAISSÉ PASSER LA FAUTE
 * SUIVANTE. « Tes {pertes} pertes d'affilée » ne figurait pas dans mes dix-huit
 * noms, donc personne n'a essayé la valeur 1. C'est exactement la leçon que je
 * m'étais déjà écrite ailleurs : ne jamais taper une liste fermée à la main,
 * la LIRE. Ici il n'y a rien à lire ailleurs : on essaie donc CHAQUE trou.
 *
 * Le coût est quelques essais inutiles ({risque} = 1 ne veut rien dire) ; le
 * contrôle qui suit, lui, ne se déclenche que devant « 1 » suivi d'un mot au
 * pluriel, ce qu'une valeur non comptable ne produit presque jamais.
 */
const compteursDe = (gabarit: string): string[] =>
  Array.from(new Set(Array.from(gabarit.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((m) => m[1])));


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
  // « tu montes a {d9} les jours charges » : un article, jamais un nom compte.
  "les",
  // Symbole d'unite : « 1 ms », comme « 1 kg ». Il ne prend pas la marque du
  // pluriel, et l'ecrire « 1 m » n'aurait aucun sens.
  "ms",
]);

/**
 * ⚠️⚠️ LA CLASSE DE CARACTÈRES DOIT COUVRIR LES ACCENTS DES DEUX CÔTÉS, et ça
 * m'a valu un faux positif que j'ai failli « corriger » dans la phrase :
 * « dont 1 refusé » était signalé comme « 1 refus », parce que \b, qui ne
 * connaît que l'ASCII, voyait une fin de mot juste avant le « é ». Un garde qui
 * accuse une phrase juste apprend à lire ses alertes en diagonale.
 */
const PLURIEL_APRES_UN = /\b1\s+([a-zéèêàîôûç]+s)(?![a-zéèêàîôûç])/gi;

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

  /**
   * QUEL COMPTEUR LA SŒUR AU SINGULIER PREND EN CHARGE.
   *
   * ⚠️⚠️ UNE SŒUR EXEMPTAIT LA PHRASE ENTIÈRE, ET C'ÉTAIT LE TROU. Vu à
   * l'écran : « Ton stop vaut 7.70 bougies de 15 minutes ». La sœur
   * `_une` existe pour le cas où le stop vaut UNE bougie ; elle ne dit rien de
   * `{minutes}`, qui vaut 1 sur un plan en M1 et produisait « de 1 minutes ».
   * Le garde sautait la clé d'un bloc, donc ne regardait plus aucun de ses
   * compteurs.
   *
   * ⚠️ LA RÈGLE JUSTE NE SAUTE QU'UN COMPTEUR, CELUI QUE LA SŒUR COUVRE. Les
   * autres sont vérifiés comme partout ailleurs, et une phrase à deux comptes
   * doit donc porter l'accord sur le second.
   */
  const COUVERT_PAR_LA_SOEUR: Record<string, string> = {
    bt_cond_stop_dans_le_bruit: "bougies",
    bt_collisions: "n",
    bt_pire_journee: "pertes",
    bt_mar_verdict_partage: "retrouves",
    bt_plan_rythme: "d9",
    bt_syn_recherche_bornee_etabli: "essais",
  };

  it("s'accordent quand le compte vaut un", () => {
    const fautes: string[] = [];
    for (const [cle, gabarit] of Object.entries(dico)) {
      if (typeof gabarit !== "string") continue;
      if (!cle.startsWith("bt_")) continue;
      if (PLANCHERS[cle]) continue;
      const tous = compteursDe(gabarit);
      if (tous.length === 0) continue;
      let compteurs = tous;
      if (aUneSoeurAuSingulier(cle)) {
        /**
         * ⚠️ UN SEUL COMPTEUR : la sœur le couvre forcément, rien à déclarer.
         * PLUSIEURS : il faut dire lequel, sinon on retombe sur le trou où une
         * sœur exemptait la phrase entière.
         */
        if (tous.length === 1) continue;
        const couvert = COUVERT_PAR_LA_SOEUR[cle];
        if (couvert === undefined) {
          fautes.push(
            `${cle} porte ${tous.length} comptes et une sœur au singulier : dis lequel elle couvre dans COUVERT_PAR_LA_SOEUR`,
          );
          continue;
        }
        compteurs = tous.filter((c) => c !== couvert);
      }
      if (compteurs.length === 0) continue;

      // Un seul compteur à la fois : deux valeurs à 1 dans la même phrase
      // produiraient des faux positifs croisés.
      for (const c of compteurs) {
        /**
         * ON REND PAR remplir(), LA FONCTION DE LA PAGE, ET PAS PAR UN
         * REMPLACEMENT MAISON. Le jour où la page a appris les accords
         * (« {apres} {apres|bougie|bougies} »), un remplacement maison aurait
         * laissé l'accord non résolu dans le texte : le mot au pluriel
         * disparaissait de la phrase rendue, et le garde déclarait tout propre
         * alors qu'il ne regardait plus rien.
         */
        const valeurs: Record<string, string | number> = {};
        for (const autre of compteurs) valeurs[autre] = autre === c ? 1 : 7;
        const rendu = remplir(gabarit, valeurs);

        for (const m of Array.from(rendu.matchAll(PLURIEL_APRES_UN))) {
          const mot = m[1].toLowerCase();
          if (INVARIABLES.has(mot)) continue;
          fautes.push(`${cle} (avec {${c}} = 1) → « 1 ${m[1]} »`);
        }
      }
    }
    expect(Array.from(new Set(fautes))).toEqual([]);
  });

  /**
   * ⚠️ ET LA TABLE NE NOMME QUE DES COMPTEURS QUI EXISTENT. Une entrée qui
   * désigne un trou disparu exempte alors un compteur au hasard, sans que rien
   * ne le dise.
   */
  it("la table des sœurs ne nomme que des compteurs présents", () => {
    const fautes: string[] = [];
    for (const [cle, compteur] of Object.entries(COUVERT_PAR_LA_SOEUR)) {
      const gabarit = dico[cle];
      if (typeof gabarit !== "string") {
        fautes.push(`${cle} n'existe plus`);
        continue;
      }
      if (!compteursDe(gabarit).includes(compteur)) {
        fautes.push(`${cle} ne porte pas de {${compteur}}`);
      }
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
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

/**
 * UNE FRACTION ÉCRITE EN TOUTES LETTRES À CÔTÉ D'UN POURCENTAGE MESURÉ.
 *
 * ⚠️⚠️ DEUX PHRASES, DEUX DÉFAUTS, ET LE SECOND SE CONTREDISAIT LUI-MÊME :
 *
 *   « 2025-06 apporte 83 % du total à lui seul […] un résultat dont un seul
 *     mois porte LA MOITIÉ n'est pas réparti. »
 *   « {part} % de tes signaux ont été écartés […] le résultat porte sur LA
 *     MOITIÉ de ses signaux qui restait exécutable. »
 *
 * Dans la première, « la moitié » est un seuil et « 83 % » une mesure : rien ne
 * dit au lecteur laquelle des deux quantités le concerne. Dans la seconde, à
 * 30 % d'écartés il en reste 70, pas la moitié : la phrase est simplement
 * fausse, dans la ligne même où elle donne le bon chiffre.
 *
 * ⚠️ C'EST LA FORME DE PRESQUE TOUS LES DÉFAUTS DE CET ONGLET : deux nombres
 * pour le même fait sur le même écran. Ici l'un des deux était écrit en lettres,
 * ce qui l'avait rendu invisible à tous les gardes.
 */
describe("les phrases ne doublent pas un pourcentage par une fraction écrite", () => {
  const dico = fr as Record<string, string>;
  const FRACTIONS = /(la moitié|un tiers|un quart|les deux tiers|les trois quarts)/;
  const POURCENTAGE = /\{[a-zA-Z0-9_]+\} ?%/;

  it("aucune phrase chiffrée n'énonce une fraction en toutes lettres", () => {
    const fautes = Object.entries(dico)
      .filter(([cle, texte]) => cle.startsWith("bt_") && typeof texte === "string")
      .filter(([, texte]) => POURCENTAGE.test(texte) && FRACTIONS.test(texte))
      .map(([cle, texte]) => `${cle} : « ${texte.match(FRACTIONS)![1]} » à côté d'un pourcentage`);
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });

  /** ⚠️ Et le garde mord : on lui redonne la phrase exacte qui est passée. */
  it("attrape la phrase qui se contredisait", () => {
    const passee =
      "{part} % de tes signaux ont été écartés. Le résultat porte sur la moitié de ses signaux.";
    expect(POURCENTAGE.test(passee) && FRACTIONS.test(passee)).toBe(true);
  });
});

/**
 * PAS DE TIRET LONG DANS CE QUE L'APPLICATION ÉCRIT.
 *
 * ⚠️⚠️ RÈGLE POSÉE PAR AXEL, ET JE VIENS DE LA CASSER MOI-MÊME en écrivant
 * « personne — toi compris, dans trois mois — ne peut rejouer ta méthode ».
 * Le tiret long est un marqueur de texte généré : ces phrases sont signées de
 * son produit, pas du mien. Deux points, une virgule ou une parenthèse font le
 * même travail.
 *
 * ⚠️ CE GARDE NE COUVRE QUE L'ONGLET, comme les autres de ce fichier :
 * l'étendre sans avoir relu le reste de l'application le rendrait bruyant, et
 * un garde bruyant finit désactivé.
 */
describe("la ponctuation de l'onglet", () => {
  const TIRET_LONG = String.fromCharCode(8212);

  it("n'utilise jamais de tiret long", () => {
    const fautes: string[] = [];
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      for (const [cle, texte] of Object.entries(dico as Record<string, string>)) {
        if (!cle.startsWith("bt_") || typeof texte !== "string") continue;
        if (texte.includes(TIRET_LONG)) fautes.push(`${cle} (${nom})`);
      }
    }
    expect(fautes, "tiret long : " + fautes.join(", ")).toEqual([]);
  });
});

/**
 * UNE PHRASE IDENTIQUE AU FRANÇAIS EST UNE TRADUCTION OUBLIÉE.
 *
 * ⚠️⚠️ LA PARITÉ DES CLÉS NE DIT RIEN DE LA JUSTESSE. Le test de parité vérifie
 * depuis toujours que les quatre langues ont les mêmes clés ; il passait au vert
 * pendant que « Or (XAU/USD) » s'affichait dans la version anglaise, et il
 * passerait encore si quelqu'un recopiait le français dans les trois autres
 * fichiers pour faire taire la parité. Cette copie-là se voit ici.
 *
 * ⚠️ UNE EXEMPTION EXIGE UNE RAISON ÉCRITE, comme partout dans ce fichier :
 * « ça m'embête » n'en est pas une, « c'est un nom propre » si.
 */
describe("les traductions ne recopient pas le français", () => {
  const dico = fr as Record<string, string>;

  const IDENTIQUES_A_RAISON: Record<string, string> = {
    // Le nom d'une méthode, tel que ses praticiens l'écrivent dans toutes les
    // langues. Le traduire le rendrait méconnaissable.
    bt_meth_ict_silver_bullet: "nom propre d'une méthode",
    // Terme anglais employé tel quel par les traders francophones : le libellé
    // français EST l'anglais, donc l'anglais ne peut pas en différer.
    bt_niveau_order_block: "terme anglais employé tel quel en français",
    // Le nom propre d'un indice : il s'ecrit pareil dans les quatre langues,
    // et le traduire donnerait un marche que personne ne reconnait sur sa
    // plateforme. Les autres indices passent sous le seuil de douze caracteres.
    bt_instr_US30: "nom propre d'un indice",
  };

  it("n'exempte que des clés qui existent encore", () => {
    const fantomes = Object.keys(IDENTIQUES_A_RAISON).filter((c) => typeof dico[c] !== "string");
    expect(fantomes).toEqual([]);
  });

  it("aucune phrase longue n'est recopiée telle quelle", () => {
    const copies: string[] = [];
    for (const [nom, autre] of Array.from(Object.entries({ en, es, de }))) {
      for (const [cle, texte] of Object.entries(dico)) {
        if (!cle.startsWith("bt_") || typeof texte !== "string") continue;
        // ⚠️ Sous douze caractères, l'identité ne prouve rien : « 1 R », « M5 »,
        // « OK » se disent pareil partout, et les signaler rendrait ce garde
        // bruyant, donc ignoré.
        if (texte.length < 12) continue;
        if (IDENTIQUES_A_RAISON[cle]) continue;
        if ((autre as Record<string, string>)[cle] === texte) copies.push(`${cle} (${nom})`);
      }
    }
    expect(copies, "recopié du français : " + copies.join(", ")).toEqual([]);
  });
});
