# Phase 2: Voice in Studio

Built 31 October 2026 on branch `phase-0`. Spec: `AdmitStory_Build_Spec.md`, §16 Phase 2, with
§5.1 (voice settings), §5.2 (input modes and states), §6.2 (Voiceprint), §7.5 (dictation),
§12.4 (voice guardrails) and §14.4.

Decisions you made for this phase:

- There are no Deepgram, Cartesia or ElevenLabs keys yet, so everything runs against fakes.
- Raw-audio retention is skipped.
- The 2.0 s read-aloud target is timed from the moment an answer is submitted.

## What was built

### `packages/voice`: the contract, the server and the client

`src/contract.ts` is the one file the server, the routes and the browser share. It holds plain
types and constants: sample rates, the 2.5 s end-of-answer silence, the 60 s token, the 120 free
minutes, the speech languages, the interviewer voices, the NDJSON line types for `/api/tts`, and
the `STTProvider` and `TTSProvider` interfaces.

**Server** (`@admitstory/voice`):

- **Deepgram.** `stt/deepgram.ts` mints a temporary token with `POST /v1/auth/grant`
  (`ttl_seconds: 60`), so the master key never leaves the server. It also builds the full Nova-3
  streaming URL:
  - linear16 audio at 16 kHz, mono
  - interim results, `smart_format` and VAD events
  - `utterance_end_ms`, endpointing, the language, and up to 50 keyterms
- **Keyterms.** `keyterms.ts` builds the keyterms from three sources:
  - the Appendix H seed schools (now `SEED_SCHOOLS` in `packages/shared`)
  - the applicant's employers and the people named in their dossier
  - a short list of common MBA terms
- **TTS.** There are three adapters: Cartesia (`sonic-3.6`), ElevenLabs (`eleven_flash_v2_5`) and
  a deterministic fake. `select.ts` picks Cartesia or ElevenLabs by `TTS_PROVIDER` and uses the
  fake when that provider's key is missing.
- **TTS cache.** `tts/cache.ts` is an in-process LRU, bounded by bytes, keyed by
  sha256(provider | voice | speed | text), and kept for 24 h (§7.5).
- **Metering.** `pricing.ts` writes `usage_ledger` rows with `task` set to `voice.stt` or
  `voice.tts`, filling in `stt_seconds` or `tts_chars`. Rates: Deepgram $0.0048/min and TTS
  $0.04 per 1K characters, both marked "verify". Voice costs count toward the free user's $5 cap.

**Client** (`@admitstory/voice/client`), which is all lazy-loaded and contains no Zod:

- **Capture.** An AudioWorklet turns the microphone into 100 ms frames of 16 kHz Int16. It filters
  before downsampling and keeps its state between chunks, so frame boundaries don't click. Where
  AudioWorklet is missing it falls back to ScriptProcessor. Dictation shares the Voiceprint's
  microphone (`useMicrophone().audio()`), so there is one permission prompt and one stream.
- **Dictation session.** `createDictationSession` moves through
  idle → connecting → listening → finishing → done, failed or refused.
  - **Dropped connection:** it fetches a new single-use token and reconnects with backoff. It then
    replays the audio from the last finalized point, with 1 s of overlap, re-bases the timestamps
    and removes duplicated words.
  - **Offline:** audio is buffered until the connection is back.
  - **Repeated failure:** the session moves to `failed`, the audio stays in memory, and `retry()`
    recovers it (§5.2).
  - **Memory:** only audio not yet transcribed is held, and all of it is released when the answer
    ends.
- **Endpointer.** An answer ends after 2.5 s of silence following a sentence end. Sentence ends
  include the CJK and Devanagari marks. "Done" ends it immediately. A pause in the middle of a
  sentence never ends it. The silence is measured on Deepgram's audio timeline, so network lag
  cannot cut someone off.
- **Read-aloud player.** It parses `/api/tts`'s NDJSON stream as it arrives and schedules the PCM
  gaplessly on Web Audio, with an iOS unlock on the first tap. It exposes a `PlaybackClock` and
  word timings to `SpokenQuestion`. The performance measure `studio:answer-to-question-audio`
  records the time from answer submitted to question audio.

