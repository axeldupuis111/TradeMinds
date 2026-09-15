import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import schema from "./schema-base.json";

/**
 * AUCUNE REQUÊTE NE DOIT CITER UNE TABLE OU UNE COLONNE QUI N'EXISTE PAS.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ LE CLIENT SUPABASE NE JETTE PAS. Une requête qui cite une colonne absente
 * est refusée ENTIÈREMENT par PostgREST (`42703 column … does not exist`), la
 * promesse se résout quand même, et le code lit `data: null` comme « ce trader
 * n'a rien ». Rien n'apparaît dans les journaux, rien ne casse à l'écran : la
 * fonction rend simplement du vide, pour tout le monde, indéfiniment.
 *
 * Trois lectures vivaient dans cet état :
 *
 *   - `/api/chat-coach` demandait `trades.checklist_total` (qui n'est pas une
 *     colonne mais le nombre d'éléments de la fiche stratégie) : le bloc de
 *     STATISTIQUES du coach — celui qui devait remplacer le dump des 60 trades
 *     — n'a jamais été envoyé au modèle ;
 *   - l'outil `get_performance` demandait la même colonne : il répondait
 *     TOUJOURS « Lecture des trades impossible » ;
 *   - `get_leaderboard_standing` demandait `profiles.current_streak`,
 *     `best_streak` et `streak_freezes_used`, trois colonnes inexistantes : le
 *     coach annonçait à chaque trader qu'il n'avait pas de pseudo public et
 *     une série de zéro jour.
 *
 * Et `read_projection` interrogeait une table `accounts` absente du schéma (les
 * comptes vivent dans `prop_challenges`) : le risque de ruine se calculait sur
 * un capital conventionnel de 10 000 pour tout le monde.
 *
 * ⚠️ LES 3 043 AUTRES TESTS NE POUVAIENT PAS LE VOIR : aucun ne parle à la base.
 * Ce test compare le code à une PHOTOGRAPHIE du schéma réel, à régénérer après
 * chaque migration avec `npm run schema:sync`.
 */

const RACINE = path.resolve(__dirname, "..");
const TABLES = schema as Record<string, string[]>;

/** Les fichiers de code applicatif, tests et dépendances exclus. */
function fichiersSources(): string[] {
  const out: string[] = [];
  const ignore = new Set(["node_modules", ".next", ".git", ".claude", "scripts"]);
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (ignore.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) marcher(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  marcher(RACINE);
  return out;
}

/**
 * Les emplois de `.from("table")` avec le bloc d'appels qui suit.
 *
 * ⚠️ ON S'ARRÊTE AU `.from(` SUIVANT, pas à une fenêtre en nombre de
 * caractères : une fenêtre fixe attribue les filtres d'une requête à la requête
 * d'à côté, et c'est ainsi qu'un garde finit par mentir.
 *
 * ⚠️⚠️ ET « LE `.from(` SUIVANT » COMPTE AUSSI CEUX DONT LA TABLE EST UNE
 * VARIABLE. Ne s'arrêter qu'aux tables écrites en toutes lettres laissait le
 * bloc de `profiles` avaler la boucle de purge de `lib/demo-data.ts`, qui
 * interroge `trades` : le garde accusait `profiles.user_id` de ne pas exister.
 */
function requetes(src: string): { table: string; bloc: string; ligne: number }[] {
  const out: { table: string; bloc: string; ligne: number }[] = [];
  const re = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const debut = m.index + m[0].length;
    const suite = src.slice(debut);
    const prochain = suite.search(/\.from\(/);
    out.push({
      table: m[1],
      bloc: prochain === -1 ? suite : suite.slice(0, prochain),
      ligne: src.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

/** Les colonnes citées par un bloc de requête, filtres et tris compris. */
function colonnesCitees(bloc: string): string[] {
  const noms: string[] = [];

  const select = bloc.match(/\.select\(\s*(["'`])([^"'`]*)\1/);
  if (select) {
    const brut = select[2];
    // Les jointures (`communities(id, name)`) et les colonnes construites par
    // interpolation ne se vérifient pas ici : on les laisse passer plutôt que
    // de rendre un verdict faux.
    if (brut.trim() && brut !== "*" && !brut.includes("(") && !brut.includes("$")) {
      for (const morceau of brut.split(",")) {
        const nom = morceau.trim().split(":").pop()!.trim();
        if (nom && nom !== "*" && !nom.startsWith("...")) noms.push(nom);
      }
    }
  }

  const filtre = /\.(eq|neq|gte|lte|lt|gt|in|is|ilike|like|contains|order)\(\s*["']([a-zA-Z_.]+)["']/g;
  let f: RegExpExecArray | null;
  while ((f = filtre.exec(bloc))) {
    // Un filtre sur une jointure (`communities.active`) porte sur une autre
    // table : hors de portée de ce garde.
    if (!f[2].includes(".")) noms.push(f[2]);
  }

  return noms;
}

describe("les requêtes ne citent que des tables et des colonnes qui existent", () => {
  const anomalies: string[] = [];

  for (const fichier of fichiersSources()) {
    const src = fs.readFileSync(fichier, "utf8");
    if (!src.includes(".from(")) continue;
    const relatif = path.relative(RACINE, fichier).replace(/\\/g, "/");

    for (const { table, bloc, ligne } of requetes(src)) {
      const connues = TABLES[table];
      if (!connues) {
        anomalies.push(`${relatif}:${ligne} — table « ${table} » absente du schéma`);
        continue;
      }
      for (const nom of colonnesCitees(bloc)) {
        if (!connues.includes(nom)) {
          anomalies.push(`${relatif}:${ligne} — ${table}.${nom} n'existe pas`);
        }
      }
    }
  }

  it("aucune table ni colonne fantôme", () => {
    expect(anomalies).toEqual([]);
  });

  it("la photographie du schéma couvre les tables du produit", () => {
    // Un fichier vide passerait le test précédent sans rien vérifier.
    expect(Object.keys(TABLES).length).toBeGreaterThan(30);
    expect(TABLES.trades).toContain("pnl");
    expect(TABLES.profiles).toContain("plan");
  });
});
