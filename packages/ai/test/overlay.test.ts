import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANON_DIR } from "../src/canon";
import { createMemoryLedger } from "../src/ledger";
import {
  abBucket,
  createRegistryOverlay,
  overlayVersionNumber,
  pickActiveVersion,
  type OverlayCanonDoc,
  type OverlayPromptVersion,
} from "../src/prompts/overlay";
import { MODEL_IDS } from "../src/routing";
import { createAI } from "../src/run";
import { messageResponse, stubFetch } from "./helpers";

const V2_BODY =
  "Write a title of at most six words for the passage. Return JSON with a field title.";

function template(version: number, options: { canon?: string; body?: string } = {}): string {
  return [
    "---",
    "agent: util.title",
    `version: ${version}`,
    `canon: [${options.canon ?? ""}]`,
    "output: UtilTitleOutput",
    "notes: Published from the admin console.",
    "---",
    "",
    options.body ?? `${V2_BODY} (v${version})`,
  ].join("\n");
}

const row = (
  version: number,
  active: boolean,
  abWeight: number,
  extra: Partial<OverlayPromptVersion> = {},
) => ({
  version: `v${version}`,
  template: template(version),
  active,
  abWeight,
  ...extra,
});

/** A live client on a stub, with an overlay; returns the system text each call sent. */
function client(overlay: Parameters<typeof createRegistryOverlay>[0]) {
  const fetch = stubFetch(() => messageResponse());
  const ledger = createMemoryLedger();
  const ai = createAI({
    mode: "live",
    apiKey: "test",
    ledger,
    fetch,
    overlay: createRegistryOverlay({ ttlMs: 0, ...overlay }),
  });
  const system = (index: number) =>
    (fetch.calls[index]!.body as unknown as { system: { text: string }[] }).system
      .map((b) => b.text)
      .join("\n");
  return { ai, fetch, ledger, system };
}

describe("A/B selection", () => {
  const rows = [row(2, true, 70), row(3, true, 30), row(4, false, 100)];

  it("is stable per user and independent of row order", () => {
    for (const user of ["u1", "u2", "u3", "u4"]) {
      const first = pickActiveVersion(rows, "util.title", user);
      expect(pickActiveVersion([...rows].reverse(), "util.title", user)).toEqual(first);
      expect(pickActiveVersion(rows, "util.title", user)).toEqual(first);
    }
  });

  it("splits users by weight and never serves an inactive version", () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 2_000; i += 1) {
      const version = pickActiveVersion(rows, "util.title", `user-${i}`)!.version;
      counts.set(version, (counts.get(version) ?? 0) + 1);
    }
    expect(counts.has(4)).toBe(false);
    expect(counts.get(2)! / 2_000).toBeGreaterThan(0.65);
    expect(counts.get(2)! / 2_000).toBeLessThan(0.75);
  });

  it("buckets each agent separately", () => {
    const users = Array.from({ length: 200 }, (_, i) => `user-${i}`);
    const same = users.filter((u) => abBucket(u, "a.one") < 0.5 === abBucket(u, "a.two") < 0.5);
    expect(same.length).toBeGreaterThan(60);
    expect(same.length).toBeLessThan(140);
  });

  it("gives a call without a user the heaviest version, the newest on a tie", () => {
    expect(pickActiveVersion(rows, "util.title")?.version).toBe(2);
    expect(pickActiveVersion([row(2, true, 50), row(3, true, 50)], "util.title")?.version).toBe(3);
    // All-zero weights share equally rather than serving nothing.
    expect(pickActiveVersion([row(2, true, 0)], "util.title", "u1")?.version).toBe(2);
    expect(pickActiveVersion([row(2, false, 100)], "util.title", "u1")).toBeUndefined();
  });

  it("reads versions as numbers or v-strings", () => {
    expect(overlayVersionNumber("v12")).toBe(12);
    expect(overlayVersionNumber(3)).toBe(3);
    expect(() => overlayVersionNumber("latest")).toThrow();
  });
});