**Fake STT server.** `src/testing/fake-deepgram.ts` emulates the subset of Deepgram streaming that
the client uses. Tests can make it drop connections, refuse them or add latency. For local
development, `pnpm --filter @admitstory/voice fake-stt` runs it so the voice path works with no
keys.

### `packages/db`

- **Migration** `0003_voice_settings` adds `profiles.speech_language`, `tts_voice` and `tts_speed`.
- **Repository** `repos/voice.ts`, ownership-checked like the rest:
  - get and update the voice settings
  - total voice seconds used
  - add voice seconds to a session
  - save a speech-derived Voiceprint
  - find the latest Studio session
- **Ledger:** `recordVoiceUsage` in `repos/usage-ledger.ts`.

### `packages/ai`: the multilingual path

`studio.extract` v2 writes dossier fields in English and keeps golden lines verbatim in the
original language, with an English rendering stored in the column Phase 1 already had (§7.5). The
task takes an optional `language`. English requests are byte-identical to v1's, so the cache and
the replay fixtures still hit.

### `apps/web`

**Routes:**

- `POST /api/stt/token`. Refuses with `email_unverified` until the email is verified (§5.1,
  §12.4), and with `voice_minutes_used` once the 120 free minutes are spent. Rate-limited to
  20/min. Returns the URL, the auth subprotocol, the expiry and the seconds remaining.
- `POST /api/tts`. Rate-limited to 60/min (§12.4). Text is capped at 600 characters. Voice and
  speed come from the profile. Checks the cache first, then streams NDJSON. When the client
  disconnects, the provider request is aborted. Any synthesis that produced audio is metered
  exactly once, including one that was cut short, and only a complete one is cached.
- `GET` and `PATCH /api/profile/voice`, and `PUT /api/profile/voiceprint`.
- `POST /api/studio/turns` and `add-detail` accept `inputMode`, `voiceSeconds` and `language`. A
  spoken answer is stored as a `voice_turn` source with its language. Its seconds are added to
  the session and the ledger only after the turn is recorded and is not a retry.

**Story Studio (screen B):**

- **Voice stage.** `voice-stage.tsx` is a separate 21.6 KB chunk that loads once the page is
  interactive. Until then, a server-rendered still Voiceprint and the question hold the same frame,
  so nothing shifts.
  - The Voiceprint sits centre stage at full size and breathes with the microphone. It moves to its
    calmer listening state while a question is read aloud (§6.2).
- **Answering.** The record button works by tap or hold-Space, and the live transcript shows each
  word dim until Deepgram finalizes it. "Done", "Write instead" and a "Read questions aloud" toggle
  sit with it.
  - Talk and Write can be switched for each answer.
  - Starting to record stops the read-aloud, and a question is never read while recording.
  - A spoken answer that cannot be sent goes into the composer and is still sent as voice, so
    nothing is lost.
- **Voiceprint identity.** Mic frames feed the existing `IdentityAccumulator`. Once enough speech
  has been heard, the Studio saves the speech-derived identity once and updates the hue (§6.2). A
  speech-derived Voiceprint replaces one seeded from writing, and the Consolidator can no longer
  overwrite it.
- **States** (§5.2, with §6.9 copy):
  - mic permission ("Allow microphone" / "Write instead"), mic denied, mic unsupported
  - offline, STT failure (audio kept, "Try again", or type instead)
  - a long silence (a note after 20 s that never ends the answer), nothing heard
  - unverified email, free minutes low (10 min or less), free minutes used up (the Studio continues
    in text and says why)
  - An answer that runs into the cap ends with what has been said.
- **Logic.** The answer flow is a pure reducer (`voice-flow.ts`) and the notice logic is a pure
  function (`voice-notice.ts`), both under test.

**Settings** gains a Voice section, and each change saves on its own:

- read questions aloud
- interviewer voice, with "Play a sample"
- speaking speed (Slower, Normal, Faster)
- language of speech

**Dossier.** A record button beside add-detail dictates into the box, where the text can be
edited before sending.

## How to run it

```sh
pnpm install
pnpm db:migrate                                    # applies 0003_voice_settings
pnpm --filter @admitstory/voice fake-stt           # fake Deepgram on ws://localhost:8787
pnpm dev                                           # http://localhost:3000/studio
```

