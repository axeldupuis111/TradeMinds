import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { messageDeBaseLisible, messageDErreurSupabase } from "./erreurs-de-base";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN MESSAGE DE LA BASE NE S'AFFICHE JAMAIS TEL QUEL.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ MESURÉ EN PRODUCTION : en faisant échouer l'enregistrement d'un compte,
 * l'écran a montré mot pour mot la phrase renvoyée par le serveur. Dans la vraie
 * vie, ce serait `duplicate key value violates unique constraint "…"` : en
 * anglais, sur un produit qui parle quatre langues, et sans dire quoi faire.
 *
 * ⚠️ QUATRE ÉCRANS DANS CE CAS, dont l'IMPORT CSV, celui où l'échec est le plus
 * probable : une colonne manquante y donne un message Postgres que personne ne
 * peut lire. La règle était pourtant déjà écrite dans le fichier du compte, pour
 * la suppression seulement.
 */
describe("les erreurs de la base sont traduites", () => {
  const t = (cle: string) => (frDict as Record<string, string>)[cle] ?? cle;

  it("reconnaît ce que Postgres et PostgREST renvoient vraiment", () => {
    const cas: [string, string][] = [
      ['duplicate key value violates unique constraint "prop_challenges_pkey"', "db_erreur_doublon"],
      ["23505", "db_erreur_doublon"],
      ['update on table "trades" violates foreign key constraint', "db_erreur_rattache"],
      ['new row violates row-level security policy for table "goals"', "db_erreur_droits"],
      ["JWT expired", "db_erreur_seance"],
      ['null value in column "pnl" violates not-null constraint', "db_erreur_donnee"],
      ["invalid input syntax for type numeric", "db_erreur_donnee"],
      ["TypeError: Failed to fetch", "db_erreur_reseau"],
    ];
    for (const [brut, cle] of cas) {
      expect(messageDeBaseLisible(brut, t), brut).toBe(t(cle));
    }
  });

  /**
   * ⚠️ LE REPLI EST UNE PHRASE VRAIE DANS TOUS LES CAS. Ne rien reconnaître est
   * la situation NORMALE le jour où Postgres change une formulation : il faut
   * que ce jour-là l'écran reste lisible, pas qu'il retombe sur le texte brut.
   */
  it("retombe sur « Non enregistré. Réessaie. » plutôt que sur le texte brut", () => {
    for (const brut of ["", null, undefined, "quelque chose de tout à fait inédit"]) {
      expect(messageDeBaseLisible(brut, t)).toBe(t("save_failed"));
    }
    expect(messageDErreurSupabase(null, t)).toBe(t("save_failed"));
  });

  /** Le code et le message vivent dans deux champs : les deux comptent. */
  it("lit le code quand le message ne dit rien", () => {
    expect(messageDErreurSupabase({ code: "23503", message: "erreur" }, t)).toBe(
      t("db_erreur_rattache"),
    );
    expect(messageDErreurSupabase({ code: null, message: "JWT expired" }, t)).toBe(
      t("db_erreur_seance"),
    );
  });

  it("dit la même chose dans les quatre langues", () => {
    const cles = [
      "db_erreur_doublon",
      "db_erreur_rattache",
      "db_erreur_droits",
      "db_erreur_seance",
      "db_erreur_donnee",
      "db_erreur_reseau",
    ];
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      for (const cle of cles) {
        const texte = (dico as Record<string, string>)[cle];
        expect(texte, `${cle} manque en ${nom}`).toBeTruthy();
        expect(texte.length, `${cle} trop court en ${nom}`).toBeGreaterThan(15);
      }
    }
  });

  /**
   * ── LE GARDE ────────────────────────────────────────────────────────────────
   *
   * ⚠️ CE QUI COMPTE N'EST PAS QUE CES QUATRE ÉCRANS SOIENT RÉPARÉS, c'est que
   * le cinquième ne recommence pas. Un message venu du serveur qui atterrit
   * directement dans un état d'affichage est une faute, où qu'il soit.
   */
  describe("aucun écran ne montre le texte brut du serveur", () => {
    /**
     * ⚠️ L'ADMIN EST EXEMPTÉ, ET C'EST ÉCRIT : ces pages ne sont ouvertes qu'à
     * Axel, elles affichent les réponses de ses propres routes, et le texte brut
     * y est précisément ce qu'il veut lire pour diagnostiquer.
     */
    const EXEMPTES = [join("app", "dashboard", "admin")];

    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }

    const POSE = new RegExp(
      "set\\w*(?:Error|Erreur|Message|Toast|Notice|Feedback)\\s*\\(\\s*" +
        "(?:\\{[^}]*text:\\s*)?" +
        "([A-Za-z_$][\\w$]*\\??\\.message)",
      "g",
    );

    it("balaie bien le produit, sinon ce test ne prouve rien", () => {
      const tous = ["app", "components"].flatMap((d) => fichiers(join(process.cwd(), d)));
      expect(tous.length).toBeGreaterThan(100);
    });

    it("ne pousse pas un `.message` du serveur dans l'écran", () => {
      const fautes: string[] = [];
      for (const d of ["app", "components"]) {
        for (const chemin of fichiers(join(process.cwd(), d))) {
          if (EXEMPTES.some((e) => chemin.includes(e))) continue;
          const src = sansCommentaires(readFileSync(chemin, "utf8"));
          for (const m of Array.from(src.matchAll(POSE))) {
            const ligne = src.slice(0, m.index!).split(/\r?\n/).length;
            fautes.push(chemin.split(/[\\/]/).slice(-2).join("/") + ":" + ligne + " (" + m[1] + ")");
          }
        }
      }
      expect(
        fautes,
        "textes bruts du serveur affichés au trader : " + fautes.join(", "),
      ).toEqual([]);
    });
  });
});
