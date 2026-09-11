import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN CRON QUI PARLE À TOUS LES ABONNÉS LES LIT TOUS.
 *
 * ── LE DÉFAUT, QUI N'APPARAÎT QUE LE JOUR OÙ LE PRODUIT MARCHE ──────────────
 *
 * ⚠️⚠️ LES CINQ CRONS QUI ÉCRIVENT AUX ABONNÉS LISAIENT `profiles` ET
 * `push_subscriptions` SANS BORNE. PostgREST rend au plus mille lignes, statut
 * 200, en-tête `content-range: 0-999/*`, aucune erreur. Au millier et unième
 * inscrit, le rappel quotidien, le rapport hebdomadaire, la relance, le gel de
 * série et l'annonce macro auraient simplement cessé de partir pour les
 * suivants — et rien, nulle part, n'aurait dit lesquels.
 *
 * ⚠️ C'EST LA MÊME RÈGLE QUE `lib/supabase-paginate.ts`, écrite le 2026-08-06
 * après l'avoir mesurée sur les trades, et jamais portée aux lectures GLOBALES.
 * Le garde qui existait ne regardait que la table `trades`.
 *
 * ⚠️ ET LE TRI EST OBLIGATOIRE : sans ordre déterministe, deux pages
 * consécutives peuvent se recouvrir ou sauter des lignes, ce qui remplace une
 * troncature silencieuse par un oubli silencieux.
 */
describe("les lectures globales des crons", () => {
  /** Les routes qui s'adressent à TOUS les abonnés, et la table qu'elles lisent. */
  const ROUTES = [
    "app/api/send-reminders/route.ts",
    "app/api/weekly-report/route.ts",
    "app/api/reactivation/route.ts",
    "app/api/streak-guard/route.ts",
    "app/api/economic-calendar/notify/route.ts",
  ];

  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  /** Chaque `.from("<table>")` avec les lignes qui la suivent. */
  function requetes(source: string, table: string): { ligne: number; texte: string }[] {
    const lignes = source.split(SAUT);
    const out: { ligne: number; texte: string }[] = [];
    for (let i = 0; i < lignes.length; i++) {
      if (!new RegExp(`\\.from\\(["'\`]${table}["'\`]\\)`).test(lignes[i])) continue;
      out.push({
        ligne: i + 1,
        texte: lignes.slice(i, Math.min(i + 12, lignes.length)).map((l) => l.trim()).join(" "),
      });
    }
    return out;
  }

  it("balaie bien des requêtes, sinon ce test ne prouve rien", () => {
    let n = 0;
    for (const r of ROUTES) {
      const source = readFileSync(join(process.cwd(), r), "utf8");
      n += requetes(source, "profiles").length + requetes(source, "push_subscriptions").length;
    }
    expect(n).toBeGreaterThan(6);
  });

  it("aucune n'est laissée sans borne", () => {
    const fautes: string[] = [];
    for (const r of ROUTES) {
      const source = readFileSync(join(process.cwd(), r), "utf8");
      for (const table of ["profiles", "push_subscriptions"]) {
        for (const { ligne, texte } of requetes(source, table)) {
          // Une écriture ou une ligne unique ne débordent pas.
          if (/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.single\(|\.maybeSingle\(/.test(texte)) continue;
          if (/\.range\(|\.limit\(/.test(texte)) continue;
          fautes.push(`${r.split("/").slice(-2).join("/")}:${ligne} (${table})`);
        }
      }
    }
    expect(
      fautes,
      "lectures globales tronquées en silence au millier de lignes : " + fautes.join(" | "),
    ).toEqual([]);
  });

  it("celles qui paginent trient sur une colonne unique", () => {
    const fautes: string[] = [];
    for (const r of ROUTES) {
      const source = readFileSync(join(process.cwd(), r), "utf8");
      for (const table of ["profiles", "push_subscriptions"]) {
        for (const { ligne, texte } of requetes(source, table)) {
          if (!/\.range\(/.test(texte)) continue;
          if (/\.order\(["'`](id|user_id)["'`]/.test(texte)) continue;
          fautes.push(`${r.split("/").slice(-2).join("/")}:${ligne} (${table})`);
        }
      }
    }
    expect(
      fautes,
      "pagination sans tri déterministe : des lignes peuvent être sautées ou vues deux fois : " +
        fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA PAGINATION PARTAGÉE RESTE EN UN SEUL EXEMPLAIRE : sa copie locale
   * dans `/api/community` avalait l'erreur (`const { data }` sans `error`), donc
   * une page ratée passait pour « zéro ligne », donc pour la fin de la
   * pagination. Le classement d'une communauté se calculait alors sur une
   * partie des membres, sans le dire.
   */
  it("personne ne réécrit la pagination dans son coin", () => {
    const source = readFileSync(join(process.cwd(), "app/api/community/route.ts"), "utf8");
    expect(source, "la pagination partagée n'est plus utilisée").toContain(
      'from "@/lib/supabase-paginate"',
    );
    expect(
      /const \{ data \} = await build\(\)\.range\(/.test(source),
      "la copie locale qui avalait l'erreur est revenue",
    ).toBe(false);
  });
});
