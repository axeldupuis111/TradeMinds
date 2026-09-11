import { describe, expect, it } from "vitest";
import fr from "../i18n/fr";
import { nomDuFichier, tradesEnCsv, type EnTetesCsv } from "./export-csv";
import { instrumentParCode } from "./instruments";
import type { TradeSimule } from "./types";

const NAS = instrumentParCode("NAS100")!;

const ENTETES: EnTetesCsv = {
  date: "Date",
  sens: "Sens",
  entree: "Entrée",
  sortie: "Sortie",
  stop: "Stop",
  risque: "Risque",
  r: "R net",
  rBrut: "R brut",
  motif: "Motif",
  collision: "Collision",
};

function trade(partiel: Partial<TradeSimule> = {}): TradeSimule {
  return {
    signalMs: Date.UTC(2025, 0, 3, 11, 0),
    niveauSignal: 16_400_000,
    entreeMs: Date.UTC(2025, 0, 3, 11, 0),
    sortieMs: Date.UTC(2025, 0, 3, 12, 0),
    sens: "long",
    entreeTicks: 16_414_970,
    sortieTicks: 16_371_290,
    risqueTicks: 43_680,
    r: -1.05,
    rBrut: -1,
    mfeR: 0.4,
    maeR: -1,
    motif: "stop",
    collisionMemeBarre: false,
    ...partiel,
  };
}

const lignes = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n");

const PARIS = "Europe/Paris";
const SAUT = String.fromCharCode(13) + String.fromCharCode(10);

describe("l'export des trades", () => {
  /**
   * ⚠️ SANS LE BOM, EXCEL LIT LE FICHIER EN ANSI et « Réussite » devient
   * « RÃ©ussite ». Trois octets qui évitent d'avoir l'air négligé.
   */
  it("commence par un BOM UTF-8", () => {
    expect(tradesEnCsv([trade()], NAS, ENTETES, (m) => m, PARIS).charCodeAt(0)).toBe(0xfeff);
  });

  /**
   * ⚠️ Excel en français, en espagnol et en allemand attend un POINT-VIRGULE.
   * Avec une virgule, tout le fichier atterrit dans une seule colonne et le
   * trader croit l'export raté.
   */
  it("sépare les colonnes par un point-virgule", () => {
    const [entete] = lignes(tradesEnCsv([], NAS, ENTETES, (m) => m, PARIS));
    expect(entete.split(";")).toHaveLength(10);
  });

  /**
   * ⚠️ LES PRIX SORTENT EN POINTS. Le moteur raisonne en ticks entiers,
   * personne d'autre : un fichier plein de « 16414970 » serait illisible et
   * incomparable avec n'importe quelle plateforme.
   */
  it("convertit les prix en points", () => {
    const [, ligne] = lignes(tradesEnCsv([trade()], NAS, ENTETES, (m) => m, PARIS));
    const cols = ligne.split(";");
    expect(cols[2]).toBe("16414.97");
    expect(cols[3]).toBe("16371.29");
    // Stop d'un achat : entrée moins le risque.
    expect(cols[4]).toBe("16371.29");
  });

  /**
   * ⚠️ LES DEUX R, NET ET BRUT. C'est ce qui permet au trader de mesurer
   * lui-même ce que l'aller-retour lui prend, au lieu de nous croire sur parole.
   */
  it("sort le R net et le R brut", () => {
    const cols = lignes(tradesEnCsv([trade()], NAS, ENTETES, (m) => m, PARIS))[1].split(";");
    expect(cols[6]).toBe("-1.0500");
    expect(cols[7]).toBe("-1.0000");
  });

  it("traduit le motif de sortie plutôt que d'écrire le nom technique", () => {
    const csv = tradesEnCsv([trade()], NAS, ENTETES, () => "Stop touché", PARIS);
    expect(csv).toContain("Stop touché");
  });

  it("marque les trades tranchés par la convention de collision", () => {
    const csv = tradesEnCsv([trade({ collisionMemeBarre: true })], NAS, ENTETES, (m) => m, PARIS);
    expect(lignes(csv)[1].split(";")[9]).toBe("1");
  });

  /**
   * ⚠️ UNE CELLULE QUI COMMENCE PAR « = » EST UNE FORMULE POUR EXCEL. Nos
   * données ne viennent de nulle part d'hostile, mais un libellé traduit ne doit
   * pas se transformer en `#NOM?` chez le trader.
   */
  it("neutralise une cellule qui ressemble à une formule", () => {
    const csv = tradesEnCsv([trade()], NAS, ENTETES, () => "=SOMME(A1)", PARIS);
    expect(csv).toContain("'=SOMME(A1)");
  });

  /**
   * ⚠️⚠️ LE REMÈDE QUI ÉTAIT PIRE QUE LE MAL. Un premier jet préfixait toute
   * cellule commençant par « - », donc tous les R négatifs : la moitié des
   * lignes devenait du TEXTE dans le tableur, ni additionnable ni triable.
   */
  it("ne transforme jamais un nombre négatif en texte", () => {
    const cols = lignes(tradesEnCsv([trade({ r: -2.5, rBrut: -2.4 })], NAS, ENTETES, (m) => m, PARIS))[1]
      .split(";");
    expect(cols[6]).toBe("-2.5000");
    expect(cols[6].startsWith("'")).toBe(false);
    expect(Number(cols[6])).toBe(-2.5);
  });

  it("protège un texte contenant le séparateur", () => {
    const csv = tradesEnCsv([trade()], NAS, ENTETES, () => "stop ; puis objectif", PARIS);
    expect(csv).toContain('"stop ; puis objectif"');
  });

  it("rend l'en-tête seul quand il n'y a aucun trade", () => {
    expect(lignes(tradesEnCsv([], NAS, ENTETES, (m) => m, PARIS))).toHaveLength(1);
  });

  it("nomme le fichier de façon retrouvable", () => {
    expect(nomDuFichier("NAS100", "2025-01", "2025-12")).toBe("backtest-NAS100-2025-01-2025-12.csv");
  });
});

