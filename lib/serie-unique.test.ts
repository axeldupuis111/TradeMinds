import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { joursEmotionnels, serieDepuisLesTrades } from "./discipline-streak-source";

/**
 * LE PRODUIT NE DONNE QU'UNE SEULE RÉPONSE À « COMBIEN DE JOURS DE DISCIPLINE ? »
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TABLEAU DE BORD AFFICHAIT « 75 jours de discipline » ET
 * « STREAK DISCIPLINE 0 » EN MÊME TEMPS, à trente centimètres l'un de l'autre.
 * Deux cartes, deux calculs écrits séparément :
 *
 *   - « Objectifs & Discipline » : jours de TRADING sans trade émotionnel, gels
 *     compris, sur tout l'historique ;
 *   - « État du jour » : BILANS DE SÉANCE sans violation, sur les trente
 *     derniers, en s'arrêtant au premier bilan fautif.
 *
 * Rien à l'écran ne dit qu'ils mesurent des choses différentes : ils portent le
 * même nom. Et c'est le chiffre dont le produit tire son nom.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Deux choses : que le calcul partagé fait bien ce qu'il annonce, et surtout
 * qu'AUCUN composant n'en réécrive un deuxième dans son coin. C'est la seconde
 * qui compte : la première version du défaut n'était pas un mauvais calcul,
 * c'était un calcul de trop.
 */
describe("la série de discipline est calculée à un seul endroit", () => {
  const jour = (d: string, emotion: string | null = null) => ({
    open_time: `${d}T09:00:00Z`,
    emotion,
  });

  it("compte les jours de trading propres, le plus récent en dernier", () => {
    const serie = serieDepuisLesTrades(
      [jour("2026-09-01"), jour("2026-09-02"), jour("2026-09-03")],
      [],
    );
    expect(serie.current).toBe(3);
    expect(serie.record).toBe(3);
    expect(serie.isRecord).toBe(true);
  });

  it("un trade émotionnel casse la série en cours, pas le record", () => {
    const serie = serieDepuisLesTrades(
      [
        jour("2026-09-01"),
        jour("2026-09-02"),
        jour("2026-09-03"),
        jour("2026-09-04", "revenge"),
        jour("2026-09-05"),
      ],
      [],
    );
    expect(serie.current).toBe(1);
    expect(serie.record).toBe(3);
    expect(serie.isRecord).toBe(false);
  });

  it("un jour gelé recolle la série", () => {
    const trades = [
      jour("2026-09-01"),
      jour("2026-09-02", "fomo"),
      jour("2026-09-03"),
    ];
    expect(serieDepuisLesTrades(trades, []).current).toBe(1);
    expect(serieDepuisLesTrades(trades, ["2026-09-02"]).current).toBe(3);
  });

  it("un seul trade émotionnel salit tout le jour", () => {
    const j = joursEmotionnels([jour("2026-09-01"), jour("2026-09-01", "revenge")]);
    expect(j.get("2026-09-01")).toBe(true);
  });

  it("les jours sans trade ne cassent rien : le marché était fermé", () => {
    // Vendredi, puis lundi : le week-end n'apparaît pas dans les trades.
    const serie = serieDepuisLesTrades([jour("2026-09-04"), jour("2026-09-07")], []);
    expect(serie.current).toBe(2);
  });

  /**
   * ⚠️⚠️ ET PERSONNE NE RECOMMENCE À CÔTÉ. Le défaut d'origine tient dans ces
   * quatre lignes, recopiées dans deux composants : une boucle sur les bilans
   * qui incrémente un compteur et sort au premier fautif.
   */
  it("aucun composant ne recalcule une série de son côté", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }
    const AUTORISES = [
      "lib/discipline-streak-source.ts",
      "lib/discipline-streak.ts",
    ];
    const tous = [...fichiers("app"), ...fichiers("components"), ...fichiers("lib")];
    expect(tous.length).toBeGreaterThan(80);

    const fautes: string[] = [];
    for (const chemin of tous) {
      const nom = chemin.split(/[\\/]/).join("/");
      if (AUTORISES.some((a) => nom.endsWith(a))) continue;
      const source = readFileSync(chemin, "utf8");
      // Un compteur de série incrémenté à la main, quelle que soit sa source.
      if (/streakCount\s*\+\+|currentStreak\s*\+\+|serieCount\s*\+\+/.test(source)) {
        fautes.push(`${nom} : incrémente une série à la main`);
      }
      // Ou la même maths refaite sur des jours.
      if (/computeDisciplineStreaks\s*\(/.test(source)) {
        fautes.push(`${nom} : appelle le calcul brut au lieu du calcul partagé`);
      }
    }
    expect(
      fautes,
      "séries calculées hors de lib/discipline-streak-source.ts : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /** ⚠️ Garde sur le garde : les deux cartes passent bien par le module partagé. */
  it("les cartes qui affichaient deux chiffres différents lisent la même source", () => {
    for (const chemin of [
      "components/dashboard/DayState.tsx",
      "components/DayStatus.tsx",
      "components/dashboard/GoalsStreaks.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(source, chemin).toContain("@/lib/discipline-streak-source");
    }
  });
});
