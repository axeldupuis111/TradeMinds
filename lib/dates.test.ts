import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";
import { enDate, enDateEtHeure, enDateLongue, enJourEtMois } from "./dates";

/**
 * AUCUNE DATE, AUCUN NOMBRE, NE CHOISIT SA LANGUE TOUT SEUL.
 *
 * ── LE DÉFAUT, DANS LES DEUX SENS ───────────────────────────────────────────
 *
 * ⚠️⚠️ SANS ARGUMENT, `toLocaleDateString()` PREND LA LANGUE DU NAVIGATEUR,
 * qui n'a aucune raison d'être celle que le trader a choisie dans
 * l'application. Sur un aperçu de backtest, interface en anglais :
 * « Date: 02/01/2025 » — le 2 janvier, qu'un lecteur anglophone lit
 * « February 1st ».
 *
 * ⚠️⚠️ ET AVEC « fr-FR » EN DUR, C'EST LA MÊME FAUTE À L'ENVERS. La date de
 * renouvellement de l'abonnement, celle qu'un abonné lit avant d'être débité,
 * sortait en « 9 juillet 2026 » pour tout le monde. Une langue écrite en dur
 * n'est pas « un défaut par défaut » : elle est simplement fausse pour
 * d'autres gens.
 *
 * ⚠️ LES DEUX MOITIÉS COEXISTAIENT, sept appels de chaque côté, parfois dans le
 * même fichier. C'est le signe qu'aucune règle n'était décidée.
 */
