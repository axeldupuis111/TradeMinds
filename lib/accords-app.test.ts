import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "./i18n/de";
import en from "./i18n/en";
import es from "./i18n/es";
import fr from "./i18n/fr";
import { remplir } from "./remplir";

/**
 * LE PRODUIT ENTIER SAIT ACCORDER SES PHRASES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VU SUR « OBJECTIFS » : « 1 atteint(s) ». Et dix-sept autres du même
 * genre : « {n} trade(s) importé(s) », « {n} jour(s) », « {n} membre(s) ».
 *
 * ⚠️ LA CAUSE ÉTAIT DANS `t()` : elle ne prenait AUCUNE valeur. Chaque appelant
 * remplaçait ses trous à la main avec `.replace("{n}", …)`, et le seul moyen
 * d'écrire une phrase juste au singulier ET au pluriel était de mettre les deux
 * formes entre parenthèses. L'onglet backtest avait résolu ça de son côté avec
 * `remplir()` ; la fonction est simplement remontée d'un cran.
 *
 * ⚠️ ET CE CONTOURNEMENT NE MARCHE MÊME PAS PARTOUT : en allemand, le nom
 * change de forme au pluriel (« Tag » / « Tage »), un « (e) » collé à la fin ne
 * produit rien de lisible.
 */