With no voice keys, the Studio uses the fake STT server and fake TTS (a quiet tone with estimated
word timings). Voice needs a verified email. The fakes refuse to run in a deployed app whose
`APP_URL` is not localhost, so production can never quietly use them.

Going live needs these in `.env.local` (all already in `.env.example`):

```
DEEPGRAM_API_KEY=
TTS_PROVIDER=cartesia            # or elevenlabs
CARTESIA_API_KEY=                # or ELEVENLABS_API_KEY
FAKE_STT_URL=ws://localhost:8787 # development only
```

They also need the interviewer voice IDs filled in, as below.

## Tests

Unit and integration only, no e2e, as you asked. Results: 116 unit files with 1264 tests, 5
integration files with 33 tests, typecheck 12/12 and lint clean, all passing.

Acceptance criteria:

- **30-minute voice session without loss** (`packages/voice/src/client/dictation.int.test.ts`).
  This runs a simulated 30-minute session over real WebSockets against the fake Deepgram, with
  about 40% of connections dropped at random points. It checks that:
  - every word appears exactly once and in order
  - the captured time totals 1800 s
  - memory stays under 15 s of audio per answer and returns to zero afterwards
  - pauses of up to 4.5 s mid-sentence never end an answer

  Other cases covered: failure followed by retry, all three refusals, minutes running out
  mid-answer, offline then online, and KeepAlive. The test takes 2–3 s.

- **Question audio ≤ 2.0 s p50 after the answer is submitted**
  (`apps/web/app/api/studio/turns/latency.test.ts`). This runs 15 voice turns through the real
  turns handler and the real `ai.run()` pipeline over a stubbed Anthropic connection. The injected
  delays are a question time of 1.2 s ± 0.3 s and a TTS first audio of 150–300 ms, with the clock
  scaled by 0.1. Result: **p50 1682 ms**, worst 2184 ms. Browser network and audio start-up are
  not in it.

Supporting tests:

- the resampler, the endpointer, the NDJSON parser and player scheduling
- the Deepgram URL and token mint, keyterms, the TTS adapters, and the cache (hit, TTL, byte bound)
- `/api/stt/token`, `/api/tts` (line order, metering, rate limit), voice settings
- voice-turn metering, the multilingual extraction
- the Studio voice reducer and notice copy

## Performance

| Route       | Phase 1  | Phase 2  | Budget |
| ----------- | -------- | -------- | ------ |
| `/studio`   | 161.0 KB | 159.2 KB | 160 KB |
| `/settings` | 156.3 KB | 158.6 KB | 160 KB |
| `/home`     | 151.7 KB | 152.1 KB | 160 KB |
| `/dossier`  | 169.6 KB | 170.1 KB | 160 KB |

`/studio` is now under budget, even with voice added. The voice stage is code-split, and the
first-load controls use `buttonStyles` on native buttons instead of `Button`, which pulls in Radix
Slot and the magnetic pull, about 3.5 KB. Those first-load buttons lose the magnetic hover; the
lazily loaded stage still uses `Button`. `/dossier` is still over budget from Phase 1; this phase
did not change its code. `bundle:check` still fails, on `/dossier` only.

## What the review caught

One review pass over the finished phase. It fixed nine problems:

- **Read-aloud while recording:** a question could be read aloud while the mic was recording,
  because the toggle was turned on mid-answer.
- **Mic left on:** after a transcription failure, tapping Done left the microphone on.
- **Cap overrun:** an answer could run past the 120 free minutes, because the cap was only checked
  when a token was issued.
- **Lost answer:** a spoken answer that finished while another request was in flight was dropped.
- **Double start:** a second tap during the permission prompt started a second capture session.
- **Stuck state:** a capture that failed to start left the session stuck at "connecting".
- **Unbounded buffer:** a closed session kept buffering audio.
- **Unmetered read-aloud:** read-aloud cut short by the client was never metered. That let a client
  make the vendor bill characters we never counted.
- **Lockfile:** `pnpm-lock.yaml` was missing the new workspace link, which would break CI's frozen
  install.