describe("les dates suivent la langue de l'application", () => {
  /**
   * ⚠️ MOTIFS NOMMÉS, PAS ÉCRITS EN LIGNE. Ces trois-là ont été mangés par le
   * shell en les écrivant (le `\r` d'un saut de ligne est devenu un vrai retour
   * chariot, et le fichier ne compilait plus). Les poser une fois, en haut, les
   * rend relisibles et évite de les ré-échapper à chaque usage.
   */
  const SAUT_DE_LIGNE = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
  const SEPARATEUR_CHEMIN = /[\\/]/;
  /** Un jour puis un mois collés dans un gabarit : `${getDate()}/${getMonth()+1}`. */
  const MOTIF_JOUR_MOIS = /getDate\(\)[^\n]{0,80}getMonth\(\)/;
  /** Une clé ISO « YYYY-MM-DD » : l'année vient en premier, l'ordre est universel. */
  const MOTIF_CLE_ISO = /getFullYear\(\)[^\n]{0,40}getMonth\(\)/;

  it("rendent la même date différemment selon la langue", () => {
    const quand = Date.UTC(2026, 0, 2, 10, 45);
    expect(enDate(quand, "fr-FR")).not.toBe(enDate(quand, "en-US"));
    expect(enDate(quand, "fr-FR")).toContain("02");
    expect(enDateLongue(quand, "fr-FR")).toContain("janvier");
    expect(enDateLongue(quand, "en-US")).toContain("January");
    expect(enDateEtHeure(quand, "fr-FR")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(enJourEtMois(quand, "fr-FR")).toMatch(/^\d{2}\/\d{2}$/);
  });

  it("acceptent une date, un horodatage ou une chaîne", () => {
    const attendu = enDate("2026-01-02T10:45:00Z", "fr-FR");
    expect(enDate(new Date("2026-01-02T10:45:00Z"), "fr-FR")).toBe(attendu);
    expect(enDate(Date.UTC(2026, 0, 2, 10, 45), "fr-FR")).toBe(attendu);
  });

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * ⚠️ LE SERVEUR EST HORS PORTÉE, ET POUR UNE RAISON : les e-mails, les PDF et
   * les images de partage n'ont pas de document où lire la langue du lecteur ;
   * l'appelant la leur passe explicitement. C'est `app/` et `components/`, le
   * navigateur, que cette règle vise.
   */
  const PORTEE = ["app", "components"];
  const HORS_PORTEE = /opengraph-image|[\\/]api[\\/]/;

  it("aucun appel ne laisse le navigateur choisir la langue", () => {
    const fautes: string[] = [];
    for (const d of PORTEE) {
      for (const chemin of fichiers(d)) {
        if (HORS_PORTEE.test(chemin)) continue;
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");
        readFileSync(chemin, "utf8")
          .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
          .forEach((ligne, i) => {
            const nu = ligne.trim();
            if (nu.startsWith("*") || nu.startsWith("//")) return;
            // `toLocale…()` sans le moindre argument.
            if (/\.toLocale(Date|Time)?String\(\s*\)/.test(ligne)) {
              fautes.push(`${nom}:${i + 1} langue du navigateur`);
            }
          });
      }
    }
    expect(
      fautes,
      "dates ou nombres laissés à la langue du navigateur (voir lib/dates.ts) : " + fautes.join(", "),
    ).toEqual([]);
  });

  it("aucun appel ne code une langue en dur", () => {
    const fautes: string[] = [];
    for (const d of PORTEE) {
      for (const chemin of fichiers(d)) {
        if (HORS_PORTEE.test(chemin)) continue;
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");
        readFileSync(chemin, "utf8")
          .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
          .forEach((ligne, i) => {
            const nu = ligne.trim();
            if (nu.startsWith("*") || nu.startsWith("//")) return;
            if (/\.toLocale(Date|Time)?String\(\s*["'`](fr|en|es|de)/.test(ligne)) {
              fautes.push(`${nom}:${i + 1} langue en dur`);
            }
            if (/new Intl\.\w+\(\s*["'`](fr|en|es|de)/.test(ligne)) {
              fautes.push(`${nom}:${i + 1} Intl à langue fixe`);
            }
          });
      }
    }
    expect(fautes, "langues codées en dur : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : les deux motifs doivent reconnaître les formes
   * exactes qui existaient, sinon ce test resterait vert pour toujours.
   */
  it("les deux motifs reconnaissent ce qu'ils cherchent", () => {
    const sansLangue = /\.toLocale(Date|Time)?String\(\s*\)/;
    const enDur = /\.toLocale(Date|Time)?String\(\s*["'`](fr|en|es|de)/;
    expect(sansLangue.test(`new Date(x).toLocaleDateString()`)).toBe(true);
    expect(sansLangue.test(`n.toLocaleString()`)).toBe(true);
    expect(sansLangue.test(`new Date(x).toLocaleDateString(langue)`)).toBe(false);
    expect(enDur.test(`new Date(x).toLocaleDateString("fr-FR", { day: "numeric" })`)).toBe(true);
    expect(enDur.test(`new Date(x).toLocaleDateString(lang)`)).toBe(false);
  });

  /**
   * ── LA TROISIÈME FAÇON DE SE TROMPER DE LANGUE ──────────────────────────────
   *
   * ⚠️⚠️ NI `toLocaleDateString()` NU, NI « fr-FR » EN DUR : UNE DATE FABRIQUÉE
   * À LA MAIN. « Mes Trades » écrivait `${getDate()}/${getMonth()+1}`, donc
   * l'ordre français pour tout le monde. Vu à l'écran en allemand : « 26/08 »,
   * là où l'allemand écrit « 26.08. ». Et en anglais le même gabarit donne
   * « 05/08 » pour le 5 août, qu'un lecteur anglophone lit « 8 mai » : ce n'est
   * plus une question de style, c'est une date fausse.
   *
   * ⚠️ LES DEUX MOTIFS EXISTANTS NE POUVAIENT PAS LA VOIR : il n'y a ni appel
   * à `toLocaleDateString` ni chaîne de langue. C'est l'ABSENCE d'appel qui est
   * la faute.
   */
  it("aucune date d'affichage n'est fabriquee a la main", () => {
    const fautes: string[] = [];
    for (const chemin of PORTEE.flatMap((d) => fichiers(d))) {
      if (HORS_PORTEE.test(chemin)) continue;
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      const lignes = src.split(SAUT_DE_LIGNE);
      lignes.forEach((ligne, i) => {
        // Un jour et un mois colles par un separateur, dans un gabarit.
        if (!MOTIF_JOUR_MOIS.test(ligne)) return;
        // Une cle ISO « YYYY-MM-DD » est machine, pas affichage : l'annee
        // vient en premier et l'ordre ne depend d'aucune langue.
        if (MOTIF_CLE_ISO.test(ligne)) return;
        fautes.push(chemin.split(SEPARATEUR_CHEMIN).slice(-2).join("/") + ":" + (i + 1));
      });
    }
    expect(
      fautes,
      "dates fabriquees a la main, donc dans l'ordre francais pour tout le monde : " +
        fautes.join(", "),
    ).toEqual([]);
  });
});
