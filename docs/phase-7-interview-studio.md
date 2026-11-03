# Phase 7: Interview Studio (deferred, build spec)

**Status: not built. Deferred by Manu on 2 November 2026 to ship faster.** At launch, Interview Studio
shows as **"Coming soon"** in the app and on the marketing site. The **expert mock interview** (a human,
spec §5.13) is _not_ part of this deferral: it ships in Phase 8.

This document is everything needed to build Phase 7 later without re-reading the whole spec. It
collects the requirements from `AdmitStory_Build_Spec.md` (§5.12, §6.7, §6.10 I/J/K, §7.5, §8.3,
§8.5.13–15, §10, §11, §12, Appendix A12, Appendix E). It lists what already exists in the repo, the
decisions already made, the data model, routes, AI tasks, UI, acceptance criteria, tests, work
packages, and the arguments to feed the build workflow.

---

## 1. Launch promise and what must change when this ships

- **The launch promise:** "Interview practice is coming soon. Kit owners get it at no extra cost when
  it opens." This is on the marketing site (pricing, FAQ, how it works, pinned sequence step 4) and on
  `/interview`. Building Phase 7 means honouring it: **every active kit unlocks interview practice
  for that school**, with no new purchase.
- **Places that show "Coming soon"** must be switched to the real feature. Grep for `COMING_SOON` and
  for "Coming soon" to find them all:
  - `/interview` (`apps/web/app/(app)/interview/page.tsx`)
  - the Workspace Files pane's Interview group
  - the kit preview and unlock "what unlocks" list
  - the kit generation screen's last stage label (screen F reads "… interview plan")
  - marketing: pricing ledger, FAQ, how-it-works step 8, the pinned sequence's last frame
  - the dock entry's label, if one was added
- **Pipeline stage 9** (`apps/web/lib/kit/pipeline.ts`) already reserves `later: [..., "interview_plan"]`.
  Generate the Interview Plan there, and backfill it on first open for kits built before Phase 7 (the
  Phase 5 form-advice pattern in `lib/forms/view.ts`).

## 2. What already exists

| Asset                                                                  | Where                                                                                                                                                                                                                               | State                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Routing for the four tasks                                             | `packages/ai/src/routing.ts`: `interview.plan` (Sonnet 5.5, medium, 6000), `interview.live_turn` (Sonnet 5.5, low, 220), `interview.drill_feedback` (Sonnet 5.5, low, 1500), `interview.report` (Opus 5.5, medium, 5000)            | Routed and priced. No prompts, schemas or replays yet |
| Canon A12                                                              | `knowledge/canon/interview.md` (rules INT-01 to INT-10)                                                                                                                                                                             | Done                                                  |
| Pack schema                                                            | `packages/kb/src/schema` `Interview`: invitation, who[], blind, length_min, location[], common_questions[{text, frequency_weight 1–5, cited}], format_notes; plus `VideoComponent` (think/answer time, attempts)                    | Done; packs carry it                                  |
| Interview questions as deliverables                                    | `apps/web/lib/strategy/deliverables.ts` adds the top 3 verified pack questions as `interview_question` deliverables; `lib/kit/view.ts` filters them out of the kit view; `lib/workspace/view.ts` maps them to the "interview" group | Rows exist, nothing drafted                           |
| Duet stage (live-mock hero)                                            | `packages/ui/src/interview/duet-stage.tsx` + `duet-logic.ts` (with tests); prototype at `/prototype/duet`                                                                                                                           | Phase 0.5 prototype, signed off pending               |
| Voiceprint (live + still, tiers)                                       | `packages/ui/src/voiceprint/*`                                                                                                                                                                                                      | Done                                                  |
| Dictation client (AudioWorklet → Deepgram, endpointing, NDJSON, hooks) | `packages/voice/src/client/*`                                                                                                                                                                                                       | Done (Phase 2). Reuse it for drills and timed video   |
| STT token route, TTS route and cache                                   | `app/api/stt/token`, `app/api/tts`, `packages/voice/src/tts/*` (Cartesia, ElevenLabs, fake)                                                                                                                                         | Done                                                  |
| Voice agent app                                                        | `apps/voice-agent`                                                                                                                                                                                                                  | Empty placeholder                                     |
| DB tables                                                              | none                                                                                                                                                                                                                                | To build                                              |

