# Phase 4: Payments, the kit pipeline and the Workspace

Built 31 October – 1 November 2026 on branch `phase-0`, together with Phase 3 (see
`docs/phase-3.md`). Spec: `AdmitStory_Build_Spec.md`, §16 Phase 4, with §5.6–5.9, §6.7, §6.9,
§6.10 (screens F and G), §7.4, §8.3, §8.5.5–8.5.11, §8.6–8.8, §8.10, §10, §11, §12.2, §12.4, §13,
§14.2 and Appendices I and J.

Decisions you made for this phase (31 October):

- There's no Paddle sandbox account yet, so payments run on a local fake. It signs its webhooks
  the way Paddle does and refuses to run off localhost.
- Paddle is the first provider behind `PaymentsProvider`. Your company's country and legal entity
  decide the final choice.

My defaults, which you didn't object to:

- a flat $100 per school;
- coach mode by default for schools whose AI policy is `limited`;
- pipeline stage 9 is a hook for Phases 5–7;
- kit progress streams by reading the database, since there is no Redis.

## What was built

### `packages/payments`

- The `PaymentsProvider` contract: create a checkout, verify a webhook over its raw body, parse the
  event, refund.
- A Paddle Billing adapter, using plain fetch.
- The localhost fake, with `buildSignedFakeWebhook()`.
- `REFUND_REASONS`.
- `@admitstory/payments/client` opens Paddle.js lazily. With the fake, it tells the page to draw
  its own test checkout.

### `packages/linters`

- Every §8.8 linter.
- The portal counting rules, which handle emoji, curly quotes, dashes and CJK.
- The AI-tell index.
- The §8.7 provenance checks: unsupported claims, facts that don't match, school details nobody
  verified, people who may not be named, and voice fidelity.

These are pure functions. The pipeline and the Workspace run them.

### `packages/db`: migration 0005

- New tables: checkouts, purchases, entitlements, webhook_events, kit_stages, deliverables, angles,
  drafts, checks, need_items, verify_items, revision_requests and feedback. `kits` gains its
  lifecycle columns.
- **`applyPurchaseCompleted`** does all of this in one transaction:
  - checks the event against the checkout row the server wrote;
  - grants the entitlement and unlocks the school;
  - upgrades the preview to a full kit, keeping the preview's positioning when the dossier is
    unchanged.

  It is idempotent on both the event id and the transaction id.

- **`applyRefund`** revokes the entitlement. The dossier and drafts are kept, but access follows
  the entitlement.
- **`consumeEntitlement`** checks fair-use limits atomically: 150 revisions, 5 voice mocks,
  150 drills, 1 regeneration.
- **`markDraftsStale`** flags drafts after a fact or story edit.
- Draft versions are append-only. There's exactly one current version per deliverable, and you
  can restore or compare any of them.

### `packages/ai`

- **Tasks**:
  - `kit.gaps`: at most 8 blocking questions.
  - `kit.angles`: every long essay in one call.
  - `kit.draft`: a draft mode, and a coach mode that returns beats, your own lines and questions.
  - `kit.shortform`: goal fields, short answers, list prompts and video talking points.
  - `kit.critic`: rates the draft and never rewrites it.
  - `draft.revise`: patches; code rejects any that touch a locked or hand-edited paragraph.
  - `draft.need_fill`: redrafts one paragraph after a NEED answer.
  - `util.classify`: picks which paragraphs an instruction is about.

  Each task has a v1 prompt, a schema, a route and synthetic replay recordings.

- **Escalation (§8.3)**: one Critic failure redrafts on the normal route, and a second escalates
  once.
- **Budget (§12.4)**: paying users are exempt from the $5 free cap and governed by the per-kit
  caps.
- **Golden set**: `fixtures/applicants/*/expected.json` for all 12 applicants, and
  `src/fixtures/golden.ts`, a deterministic invented-fact checker.
- `estimateKitCost()` turns ledger rows into a cost and a range check.

### `packages/ui`

- **Screen F**: `KitAssembly`, the stage list and the gap-questions plane, driven by real data.
- **Screen G**:
  - `WorkspaceLayout`, `FilesPane` and `CoachSheet`, with its tabs: Why this draft, Options,
    Refine, Checks and Verify;
  - `OptionSplit`, the side-by-side compare with a draggable divider;
  - `VersionScrubber`, `RevisionReview`, `NeedComposer`, `AuthorshipBanner` and `ExportMenu`.
- `DocCanvas` (TipTap) and its draft-to-document model are on a separate `@admitstory/ui/editor`
  entry, so TipTap only ever loads through `next/dynamic`.

### `apps/web`

