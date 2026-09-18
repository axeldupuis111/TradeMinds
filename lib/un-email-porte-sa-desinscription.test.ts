import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ligneDeDesinscription } from "./desinscription";

/**
 * TOUT E-MAIL RÉCURRENT PORTE SON LIEN DE DÉSINSCRIPTION, ÉCRIT UNE SEULE FOIS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️ TROIS COPIES MOT POUR MOT. Le rappel quotidien, le rapport hebdomadaire et
 * l'e-mail de réactivation portaient chacun sa table `DESINSCRIPTION_LIBELLE`
 * (quatre langues) et sa fonction `ligneDeDesinscription`, identiques au
 * caractère près — cinq cent soixante et un octets recopiés trois fois.
 *
 * ⚠️ CE N'EST PAS UNE QUESTION DE STYLE : le lien de désinscription est une
 * OBLIGATION, pas une décoration. Ce que trois copies produisent, ce dépôt le
 * sait : une correction qui n'en touche qu'une. C'est arrivé cette semaine au
 * message « −1 trades conformes », corrigé sur la page d'analyse et laissé dans
 * l'import CSV pendant une semaine.
 *
 * ── CE QUI A ÉTÉ VÉRIFIÉ ET TROUVÉ SAIN ─────────────────────────────────────
 *
 * ✅ LES AVERTISSEMENTS SUR LES RISQUES SORTENT BIEN DANS LES QUATRE LANGUES.
 * Rendu le 2026-09-18 et lu ligne à ligne : les trois routes passent `lang` à
 * `renderBrandEmail`, et le texte de conformité (annexe A du programme
 * NinjaTrader, « all emails sent and received ») apparaît en français, anglais,
 * allemand et espagnol. Le modèle l'impose au centre plutôt que de le
 * confier à chaque route, et c'est ce qui le rend impossible à oublier.
 */

const RACINE = process.cwd();

/** Les routes qui envoient un e-mail récurrent à un trader. */
const ROUTES_RECURRENTES = [
  "app/api/send-reminders/route.ts",
  "app/api/weekly-report/route.ts",
  "app/api/reactivation/route.ts",
];

describe("la ligne de désinscription", () => {
  it("n'est plus recopiée dans les routes", () => {
    const fautes: string[] = [];
    for (const f of ROUTES_RECURRENTES) {
      const src = readFileSync(join(RACINE, f), "utf8");
      if (/const DESINSCRIPTION_LIBELLE/.test(src)) fautes.push(`${f} : table recopiée`);
      if (/function ligneDeDesinscription/.test(src)) fautes.push(`${f} : fonction recopiée`);
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ON CHERCHE LA FORME DANS TOUT LE DÉPÔT, pas seulement dans les trois
   * routes connues : une quatrième écrite demain tombe ici le jour même.
   */
  it("n'est réécrite nulle part ailleurs", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (["node_modules", ".next", ".git"].includes(e.name)) continue;
        const p = join(d, e.name);
        if (statSync(p).isDirectory()) fichiers(p, out);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
      }
      return out;
    }
    const fautes = [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "lib"))]
      .filter((p) => !p.endsWith(join("lib", "desinscription.ts")))
      .filter((p) => /DESINSCRIPTION_LIBELLE|text-decoration:underline">\$\{DESINSCRIPTION/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(RACINE.length + 1).replace(/\\/g, "/"));
    expect(fautes, "libellé de désinscription réécrit hors du module : " + fautes.join(" ")).toEqual(
      [],
    );
  });

  /** ⚠️ Chaque e-mail récurrent l'appelle : une obligation, pas une option. */
  it("est posée par chacune des trois routes", () => {
    for (const f of ROUTES_RECURRENTES) {
      const src = readFileSync(join(RACINE, f), "utf8");
      expect(src, `${f} n'appelle plus la ligne de désinscription`).toMatch(
        /\.\.\.ligneDeDesinscription\(userId, lang\)/,
      );
      expect(src, `${f} n'importe plus le module partagé`).toContain("@/lib/desinscription");
    }
  });
});

describe("le comportement de la ligne", () => {
  /**
   * ⚠️⚠️ ZÉRO LIGNE PLUTÔT QU'UNE LIGNE VIDE. Sans secret configuré, le jeton
   * est nul : rendre une chaîne vide laisserait un lien mort dans le pied de
   * page, ce qui est pire que pas de lien du tout.
   */
  it("ne rend rien du tout quand le jeton est impossible", () => {
    const avant = process.env.UNSUBSCRIBE_SECRET;
    delete process.env.UNSUBSCRIBE_SECRET;
    try {
      expect(ligneDeDesinscription("00000000-0000-0000-0000-000000000000", "fr")).toEqual([]);
    } finally {
      if (avant !== undefined) process.env.UNSUBSCRIBE_SECRET = avant;
    }
  });

  /**
   * ⚠️ UNE LANGUE INCONNUE RETOMBE SUR L'ANGLAIS, pas sur une case vide. Les
   * copies indexaient la table sans repli : une valeur hors catalogue dans
   * `profiles.language` aurait donné `undefined` dans le lien.
   */
  it("retombe sur l'anglais pour une langue inconnue", () => {
    const avant = process.env.UNSUBSCRIBE_SECRET;
    process.env.UNSUBSCRIBE_SECRET = "secret-de-test-pour-le-garde";
    try {
      const [ligne] = ligneDeDesinscription("00000000-0000-0000-0000-000000000000", "it");
      expect(ligne, "aucune ligne rendue alors que le jeton est possible").toBeTruthy();
      expect(ligne).toContain("Unsubscribe from these emails");
      expect(ligne, "un libellé vide a remplacé le texte").not.toContain(">undefined<");
    } finally {
      if (avant === undefined) delete process.env.UNSUBSCRIBE_SECRET;
      else process.env.UNSUBSCRIBE_SECRET = avant;
    }
  });
});
