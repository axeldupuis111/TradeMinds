import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" → project root alias from tsconfig.json so tests can
      // import modules the same way the app does.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