- **Checkout and webhook**:
  - `POST /api/checkout/session` takes an Idempotency-Key. It refuses a school that isn't yours, a
    "Pack coming soon" school, and one you've already unlocked.
  - `POST /api/webhooks/paddle` verifies the signature over the raw body. It is idempotent and
    checks every payment against the stored checkout. A mismatch, or a second purchase of a school
    you already own, is set aside as an audited admin alert. Any processing error returns 500 so
    Paddle retries.
  - `POST /api/dev/fake-checkout` is the local test checkout's "Pay $100 (test)". It works only on
    localhost with the fake provider.
- **`/schools/[id]/unlock`**: "Pay $100 and unlock {School}". The provider's checkout opens over
  the page. Afterwards the page shows "Payment confirmed, starting your kit" and moves to the kit
  as soon as the webhook has created it.
- **The kit pipeline** (`lib/kit/pipeline.ts`, Inngest `kit/generate`) runs §5.7's stages in order,
  one Inngest step per stage. Each stage's output is saved to `kit_stages` before the next starts,
  so a retry resumes and never pays twice for a finished stage.

  | Stage                         | What it does                                                                                            |
  | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
  | 1. context                    | Reads the pack. Creates the deliverables with their authorship mode from the verified AI policy.        |
  | 2–3. positioning and file map | Reused from the preview when the dossier is unchanged.                                                  |
  | 4. gaps                       | Waits up to `KIT_GAP_WAIT` (default 10 minutes) for blocking answers, or until "Skip, draft with gaps". |
  | 5. angles                     | Angles for every long essay.                                                                            |
  | 6. drafts                     | Every essay drafts in parallel. One failing doesn't stop the others.                                    |
  | 7. short form                 | Short answers, goal fields and video talking points.                                                    |
  | 8. checks                     | Linters, provenance, the Critic, up to two limit trims, and the one escalation.                         |
  | 9. forms                      | Skipped: a hook for Phases 5–7.                                                                         |
  | 10. verify                    | One Verify list for the whole kit.                                                                      |

  On a final failure the kit is marked failed. If only some essays failed, the kit is ready and
  names them, and `POST /api/kits/:id/regenerate` with `only` retries just those.
  `kit/draft-option` drafts Options B and C on demand. `checks/rerun` runs after fact and story
  edits.

- **Screen F (`/kits/[id]`)**: the assembly hero, which updates from `GET /api/kits/:id/events`
  (SSE that reads the database). It has "Read it now" on finished stages, the gap plane (type your
  answers or skip), and "Payment confirmed, starting your kit" before the first stage.
- **Screen G (`/workspace/[deliverableId]`)**:
  - The Files pane (J and K to move between deliverables).
  - The prompt verbatim, a live count by the school's rule, and the authorship banner.
  - The canvas: the your-words view (Y), NEED chips that open the composer, and paragraph locks (L).
  - The stale-draft banner, version history with restore, the export menu (copy for portal, DOCX,
    PDF) and "Mark final".
  - The Coach, with all five tabs.
  - Coach-mode deliverables show beats with your own lines and questions instead of prose, and the
    video shows talking points.
  - Edits save as your own version 1.5 s after you stop typing.
- **Workspace API**: every §11 route for deliverables, drafts, needs, verify and checks. All of them
  check ownership and the kit's entitlement, so a refund closes the kit.
  - **Refine**: 10 a minute, uses one of the 150 refinements, and gives it back if nothing changed.
    It runs the limit loop at most twice and re-runs only the affected linters.
  - **Save**: marks the edited paragraphs as yours.
  - **NEED answers**: saved to the dossier as a source and one of your own lines, then only that
    paragraph is redrafted.
  - **Exports**: generated on demand and stored nowhere.
- **Admin Orders (`/admin/orders`)**: find purchases by email and refund with a reason code. The
  refund is audited, and the entitlement is revoked when the provider confirms it.

## How to run it

```sh
pnpm db:migrate
pnpm --filter @admitstory/web seed:fixtures   # FICTIONAL schools with published packs (localhost only)
pnpm dev
```

Then follow the flow:

1. Add Kestrel Lake on `/schools` and open its preview.
2. Press "Unlock Kestrel Lake for $100", then "Pay $100 (test)".
3. Watch `/kits/[id]` build, then open the workspace.

Without an Anthropic key the model calls use replay recordings, so a kit for your own dossier needs
`AI_MODE=live` and a key. The integration test below runs the whole pipeline with a fake model.

## Tests

