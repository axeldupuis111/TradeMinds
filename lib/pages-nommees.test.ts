import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT_META, FAQ_META, LEGAL_META, LOGIN_META, MOT_DE_PASSE_META, pageMetadata, SITE_URL } from "./seo";

/**
 * UNE PAGE PUBLIQUE DIT QUI ELLE EST, ET NE SE FAIT PAS PASSER POUR UNE AUTRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ /fr/faq ET /fr/contact SE DÉCLARAIENT ÉGAUX À LA PAGE D'ACCUEIL. Les
 * métadonnées de la landing étaient posées sur le LAYOUT du segment
 * `[locale]`, donc héritées par tout ce qui vit dessous. Ces pages annonçaient
 * le titre de la landing et, bien plus grave, `canonical` vers `/fr` : une
 * page qui désigne une autre URL comme canonique demande à Google de ne pas
 * l'indexer. La FAQ, dont c'est pourtant le seul métier, était invisible dans
 * trois langues sur quatre. Constaté sur le site déployé, pas dans le code.
 *
 * ⚠️ ET ONZE PAGES PUBLIQUES N'AVAIENT AUCUN TITRE : la FAQ, le contact, les
 * quatre pages légales, la connexion, le mot de passe oublié. Toutes
 * s'appelaient « TradeDiscipline » dans l'onglet, l'historique et les favoris.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Des métadonnées de PAGE ne se posent jamais sur un layout partagé.
 */
