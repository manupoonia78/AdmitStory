// Automated Studio runs over the synthetic applicants (spec §16 Phase 1, §8.11).
//
//   pnpm --filter @admitstory/ai simulate            50 scripted sessions, no API key needed
//   pnpm --filter @admitstory/ai simulate -- 200     more sessions
//
// Scripted mode is deterministic and free: it drives the real slot selector and the real slot-state
// rule, and reports any slot asked about after it was already filled.

import { loadApplicants, simulateSuite } from "../src/fixtures";

const sessions = Number(process.argv[2] ?? 50);
const fixtures = loadApplicants();

if (fixtures.length === 0) {
  console.error("No fixtures in fixtures/applicants. Nothing to simulate.");
  process.exit(1);
}

const suite = simulateSuite(fixtures, sessions);

console.log(`${suite.sessions.length} scripted sessions over ${fixtures.length} applicants\n`);
console.log(`median turns:            ${suite.medianTurns}`);
console.log(`repeated known questions: ${suite.totalRepeats}`);

const coverage = suite.sessions.map((session) => session.filledSlots.length);
console.log(`slots filled per session: min ${Math.min(...coverage)}, max ${Math.max(...coverage)}`);
const stopped = suite.sessions.filter((s) => s.stoppedBecause === "nothing_left").length;
console.log(`ran out of questions:     ${stopped} of ${suite.sessions.length}`);

if (suite.totalRepeats > 0) {
  console.error("\nRepeated questions (spec §16 requires zero):");
  for (const session of suite.sessions)
    for (const repeat of session.repeats)
      console.error(
        `  ${session.slug}: asked ${repeat.slot} at turn ${repeat.askedAtTurn}, filled at ${repeat.filledAtTurn}`,
      );
  process.exit(1);
}

console.log("\nNo question was asked twice.");