## 3. Decisions already made (2 November 2026)

1. **Live mocks run on LiveKit Cloud.** It has a free Build plan (1,000 agent minutes a month, 5
   concurrent sessions) and is deployed with `lk agent create`. The worker is Node (`@livekit/agents`)
   in `apps/voice-agent`. Vercel can't host it, because it is a long-running process.
2. **Pipeline:** Silero VAD plus the LiveKit turn detector, then Deepgram streaming STT, then Claude
   Sonnet 5.5 (streaming, low effort, ≤ 40-word turns), then TTS. TTS starts on the first complete
   sentence, and barge-in stops TTS within 200 ms.
3. **TTS is Deepgram Aura-2** by default (the same key as STT, $200 of free credit, ~100–200 ms to
   first audio). An `openai_compat` TTS adapter (base URL + model + voice) lets a self-hosted open-source
   model (Kokoro-82M through Kokoro-FastAPI) stand in. If the Aura adapter isn't added in Phase 9b, add
   it here: `packages/voice/src/tts/deepgram.ts`, `TTS_PROVIDER=deepgram`.
4. **A local fallback transport** runs when `LIVEKIT_*` keys are missing (dev, CI, outages). It is a
   half-duplex loop built from the existing dictation client, an SSE route that streams
   `interview.live_turn`, and `/api/tts`. The same UI and the same report are used, and the screen says
   "Practice mode: take turns". This keeps the feature testable without keys, and usable if LiveKit is
   down (a kill switch flips to it).
5. **Access:** an active kit for a school unlocks that school's Interview Plan, drills, live mocks and
   timed video. There is no new product key; reuse the `school_kit` entitlement and add
   `limits.mocks` / `used.mocks`.
6. **Limits** (§12.4): drills 20 an hour; live mocks 3 a day and **5 per kit**, 20–45 minutes each;
   timed video 30 a day. Live mocks count against the kit's AI cost guard, and the kill switch
   `live_mocks` disables them.
7. **Video:** camera optional. The recording stays in the browser (MediaRecorder blob); "Save" downloads
   it to the applicant's device. There is no R2 at launch, so nothing is uploaded. The transcript comes
   from STT on the audio track.
8. **No raw audio retention** (as in Studio). Transcripts are encrypted at rest (`transcript_encrypted`).
9. Live ACs (latency from India and the US, the 30-minute soak) wait for real keys. Build with fakes,
   replays and a latency harness, as Phases 2–5 did.

## 4. Product scope (from §5.12)

### 4.1 Interview Plan (per school, generated with the kit, `interview.plan`)

- **Format:** who interviews (admissions, student, alum), blind or file-read, length, on campus or
  virtual, invitation-only or open, any video assessment, typical invite timing. All from the pack,
  with sources.
- **Question map:** the school's likely questions (weighted by `frequency_weight`) plus the core
  questions from Appendix E. Each question gets **one distinct story, with no repeats** (INT-02) and 3
  talking points. Groups: Openers, Why, Behavioural, School-specific, Curveballs.
- **Your openers:** "tell me about yourself" in a 90-second and a 30-second version (INT-03), why MBA,
  why now, why this school (verified specifics only), goals and Plan B.
- **Curveballs:** weakness, failure, disagreement with a superior, other schools, gaps. Each comes
  with the honest framing for this applicant.
- **Glossary:** school terms they might use, each with one plain sentence and a source (INT-05).
- **Numbers:** numbers to say confidently (from the Fact Sheet) vs numbers to avoid (INT-06).
- **Questions to ask,** by interviewer type (INT-07).
- **Day-of checklist:** the time-zone conversion, a tech check, what to re-read, and a thank-you note
  within 24 hours, drafted from the session notes (INT-08).