describe("chaque page publique porte son propre nom", () => {
  const RACINE = join(process.cwd(), "app");

  /** Les `page.tsx` publics : tout sauf le tableau de bord et les API. */
  function pagesPubliques(d = RACINE, chemin = ""): { fichier: string; route: string }[] {
    const out: { fichier: string; route: string }[] = [];
    for (const f of readdirSync(d)) {
      const c = join(d, f);
      if (statSync(c).isDirectory()) {
        if (f === "dashboard" || f === "api" || f === "fonts") continue;
        out.push(...pagesPubliques(c, chemin + "/" + f));
      } else if (f === "page.tsx") {
        out.push({ fichier: c, route: chemin || "/" });
      }
    }
    return out;
  }

  const aDesMetadonnees = (fichier: string) =>
    /export (const metadata|async function generateMetadata|function generateMetadata)/.test(
      readFileSync(fichier, "utf8"),
    );

  it("la sonde trouve bien les pages publiques", () => {
    const p = pagesPubliques();
    expect(p.length, "aucune page publique trouvée").toBeGreaterThan(10);
    expect(p.map((x) => x.route)).toContain("/faq");
  });

  /**
   * ⚠️ CHAQUE PAGE DÉCLARE LES SIENNES, sans exception : hériter, ici, c'est
   * hériter d'un titre faux et d'une canonique qui pointe ailleurs.
   */
  it("aucune page publique n'hérite des métadonnées d'une autre", () => {
    const muettes = pagesPubliques()
      .filter((p) => !aDesMetadonnees(p.fichier))
      .map((p) => p.route);
    expect(muettes, "pages sans métadonnées : " + muettes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET LE LAYOUT DU SEGMENT `[locale]` N'EN POSE PAS. C'est la forme même
   * du défaut : un layout qui décrit UNE page la décrit pour TOUTES celles
   * qu'il enveloppe. Remettre `generateMetadata` ici rendrait la FAQ, le
   * contact et la connexion canoniquement égaux à la page d'accueil.
   */
  it("le layout de langue ne décrit aucune page", () => {
    const layout = readFileSync(join(RACINE, "[locale]", "layout.tsx"), "utf8");
    // ⚠️ L'EXPORT, PAS LA MENTION : le commentaire qui explique pourquoi il n'y
    // en a pas contient le mot lui aussi.
    expect(
      /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(layout),
      "le layout [locale] décrit une page : tout le segment en hérite",
    ).toBe(false);
  });

  /** ⚠️ Une page est canonique d'elle-même, jamais d'une autre. */
  it("chaque page se déclare canonique d'elle-même", () => {
    const cas: [string, string][] = [
      ["/faq", "fr"],
      ["/faq", "en"],
      ["/contact", "de"],
      ["/login", "es"],
    ];
    for (const [chemin, locale] of cas) {
      const m = pageMetadata({
        chemin,
        locale: locale as "fr" | "en" | "de" | "es",
        textes: chemin === "/faq" ? FAQ_META : chemin === "/contact" ? CONTACT_META : LOGIN_META,
      });
      const attendu = `${SITE_URL}${locale === "en" ? "" : "/" + locale}${chemin}`;
      expect(m.alternates?.canonical, `${locale}${chemin}`).toBe(attendu);
    }
  });

  /** ⚠️ La connexion et le mot de passe ne s'indexent pas : rien à y chercher. */
  it("les pages de compte restent hors de l'index", () => {
    const m = pageMetadata({ chemin: "/login", locale: "fr", textes: LOGIN_META, indexer: false });
    expect((m.robots as { index?: boolean }).index).toBe(false);
    const connexion = readFileSync(join(RACINE, "login", "page.tsx"), "utf8");
    expect(connexion).toContain("indexer: false");
  });

  /**
   * ⚠️ AUCUN TITRE N'EST PARTAGÉ PAR DEUX PAGES. Deux pages qui portent le même
   * titre sont, pour un moteur comme pour un onglet, la même page.
   *
   * ⚠️ ENTRE DEUX LANGUES, EN REVANCHE, C'EST NORMAL : « Contact » s'écrit
   * pareil en français et en anglais, et les deux pages sont distinguées par
   * leur URL et leur `hreflang`. Ce test compare donc des PAGES, pas des
   * lignes de table : ma première version comptait les langues et accusait
   * « Contact » de se répéter.
   */
  it("aucun titre n'est partagé par deux pages", () => {
    const titres = new Map<string, string[]>();
    const tables: [string, Record<string, { title: string }>][] = [
      ["faq", FAQ_META],
      ["contact", CONTACT_META],
      ["login", LOGIN_META],
      ["mot de passe", MOT_DE_PASSE_META],
      ...Object.entries(LEGAL_META).map(
        ([k, v]) => ["légal/" + k, v] as [string, Record<string, { title: string }>],
      ),
    ];
    for (const [nom, table] of tables) {
      for (const textes of Object.values(table)) {
        const pages = titres.get(textes.title) ?? [];
        if (!pages.includes(nom)) titres.set(textes.title, [...pages, nom]);
      }
    }
    const doubles = Array.from(titres).filter(([, ou]) => ou.length > 1);
    expect(doubles.map(([t, ou]) => `${t} (${ou.join(" + ")})`), "titres en double").toEqual([]);
  });

  /** ⚠️ Et une description vide vaut une description absente. */
  it("chaque texte est écrit dans les quatre langues", () => {
    const fautes: string[] = [];
    const tables: [string, Record<string, { title: string; description: string }>][] = [
      ["FAQ_META", FAQ_META],
      ["CONTACT_META", CONTACT_META],
      ["LOGIN_META", LOGIN_META],
      ["MOT_DE_PASSE_META", MOT_DE_PASSE_META],
      ...Object.entries(LEGAL_META).map(
        ([k, v]) => ["LEGAL_META." + k, v] as [string, Record<string, { title: string; description: string }>],
      ),
    ];
    for (const [nom, table] of tables) {
      for (const langue of ["fr", "en", "de", "es"]) {
        const textes = table[langue];
        if (!textes || !textes.title.trim() || !textes.description.trim()) {
          fautes.push(`${nom}.${langue}`);
        }
      }
    }
    expect(fautes, "textes manquants : " + fautes.join(", ")).toEqual([]);
  });
});