describe("les accords du produit", () => {
  const dicos = { fr, en, es, de } as Record<string, Record<string, string>>;

  it("aucune phrase n'écrit un pluriel entre parenthèses", () => {
    const fautes: string[] = [];
    for (const [nom, dico] of Object.entries(dicos)) {
      for (const [cle, texte] of Object.entries(dico)) {
        if (typeof texte !== "string") continue;
        if (/\((s|e|es|n|en)\)/.test(texte)) fautes.push(`${nom}/${cle}`);
      }
    }
    expect(fautes, "pluriels entre parenthèses : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET PLUS PERSONNE NE REMPLACE UN TROU À LA MAIN. Un
   * `t("clé").replace("{n}", …)` ne voit pas `{n|jour|jours}` : il laisserait
   * l'accord non résolu à l'écran, c'est-à-dire le remède pire que le mal.
   */
  it("aucun appelant ne remplace à la main un trou d'une phrase accordée", () => {
    /**
     * ⚠️ SEULES LES PHRASES QUI PORTENT UN ACCORD. Des centaines d'appels
     * remplacent encore leurs trous à la main, et ils marchent : leur phrase
     * n'a pas d'accord. Les signaler tous ferait un garde de quatre cent
     * cinquante lignes qu'on apprendrait à ignorer en une journée.
     */
    /**
     * ⚠️⚠️ LES QUATRE LANGUES, PAS SEULEMENT LE FRANÇAIS. Une phrase peut
     * demander un accord dans une langue et pas dans une autre : « the first
     * {n} {n|member|members} » en anglais, « les {n} premiers membres » en
     * français, où le mot accordé n'est pas au même endroit. Un garde bâti sur
     * le seul français laisse alors l'appelant remplacer le trou à la main, et
     * c'est l'ANGLAIS qui affiche le gabarit brut. Vu en relisant ce garde
     * juste après avoir accordé trois cents phrases.
     */
    const accordees = new Set(
      Object.values({ fr, en, es, de } as Record<string, Record<string, string>>)
        .flatMap((dico) => Object.entries(dico))
        .filter(([, texte]) => typeof texte === "string" && /\{[a-zA-Z0-9_]+\|/.test(texte))
        .map(([cle]) => cle),
    );
    expect(accordees.size).toBeGreaterThan(10);
    // ⚠️ Garde sur le garde : la phrase la plus récemment accordée doit y être.
    expect(accordees.has("goals_beat_record")).toBe(true);

    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    const tous = [...fichiers("app"), ...fichiers("components"), ...fichiers("lib")];
    expect(tous.length).toBeGreaterThan(80);

    const fautes: string[] = [];
    for (const chemin of tous) {
      const nom = chemin.split(/[\\\/]/).slice(-2).join("/");
      const source = readFileSync(chemin, "utf8");
      /**
       * ⚠️⚠️ CE GARDE N'A JAMAIS RIEN VU PENDANT UNE HEURE, ET LA CAUSE TIENT EN
       * UN CARACTÈRE. J'avais écrit son motif depuis un script Python : le « \b »
       * du début est devenu un vrai caractère RETOUR ARRIÈRE dans le fichier, et
       * le motif exigeait donc un retour arrière avant chaque `t(`. Il ne pouvait
       * rien trouver. J'ai remis le défaut d'origine pour m'en assurer : il n'a
       * pas bronché, et j'ai cru pendant dix minutes que le problème venait de la
       * gourmandise du motif.
       *
       * ⚠️ ET UN REGARD EN AVANT PLUTÔT QU'UNE CAPTURE : capturer les cent vingt
       * caractères suivants ferait sauter `lastIndex` d'autant, et un `t("…")`
       * proche avalerait l'appel fautif. Un `(?=…)` ne consomme rien.
       */
      for (const m of Array.from(
        source.matchAll(/[^A-Za-z0-9_](?:t|tr)\(\s*"([a-z0-9_]+)"\s*\)(?=([\s\S]{0,120}))/g),
      )) {
        if (!accordees.has(m[1])) continue;
        if (/^\s*\.replace(All)?\(/.test(m[2])) fautes.push(`${nom} : ${m[1]}`);
      }
    }
    expect(
      fautes,
      "phrases accordées dont un appelant remplace le trou à la main : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET PERSONNE NE RÉÉCRIT `remplir()` DANS SON COIN. Trois composants
   * avaient leur propre `fmt(cle, valeurs)` : une boucle de `.replace()` sur
   * les trous, qui ne connaît pas la syntaxe d'accord. Le garde du dessus ne
   * les voyait pas, parce qu'ils n'écrivent pas `t("…").replace(…)` mais
   * `fmt(t("…"), { … })`.
   *
   * ⚠️ C'EST MOI QUI LES AI RENDUS DANGEREUX : le jour où le dictionnaire a
   * reçu ses accords, ces trois-là se sont mis à afficher le gabarit BRUT à
   * l'écran — « Basé sur tes 157 {count|trade|trades} » sur le tableau de bord.
   * Une correction qui casse trois écrans est pire que le défaut qu'elle
   * répare, et c'est exactement ce que le test d'à côté annonçait.
   */
  it("aucun composant ne réécrit le remplissage des trous", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components"), ...fichiers("lib")]) {
      if (chemin.endsWith("remplir.ts")) continue;
      const source = readFileSync(chemin, "utf8");
      // Un remplissage de trou écrit à la main : `.replace(`{${k}}`, …)`.
      if (!/\.replace\(\s*`\{\$\{/.test(source)) continue;
      fautes.push(chemin.split(/[\\\/]/).slice(-2).join("/"));
    }
    expect(
      fautes,
      "remplissages de trous écrits à la main (passer par t(clé, valeurs)) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Garde sur le garde : la fonction d'accord fait bien ce qu'on croit. */
  it("remplir choisit le singulier à un et le pluriel au-delà", () => {
    const g = "{n} {n|jour|jours}";
    expect(remplir(g, { n: 1 })).toBe("1 jour");
    expect(remplir(g, { n: 4 })).toBe("4 jours");
    expect(remplir(g, {})).toBe("{n} {n|jour|jours}");
  });

  /**
   * ⚠️⚠️ ZÉRO NE S'ACCORDE PAS PAREIL D'UNE LANGUE À L'AUTRE. Le français dit
   * « 0 jour », l'anglais « 0 days ». La première version comparait à 1, c'est-
   * à-dire appliquait la règle anglaise aux quatre langues : le profil public
   * écrivait « 0 jours de discipline », et c'est l'écran qu'un nouveau membre
   * voit en premier. Les trois autres langues rendaient la faute invisible.
   */
  it("zéro prend la forme que veut la langue, pas celle de l'anglais", () => {
    const gabarits: Record<string, [string, string]> = {
      fr: ["{n} {n|jour|jours}", "0 jour"],
      en: ["{n} {n|day|days}", "0 days"],
      es: ["{n} {n|día|días}", "0 días"],
      de: ["{n} {n|Tag|Tage}", "0 Tage"],
    };
    for (const [langue, [gabarit, attendu]] of Object.entries(gabarits)) {
      expect(remplir(gabarit, { n: 0 }, langue), `zéro en ${langue}`).toBe(attendu);
    }
    // Et un reste inchangé partout.
    for (const langue of Object.keys(gabarits)) {
      const [gabarit] = gabarits[langue];
      expect(remplir(gabarit, { n: 1 }, langue).endsWith("s")).toBe(false);
    }
  });

  /**
   * ⚠️⚠️ ET AUCUN COMPOSANT NE REFAIT L'ACCORD EN JAVASCRIPT. Cinq endroits
   * écrivaient `trade${n > 1 ? "s" : ""}` ou `n !== 1 ? "s" : ""` : deux règles
   * OPPOSÉES pour un seul fait dans le même produit (« 0 trade » sur le
   * calendrier, « 0 trades » sur le dashboard), et le mot « trade » traduit
   * dans aucune des quatre langues. Un « s » anglais n'accorde ni l'allemand ni
   * l'espagnol.
   */
  it("aucun composant ne fabrique un pluriel en JavaScript", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    const MOTIF = /[?]\s*"(s|es|n|en)"\s*:\s*""|""\s*:\s*"(s|es|n|en)"/;
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          if (MOTIF.test(ligne)) fautes.push(`${nom}:${i + 1}`);
        });
    }
    expect(
      fautes,
      "pluriels fabriqués en JavaScript (une phrase accordée du dictionnaire à la place) : " +
        fautes.join(", "),
    ).toEqual([]);
  });
});
