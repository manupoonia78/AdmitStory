import { describe, expect, it } from "vitest";
import { citableSpecificIds, compilePack, PACK_TOKEN_TARGET } from "../src/compiler";
import { cycleStart, isCitableSpecific, isStale, sectionFreshness } from "../src/freshness";
import { parseSchoolPack } from "../src/schema/school-pack";
import type { SchoolPack } from "../src/types";
import { citedNodes } from "../src/walk";
import { CYCLE, FIXTURE_SLUGS, NOW, fixture, rawDarden } from "./packs";

const compile = (pack: SchoolPack, now: string = NOW) => compilePack(pack, { cycle: CYCLE, now });

/** The same pack with every object's keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([k, v]) => [k, reverseKeys(v)]),
  );
}

describe("compilePack determinism (§8.2)", () => {
  it.each(FIXTURE_SLUGS)("%s compiles byte-for-byte the same every time", (slug) => {
    const pack = fixture(slug);
    const first = compile(pack);
    const again = compile(structuredClone(pack));
    const reordered = compile(reverseKeys(pack) as SchoolPack);
    expect(again.text).toBe(first.text);
    expect(reordered.text).toBe(first.text);
    expect(JSON.stringify(again.itemIndex)).toBe(JSON.stringify(first.itemIndex));
  });

  it("doesn't depend on today's date within the cycle", () => {
    const pack = fixture("quillfeather");
    expect(compile(pack, "2026-11-01").text).toBe(compile(pack, "2027-04-30").text);
  });

  it("stays within the compiled-pack budget and counts tokens", () => {
    for (const slug of FIXTURE_SLUGS) {
      const compiled = compile(fixture(slug));
      expect(compiled.tokenCount, slug).toBeGreaterThan(500);
      expect(compiled.tokenCount, slug).toBeLessThanOrEqual(PACK_TOKEN_TARGET.max);
    }
  });

  it("indexes every K id the text cites, and nothing else", () => {
    for (const slug of FIXTURE_SLUGS) {
      const compiled = compile(fixture(slug));
      const inText = [...compiled.text.matchAll(/^\s*(K\d+) /gm)].map((m) => m[1]);
      expect(inText, slug).toEqual(Object.keys(compiled.itemIndex));
      for (const entry of Object.values(compiled.itemIndex)) {
        expect(entry.verifiedAt, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Only an admin-approved rewrite of third-party notes has no citable source (§9.6).
        if (entry.sourceType !== null) expect(entry.sourceIds.length, slug).toBeGreaterThan(0);
      }
    }
  });
});

describe("freshness (§9.3)", () => {
  it("opens cycle 2026-27 on 1 May 2026", () => {
    expect(cycleStart("2026-27")).toBe("2026-05-01");
    expect(() => cycleStart("2026-28")).toThrow();
    expect(isStale("2026-04-30", "2026-27")).toBe(true);
    expect(isStale("2026-05-01", "2026-27")).toBe(false);
    expect(isStale(null, "2026-27")).toBe(false);
  });

  it("leaves a stale why-school specific out of the compiled pack", () => {
    const pack = fixture("halvorsen");
    const studio = pack.academics.centers.find((c) => c.name === "Halvorsen Venture Studio");
    expect(studio?.verified_at).toBe("2025-09-18");
    const compiled = compile(pack);
    expect(compiled.excluded).toContainEqual({
      id: studio?.id,
      section: "academics",
      reason: "stale_specific",
    });
    expect(compiled.text).not.toContain("Venture Studio:");
    expect(isCitableSpecific(compiled.itemIndex[studio?.id ?? ""])).toBe(false);
  });

  it("keeps other stale items as marked background, never citable as specifics", () => {
    const pack = structuredClone(fixture("halvorsen"));
    const note = pack.culture_and_location[0];
    if (!note) throw new Error("fixture changed");
    note.verified_at = "2025-11-02";
    const compiled = compile(pack);
    expect(compiled.itemIndex[note.id]?.stale).toBe(true);
    expect(compiled.text).toContain(`${note.id} ${note.text} [insider 2025-11-02 stale]`);
    expect(citableSpecificIds(compiled)).not.toContain(note.id);
    expect(isCitableSpecific(compiled.itemIndex[note.id])).toBe(false);
    const fresh = pack.culture_and_location[1];
    expect(isCitableSpecific(compiled.itemIndex[fresh?.id ?? ""])).toBe(true);
  });

  it("reports the oldest verified date per section", () => {
    const sections = sectionFreshness(fixture("halvorsen"), CYCLE);
    const academics = sections.find((s) => s.section === "academics");
    expect(academics).toMatchObject({ verifiedOn: "2025-09-18", stale: 1, unverified: 0 });
  });
});

describe("what never reaches the compiled pack", () => {
  it("compiles no unverified item: the Darden draft yields only the header", () => {
    const draft = parseSchoolPack(rawDarden());
    const compiled = compile(draft);
    expect(Object.keys(compiled.itemIndex)).toEqual([]);
    expect(compiled.excluded).toHaveLength(citedNodes(draft).length);
    expect(compiled.text).not.toContain("classmates");
    expect(compiled.text.trim().split("\n")).toHaveLength(2);
  });

  it("uses a third-party note only as an admin-approved rewrite, and never names the source", () => {
    const pack = fixture("halvorsen");
    const guide = pack.sources.find((s) => s.type === "third_party_reference");
    const note = pack.insider_notes.find((i) => i.source_ids.includes(guide?.id ?? ""));
    if (!guide || !note) throw new Error("fixture changed");
    expect(note.approved_rewrite).toBe(true);

    const approved = compile(pack);
    expect(approved.itemIndex[note.id]).toMatchObject({ sourceIds: [], sourceType: null });
    expect(approved.text).toContain(`${note.id} ${note.text} [admitstory `);
    expect(approved.text).not.toContain(guide.title);
    expect(approved.text).not.toContain(guide.id);
    // Background for the model, but no source a user could be shown: never a cited specific.
    expect(isCitableSpecific(approved.itemIndex[note.id])).toBe(false);
    expect(citableSpecificIds(approved)).not.toContain(note.id);

    const raw = structuredClone(pack);
    const unapproved = raw.insider_notes.find((i) => i.id === note.id);
    if (!unapproved) throw new Error("fixture changed");
    delete unapproved.approved_rewrite;
    const compiled = compile(raw);
    expect(compiled.itemIndex[note.id]).toBeUndefined();
    expect(compiled.text).not.toContain(note.text);
    expect(compiled.excluded).toContainEqual({
      id: note.id,
      section: "insider_notes",
      reason: "third_party_only",
    });
  });

  it("drops a third-party source from an item that also has a citable one", () => {
    const pack = structuredClone(fixture("halvorsen"));
    const item = pack.avoid[0];
    if (!item) throw new Error("fixture changed");
    item.source_ids.push("halvorsen-guide-notes");
    expect(compile(pack).itemIndex[item.id]?.sourceIds).toEqual(["halvorsen-coach"]);
  });

  it("excludes unsourced and future-dated items, and the notes of an excluded prompt", () => {
    const pack = structuredClone(fixture("halvorsen"));
    const [goals] = pack.application.essays;
    const avoid = pack.avoid[0];
    const angle = pack.angles_that_work[0];
    if (!goals || !avoid || !angle) throw new Error("fixture changed");
    goals.verified_at = null;
    avoid.source_ids = [];
    angle.verified_at = "2026-12-01";
    const compiled = compile(pack);
    const reasons = Object.fromEntries(compiled.excluded.map((e) => [e.id, e.reason]));
    expect(reasons[goals.id]).toBe("unverified");
    for (const note of goals.notes) expect(reasons[note.id]).toBe("parent_excluded");
    expect(reasons[avoid.id]).toBe("unsourced");
    expect(reasons[angle.id]).toBe("future_dated");
    expect(compiled.text).not.toContain(goals.prompt_verbatim ?? "");
    // Once the clock passes the verification date, the item is in.
    expect(compile(pack, "2026-12-02").itemIndex[angle.id]).toBeDefined();
  });

  it("renders limits, list prompts and money without locale", () => {
    const marrowgate = compile(fixture("marrowgate")).text;
    expect(marrowgate).toContain(
      "eight_things | required | list of 8, 25 words each | LIST,IDENTITY",
    );
    expect(marrowgate).toContain("median GBP 95,000");
    expect(compile(fixture("quillfeather")).text).toContain("300 chars incl. spaces");
    expect(compile(fixture("saltmarsh")).text).toContain(
      "async video | think 30s | answer 60s | attempts 1 | no scripting",
    );
  });
});
