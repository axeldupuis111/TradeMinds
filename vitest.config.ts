import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Les worktrees créés par Claude Code (.claude/worktrees/*) contiennent des
    // copies complètes du repo : sans cette exclusion, vitest exécute chaque
    // suite en double/triple, ce qui rallonge le run et provoque des timeouts.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
  resolve: {
    alias: {
      // Mirror the "@/*" → project root alias from tsconfig.json so tests can
      // import modules the same way the app does.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