### 4.2 Practice modes

| Mode        | What it is                                                                                                                                                                                                                    | Feedback                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Drill       | One question, answered by voice (or text). Feedback arrives in ~5–8 s, then retry                                                                                                                                             | Rubric scores with quotes, 3 fixes, "a stronger version in your words" (built from their own spoken sentences, 60–90 s read aloud) |
| Live mock   | A real-time voice interviewer. Persona: admissions officer, second-year student or alum. Style: warm, neutral or probing. Blind or file-read. 20–45 min, natural follow-ups, interruptions handled, "Need a moment" pauses it | Full report after the session (≤ 60 s)                                                                                             |
| Timed video | Think time plus an answer window in the school's format (`VideoComponent`), a random question from the bank, camera optional                                                                                                  | The same rubric, plus timing                                                                                                       |
| Expert mock | Book a human. **Built in Phase 8**; its debrief should appear in this studio once it exists                                                                                                                                   | The expert's written debrief                                                                                                       |

### 4.3 Rubric (Appendix E; put the anchors in `packages/ai/src/rubrics/interview.ts`)

Each criterion is scored 1–5 with transcript quotes as evidence:

| Criterion                  | 1                                        | 3                                        | 5                                                                          |
| -------------------------- | ---------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Answered the question      | Talked around it                         | Answered, partly                         | Directly answered every part                                               |
| Structure                  | Rambling, no result                      | Clear but context-heavy or no reflection | Brief context, clear action, result, reflection                            |
| Specificity                | Abstractions only                        | Some detail                              | People, words, numbers, decisions; easy to picture                         |
| Ownership                  | "We" throughout                          | Mixed                                    | Their own actions unmistakable, credit shared fairly                       |
| Self-awareness             | Defensive or generic lesson              | Real lesson, thin                        | Specific blind spot and changed behaviour, with evidence                   |
| School fit (when relevant) | Generic or wrong                         | Some specifics                           | Accurate, verified, tied to their plan and contribution                    |
| Consistency with file      | Contradicts essays or facts              | Minor drift                              | Fully consistent (reuse the Phase 5 consistency checker on the transcript) |
| Delivery                   | Very fast or slow, many fillers, > 3 min | Some issues                              | 130–170 wpm, few fillers, 60–120 s, natural pauses                         |

**Delivery metrics are computed in code, never by the model:** `packages/voice/src/delivery.ts`, from
STT word timestamps:

- words per minute, excluding pauses over 2 s;
- filler rate per 100 words: um, uh, "like" as a filler, "you know", "sort of", "kind of",
  "basically", "actually", and a repeated sentence-initial "so". Lists are language-aware for
  non-English sessions;
- the longest pause, and the count of pauses over 3 s;
- answer duration;
- self-corrections ("I mean", restarts).

These are pure and deterministic, and must be unit-tested (an AC).

### 4.4 Progress

Each question's attempts over time, rubric trends, and a "ready" indicator per question (for example,
the last two attempts score ≥ 4 on answered, structure and specificity, with delivery in range).

### 4.5 Canon (A12) that prompts and checks must enforce

INT-01 three buckets · INT-02 one distinct story per question · INT-03 90 s and 30 s arc · INT-04
behavioural answers in 60–120 s, context, action, result, reflection · INT-05 explain every school term
plainly · INT-06 exact numbers from the Fact Sheet · INT-07 questions to ask that the website can't
answer · INT-08 thank-you within 24 h · INT-09 practise under real video timing · INT-10 core stories
ready.

## 5. Voice architecture (from §7.5)

