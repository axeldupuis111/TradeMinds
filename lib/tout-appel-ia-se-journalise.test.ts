import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costEur } from "./ai-cost-log";

/**
 * UN APPEL QUI NE SE JOURNALISE PAS EST UN COÛT INVISIBLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA RÈGLE ÉTAIT ÉCRITE ET TENUE PAR QUATRE ROUTES SUR TREIZE. L'en-tête de
 * `lib/ai-cost-log.ts` dit « un événement `ai_call` par appel », et le tableau
 * de bord d'Axel lit ces événements pour répondre à « combien me coûte l'IA ».
 * Mesuré le 2026-09-17 sur les 95 appels journalisés en production : trois
 * routes seulement y apparaissent (chat-coach, compiler-strategie, analyze).
 * Huit routes qui appellent un modèle n'écrivaient rien.
 *
 * ⚠️ Le module porte même l'avertissement qui le dit : « À METTRE À JOUR en même
 * temps que tout changement de modèle dans une route, sinon les coûts affichés
 * dérivent en silence. » Une phrase dans un commentaire ne tient rien.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute route qui appelle un modèle journalise son coût, et tout modèle employé
 * a un tarif. Les exceptions sont nommées, avec leur raison.
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

/** Les routes qui parlent à un modèle. */
function routesIa(): { chemin: string; nom: string; src: string }[] {
  return routes(join(RACINE, "app/api"))
    .map((chemin) => ({ chemin, nom: chemin.slice(RACINE.length + 1).replace(/\\/g, "/"), src: readFileSync(chemin, "utf8") }))
    .filter((r) => /\.messages\.create\(/.test(r.src));
}

describe("le journal des coûts IA", () => {
  it("trouve bien les routes qui appellent un modèle", () => {
    expect(routesIa().length, "plus aucune route IA : le balayage est cassé").toBeGreaterThanOrEqual(10);
  });

  /**
   * Les exceptions, chacune avec sa raison. ⚠️ Une liste sans raisons devient
   * une poubelle, et le garde ne garde plus rien.
   */
  const EXEMPTEES = new Map<string, string>([
    [
      "app/api/macro-analysis/generate/route.ts",
      "cron sans utilisateur : `product_events.user_id` est NOT NULL, donc ce " +
        "coût-là ne peut pas s'écrire dans cette table sans lui inventer un " +
        "propriétaire. C'est pourtant le seul appel QUOTIDIEN et non surveillé " +
        "du produit : à traiter à part, avec une colonne nullable ou une table " +
        "dédiée.",
    ],
  ]);

  it("toute route qui appelle un modèle journalise son coût", () => {
    const fautes: string[] = [];
    for (const { nom, src } of routesIa()) {
      if (EXEMPTEES.has(nom)) continue;
      if (!/logAiCost\(/.test(src)) fautes.push(nom);
    }
    expect(
      fautes,
      "routes dont le coût n'apparaît nulle part : le tableau de bord " +
        "sous-estime la facture sans le dire :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET TOUT MODÈLE EMPLOYÉ A UN TARIF. `costEur` rend ZÉRO pour un modèle
   * inconnu — délibérément, pour ne pas inventer un chiffre — donc changer de
   * modèle sans toucher au tarif fait disparaître son coût des totaux, en
   * silence et sans erreur. C'est exactement ce que l'en-tête du module
   * redoute.
   */
  it("tout modèle employé dans une route a un tarif", () => {
    const modeles = new Set<string>();
    for (const { src } of routesIa()) {
      for (const m of Array.from(src.matchAll(/model:\s*"(claude-[a-z0-9-]+)"/g))) modeles.add(m[1]);
      for (const m of Array.from(src.matchAll(/=\s*"(claude-[a-z0-9-]+)"/g))) modeles.add(m[1]);
    }
    expect(modeles.size, "aucun modèle lu : le balayage est cassé").toBeGreaterThanOrEqual(2);

    const sansTarif = Array.from(modeles).filter(
      (m) => costEur(m, { input_tokens: 1_000_000, output_tokens: 0 }) === 0,
    );
    expect(
      sansTarif,
      "modèles employés sans tarif : leur coût vaut zéro dans les totaux, " +
        "en silence. Ajouter la ligne dans PRICING (lib/ai-cost-log.ts) : " +
        sansTarif.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Et le tarif calcule vraiment quelque chose, sinon ce test dirait oui à tout. */
  it("le tarif produit un coût non nul", () => {
    expect(costEur("claude-sonnet-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeGreaterThan(0);
    expect(costEur("zzz-modele-inconnu", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(0);
  });
});
