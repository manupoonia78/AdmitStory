// The prototypes (spec §16 Phase 0.5) run on fake data and are for review only: on in
// development, and in a production build only with PROTOTYPES_ENABLED=1 (e2e tests, review
// deploys). Read at request time, so one build serves both.

export function prototypesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.PROTOTYPES_ENABLED === "1";
}