- **Live:** one LiveKit room per mock. The `POST /api/interview/mocks` route creates the
  `mock_sessions` row and mints a short-lived LiveKit participant token, with room metadata carrying
  the session id. The agent worker joins and loads the cached prefix through a signed server-to-server
  call, e.g. `GET /api/internal/mocks/:id/context` with an HMAC. The prefix is the persona prompt, the
  Interview Plan and the compact dossier; the running transcript is the conversation.
- **Latency budget,** from the end of user speech to the first interviewer audio: turn detection
  300–500 ms + LLM first sentence 400–700 ms + TTS first audio 100–200 ms. Targets: **≤ 1.2 s p50,
  ≤ 2.0 s p95.** Log every turn's timings to the ledger (`latency_ms`) and to `mock_sessions.metrics`.
- **Barge-in:** if the user speaks, TTS stops within 200 ms. "Need a moment" pauses the agent with a
  data message.
- **The agent enforces the time limit** and closes naturally: "We're at time. Do you have any questions
  for me?" It then answers their questions briefly, in character, using only pack facts.
- **At the end,** the agent posts the transcript to `POST /api/interview/mocks/:id/complete` (HMAC),
  with word timestamps for both sides. The server encrypts and stores it, computes the delivery metrics
  in code, and fires the Inngest event `interview/report.requested`. The report is ready ≤ 60 s later.
- **Cost per 30-minute mock** (§12.2): about $1.15–1.30, i.e. STT $0.15 + TTS + Sonnet turns + LiveKit
  agent minutes + an Opus report. Record each in `usage_ledger` (`stt_seconds`, `tts_chars`,
  `livekit_minutes`).

## 6. Data model (migration after Phase 8's; §10)

- `interview_plans`: id, user_id, user_school_id (unique per version), content jsonb (`InterviewPlan`),
  version, dossier_snapshot_version, created_at, updated_at.
- `mock_sessions`: id, user_id, user_school_id, mode (`drill`|`live`|`video`|`expert`), persona, style,
  blind bool, length_min, question_id?, transport (`livekit`|`local`), started_at, ended_at,
  livekit_room?, transcript_encrypted, key_id, metrics jsonb (delivery + latency), audio_key (always
  null at launch), status (`active`|`completed`|`abandoned`|`failed`).
- `mock_evaluations`: id, session_id (unique), scores jsonb (criterion → {score, quotes[]}), findings
  jsonb (helped most and least, contradictions with the file, recommended drills), improved_answers
  jsonb, overall_note, model, cost_usd.
- Optional: `interview_question_progress` (user_school_id, question_key, attempts, last_scores, ready)
  as a materialised read model, or compute it on read from `mock_sessions` + `mock_evaluations`.

All tables are owner-scoped through repos in `packages/db/src/repos/interview.ts`, following the
Phase 5 pattern.

## 7. Routes (§11)

