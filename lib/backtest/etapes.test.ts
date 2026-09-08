import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import {
  ETAPE_PAR_ANCRE,
  etapesDuParcours,
  PARCOURS,
  raisonAffichee,
  replierVers,
  type EtatDuParcours,
} from "./etapes";

const etat = (p: Partial<EtatDuParcours> = {}): EtatDuParcours => ({
  aUnPlan: true,
  aUnResultat: true,
  assezDeTrades: true,
  ...p,
});

const ouvertes = (e: EtatDuParcours) =>
  etapesDuParcours(e)
    .filter((x) => x.ouverte)
    .map((x) => x.code);

/**
 * LE PARCOURS, ET LA RÈGLE « ON NE SAUTE PAS D'ÉTAPE ».
 *
 * ⚠️⚠️ TROISIÈME RÉPONSE AU MÊME REPROCHE. Une carte « la prochaine chose à
 * faire » posée sur un mur reste un mur ; des sections repliées restent vingt
 * décisions dans un ordre que rien n'impose.
 *
 *   « Limite tu fais des onglets. Il faut trouver un ordre logique, on ne doit
 *     pas sauter des étapes car on n'est pas intéressé. »
 */
describe("le parcours", () => {
  /**
   * ⚠️⚠️ RÉGLER ET LANCER SONT TOUJOURS OUVERTS, ET C'EST LA CORRECTION D'UN
   * CUL-DE-SAC. Je les bloquais tant qu'aucune fiche n'était traduite. Quand la
   * limite mensuelle de traductions est atteinte, l'écran dit — à juste titre —
   * « la traduction n'est pas obligatoire, règle ton plan à la main », et
   * l'éditeur qui permet de le faire était derrière le verrou.
   */
  it("laisse toujours régler et lancer, même à froid", () => {
    expect(ouvertes(etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }))).toEqual([
      "strategie",
      "regles",
      "test",
    ]);
  });

  /**
   * ⚠️ SANS PLAN, IL N'Y A RIEN À RÉGLER NI À REJOUER. Ce n'est pas une
   * contrainte pour la forme : ces écrans n'auraient littéralement rien à
   * montrer.
   */
  it("ferme encore ce qui n'a rien à montrer sans rejeu", () => {
    const o = ouvertes(etat({ aUnPlan: true, aUnResultat: false, assezDeTrades: false }));
    expect(o).not.toContain("ameliorer");
    expect(o).not.toContain("plan");
  });

  /**
   * ⚠️⚠️ LE PLAN S'OUVRE DÈS QU'IL Y A UN REJEU, MÊME MAUVAIS, ET MÊME COURT.
   * C'est le livrable de l'onglet : un plan est un engagement de discipline,
   * pas une récompense accordée par le verdict.
   */
  it("ouvre le plan dès qu'il y a un rejeu, même trop court pour conclure", () => {
    const o = ouvertes(etat({ assezDeTrades: false }));
    expect(o).toContain("plan");
    expect(o).not.toContain("ameliorer");
  });

  /**
   * ⚠️ DIAGNOSTIQUER QUARANTE TRADES REVIENDRAIT À NOMMER DES MÉCANISMES DANS DU
   * BRUIT, avec l'autorité d'un diagnostic. C'est pire que se taire.
   */
  it("n'ouvre l'amélioration qu'avec assez de trades", () => {
    expect(ouvertes(etat({ assezDeTrades: false }))).not.toContain("ameliorer");
    expect(ouvertes(etat())).toContain("ameliorer");
  });

  /**
   * ⚠️ UNE ÉTAPE FERMÉE DIT POURQUOI, ET LA RAISON EST UNE ACTION. « Lance le
   * test d'abord » se règle en un clic ; « verrouillé » ne se règle pas.
   */
  it("donne toujours une raison actionnable quand elle ferme", () => {
    for (const cas of [
      etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }),
      etat({ aUnResultat: false, assezDeTrades: false }),
      etat({ assezDeTrades: false }),
    ]) {
      for (const e of etapesDuParcours(cas)) {
        if (e.ouverte) continue;
        expect(e.raison, `${e.code} ferme sans raison`).toBeTruthy();
        for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
          expect(
            (dico as Record<string, string>)[e.raison!],
            `${e.raison} manquante en ${nom}`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("nomme chaque étape dans les quatre langues", () => {
    for (const code of PARCOURS) {
      for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
        expect((dico as Record<string, string>)[`bt_par_${code}`], `${code} en ${nom}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️⚠️ ON RECULE, JAMAIS ON N'AVANCE. Changer d'instrument efface le résultat :
   * rester sur « Ton plan » afficherait une page vide sans dire pourquoi, et
   * faire avancer quelqu'un qui vient de reculer est la façon la plus sûre de
   * le perdre.
   */
  it("replie vers la dernière étape encore ouverte", () => {
    const e = etapesDuParcours(etat({ aUnResultat: false, assezDeTrades: false }));
    expect(replierVers("plan", e)).toBe("test");
    expect(replierVers("ameliorer", e)).toBe("test");
    const froid = etapesDuParcours(etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }));
    expect(replierVers("plan", froid)).toBe("test");
  });

  it("ne bouge pas quand l'étape courante est encore ouverte", () => {
    const e = etapesDuParcours(etat());
    for (const code of PARCOURS) expect(replierVers(code, e)).toBe(code);
  });
});

/**
 * ⚠️⚠️ LES BASES SE PROPOSENT AU DÉBUT, PAS À LA FIN. Correction de conception
 * explicite : « c'est au début qu'on propose des stratégies à tester, pas à la
 * fin ». Je les avais mises en bas de page, comme une consolation après
 * l'échec ; quelqu'un qui n'a pas de stratégie n'a rien à faire des quatre
 * étapes suivantes tant qu'il n'en a pas une.
 */
describe("l'ordre des écrans dans la page", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  it("propose les bases à l'étape de la stratégie", () => {
    const i = source.indexOf('id="bt-departs"');
    expect(i).toBeGreaterThan(0);
    const avant = source.slice(Math.max(0, i - 400), i);
    expect(avant).toContain('etapeCourante === "strategie"');
  });

  it("garde le diagnostic à l'étape de l'amélioration", () => {
    const i = source.indexOf('id="bt-diagnostic"');
    expect(i).toBeGreaterThan(0);
    expect(source.slice(Math.max(0, i - 400), i)).toContain('etapeCourante === "ameliorer"');
  });

  /**
   * ⚠️ LE BOUTON QUI EFFACE TOUT NE DOIT PAS TOUCHER SA FICHE. Un bouton de
   * remise à zéro imprécis n'est jamais cliqué, et celui-là est la sortie de
   * secours du parcours.
   */
  it("repart de zéro sans toucher à la fiche enregistrée", () => {
    const i = source.indexOf("const repartirDeZero");
    expect(i).toBeGreaterThan(0);
    const corps = source.slice(i, source.indexOf("}, [code, fuseau", i));
    for (const efface of ["setPlanFiche(null)", "setResultat(null)", "setCouverture(null)"]) {
      expect(corps, `${efface} manquant`).toContain(efface);
    }
    // ⚠️ Aucune écriture en base : ce bouton ne touche que l'état de la page.
    for (const interdit of ["supabase", "enregistrer", "update", "delete"]) {
      expect(corps.toLowerCase(), `${interdit} dans une remise à zéro`).not.toContain(interdit);
    }
  });

  it("annonce ce que la remise à zéro emporte, dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      const d = dico as Record<string, string>;
      expect(d.bt_recommencer_bouton, nom).toBeTruthy();
      expect(d.bt_recommencer_avertit, nom).toBeTruthy();
    }
    expect((fr as Record<string, string>).bt_recommencer_avertit).toMatch(
      /fiche n'est pas touchée/i,
    );
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'EST LE PIRE MESSAGE POSSIBLE. Après avoir sélectionné
 * sa stratégie, les quatre étapes restaient fermées avec « choisis ou construis
 * une stratégie » : la raison lui demandait de faire ce qu'il venait de faire.
 * Un blocage dont la raison est déjà satisfaite ne se distingue pas d'une panne.
 */
/**
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT LE PIRE MESSAGE POSSIBLE. Après avoir
 * sélectionné sa stratégie, les quatre étapes restaient fermées avec « choisis
 * ou construis une stratégie » : la raison lui demandait de faire ce qu'il
 * venait de faire.
 *
 * La correction n'a pas été de mieux rédiger la raison, mais de RETIRER LE
 * BLOCAGE : régler et lancer ont toujours quelque chose à montrer. Il ne reste
 * donc plus aucune étape dont la raison puisse être déjà satisfaite, et ce test
 * le vérifie.
 */
describe("aucune raison de blocage n'est déjà satisfaite", () => {
  it("ne bloque plus rien sur l'absence de traduction", () => {
    for (const cas of [
      etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }),
      etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }),
    ]) {
      const fermees = etapesDuParcours(cas).filter((x) => !x.ouverte);
      for (const e of fermees) {
        expect(e.raison, `${e.code}`).toBe("bt_par_bloque_sans_test");
      }
    }
  });

  it("garde les rédactions dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      const d = dico as Record<string, string>;
      expect(d.bt_par_bloque_sans_test, nom).toBeTruthy();
      expect(d.bt_par_bloque_trop_peu, nom).toBeTruthy();
    }
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN : « Lancer le test » S'AFFICHAIT SUR LES TROIS ÉTAPES.
 *
 * Le bloc n'avait pas été affecté à une étape, donc il fuyait partout. Un bouton
 * « Lancer » présent à l'étape « Ta stratégie » invite à sauter exactement ce
 * que le parcours existe pour ordonner, et la fuite ne se voit qu'en cliquant
 * d'un onglet à l'autre.
 *
 * ⚠️ CE TEST LIT LA SOURCE et exige que chaque bloc de premier niveau du
 * parcours porte une étape. Un bloc ajouté demain sans étape sera signalé au
 * lieu d'apparaître cinq fois.
 */
describe("aucun bloc ne fuit d'une étape à l'autre", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  /** Le corps du conteneur, entre son ouverture et sa fermeture. */
  const corps = (() => {
    const i = source.indexOf("<StaggerContainer");
    const j = source.indexOf("</StaggerContainer>");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    return source.slice(i, j);
  })();

  /** Un saut de ligne, construit plutôt qu'échappé : voir `pluriels.test.ts`. */
  const SAUT = String.fromCharCode(10);

  it("chaque bloc du parcours déclare son étape", () => {
    const lignes = corps.split(new RegExp(String.fromCharCode(13) + "?" + SAUT));
    /**
     * ⚠️⚠️ ON REMONTE JUSQU'À LA CONDITION, SANS SE FIER À L'INDENTATION. Ma
     * première version ne regardait que les blocs indentés de huit espaces, en
     * supposant que les autres étaient imbriqués. Faux : un bloc placé dans un
     * `{resultat ? (` gagne deux espaces et échappait au contrôle. Trois blocs
     * fuyaient encore vers l'étape « Le test » — la projection, le contrôle hors
     * période et l'enregistrement — et le garde disait que tout allait bien.
     *
     * La règle juste ne parle pas d'espaces : en remontant depuis un bloc, on
     * doit rencontrer une condition d'étape AVANT de sortir du conteneur.
     */
    const SUIT_PARTOUT = ["<ProchaineEtape"];
    /**
     * DEUXIEME REPARATION DU MEME GARDE : REGARDER VINGT LIGNES EN ARRIERE NE
     * MARCHE PAS NON PLUS. La carte « Ce que tes filtres ont refuse » n'a jamais
     * porte d'etape, et le garde la laissait passer parce que le bloc VOISIN,
     * vingt lignes plus haut, en portait une. Un garde qui accepte un bloc grace
     * a la condition d'un autre ne garde rien.
     *
     * La condition d'un bloc, c'est ce qui le separe de la fin du bloc
     * precedent. On remonte jusqu'a cette frontiere, et pas plus loin.
     */
    const FRONTIERES = [") : null}", "</StaggerItem>", "<StaggerContainer"];
    const sansEtape: string[] = [];
    for (let k = 0; k < lignes.length; k++) {
      if (!lignes[k].includes("<StaggerItem")) continue;
      const dedans = lignes.slice(k, k + 4).join(SAUT);
      if (SUIT_PARTOUT.some((x) => dedans.includes(x))) continue;
      const condition: string[] = [];
      for (let j = k - 1; j >= 0; j--) {
        if (FRONTIERES.some((f) => lignes[j].includes(f))) break;
        condition.push(lignes[j]);
      }
      if (!condition.join(SAUT).includes("etapeCourante ===")) {
        sansEtape.push("ligne " + (k + 1) + " : " + (lignes[k + 1] ?? "").trim().slice(0, 60));
      }
    }
    expect(
      sansEtape,
      "blocs affichés sur toutes les étapes : " + sansEtape.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES CINQ ÉTAPES ONT CHACUNE DU CONTENU. Une étape vide serait une
   * porte qui s'ouvre sur rien, ce qui est pire qu'une porte fermée.
   */
  it("chaque étape a au moins un bloc", () => {
    for (const code of PARCOURS) {
      expect(corps, `l'étape ${code} n'affiche rien`).toContain(`etapeCourante === "${code}"`);
    }
  });

  /**
   * ⚠️⚠️ UNE SEULE NUMÉROTATION À L'ÉCRAN. La barre du parcours numérote cinq
   * étapes ; les cartes portaient encore « 2. », « 4. », « 6. » de la page à
   * plat. Un trader à l'étape 2 lisait « 6. Lancer le test ». C'est la faute que
   * cette page passe son temps à corriger : deux façons de compter la même
   * chose.
   */
  it("les titres de cartes ne portent plus de numéro", () => {
    const dico = fr as Record<string, string>;
    for (const cle of [
      "bt_etape_perimetre",
      "bt_etape_fiche",
      "bt_etape_methode",
      "bt_etape_completude",
      "bt_etape_plan",
      "bt_etape_lancer",
    ]) {
      expect(dico[cle], cle).toBeTruthy();
      expect(dico[cle], `${cle} porte encore un numéro`).not.toMatch(/^\d+\.\s/);
    }
  });
});

/**
 * LE BOUTON EST SUR L'ÉTAPE QUI MONTRE CE QU'IL PRODUIT.
 *
 * ⚠️⚠️ VU EN PILOTANT, APRÈS AVOIR RANGÉ LA PAGE : « Analyser à fond » et
 * « Chercher » étaient restés sur « Le test », alors que TOUT ce qu'ils
 * produisent (la recherche, le diagnostic, les marchés comparables, le
 * voisinage des réglages) s'affiche sur « L'améliorer ». Tant que les blocs
 * fuyaient d'une étape à l'autre, ça marchait par accident ; en les rangeant,
 * j'ai créé une étape 4 qui montre des emplacements de mesures et plus aucun
 * bouton pour les lancer.
 *
 * ⚠️ MA PROPRE RÈGLE LE DISAIT DÉJÀ, dans prochaine-etape.ts : « un constat qui
 * nomme une action doit porter le bouton ». Elle vaut aussi entre étapes.
 */
describe("le bouton et son résultat sont sur la même étape", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const SAUT2 = String.fromCharCode(10);
  const lignes = source.split(new RegExp(String.fromCharCode(13) + "?" + SAUT2));

  /** L'étape du bloc qui contient ce morceau de code. */
  function etapeDe(morceau: string): string | null {
    const k = lignes.findIndex((l) => l.includes(morceau));
    expect(k, `${morceau} : introuvable dans la page`).toBeGreaterThan(0);
    for (let j = k; j >= 0; j--) {
      const m = lignes[j].match(/etapeCourante === "([a-z]+)"/);
      if (m) return m[1];
      if (lignes[j].includes("</StaggerItem>")) return null;
    }
    return null;
  }

  const LANCEUR = "onClick={analyserAFond}";
  /**
   * ⚠️ ET LA LISTE ÉTAIT INCOMPLÈTE : « Tes confluences » n'y figurait pas, et
   * ce tableau s'affichait donc sur « Ton plan », sept cartes de filtres non
   * utilisés posées APRÈS le document à emporter. Le garde passait au vert
   * parce que je lui avais donné quatre noms sur cinq. C'est la limite de
   * toute liste écrite à la main, et la seule parade est de la relire à chaque
   * fois qu'un bloc naît.
   */
  const PRODUITS = ["<Trouver", "<Diagnostic", "<Marches", "<Robustesse", "<Confluences"];

  it("les mesures profondes se lancent depuis l'étape qui les affiche", () => {
    const etapeDuBouton = etapeDe(LANCEUR);
    expect(etapeDuBouton).not.toBeNull();
    for (const produit of PRODUITS) {
      expect(etapeDe(produit), `${produit} n'est pas sur l'étape du bouton`).toBe(etapeDuBouton);
    }
  });
});

/**
 * LES CARTES SE COMPTENT DANS LEUR ÉTAPE, PAS DANS LA PAGE.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'EST LA TROISIÈME FOIS QUE DEUX NUMÉROTATIONS SE
 * CROISENT SUR LE MÊME ÉCRAN. Le fil annonce cinq étapes, et l'étape 1
 * affichait des cartes numérotées 2 et 3, l'étape 2 des cartes 4 et 5 : les
 * numéros de l'ancienne page à plat, qui n'avait pas d'étapes. Un trader lit
 * « étape 1 » puis « 3. Ta méthode » et se demande légitimement lequel des deux
 * comptes le concerne.
 *
 * ⚠️ J'AVAIS DÉJÀ CORRIGÉ LA MOITIÉ DU DÉFAUT, ce qui est pire que rien : les
 * préfixes « 1. », « 2. » avaient été retirés des TITRES traduits, et la
 * pastille numérotée du composant, elle, était restée.
 */
describe("les cartes se numérotent dans leur étape", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const SAUT3 = String.fromCharCode(10);
  const lignes = source.split(new RegExp(String.fromCharCode(13) + "?" + SAUT3));

  it("chaque étape compte ses cartes à partir de un, sans trou", () => {
    const parEtape = new Map<string, number[]>();
    let etape: string | null = null;
    for (const ligne of lignes) {
      const e = ligne.match(/etapeCourante === "([a-z]+)"/);
      if (e) etape = e[1];
      const n = ligne.match(/numero=\{(\d+)\}/);
      if (!n) continue;
      expect(etape, `une carte numérotée ${n[1]} n'est sur aucune étape`).not.toBeNull();
      const liste = parEtape.get(etape!) ?? [];
      liste.push(Number(n[1]));
      parEtape.set(etape!, liste);
    }
    // Garde sur le garde : sans carte lue, la boucle ci-dessous ne dit rien.
    expect(parEtape.size).toBeGreaterThan(0);
    for (const [code, numeros] of Array.from(parEtape.entries())) {
      expect(numeros, `l'étape ${code} numérote ses cartes ${numeros.join(", ")}`).toEqual(
        numeros.map((_, i) => i + 1),
      );
    }
  });
});

/**
 * LE BOUTON QUI TRAVERSE UNE ÉTAPE.
 *
 * ⚠️⚠️ TROIS CASSURES DU MÊME BOUTON, TOUJOURS INVISIBLES AUTREMENT QU'À
 * L'ÉCRAN : identifiant qui ne correspond pas, section repliée, puis étape non
 * rendue. Les trois donnent le même symptôme (on clique, rien ne se passe) et
 * aucune erreur, parce que `getElementById` rend `null` en silence.
 *
 * Ce garde tient les deux bouts : chaque ancre que la carte désigne existe dans
 * la page, et la table dit la BONNE étape.
 */
describe("chaque ancre sait sur quelle étape elle vit", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const carte = readFileSync(join(process.cwd(), "lib/backtest/prochaine-etape.ts"), "utf8");
  const SAUT4 = String.fromCharCode(10);

  /** L'étape réelle de chaque ancre, lue dans la page. */
  const reelles = (() => {
    const par: Record<string, string> = {};
    let etape: string | null = null;
    for (const ligne of page.split(new RegExp(String.fromCharCode(13) + "?" + SAUT4))) {
      const e = ligne.match(/etapeCourante === "([a-z]+)"/);
      if (e) etape = e[1];
      const a = ligne.match(/(?:ancre|id)="(bt-[a-z-]+)"/);
      if (a && etape) par[a[1]] = etape;
    }
    return par;
  })();

  it("la page pose bien des ancres réparties sur les étapes", () => {
    // Garde sur le garde : sans lecture, tout ce qui suit passerait à vide.
    expect(Object.keys(reelles).length).toBeGreaterThan(8);
    expect(new Set(Object.values(reelles)).size).toBeGreaterThan(2);
  });

  it("la table décrit l'étape où l'ancre se trouve vraiment", () => {
    const fautes: string[] = [];
    for (const [ancre, etape] of Array.from(Object.entries(ETAPE_PAR_ANCRE))) {
      const vraie = reelles[ancre];
      if (!vraie) fautes.push(`${ancre} : plus aucune ancre de ce nom dans la page`);
      else if (vraie !== etape) fautes.push(`${ancre} : table dit ${etape}, la page dit ${vraie}`);
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ET C'EST CE SENS-LÀ QUI A CASSÉ : une ancre désignée par la carte mais
   * absente de la table laisse le bouton sur place, sans rien dire.
   */
  it("toute ancre désignée par la carte est dans la table", () => {
    const designees = Array.from(carte.matchAll(/ancre: "(bt-[a-z-]+)"/g)).map((m) => m[1]);
    expect(designees.length).toBeGreaterThan(5);
    const orphelines = designees.filter((a) => !(a in ETAPE_PAR_ANCRE));
    expect(orphelines, `sans étape connue : ${orphelines.join(", ")}`).toEqual([]);
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN : debout sur l'étape 3, la barre expliquait « Lance le test
 * À L'ÉTAPE 3 ». Envoyer quelqu'un là où il se tient déjà est le message le
 * plus sûr pour lui faire croire qu'il n'a pas compris la page.
 */
describe("la raison d'un blocage se dit depuis là où on est", () => {
  it("nomme l'étape quand on est ailleurs", () => {
    expect(raisonAffichee("bt_par_bloque_sans_test", "strategie")).toBe("bt_par_bloque_sans_test");
    expect(raisonAffichee("bt_par_bloque_sans_test", "regles")).toBe("bt_par_bloque_sans_test");
  });

  it("ne renvoie pas vers l'étape où l'on se tient", () => {
    expect(raisonAffichee("bt_par_bloque_sans_test", "test")).toBe("bt_par_bloque_sans_test_ici");
  });

  it("laisse intacte une raison qui ne nomme aucune destination", () => {
    for (const code of PARCOURS) {
      expect(raisonAffichee("bt_par_bloque_trop_peu", code)).toBe("bt_par_bloque_trop_peu");
    }
  });

  /** ⚠️ Et les deux versions existent dans les quatre langues. */
  it("les deux versions sont traduites partout", () => {
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      for (const cle of ["bt_par_bloque_sans_test", "bt_par_bloque_sans_test_ici"]) {
        expect((dico as Record<string, string>)[cle], `${cle} en ${nom}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️ ET LA VARIANTE NE DIT PLUS « à l'étape » : sans ça, on aurait deux clés
   * et le même défaut.
   */
  it("la variante ne renvoie plus vers une étape numérotée", () => {
    // Une étape NUMÉROTÉE : « ces étapes lisent tes trades » est légitime,
    // « à l’étape 3 » ne l’est pas quand on s’y tient déjà.
    const DESTINATION = new RegExp("l" + String.fromCharCode(39) + "étape [0-9]");
    expect(DESTINATION.test(fr.bt_par_bloque_sans_test)).toBe(true);
    expect(DESTINATION.test(fr.bt_par_bloque_sans_test_ici)).toBe(false);
  });
});

/**
 * LE FIL SE LIT SUR UN TÉLÉPHONE.
 *
 * ⚠️⚠️ MESURÉ DANS LA PAGE, PAS DEVINÉ : à 375 px de large, chaque libellé du
 * fil recevait DIX-NEUF PIXELS. Les cinq étaient tronqués à néant côte à côte,
 * et le fil des étapes, qui est tout l'objet de cette refonte, ne se lisait pas
 * du tout sur un écran de téléphone. Cinq éléments en `flex-1` ne se replient
 * jamais : leur base vaut zéro, donc ils se serrent au lieu de passer à la
 * ligne.
 *
 * ⚠️ CE TEST LIT UNE CLASSE, ce qui ne prouve pas le rendu. Il tient la
 * décision en place : quelqu'un qui remet `flex-1` verra ce texte au lieu de
 * refaire la mesure.
 */
describe("le fil des étapes tient sur un écran étroit", () => {
  const source = readFileSync(join(process.cwd(), "components/backtest/Parcours.tsx"), "utf8");

  it("les étapes se replient au lieu de se serrer", () => {
    const li = source.match(/<li key=\{e\.code\} className="([^"]+)"/);
    expect(li, "l'élément de liste du fil est introuvable").toBeTruthy();
    const classes = li![1];
    expect(classes, "une base explicite est nécessaire pour que la ligne se replie").toContain(
      "basis-[",
    );
    expect(classes, "et une base large seulement sur les petits écrans").toContain("sm:basis-0");
    expect(
      /(^|\s)flex-1(\s|$)/.test(classes),
      "`flex-1` repose une base à zéro et annule le repli",
    ).toBe(false);
  });
});

/**
 * LE RÉSUMÉ D'UNE SECTION REPLIÉE NE PEUT PAS MENTIR.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : « trendline nas100 · TRADUITE EN PLAN », affiché à la
 * seconde où la fiche était choisie, pendant que le bouton juste en dessous
 * proposait encore de la traduire et qu'aucun plan n'existait. La condition ne
 * regardait que « une fiche est-elle sélectionnée ».
 *
 * ⚠️ C'EST LA SEULE LIGNE DE LA PAGE OÙ UNE CONTREVÉRITÉ NE SE RATTRAPE PAS :
 * ce résumé existe précisément pour qu'on n'ouvre PAS la section, donc pour
 * qu'on ne voie pas ce qui la contredit.
 */
describe("le résumé de la fiche dit son état réel", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const resume = (() => {
    const i = page.indexOf('tr("bt_sec_fiche_aucune")');
    expect(i, "le résumé de la section fiche est introuvable").toBeGreaterThan(0);
    return page.slice(Math.max(0, i - 900), i + 900);
  })();

  it("distingue « choisie » de « traduite »", () => {
    expect(resume, "l'état « pas encore traduite » manque").toContain("bt_sec_fiche_a_traduire");
  });

  it("s'appuie sur la traduction elle-même, pas sur la sélection", () => {
    expect(
      /!couverture/.test(resume),
      "sans regarder `couverture`, la ligne annonce un plan qui n'existe pas",
    ).toBe(true);
  });
});