## Deviations from the spec, and why

- **`/api/tts` streams NDJSON (PCM + word timestamps) played through Web Audio, not an `<audio>`
  element (§7.5).** `SpokenQuestion` needs word timestamps, and iOS Safari cannot stream into
  `<audio>` without Media Source Extensions.
- **TTS cache is in-process**, not shared. §7.5 asks for a 24 h cache but names no store; Redis and
  R2 are not configured. Each instance caches on its own until they are.
- **Read-aloud also needs a verified email.** §12.4's "verified email before voice" is applied to
  TTS as well as STT, since both cost money per use. Unverified users see the question but hear
  nothing, and "Play a sample" in Settings is disabled for them.
- **The answer is dictated while recording; the mic is not always on.** Between answers the mic is
  released, so the browser's recording light goes off. The Voiceprint breathes with the voice
  while an answer is being recorded and rests otherwise.
- **Three profile columns and three routes are additions.** §5.1 lists voice choice, speed and
  speech language as settings, but §10 has no columns for them. `GET`/`PATCH /api/profile/voice`
  and `PUT /api/profile/voiceprint` are not in §11's list. The STT token is rate-limited at 20/min,
  which §12.4 does not specify.
- **Questions stay in English** when the applicant speaks another language. The spec says only that
  drafting writes in the school's language. The transcript is stored in the original language.
- **Keyterms use Appendix H's seed list** until Phase 3's schools table exists.
- **Dictated details count against the free minutes.** They are added to the most recent Studio
  session. Otherwise, dictation in the Dossier would be free voice time.
- **No raw-audio retention or R2** (your decision). `profiles.keep_audio` stays false and no toggle
  is shown.

## Not done, or needs you

- **Voice keys.** Nothing has been run against real Deepgram, Cartesia or ElevenLabs. Once the keys
  exist:
  - Fill in the three interviewer voice IDs (warm, clear, low) for each vendor in
    `packages/voice/src/config.ts`. The real adapters refuse to run with them empty, rather than
    guess.
  - Confirm the browser auth subprotocol for Deepgram temporary tokens (`["bearer", jwt]`). The
    docs only show `["token", key]`.
  - Confirm whether ElevenLabs' streamed word timings count from the start of the audio or from each
    chunk. The code detects which one it gets.
  - Check the vendor model names and the rates in `config.ts` and `pricing.ts`.
- **Device runs for the acceptance criteria.** Run a 30-minute voice session on Chrome, Safari
  (macOS and iOS) and Android Chrome, and measure question audio p50 in the browser. Read the
  `studio:answer-to-question-audio` performance measure in DevTools. One known risk on iOS: if a
  question is read aloud before the first tap, the audio context stays suspended until a tap
  unlocks it.
- **Voice minutes rely on what the browser reports.** The server limits each answer to 0–30
  minutes, refuses new tokens at the cap, and ends an answer that runs into it. But audio goes
  straight to Deepgram, so a modified client could under-report. The real fix is reconciling with
  Deepgram's usage API, for example by tagging each stream with the user. That belongs to Phase 9
  hardening.
- **Resending an answer can record it twice.** This was already true in Phase 1: a resend gets a new
  `clientTurnId`, so a response lost after the server saved the turn could record the turn and its
  voice seconds twice. Keeping the id would make an edited resend come back as a "duplicate" with
  no next question. That needs a UX decision from you.
- **Content-Security-Policy.** When the full CSP lands in Phase 9, `script-src` must allow `blob:`
  for the capture worklet. Without it, capture silently falls back to ScriptProcessor.
- **`/dossier` is still over budget** from Phase 1.

## Left for later phases

- **Phase 3:** keyterms from the real schools table and `user_schools`.
- **Phase 4:** voice answers to NEED questions reuse `useDictation`.
- **Phase 7:** live mocks (LiveKit, `apps/voice-agent`) reuse the TTS providers and the Voiceprint
  duet.
- **Phase 9:**
  - Upstash rate limits and a shared TTS cache (Redis or R2)
  - Deepgram usage reconciliation
  - optional raw-audio retention to R2 (90 days, §14.4)
  - the CSP `blob:` allowance
