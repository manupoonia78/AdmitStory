// Vercel's build command (Phase 9b decision 23; apps/web/vercel.json). Production and preview
// builds migrate the database first; migrations are additive, so the running deployment keeps
// working against the new schema until the new one takes over. Previews point DATABASE_URL at a
// Neon `preview` branch. Then the web app builds through turbo, so workspace packages build first.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const deployEnv = process.env.VERCEL_ENV;
if ((deployEnv === "production" || deployEnv === "preview") && process.env.DATABASE_URL) {
  run("pnpm", ["db:migrate"]);
} else {
  console.log(
    `Skipping migrations (VERCEL_ENV=${deployEnv ?? "unset"}, DATABASE_URL ${process.env.DATABASE_URL ? "set" : "unset"}).`,
  );
}
run("pnpm", ["turbo", "run", "build", "--filter=@admitstory/web"]);
