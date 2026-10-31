import { describe, expect, it, vi } from "vitest";
import { DEEPGRAM } from "../src/config";
import { STT_TOKEN_TTL_SECONDS } from "../src/contract";
import { parseVoiceEnv } from "../src/env";
import { createDeepgramStt, listenQuery } from "../src/stt/deepgram";
import { createFakeStt } from "../src/stt/fake";
import { selectSttProvider } from "../src/stt/select";

const input = {
  userId: "00000000-0000-4000-8000-000000000001",
  language: "en" as const,
  keyterms: ["Harvard Business School", "GMAT"],
  utteranceEndMs: 2_500,
};

describe("Deepgram listen query (§7.5)", () => {
  it("asks for 16 kHz linear16 mono nova-3 with interim results, VAD and utterance end", () => {
    const params = listenQuery(input);
    expect(Object.fromEntries(params)).toMatchObject({
      model: "nova-3",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      vad_events: "true",
      utterance_end_ms: "2500",
      endpointing: "300",
      language: "en",
    });
  });

  it("repeats keyterm once per term, multi-word terms intact", () => {
    const params = listenQuery(input);
    expect(params.getAll("keyterm")).toEqual(["Harvard Business School", "GMAT"]);
    expect(params.toString()).toContain("keyterm=Harvard+Business+School&keyterm=GMAT");
  });

  it("never asks for an utterance end below Deepgram's 1,000 ms minimum", () => {
    expect(listenQuery({ ...input, utteranceEndMs: 300 }).get("utterance_end_ms")).toBe("1000");
  });

  it("uses language=multi with the shorter endpointing Deepgram recommends for code-switching", () => {
    const params = listenQuery({ ...input, language: "multi" });
    expect(params.get("language")).toBe("multi");
    expect(params.get("endpointing")).toBe(String(DEEPGRAM.endpointingMs.multi));
  });

  it("passes a single non-English language through", () => {
    expect(listenQuery({ ...input, language: "hi" }).get("language")).toBe("hi");
  });
});

describe("Deepgram token mint", () => {
  it("grants a 60 s token with the master key and hands the browser only the JWT", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ access_token: "jwt.token.value", expires_in: 60 }),
    );
    const stt = createDeepgramStt({ apiKey: "master-key", fetch, now: () => 1_000_000 });
    const minted = await stt.mint(input);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.deepgram.com/v1/auth/grant");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Token master-key");
    expect(JSON.parse(String(init?.body))).toEqual({ ttl_seconds: STT_TOKEN_TTL_SECONDS });

    expect(minted.provider).toBe("deepgram");
    expect(minted.protocols).toEqual(["bearer", "jwt.token.value"]);
    expect(minted.url.startsWith("wss://api.deepgram.com/v1/listen?model=nova-3")).toBe(true);
    expect(minted.expiresAt).toBe(new Date(1_000_000 + 60_000).toISOString());
    expect(JSON.stringify(minted)).not.toContain("master-key");
  });

  it("fails without echoing Deepgram's response body", async () => {
    const fetch = vi.fn(async () => new Response("invalid key master-key", { status: 401 }));
    const stt = createDeepgramStt({ apiKey: "master-key", fetch });
    const error = (await stt.mint(input).catch((e: unknown) => e)) as Error;
    expect(error.message).toBe("Deepgram's token grant failed (401).");
  });

  it("rejects a grant with no token", async () => {
    const stt = createDeepgramStt({ apiKey: "k", fetch: vi.fn(async () => Response.json({})) });
    await expect(stt.mint(input)).rejects.toThrow(/no access_token/);
  });
});

describe("fake STT and selection", () => {
  it("points at FAKE_STT_URL with the same query and the fake subprotocols", async () => {
    const minted = await createFakeStt({ url: "ws://localhost:8787" }).mint(input);
    expect(minted.url).toBe(`ws://localhost:8787?${listenQuery(input).toString()}`);
    expect(minted.protocols).toEqual(["token", "fake"]);
    expect(minted.provider).toBe("fake");
  });

  it("selects the fake without a key and Deepgram with one", () => {
    expect(selectSttProvider(parseVoiceEnv({})).name).toBe("fake");
    expect(selectSttProvider(parseVoiceEnv({ DEEPGRAM_API_KEY: "k" })).name).toBe("deepgram");
  });

  it("validates the environment", () => {
    expect(parseVoiceEnv({}).fakeSttUrl).toBe("ws://localhost:8787");
    expect(() => parseVoiceEnv({ TTS_PROVIDER: "polly" })).toThrow(/TTS_PROVIDER/);
    expect(() => parseVoiceEnv({ FAKE_STT_URL: "http://x" })).toThrow(/FAKE_STT_URL/);
  });
});
