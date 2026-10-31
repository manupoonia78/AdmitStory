// `pnpm --filter @admitstory/voice fake-stt`: the fake Deepgram on ws://localhost:8787, which the
// token route hands out when DEEPGRAM_API_KEY is missing (FAKE_STT_URL overrides the address).

import { startFakeDeepgram } from "./fake-deepgram";

const port = Number(process.env.FAKE_STT_PORT ?? 8787);
const fake = await startFakeDeepgram({ port, latencyMs: 120 });
console.log(
  `Fake Deepgram listening on ${fake.url} — speak into the Studio to see placeholder words.`,
);

const shutdown = () => void fake.close().then(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
