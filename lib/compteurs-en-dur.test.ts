import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN COMPTEUR N'EST PAS ÉCRIT DANS LE JSX.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « 1 TRADES » DANS L'HISTORIQUE DES ANALYSES : « 23 juin 2026 · Cette
 * semaine — 1 trades — 100 ». Relevé le 2026-09-16 en pilotant la page Analyse
 * IA. Douze compteurs du même genre, tous écrits directement dans le JSX sous
 * la forme `{n} trades` : historique des analyses, infobulles des graphiques
 * d'Analytics, cartes « jour le moins performant » et « meilleure heure »,
 * bouton d'import CSV (« Importer 1 trades »), pied de la liste des trades.
 *
 * ⚠️ ET ILS N'ÉTAIENT MÊME PAS TRADUITS : « trades » en anglais, en dur, dans
 * un produit qui parle quatre langues.
 *
 * ── POURQUOI LE GARDE EXISTANT NE POUVAIT PAS LES VOIR ──────────────────────
 *
 * ⚠️⚠️ `accords-des-compteurs.test.ts` A ÉTÉ ÉCRIT POUR EXACTEMENT CETTE FAUTE
 * (« quatre-vingt-dix-huit phrases écrivaient 1 trades ») et il lit les
 * DICTIONNAIRES. Un compteur écrit dans le JSX n'entre dans aucun dictionnaire :
 * il est, par construction, hors de sa portée. Les deux gardes sont donc
 * complémentaires, et c'est le second qui manquait.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un nombre suivi d'un nom passe par une clé de traduction qui porte l'accord
 * (`{n} {n|trade|trades}`). La clé générique existe : `common_trades_count`.
 */
describe("aucun compteur écrit dans le JSX", () => {
  const RACINE = process.cwd();

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))];

  /**
   * Les noms qu'on a déjà su accorder ailleurs. La liste vient des clés
   * existantes, pas d'une intuition : le test ne connaît pas la grammaire, il
   * reconnaît un mot que le produit sait déjà décliner.
   */
  /**
   * ⚠️ « POINT » A ÉTÉ RETIRÉ DE CETTE LISTE, et la raison vaut d'être
   * connue : `points` est aussi un ATTRIBUT SVG (`<polyline points={…}>`).
   * Un garde qui accuse du code juste finit par être désactivé ; mieux
   * vaut une liste courte qui dit vrai qu'une liste large qui crie.
   */
  const NOMS = ["trade", "trades", "jour", "jours", "session", "sessions"];
  const MOTIF = new RegExp(`\\{[^{}]{1,80}\\}\\s+(${NOMS.join("|")})\\b`, "i");

  it("reconnaît la faute quand on la lui montre", () => {
    expect(MOTIF.test("{r.total_trades} trades")).toBe(true);
    expect(MOTIF.test("{worstDay.count} trades)")).toBe(true);
    // Et laisse passer ce qui est bien fait.
    expect(MOTIF.test('{t("common_trades_count", { n: total })}')).toBe(false);
  });

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(50);
  });

  it("aucun nombre n'est suivi d'un nom écrit en dur", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      src.split(/\r?\n/).forEach((ligne, i) => {
        if (!MOTIF.test(ligne)) return;
        /**
         * ⚠️ UNE INTERPOLATION QUI CONTIENT DÉJÀ `t(` EST BIEN FAITE : c'est le
         * cas de `{t("common_trades_count", …)} · WR …`, où le mot qui suit
         * appartient à la phrase suivante, pas au compteur.
         */
        const m = MOTIF.exec(ligne)!;
        if (/\bt\(/.test(m[0])) return;
        fautes.push(`${nom}:${i + 1}  ${ligne.trim().slice(0, 70)}`);
      });
    }
    expect(
      fautes,
      "compteurs écrits dans le JSX (passer par une clé qui porte l'accord, ex. common_trades_count) :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });
});
