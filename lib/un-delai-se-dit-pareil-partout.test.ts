import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { delaiRelatif, styleDImpact } from "./economic-calendar";
import { joursEntreCles, localDateKey } from "./timezone";

/**
 * LES DEUX SURFACES DU CALENDRIER DISENT LA MÊME CHOSE DE LA MÊME ANNONCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `relativeLabel` ÉTAIT RECOPIÉ DANS LES DEUX SURFACES ET AVAIT DIVERGÉ.
 * La page Calendrier et la carte de la page Séance portaient chacune sa copie ;
 * le 2026-09-16, un défaut a été corrigé dans UNE des deux — le délai annoncé
 * en tranches de vingt-quatre heures, qui donnait « dans 1 j » et « dans 2 j »
 * pour deux annonces du MÊME jour, sous un seul titre « vendredi 18
 * septembre ». La correction, commentaire de dix lignes compris, n'a jamais été
 * reportée sur l'autre copie.
 *
 * ⚠️ AUCUN TRADER N'A VU LA DIFFÉRENCE, ET C'EST DIT HONNÊTEMENT : la carte de
 * la page Séance ne montre que la journée en cours (`loadTodayNews` borne la
 * lecture au jour local), donc la branche « en jours » ne pouvait pas s'y
 * déclencher. Le défaut était dans le code, pas à l'écran — il y attendait le
 * jour où cette carte montrerait deux jours.
 *
 * ⚠️ `impactStyle`, LUI, ÉTAIT IDENTIQUE AU CARACTÈRE PRÈS. Deux copies
 * d'accord aujourd'hui, ce n'est pas un défaut ; deux copies dont l'une a déjà
 * dérivé, c'est la preuve que la suivante dérivera.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

const SURFACES = [
  "app/dashboard/calendar/page.tsx",
  "components/session/EconomicCalendarCard.tsx",
];

const t = (cle: string) => {
  const dict: Record<string, string> = {
    news_passed: "passée",
    news_now: "maintenant",
    news_in_minutes: "dans {n} min",
    news_in_hours: "dans {h}h{m}",
    cal_in_days: "dans {n} j",
  };
  return dict[cle] ?? cle;
};

const outils = {
  fuseau: "Europe/Paris",
  cleDuJour: localDateKey,
  joursEntre: joursEntreCles,
};

describe("le délai avant une annonce", () => {
  /**
   * ⚠️⚠️ LE CAS RÉEL, REPRIS DU RELEVÉ DU 2026-09-16 À 23 H. Deux annonces du
   * MÊME jour, à vingt-six et trente-sept heures : l'ancienne version disait
   * « dans 1 j » et « dans 2 j » sous un seul titre de jour.
   */
  it("compte des jours de calendrier, pas des tranches de vingt-quatre heures", () => {
    const maintenant = new Date("2026-09-16T21:00:00Z"); // 23 h à Paris
    const aube = delaiRelatif({ event_time: "2026-09-17T23:30:00Z" }, t, outils, maintenant);
    const midi = delaiRelatif({ event_time: "2026-09-18T10:30:00Z" }, t, outils, maintenant);
    // 26 h et 37 h plus tard, mais le 18 septembre à Paris dans les deux cas.
    expect(aube, "l'annonce de la nuit est comptée sur un autre jour").toBe(midi);
    expect(midi).toBe("dans 2 j");
  });

  it("dit les minutes, puis les heures, puis les jours", () => {
    const n = new Date("2026-09-16T10:00:00Z");
    expect(delaiRelatif({ event_time: "2026-09-16T10:30:00Z" }, t, outils, n)).toBe("dans 30 min");
    expect(delaiRelatif({ event_time: "2026-09-16T15:45:00Z" }, t, outils, n)).toBe("dans 5h45");
    expect(delaiRelatif({ event_time: "2026-09-16T10:02:00Z" }, t, outils, n)).toBe("maintenant");
    expect(delaiRelatif({ event_time: "2026-09-16T09:00:00Z" }, t, outils, n)).toBe("passée");
  });

  /** ⚠️ Les minutes se rendent sur deux chiffres, sinon « dans 5h5 ». */
  it("écrit les minutes sur deux chiffres", () => {
    const n = new Date("2026-09-16T10:00:00Z");
    expect(delaiRelatif({ event_time: "2026-09-16T15:05:00Z" }, t, outils, n)).toBe("dans 5h05");
  });
});

describe("les deux surfaces", () => {
  it("ne réécrivent plus le calcul dans leur coin", () => {
    const fautes: string[] = [];
    for (const f of SURFACES) {
      const src = lire(f);
      if (/function relativeLabel\(/.test(src)) fautes.push(`${f} : délai recopié`);
      if (/function impactStyle\(/.test(src)) fautes.push(`${f} : style recopié`);
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });

  it("passent bien par le module partagé", () => {
    for (const f of SURFACES) {
      const src = lire(f);
      expect(src, `${f} n'appelle plus le délai partagé`).toContain("delaiRelatif(");
      expect(src, `${f} n'appelle plus le style partagé`).toContain("styleDImpact(");
    }
  });

  /**
   * ⚠️ ET LE FUSEAU ARRIVE PAR PARAMÈTRE. `browserTimezone()` n'a de sens que
   * côté navigateur : l'appeler dans le module partagé — lu aussi par le cron —
   * ferait dépendre une fonction serveur d'un `Intl` de client.
   */
  it("fournissent le fuseau du navigateur au module", () => {
    for (const f of SURFACES) {
      expect(lire(f), `${f} ne fournit plus ses outils de date`).toMatch(
        /fuseau: browserTimezone\(\)/,
      );
    }
    /**
     * ⚠️ ON LIT LE CODE, PAS LES COMMENTAIRES. Ce test accusait le module à
     * tort : il y mentionne `browserTimezone()` pour EXPLIQUER pourquoi il ne
     * l'appelle pas. Un garde qui lit la prose d'un fichier interdit d'en
     * parler.
     */
    const sansCommentaires = lire("lib/economic-calendar.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(
      sansCommentaires,
      "le module partagé appelle lui-même le fuseau du navigateur",
    ).not.toContain("browserTimezone");
  });
});

describe("le style d'une annonce", () => {
  it("distingue les trois importances", () => {
    const h = styleDImpact("high");
    const m = styleDImpact("medium");
    const l = styleDImpact("low");
    expect(new Set([h.row, m.row, l.row]).size).toBe(3);
    expect(h.badge).toContain("red");
    expect(m.badge).toContain("orange");
    expect(l.badge).toContain("yellow");
  });
});