| Route                                                       | Does                                                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/interview/plans/:userSchoolId`                    | The plan (generated on first open if missing; free, since it is part of the kit)                                                                                           |
| `POST /api/interview/plans/:userSchoolId/refresh`           | Regenerate from the current dossier (costs one refinement, as forms do)                                                                                                    |
| `POST /api/interview/drills`                                | {userSchoolId, questionKey, transcript + word timestamps \| text} → computes delivery, runs `interview.drill_feedback`, stores the session and evaluation. Rate limit 20/h |
| `POST /api/interview/mocks`                                 | {userSchoolId, persona, style, blind, lengthMin, transport?} → session row + LiveKit token (or local-transport session). Limits: 3/day, 5/kit                              |
| `POST /api/interview/mocks/:id/turn` (local transport only) | SSE stream of the interviewer's next turn                                                                                                                                  |
| `POST /api/interview/mocks/:id/complete`                    | From the agent (HMAC) or the client (local) → store the transcript, metrics, Inngest report                                                                                |
| `GET /api/interview/mocks/:id/report`                       | The evaluation, or `{status: "pending"}`                                                                                                                                   |
| `POST /api/interview/video`                                 | A timed-video attempt (transcript only; the video never leaves the device)                                                                                                 |
| `GET /api/internal/mocks/:id/context`                       | For the agent only (HMAC, short-lived), the cached prefix                                                                                                                  |

All routes check Zod, ownership and entitlement, and accept an `Idempotency-Key`.

## 8. AI tasks (prompts in `packages/ai/src/prompts/<task>/v1.md`, schemas, `check()` + one repair, synthetic replays via `record:phase7 --synthetic`)

- **`interview.plan`** → the `InterviewPlan` schema (format with cites, questionMap[{key, group,
  question, weight, storyId, talkingPoints[3]}], openers, curveballs, glossary[{term, definition,
  source}], numbersSay[], numbersAvoid[], questionsToAsk{byInterviewer}, dayOf). `check()`:
  - every storyId exists, with no story repeated across questions (INT-02);
  - every number is a Fact Sheet fact;
  - every school term in the glossary has a pack source;
  - every format field has a cite.
- **`interview.live_turn`**: the §8.5.13 persona prompt. Output is plain text, ≤ 40 words, one
  question. It doesn't coach, evaluate or praise. Streams.
- **`interview.drill_feedback`**: inputs are the question, the timestamped transcript, the computed
  delivery metrics, the assigned story and the dossier. Output: rubric scores with quotes (each quote
  must be verbatim from the transcript, checked), 3 fixes, a stronger version built **only from their
  own sentences** (check: ≥ 80% of its tokens come from the transcript or dossier; no new numbers), and
  consistency flags.
- **`interview.report`**: the full-session version, plus an overall impression written like
  interviewer notes, the 3 moments that helped most and the 3 that helped least (with timestamps), and
  recommended drills.

## 9. UI (one hero moment per screen, §6.7; structure §6.10)

- **I. Interview Studio** (`/interview`, plus `/interview/[userSchoolId]`):
  - School picker on top, with "Start a full mock" and persona, style and length selectors.
  - Left: the question map grouped as Openers, Why, Behavioural, School-specific, Curveballs. Each
    question shows its assigned story and readiness. Right: the selected question's talking points,
    "Practise this" (a drill) and attempt history.
  - **Hero:** the question map as a cluster of questions, each glowing by readiness, with an
    accessible list equivalent.
  - The plan's sections (format, openers, glossary, numbers, questions to ask, day-of) are plain
    typographic tabs.
- **Drill:** phone-first. The question is in Newsreader, with a record button (Space), the live
  transcript, then feedback streaming in place (no spinner): scores with quotes, 3 fixes, "a stronger
  version in your words" with their own phrases lit in their hue, and Retry.
- **J. Live mock:** the duet stage from `packages/ui/src/interview`. Two Voiceprints face each other
  in a dim room. Captions are in Newsreader: the interviewer's in silver, the applicant's in their
  hue. On screen there is only the header (school, persona, mode, length, timer, End) and the
  controls: Mute, Captions on, Pause, Need a moment. It is phone-first, with a reduced-motion still
  version and tier 1 SVG.
- **K. Interview report:** the overall note; rubric bars with quotes; per-question cards (the question,
  the answer transcript with strong and weak lines highlighted, delivery stats, a stronger version in
  their words); contradictions with the file; next drills. **Hero:** a scrubbable timeline of the
  whole mock (waveform from the stored amplitude envelope, not audio; rubric markers; strong and weak
  moments). Clicking any moment jumps into the transcript.
- **Timed video:** think-time countdown, then the answer window. The local camera preview is
  optional and mirrored. A "Save to my device" download, and the same rubric plus timing.
- **States:** mic denied, offline, LiveKit unavailable (offer practice mode), over limit, kit refunded
  (403), plan generating (shape-holding).
- **Budgets:** every route ≤ 160 KB first-load JS; LiveKit client, duet and video go behind
  `next/dynamic` hosts; the LiveKit JS SDK loads only on the mock screen.

## 10. Acceptance criteria and tests

| AC (§5.12, §16)                                                                                                                  | Test                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live mock: end of user speech → first interviewer audio ≤ 1.2 s p50 (≤ 2.0 s p95), on a 50 Mbps connection from India and the US | **Live AC (needs keys).** Build a latency harness in `apps/voice-agent` that logs per-turn timings; run 20 turns from each region once keys exist. Unit-test the timing instrumentation with fakes |
| Report generated ≤ 60 s after the session                                                                                        | Integration: complete a fake session → the Inngest function in replay mode → the report row exists; time the function with the replay model                                                        |
| Delivery metrics computed deterministically and unit-tested                                                                      | `packages/voice/src/delivery.test.ts`: wpm excluding pauses > 2 s, every filler rule (including "like" as filler vs verb, sentence-initial "so"), pauses, self-corrections, a non-English list     |
| One distinct story per question                                                                                                  | `interview.plan` `check()` test with a repeated story → repaired                                                                                                                                   |
| Stronger version only from their words, no new numbers                                                                           | `drill_feedback` `check()` tests                                                                                                                                                                   |
| Ownership and entitlement                                                                                                        | Integration: another applicant gets 404/403 on every route; a refund closes access                                                                                                                 |
| Agent HMAC routes reject unsigned or replayed calls                                                                              | Unit tests                                                                                                                                                                                         |
| 30-minute voice session without loss (carried from Phase 2)                                                                      | Live AC on devices                                                                                                                                                                                 |

## 11. Work packages (for the parallel build)

1. **Foundation:** migration and tables, repos, shared types (`packages/shared/src/interview.ts`,
   Zod-free), rubric anchors, the four AI tasks with prompts, schemas, checks and synthetic replays,
   `delivery.ts`, the Deepgram Aura and `openai_compat` TTS adapters if still missing, env and
   `.env.example`, routing and pricing coverage, the Inngest event names, and stub pages.
2. **Server:** `lib/interview/*` (plan view and backfill, drill, mock create and complete, report
   job, limits and entitlement, LiveKit token minting), all routes, pipeline stage 9, and
   consistency-checker reuse.
3. **Voice agent:** `apps/voice-agent` (LiveKit Agents Node, Deepgram STT and TTS plugins, Anthropic
   LLM, VAD and turn detector, persona prompt, barge-in, time limit, "Need a moment", transcript post,
   latency logging), a Dockerfile or `livekit.toml`, and README deploy steps (`lk cloud auth`,
   `lk agent create`, secrets).
4. **UI, Studio and drill:** screen I, the drill flow, progress, and the plan tabs (`packages/ui/src/interview/*` + `apps/web/app/(app)/interview/**`).
5. **UI, live mock, report and video:** screen J on the duet stage (LiveKit and local transports),
   screen K with the timeline, and timed video.
6. **Remove "Coming soon"** everywhere (§1), and update marketing copy and `docs/LAUNCH.md`.

## 12. How to build it later

1. Read `HANDOFF.md`, then this file.
2. In Claude Code, run the workflow script in `docs/plans/build-phase.workflow.md` with these `args`:

```json
{
  "phase": "7",
  "title": "Interview Studio",
  "date": "<today>",
  "sections": "docs/phase-7-interview-studio.md (primary), §5.12, §6.7 (Interview Studio, Live mock, Interview report rows), §6.10 I/J/K, §7.5 live conversation, §8.3 routing, §8.5.13–15, §10 Interview tables, §11 Interview routes, §12.2/§12.4, Appendix A12, Appendix E, §16 Phase 7",
  "brief": "Build everything in docs/phase-7-interview-studio.md §4–§11, and remove every 'Coming soon' label listed in §1.",
  "decisions": "See docs/phase-7-interview-studio.md §3 (all nine decisions are requirements)."
}
```

3. Keys needed for the live ACs: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
   `DEEPGRAM_API_KEY` and `ANTHROPIC_API_KEY`, plus the TTS key if it isn't Deepgram.
