import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Integration tests read DATABASE_URL etc. from .env.local (never committed).
loadEnv({ path: ".env.local", quiet: true });

const shared = ["**/node_modules/**", "**/.next/**", "apps/web/e2e/**"];

export default defineConfig({
  plugins: [react()],
  // apps/web's tsconfig path alias, so route handlers can be tested as they are written.
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/", import.meta.url)) }],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["{apps,packages}/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
          exclude: [...shared, "**/*.int.test.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["{apps,packages}/**/*.int.test.{ts,tsx}"],
          exclude: shared,
          environment: "node",
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
