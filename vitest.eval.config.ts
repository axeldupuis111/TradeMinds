import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Configuration du BANC D'ESSAI du coach (`npm run eval:coach`).
 *
 * Séparée de vitest.config.ts pour une raison simple : ces suites appellent le
 * vrai modèle et dépensent de vrais tokens. Elles ne doivent jamais partir avec
 * `npm test`, ni en intégration continue par accident. Leur extension `.eval`
 * les tient hors du motif par défaut de vitest ; ce fichier est le seul endroit
 * qui les inclut.
 */
export default defineConfig({
  test: {
    include: ["**/*.eval.ts"],
    exclude: ["**/node_modules/**", "**/.claude/**"],
    // Un appel modèle avec boucle d'outils dépasse largement les 5 s par défaut.
    testTimeout: 120_000,
    // Les scénarios partagent le préfixe système mis en cache : les lancer en
    // série évite d'en payer plusieurs écritures en parallèle.
    fileParallelism: false,
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
