import { config } from "dotenv";
import { fileURLToPath } from "node:url";

/** Repo-root .env.local (never committed). */
export const ROOT_ENV_FILE = fileURLToPath(new URL("../../../.env.local", import.meta.url));

/** For CLI entry points only; app runtimes get their env from the host. Existing vars win. */
export function loadRootEnv(): void {
  config({ path: ROOT_ENV_FILE, quiet: true });
}
