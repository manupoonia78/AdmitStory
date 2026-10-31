# @admitstory/voice

Speech-to-text and read-aloud for Story Studio dictation (spec §7.5). Built in Phase 2; the live
mock-interview transport (LiveKit) comes in Phase 7.

- `@admitstory/voice/contract`: the types and constants that the server, the routes and the
  browser share. Plain data only, safe to import into a client bundle.
- `@admitstory/voice` (server only): the Deepgram token mint and stream URL, the Cartesia,
  ElevenLabs and fake TTS adapters, the TTS cache, keyterms, voice pricing and metering. Each
  provider falls back to a fake when its key is missing.
- `@admitstory/voice/client` (browser): the 16 kHz PCM capture worklet, `createDictationSession`
  (reconnects and replays without loss), the endpointer, the Web Audio read-aloud player, and the
  `useDictation` / `useReadAloud` hooks. It never imports Zod or server code.
- `src/testing/fake-deepgram.ts`: a local emulation of Deepgram streaming, used by the tests and by
  `pnpm --filter @admitstory/voice fake-stt` in development (port 8787).

Vendor model names, voice IDs and rates live in `src/config.ts` and `src/pricing.ts`. Check them
against the vendors' docs before going live.
