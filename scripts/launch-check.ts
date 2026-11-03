// pnpm launch:check (Phase 9b §11): reads the environment the way the app does and prints, per
// service, whether it is live, a development fake, optional or missing. Exits 1 when a production
// deploy (VERCEL_ENV=production) would refuse to boot. Prints names only, never a secret value.
//
//   pnpm launch:check                 # this shell's env plus .env.local
//   VERCEL_ENV=production pnpm launch:check

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { isProductionDeploy, productionProblems, serviceChecks } from "../apps/web/lib/launch-env";

loadEnv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true });

const env = process.env;
const WORDS = {
  live: "live",
  fake: "fake (dev only)",
  missing: "missing",
  optional: "not set (optional)",
} as const;

console.log(`AdmitStory launch check (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"})\n`);
for (const check of serviceChecks(env)) {
  const status =
    check.required && check.status !== "live" && isProductionDeploy(env) ? "missing" : check.status;
  const mark = status === "live" ? "✓" : status === "missing" ? "✗" : "·";
  console.log(`${mark} ${check.service.padEnd(32)} ${WORDS[status].padEnd(20)} ${check.detail}`);
}

const problems = productionProblems(env);
console.log("");
if (problems.length === 0) {
  console.log("Ready: production would start with this environment.");
} else {
  console.log(`Production would refuse to start. Missing (${problems.length}):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  if (isProductionDeploy(env)) process.exit(1);
  console.log("\n(Not a production deploy, so this is a preview of what production needs.)");
}
