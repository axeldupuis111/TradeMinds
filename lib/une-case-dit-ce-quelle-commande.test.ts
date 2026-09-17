import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UNE CASE À COCHER DIT TOUT CE QU'ELLE COMMANDE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE SEULE CASE, « Recevoir un email de rappel quotidien », COMMANDAIT
 * TROIS E-MAILS DIFFÉRENTS : le rappel quotidien qu'elle nomme, le BILAN
 * HEBDOMADAIRE, et la RELANCE envoyée à un trader qui ne revient plus. Le
 * trader qui cochait pour son rappel du matin acceptait sans le savoir deux
 * autres envois ; celui qui décochait perdait des e-mails qu'il n'avait pas
 * refusés.
 *
 * ⚠️ LE CÔTÉ PUSH A QUATRE RÉGLAGES DISTINCTS (séance, hebdo, alertes,
 * actualités). Le côté e-mail en a un, nommé d'après l'un des trois. La même
 * règle, appliquée à un canal sur deux.
 *
 * ⚠️ ET CE N'EST PAS QU'UNE QUESTION DE STYLE : en Europe, un consentement se
 * donne pour un objet décrit. Une case qui n'annonce pas ce qu'elle déclenche
 * n'en est pas un.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tant que `email_notif_session` commande plusieurs envois, son libellé les
 * nomme, dans les quatre langues. Ce garde épingle la LISTE DES ROUTES qui s'en
 * servent : en ajouter une casse le test, et oblige à revoir le libellé.
 */

const RACINE = process.cwd();

function routes(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const c = join(d, f);
    if (statSync(c).isDirectory()) routes(c, out);
    else if (f === "route.ts") out.push(c);
  }
  return out;
}

/**
 * Les routes qui décident d'un envoi d'après cette préférence.
 *
 * ⚠️ ON CHERCHE LA COLONNE, PAS UNE FORME D'APPEL. La première version de ce
 * garde cherchait `.eq("email_notif_session", true)` et ratait donc le rappel
 * quotidien, dont le filtre a été déplacé DANS la boucle (cette route lit tous
 * les profils pour aussi clôturer les séances oubliées). Une règle qui ne
 * connaît qu'une syntaxe protège la moitié du produit.
 */
const ECRIVENT = new Set([
  // La route de désinscription ne lit pas la préférence : elle la POSE.
  "app/api/unsubscribe/route.ts",
]);

function routesFiltrantes(): string[] {
  return routes(join(RACINE, "app/api"))
    .filter((c) => /email_notif_session/.test(readFileSync(c, "utf8")))
    .map((c) => c.slice(RACINE.length + 1).replace(/\\/g, "/"))
    .filter((n) => !ECRIVENT.has(n))
    .sort();
}

describe("la case des e-mails", () => {
  it("commande exactement les envois que son libellé annonce", () => {
    expect(
      routesFiltrantes(),
      "un envoi est apparu derrière cette case, ou en a disparu : le libellé " +
        "des quatre langues doit le dire (lib/i18n/*.ts, settings_notif_email_session)",
    ).toEqual([
      "app/api/reactivation/route.ts",
      "app/api/send-reminders/route.ts",
      "app/api/weekly-report/route.ts",
    ]);
  });

  /**
   * ⚠️ ON CHERCHE LE SENS, PAS LA PHRASE : chaque langue doit nommer le rythme
   * hebdomadaire ET la relance, sinon le libellé est retombé sur le seul
   * rappel quotidien.
   */
  const ATTENDUS: Record<string, { table: Record<string, string>; mots: RegExp[] }> = {
    fr: { table: fr, mots: [/hebdomadaire/i, /relance|absence/i] },
    en: { table: en, mots: [/weekly/i, /nudge|stop coming|inactiv/i] },
    de: { table: de, mots: [/wochen/i, /abwesenheit|inaktiv/i] },
    es: { table: es, mots: [/semanal/i, /aviso|dejas|inactiv/i] },
  };

  for (const [langue, { table, mots }] of Object.entries(ATTENDUS)) {
    it(`le dit en ${langue}`, () => {
      const libelle = table["settings_notif_email_session"];
      expect(libelle, "le libellé a disparu").toBeTruthy();
      for (const mot of mots) {
        expect(
          libelle,
          `le libellé ${langue} ne nomme plus un des envois qu'il déclenche (${mot}) : ` +
            `« ${libelle} »`,
        ).toMatch(mot);
      }
    });
  }

  /** ⚠️ Et il reste une case, pas un paragraphe. */
  it("tient dans une ligne de réglage", () => {
    for (const { table } of Object.values(ATTENDUS)) {
      expect(table["settings_notif_email_session"].length).toBeLessThan(130);
    }
  });
});