- **Unit**: everything passes in `pnpm test` (2,041 across the repo). The Phase 4 tests are:
  - `packages/ai/test/phase4-tasks.test.ts`:
    - every writing task runs in replay mode through `ai.run()`;
    - coach and draft modes return exactly one output;
    - the patch guards hold;
    - escalation happens only after the second failure, and only once;
    - cost comes from ledger rows.
  - `packages/ai/test/golden.test.ts` checks every recorded `kit.draft` and `kit.shortform` reply
    against its fixture applicant's ground truth and the school pack, and finds **zero invented
    facts**. A deliberately poisoned draft is caught (number, name, quote and date). All 12
    `expected.json` files are valid. `pnpm --filter @admitstory/ai kit:golden` runs the same check
    as a script, and will re-check live recordings.
  - `packages/ai/test/budget.test.ts`: a paying user is exempt from the free cap.
  - The linters (counting rules, every linter, provenance) and payments (signature verification,
    Paddle mapping, the fake) package tests, and the UI component tests (DocCanvas round-trip
    keeping provenance and locks, OptionSplit keyboard, revision accept and reject).
  - `apps/web/lib/home/next-step.test.ts`: the order of Home's next step.
- **Integration** (`pnpm test:integration`, 86 tests against Neon, all passing).
  `apps/web/lib/phase4-ac.int.test.ts` uses a FICTIONAL school, the fake payments provider, and a
  fake model that parses every input and output with the task's own Zod schemas and prices each
  call into the ledger. It checks:
  - **a replayed webhook** grants one entitlement and starts one kit, and a bad signature gets 401;
  - **a whole kit**: every stage is persisted, in order, each finishing before the next starts.
    Drafts carry provenance on every sentence and pass the invented-fact check. Checks and a Verify
    list exist, and the cost is read from the kit's ledger rows;
  - **a crash in stage 5**: the kit is marked failed, and the rerun skips stages 1–4 and finishes;
  - **ownership**: all 24 user-scoped Phase 3 and 4 routes answer 404 to another applicant;
  - **"Pack coming soon"**: such a school can't be bought or previewed.

  `packages/db/test/kits.int.test.ts` covers webhook replays (one after another and concurrent),
  mismatches, refunds, atomic limits, ownership on every repository, stale flags, and versions with
  restore.

## Performance

First-load JS, gzipped:

| Route                        | Size     |
| ---------------------------- | -------- |
| `/kits/[id]`                 | 153.9 KB |
| `/workspace/[deliverableId]` | 154.0 KB |
| `/schools/[id]/unlock`       | 158.0 KB |

Every route is within the 160 KB budget:

- The Motion-heavy assembly and the Workspace panes load behind `next/dynamic` hosts.
- TipTap loads only when the canvas mounts. Until then the draft shows as text in the same place.
- The test-checkout dialog and the admin confirm dialog load only when opened.

## What the review caught

One review pass, over payments, the pipeline and the Workspace, found three problems, now fixed:

- A deployed app without Paddle keys would have answered checkout with a generic 500. It now says
  checkout isn't available (503), and it never grants a kit.
- A refinement used a credit before the model call. A failed or rejected revision now gives it back.
- The checks stage re-ran the Critic on the same draft after a first failure. It now redrafts on the
  normal route, as §8.3 says, before escalating.

Earlier lint fixes also removed several effects that set state synchronously, and two components
that were created during render.

## Deviations from the spec, and why

- **Payments are fake** until the Paddle sandbox exists. The fake goes through the same signature
  check, the same mapping and the same handler as Paddle.
- **No referral credits.** Paddle's discount codes work in the overlay at launch.
- **A partial refund** is recorded but doesn't revoke access. A full refund or a chargeback does.
- **The gap wait** happens only under Inngest. Without it (local development) the pipeline drafts
  straight away, and the gap questions wait as NEED chips.
- **Exports** carry your name and "Written from your own words" as the header mark. Drawing the
  Voiceprint into DOCX and PDF is left for later.
- **`angles.stories`** stores story codes (S##), not the uuid[] in §10.
- **Several large client screens load as their own chunks**, so first-load JS stays under budget.
  Their code still downloads right after the HTML. The real saving is still the shell (memory
  note: about 152 KB of the 160 KB).

## Not done, or needs you

- **Live acceptance criteria**, once the keys exist:
  - **Kit p95 under 5 minutes.** This needs real model latency.
  - **Cost per kit within §12.2's range.** The fake model's run cost $0.27 in the ledger, below
    the $0.90–2.70 range, because its drafts are two paragraphs long. The ledger plumbing is
    tested; the cost isn't.
  - **Zero invented facts on live runs.** Re-record with `record:phase4` (`AI_MODE=live`), then run
    `kit:golden`.
- **Paddle sandbox**: an API key, client token, webhook secret and a $100 price
  (`PADDLE_PRICE_SCHOOL_KIT`).
- **Voice answers** for gap questions and NEED chips: the routes accept `via: "voice"`, but the
  hold-to-talk slot isn't wired on these screens yet.
- **Admin alerts** are audit-log rows. Email or Slack delivery isn't built.

## Left for later phases

- Stage 9 (forms, résumé, recommenders, interview plan) is Phases 5–7. The file map already assigns
  stories to recommender and interview questions.
- `lorOverlap` is built and tested but does nothing until Phase 6 creates recommender briefs.
