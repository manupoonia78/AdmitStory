import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });

// `generate` needs no database; `migrate`/`studio`/`push` read DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
