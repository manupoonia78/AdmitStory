import {
  FREE_VOICE_SECONDS,
  createDeepgramStt,
  createFakeStt,
  type SttTokenResponse,
} from "@admitstory/voice";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/app-user";
import { testUser } from "@/lib/voice/test-support";

const state = vi.hoisted(() => ({ user: null as unknown as AppUser, usedSeconds: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  voiceSecondsUsed: vi.fn(async () => state.usedSeconds),
  listFacts: vi.fn(async () => [{ key: "current_employer", value: "Meridian Health" }]),
  listPeople: vi.fn(async () => [{ name: "Asha Rao", roleInLife: "manager", mayName: false }]),
  listUserSchools: vi.fn(async () => []),
}));

const { POST } = await import("./route");
const { setVoiceProviders } = await import("@/lib/voice/server");

beforeEach(() => {
  state.user = testUser();
  state.usedSeconds = 0;
  setVoiceProviders({ stt: createFakeStt({ url: "ws://localhost:8787" }) });
});
afterEach(() => {
  setVoiceProviders(null);
  vi.unstubAllEnvs();
});

describe("POST /api/stt/token", () => {
  it("refuses until the email is verified (§12.4)", async () => {
    state.user = testUser({ emailVerified: false });
    const response = await POST();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ refusal: "email_unverified" });
  });

  it("refuses once the 120 free voice minutes are used", async () => {
    state.usedSeconds = FREE_VOICE_SECONDS;
    const response = await POST();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ refusal: "voice_minutes_used" });
  });

  it("returns a token response with the seconds left, keyterms and the applicant's language", async () => {
    state.usedSeconds = 600;
    state.user = testUser({ profile: { speechLanguage: "hi" } });
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as SttTokenResponse;
    expect(Object.keys(body).sort()).toEqual([
      "expiresAt",
      "protocols",
      "provider",
      "remainingSeconds",
      "url",
    ]);
    expect(body.remainingSeconds).toBe(FREE_VOICE_SECONDS - 600);
    expect(body.provider).toBe("fake");
    const url = new URL(body.url);
    expect(url.searchParams.get("language")).toBe("hi");
    expect(url.searchParams.get("utterance_end_ms")).toBe("2500");
    expect(url.searchParams.getAll("keyterm")).toEqual(
      expect.arrayContaining(["Meridian Health", "Asha Rao", "GMAT", "Harvard Business School"]),
    );
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("never exposes the master key", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ access_token: "short-lived-jwt", expires_in: 60 }),
    );
    setVoiceProviders({ stt: createDeepgramStt({ apiKey: "MASTER-KEY-123", fetch }) });
    const text = await (await POST()).text();
    expect(text).toContain("short-lived-jwt");
    expect(text).not.toContain("MASTER-KEY-123");
  });

  it("says speech is unavailable when the provider fails, or when a deployed app has only the fake", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setVoiceProviders({
      stt: createDeepgramStt({
        apiKey: "k",
        fetch: vi.fn(async () => new Response("", { status: 500 })),
      }),
    });
    expect(await (await POST()).json()).toMatchObject({ refusal: "stt_unavailable" });

    setVoiceProviders({ stt: createFakeStt({ url: "ws://localhost:8787" }) });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://app.example.test");
    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ refusal: "stt_unavailable" });
  });

  it("is rate-limited", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await POST()).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