describe("the overlay in ai.run()", () => {
  it("serves an active published version, with its route override", async () => {
    const { ai, fetch, ledger, system } = client({
      promptVersions: async () => [
        row(2, true, 100, { routeOverride: { model: "sonnet", promptVersion: 9 } }),
      ],
    });
    await ai.run("util.title", { text: "A passage." }, { userId: "u1" });
    expect(system(0)).toContain(`${V2_BODY} (v2)`);
    expect(fetch.calls[0]!.body.model).toBe(MODEL_IDS.sonnet);
    expect(ledger.entries[0]).toMatchObject({
      promptVersion: "util.title@v2",
      model: MODEL_IDS.sonnet,
    });
  });

  it("falls back to the newest file when nothing is active, and to the files with no overlay rows", async () => {
    const inactive = client({ promptVersions: async () => [row(2, false, 100)] });
    await inactive.ai.run("util.title", { text: "A passage." });
    expect(inactive.ledger.entries[0]!.promptVersion).toBe("util.title@v1");

    const empty = client({});
    await empty.ai.run("util.title", { text: "A passage." });
    expect(empty.ledger.entries[0]!.promptVersion).toBe("util.title@v1");

    // An inactive draft that reuses the file's number does not replace the file.
    const draft = client({ promptVersions: async () => [row(1, false, 100)] });
    await draft.ai.run("util.title", { text: "A passage." });
    expect(draft.system(0)).not.toContain(V2_BODY);
  });

  it("lets a task's route override pin a version over the A/B split", async () => {
    const { ai, ledger } = client({
      promptVersions: async () => [row(2, true, 100)],
      routeOverrides: async () => ({ "util.title": { promptVersion: 1 } }),
    });
    await ai.run("util.title", { text: "A passage." }, { userId: "u1" });
    expect(ledger.entries[0]!.promptVersion).toBe("util.title@v1");
  });

  it("rejects a published template whose header disagrees with its row", async () => {
    const { ai } = client({
      promptVersions: async () => [{ ...row(2, true, 100), template: template(3) }],
    });
    await expect(ai.run("util.title", { text: "A passage." })).rejects.toThrow(
      "header version 3 must be 2",
    );
  });

  it("lays published canon over the files and keeps the prefix byte-stable", async () => {
    const original = readFileSync(join(CANON_DIR, "anti-ai-tells.md"), "utf8");
    const edited = original
      .replace("version: 1", "version: 2")
      .replace("- **TELL-03**", "- **TELL-03** Never use the word delve.\n- **TELL-04**");
    // A fresh array on every read, as a database would return.
    const docs = (): OverlayCanonDoc[] => [
      { slug: "anti-ai-tells", version: 1, content: original },
      { slug: "anti-ai-tells", version: 2, content: edited },
    ];
    const { ai, system } = client({
      promptVersions: async () => [
        { ...row(2, true, 100), template: template(2, { canon: "anti-ai-tells" }) },
      ],
      canonDocs: async () => docs(),
    });
    await ai.run("util.title", { text: "A passage." });
    await ai.run("util.title", { text: "Another passage." });
    expect(system(0)).toContain("Never use the word delve.");
    expect(system(0)).toContain("TELL-04");
    expect(system(1)).toBe(system(0));
  });
});

describe("createRegistryOverlay", () => {
  it("reuses answers within the TTL and never caches a failure", async () => {
    let clock = 0;
    let reads = 0;
    let fail = true;
    const overlay = createRegistryOverlay({
      ttlMs: 1_000,
      now: () => clock,
      promptVersions: async () => {
        reads += 1;
        if (fail) throw new Error("database down");
        return [];
      },
    });
    await expect(overlay.promptVersions("util.title")).rejects.toThrow("database down");
    fail = false;
    await overlay.promptVersions("util.title");
    await overlay.promptVersions("util.title");
    expect(reads).toBe(2);
    clock = 1_000;
    await overlay.promptVersions("util.title");
    expect(reads).toBe(3);
    expect(await overlay.canonDocs()).toEqual([]);
    expect(await overlay.routeOverrides()).toEqual({});
  });
});
