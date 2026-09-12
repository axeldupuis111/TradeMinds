import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bornesDePeriode, cleDePeriode, debutDePeriodeIso } from "./periode-objectif";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE PÉRIODE D'OBJECTIF EST CELLE DU CALENDRIER DU TRADER, ET ELLE SE CALCULE
 * À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS IMPLÉMENTATIONS DE LA MÊME CLÉ, dans trois fichiers :
 *
 *   • `app/dashboard/goals/page.tsx` posait minuit LOCAL puis écrivait la date
 *     UTC de cet instant. À l'est de Greenwich, minuit local tombe la VEILLE en
 *     UTC : la clé était donc fausse d'un jour TOUS LES JOURS, et pas seulement
 *     au passage de minuit.
 *   • `lib/coach-tools.ts` lisait la date « locale » d'un serveur Vercel, c'est
 *     à dire UTC.
 *   • `app/api/goals/route.ts` dérivait la sienne d'un `toISOString()`.
 *
 * ⚠️ CE QUE ÇA COÛTAIT : la reconduction compare la clé STOCKÉE (écrite par le
 * navigateur) à la clé RECALCULÉE (par le serveur). Elles ne venaient pas du
 * même endroit, donc elles ne coïncidaient pas : un objectif récurrent créé
 * depuis l'écran était reconduit dès la lecture suivante, ce qui décoche la
 * case et remet la série à zéro. Le trader perdait une série sans rien manquer.
 */
describe("la période d'un objectif", () => {
  /** 9 h du matin à Sydney le 12 ; à Greenwich il est encore le 11. */
  const NEUF_H_SYDNEY = new Date("2026-09-11T23:00:00Z");
  const SYDNEY = "Australia/Sydney";

  it("appartient au calendrier du trader, pas à celui du serveur", () => {
    expect(NEUF_H_SYDNEY.toISOString().slice(0, 10), "l'ancien calcul").toBe("2026-09-11");
    expect(cleDePeriode("day", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-09-12");
    expect(cleDePeriode("month", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-09-01");
    expect(cleDePeriode("quarter", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-07-01");
    expect(cleDePeriode("year", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-01-01");
  });

  /**
   * ⚠️ LE CAS QUI TOMBAIT TOUS LES JOURS, PAS SEULEMENT AUX BORDS : Paris en
   * pleine journée. L'ancien calcul rendait la veille parce qu'il écrivait en
   * UTC un instant posé à minuit local.
   */
  it("ne décale plus d'un jour en plein après-midi à Paris", () => {
    const apresMidi = new Date("2026-09-12T13:00:00Z"); // 15 h à Paris
    const ancien = (() => {
      const d = new Date(apresMidi);
      d.setUTCHours(-2, 0, 0, 0); // minuit à Paris exprimé en UTC
      return d.toISOString().slice(0, 10);
    })();
    expect(ancien, "l'ancien calcul rendait bien la veille").toBe("2026-09-11");
    expect(cleDePeriode("day", "Europe/Paris", apresMidi)).toBe("2026-09-12");
  });

  it("pose la semaine sur un lundi, dans le fuseau du trader", () => {
    for (const fuseau of ["Europe/Paris", SYDNEY, "America/Chicago", "UTC"]) {
      const cle = cleDePeriode("week", fuseau, NEUF_H_SYDNEY);
      expect(new Date(`${cle}T12:00:00Z`).getUTCDay(), `${cle} en ${fuseau}`).toBe(1);
    }
  });

  /** Les bornes s'enchaînent sans trou ni recouvrement, y compris d'un mois à l'autre. */
  it("enchaîne les périodes bout à bout", () => {
    for (const periode of ["day", "week", "month", "quarter", "year"] as const) {
      for (let offset = 4; offset >= 1; offset--) {
        const avant = bornesDePeriode(periode, offset, SYDNEY, NEUF_H_SYDNEY);
        const apres = bornesDePeriode(periode, offset - 1, SYDNEY, NEUF_H_SYDNEY);
        expect(avant.end.toISOString(), `trou en ${periode} (offset ${offset})`).toBe(
          apres.start.toISOString(),
        );
        expect(avant.start.getTime()).toBeLessThan(avant.end.getTime());
      }
    }
  });

  /** ⚠️ Un décalage de mois ne doit pas se perdre au passage d'une année. */
  it("traverse le changement d'année", () => {
    const janvier = new Date("2026-01-15T12:00:00Z");
    expect(cleDePeriode("month", "UTC", janvier)).toBe("2026-01-01");
    expect(bornesDePeriode("month", 1, "UTC", janvier).start.toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
    expect(bornesDePeriode("quarter", 1, "UTC", janvier).start.toISOString()).toBe(
      "2025-10-01T00:00:00.000Z",
    );
  });

  /** Une clé est une DATE, une borne est un INSTANT : ne pas les confondre. */
  it("distingue la clé de la borne", () => {
    expect(cleDePeriode("day", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-09-12");
    expect(debutDePeriodeIso("day", SYDNEY, NEUF_H_SYDNEY)).toBe("2026-09-11T14:00:00.000Z");
  });

  /**
   * ⚠️⚠️ ET IL N'EN RESTE QU'UNE. Le balayage cherche la signature des copies
   * supprimées : un calcul de début de période fait à la main sur un `Date`.
   */
  it("n'est plus recalculée à la main ailleurs", () => {
    const COPIE = /new Date\(\s*\w+\.getFullYear\(\)\s*,\s*\w+\.getMonth\(\)/;
    expect(
      COPIE.test("start = new Date(now.getFullYear(), now.getMonth() - offset, 1);"),
      "le motif ne reconnaît pas la faute qu'il cherche",
    ).toBe(true);

    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const c = join(d, f);
        if (statSync(c).isDirectory()) fichiers(c, out);
        else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
      }
      return out;
    }

    const fautes: string[] = [];
    for (const racine of ["app/api/goals", "app/dashboard/goals"]) {
      for (const chemin of fichiers(join(process.cwd(), ...racine.split("/")))) {
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        if (COPIE.test(src)) fautes.push(chemin.split(/[\\/]/).slice(-2).join("/"));
      }
    }
    expect(fautes, "copies du calcul de période : " + fautes.join(", ")).toEqual([]);
  });
});
