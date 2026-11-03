# Recommender overlap fixtures

Inputs for the deterministic overlap check (`packages/linters/src/lor/overlap.ts`, Phase 6 plan
§1.17). Each file is a `LorOverlapInput` (`points`, `essays`) plus `expected`, the findings the
check must produce, written in a short human form (`"<recommenderId> <questionId>#<index>"` for a
talking point, `"<deliverableId>/<paragraphId>"` for an essay paragraph).

Everything here is invented, like the rest of `fixtures/` (§0): the applicant, the recommenders
Ravi Menon and Kavita Rao, the schools, the wards and every number.

Tests come after launch (Manu, 2 November 2026): no test file reads these yet.
