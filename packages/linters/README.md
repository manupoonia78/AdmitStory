# @admitstory/linters

Deterministic draft checks, provenance and the AI-tell index (spec §8.7, §8.8, §5.8). Pure
functions with no dependencies, so the Workspace can run them in the browser and the kit pipeline
on the server.

- `count.ts`: portal counting (words, characters with and without spaces, grapheme-aware) and
  `normalizeForPortal` for "Copy for portal". The counting rules are documented at the top of the file.
- `linters/style.ts`, `linters/file.ts`, `linters/truth.ts`: every §8.8 linter, plus TELL-02
  `constructions` and TELL-03 `formatting`. Word lists live in `phrases.ts` (canon A13, A5).
- `provenance.ts`: unsupported claims (regex; undecidable cases come back as `ambiguous` for a
  classifier the app runs through `ai.run()`), own-words sources, people, voice fidelity.
- `ai-tell.ts`: "Sounds like you / Mixed / Sounds generated" with reasons. Guidance, never a
  detector prediction.
- `run.ts`: `runLinters`, `runAffectedLinters` (§8.6) and the Checks-tab grouping.

Findings use the Critic's Appendix I shape: `{ rule_id, severity, location, explanation, fix_hint, patch? }`.

Tests: `pnpm vitest run --project unit packages/linters`.
