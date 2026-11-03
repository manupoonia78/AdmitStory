# @admitstory/kb

School Packs and retrieval (spec §9, §8.9, §14.6). Pure TypeScript with no database. `packages/db`
implements the `ChunkStore` contract, and the admin console and kit pipeline call this package.

| Import                  | What                                                                                      | Where it runs     |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| `@admitstory/kb/types`  | Plain pack types, enums as plain arrays, and the retrieval contract. No Zod.              | Client and server |
| `@admitstory/kb/schema` | The §9.2 Zod schema and integrity checks (`SchoolPack`, `parseSchoolPack`)                | Server only       |
| `@admitstory/kb`        | Everything above, plus the compiler, freshness, proposals, the publish gate and retrieval | Server only       |
| `@admitstory/kb/ingest` | `extractText` (PDF, DOCX, text, HTML, audio hook), `fetchUrl` (SSRF-guarded), `chunkText` | Server only       |

## Decisions

- **Additions to §9.2.** These are `sources` (the pack's source registry), K ids with `source_ids`
  and `verified_at` on every structured record (rounds, prompts, the employment report and so on),
  `class_profile`, `official_urls`, `status` (`draft` | `complete`), `_todo`, `synthetic` and
  `k_high_water`. The header of `src/types.ts` gives the reason for each.
- **Unverified items.** A draft can hold `verified_at: null`. The compiler never emits one, and
  `publishBlockers` refuses to publish while any remain.
- **Freshness.** An item is stale when it was verified before its cycle opened. Cycle `YYYY-YY`
  opens on 1 May of its first year (an assumption you can override). Stale courses, centres,
  clubs and events are left out of the compiled pack. Other stale items stay in, marked `stale`,
  and are never citable as specifics.
- **Third-party sources (§9.6).** An item whose only sources are `third_party_reference` is
  compiled only with `approved_rewrite: true`, and the third-party source is never named. Such an
  item is background for the model, never a citable specific (`isCitableSpecific`), because it has
  no source a user can be shown. Retrieval sends every other source type to the store unless the
  caller names `sourceTypes`, and a third-party chunk is never `citable`.
- **Conflicts.** A value backed by exactly one official source wins by default. A field where
  official sources disagree, or where no official source backs a value, blocks until an admin
  chooses. An accepted proposal can't overwrite a more trusted value without `override`.
- **Retrieval codes.** Pack items use `K01`–`K899999`. Retrieval results use `K900001`–`K999999`
  and are numbered for each result (pass `codeStart` to continue numbering across searches).
  `parseCode` in `@admitstory/shared` reads both kinds as `pack`.
- **RRF constant.** k = 60, the value from the original paper. §8.9 doesn't fix it.
- **Deferred.** OCR (a scanned PDF comes back with `needsOcr: true`) and audio transcription (pass
  a `Transcriber`).

## Data

- `knowledge/schools/darden/2026-27/pack.draft.json` holds the Appendix G draft. Nothing in it is
  verified, and `_todo` lists every field still to fill.
- `fixtures/schools/<slug>/pack.json` holds six fictional, complete packs for the eval harness.