/**
 * ⚠️⚠️ VU DANS LE FICHIER : « 2025-01-06T15:00:00.000Z ». De l'UTC, alors que
 * toute la page travaille dans le fuseau du trader, et que la carte qui propose
 * ce fichier annonce exactement l'usage qui casse :
 *
 *   « Ouvre la liste entière dans ton tableur pour la trier PAR HEURE, par sens
 *     ou par motif de sortie, et retrouver tes propres captures. »
 *
 * Trier par heure sur de l'UTC quand on trade en heure de Paris décale tout
 * d'une à deux heures selon la saison. Rien dans le fichier ne le disait : la
 * colonne s'appelait « Date d'entrée ».
 */
describe("l'heure des trades exportés", () => {
  /** 6 janvier 2025, 15:00 UTC, donc 16:00 à Paris (heure d'hiver). */
  const hiver = () => ({ ...trade(), entreeMs: Date.UTC(2025, 0, 6, 15, 0, 0) });
  /** 6 juillet 2025, 15:00 UTC, donc 17:00 à Paris (heure d'été). */
  const ete = () => ({ ...trade(), entreeMs: Date.UTC(2025, 6, 6, 15, 0, 0) });

  const premiereCellule = (t: ReturnType<typeof trade>, fuseau: string) =>
    tradesEnCsv([t], NAS, ENTETES, (m) => m, fuseau).split(SAUT)[1].split(";")[0];

  it("écrit l'heure du trader, pas l'UTC", () => {
    expect(premiereCellule(hiver(), PARIS)).toBe("2025-01-06 16:00:00");
  });

  /**
   * ⚠️ L'ÉCART N'EST PAS CONSTANT : une conversion à décalage fixe se tromperait
   * six mois sur douze, et personne ne s'en apercevrait avant l'automne.
   */
  it("suit l'heure d'été", () => {
    expect(premiereCellule(ete(), PARIS)).toBe("2025-07-06 17:00:00");
  });

  it("suit le fuseau qu'on lui donne", () => {
    expect(premiereCellule(hiver(), "America/New_York")).toBe("2025-01-06 10:00:00");
    expect(premiereCellule(hiver(), "UTC")).toBe("2025-01-06 15:00:00");
  });

  /**
   * ⚠️ FORMAT DE TABLEUR, PAS ISO. Un « T » et un « Z » font du texte dans Excel
   * et LibreOffice : ni tri chronologique, ni filtre par heure.
   */
  it("écrit une date qu'un tableur reconnaît", () => {
    const cellule = premiereCellule(hiver(), PARIS);
    expect(cellule).not.toContain("T");
    expect(cellule).not.toContain("Z");
    expect(cellule).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  /** ⚠️ Et l'en-tête le dit, sinon le lecteur ne peut pas le savoir. */
  it("annonce le fuseau dans l'en-tête", () => {
    const entete = (fr as Record<string, string>).bt_csv_date;
    expect(entete.toLowerCase()).toContain("fuseau");
  });
});
