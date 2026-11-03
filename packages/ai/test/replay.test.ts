import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReplayMissingError } from "../src/errors";
import {
  PROMPT_VERSION_HEADER,
  TASK_HEADER,
  canonicalJson,
  createLiveFetch,
  createReplayFetch,
  fixturePath,
  readFixture,
  requestHash,
} from "../src/replay";
import { messageResponse, stubFetch } from "./helpers";

const URL_ = "https://api.anthropic.com/v1/messages";

describe("request hash", () => {
  it("is stable under key order and changes with content", () => {
    const a = { model: "m", messages: [{ role: "user", content: "hi" }], max_tokens: 10 };
    const b = { max_tokens: 10, messages: [{ content: "hi", role: "user" }], model: "m" };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(requestHash(a)).toBe(requestHash(b));
    expect(requestHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(requestHash({ ...a, max_tokens: 11 })).not.toBe(requestHash(a));
  });
});

describe("record and replay", () => {
  const body = JSON.stringify({
    model: "m",
    max_tokens: 10,
    messages: [{ role: "user", content: "hi" }],
  });

  it("strips private headers, excludes headers from the hash, and replays what it recorded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const upstream = stubFetch(() => messageResponse({ text: '{"title":"Hi"}' }));
    const live = createLiveFetch(upstream, { dir, synthetic: true, note: "test" });

    await live(URL_, {
      method: "POST",
      body,
      headers: {
        [TASK_HEADER]: "util.title",
        [PROMPT_VERSION_HEADER]: "util.title@v1",
        "x-api-key": "k1",
      },
    });
    await live(URL_, {
      method: "POST",
      body,
      headers: { [TASK_HEADER]: "util.title", "x-api-key": "k2", "anthropic-beta": "b" },
    });

    expect(upstream.calls).toHaveLength(2);
    for (const call of upstream.calls) {
      expect(call.headers.has(TASK_HEADER)).toBe(false);
      expect(call.headers.has(PROMPT_VERSION_HEADER)).toBe(false);
    }
    const files = readdirSync(join(dir, "util.title"));
    expect(files).toEqual([`${requestHash(JSON.parse(body))}.json`]);

    const fixture = readFixture(join(dir, "util.title", files[0]!));
    expect(fixture.meta).toMatchObject({
      task: "util.title",
      model: "m",
      synthetic: true,
      note: "test",
    });
    expect(fixture.response.headers).toEqual({ "content-type": "application/json" });

    const replayed = await createReplayFetch(dir)(URL_, {
      method: "POST",
      body,
      headers: { [TASK_HEADER]: "util.title", "x-api-key": "other" },
    });
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toMatchObject({ content: [{ text: '{"title":"Hi"}' }] });
  });

  it("does not record failed responses", async () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const live = createLiveFetch(async () => new Response("{}", { status: 529 }), { dir });
    await live(URL_, { method: "POST", body, headers: { [TASK_HEADER]: "util.title" } });
    expect(existsSync(join(dir, "util.title"))).toBe(false);
  });

  it("names the hash, path and how to record when a fixture is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const replay = createReplayFetch(dir);
    const error = await replay(URL_, {
      method: "POST",
      body,
      headers: { [TASK_HEADER]: "util.title" },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReplayMissingError);
    const miss = error as ReplayMissingError;
    expect(miss.hash).toBe(requestHash(JSON.parse(body)));
    expect(miss.path).toBe(fixturePath(dir, "util.title", miss.hash));
    expect(miss.message).toMatch(/AI_MODE=live/);
  });
});
