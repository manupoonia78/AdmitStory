import { describe, expect, it } from "vitest";
import { ITEM_PATTERNS, RECORD_PATTERNS } from "../src/proposals";
import { pathPattern } from "../src/paths";
import { publishBlockers } from "../src/publish";
import { SchoolPack, packIntegrityIssues, parseSchoolPack } from "../src/schema/school-pack";
import { RETRIEVAL_CODE_BASE } from "../src/types";
import { citedNodes } from "../src/walk";
import { FIXTURE_SLUGS, fixture, rawDarden, rawFixture } from "./packs";

describe("fixture packs (§8.11)", () => {
  it("has six fictional schools, all marked synthetic and complete", () => {
    expect(FIXTURE_SLUGS).toHaveLength(6);
    for (const slug of FIXTURE_SLUGS) {
      const pack = fixture(slug);
      expect(pack.synthetic, slug).toBe(true);
      expect(pack.status, slug).toBe("complete");
      expect(pack.school.id, slug).toBe(slug);
      // Reserved .example domains: no fixture can point at a real school.
      expect(new URL(pack.school.website).hostname.endsWith(".example"), slug).toBe(true);
      for (const source of pack.sources)
        if (source.url)
          expect(new URL(source.url).hostname.endsWith(".example"), source.id).toBe(true);
    }
  });

  it.each(FIXTURE_SLUGS)("%s validates and is publishable", (slug) => {
    const result = SchoolPack.safeParse(rawFixture(slug));
    expect(result.success ? [] : result.error.issues).toEqual([]);
    expect(publishBlockers(rawFixture(slug))).toEqual([]);
  });

  it.each(FIXTURE_SLUGS)(
    "%s carries sources, verified dates, an employment report and a class profile",
    (slug) => {
      const pack = fixture(slug);
      expect(pack.careers.employment_report).not.toBeNull();
      expect(pack.class_profile).not.toBeNull();
      for (const node of citedNodes(pack)) {
        expect(node.verifiedAt, node.path).not.toBeNull();
        expect(node.sourceIds.length, node.path).toBeGreaterThan(0);
      }
    },
  );

  it("covers the variety the kit pipeline needs", () => {
    const packs = FIXTURE_SLUGS.map(fixture);
    const prompts = packs.flatMap((p) => [
      ...p.application.essays,
      ...p.application.short_answers,
      ...p.application.goal_fields,
    ]);
    const stances = new Set(packs.map((p) => p.ai_policy.stance));
    for (const stance of ["limited", "prohibited", "permitted_with_disclosure"] as const)
      expect(stances.has(stance), stance).toBe(true);
    const kinds = new Set(prompts.map((p) => p.limit.kind));
    expect([...kinds].sort()).toEqual(["chars_excl_spaces", "chars_incl_spaces", "words"]);
    expect(prompts.some((p) => p.list_count !== undefined && p.archetypes.includes("LIST"))).toBe(
      true,
    );
    expect(packs.some((p) => p.application.goal_fields.some((g) => g.limit.kind !== "words"))).toBe(
      true,
    );
    expect(packs.some((p) => p.application.video.some((v) => v.format === "async_video"))).toBe(
      true,
    );
  });

  it("puts every cited node where the proposals model expects one", () => {
    const patterns = new Set([
      ...ITEM_PATTERNS,
      ...RECORD_PATTERNS,
      "interview.common_questions[]",
      "glossary[]",
    ]);
    for (const slug of FIXTURE_SLUGS)
      for (const node of citedNodes(fixture(slug)))
        expect(patterns.has(pathPattern(node.path)), `${slug} ${node.path}`).toBe(true);
  });
});

describe("the Darden draft (Appendix G)", () => {
  it("validates as a draft but can't be published", () => {
    const pack = parseSchoolPack(rawDarden());
    expect(pack.status).toBe("draft");
    expect(pack.synthetic).toBeUndefined();
    expect(pack._todo?.length).toBeGreaterThan(10);
    const blockers = publishBlockers(rawDarden());
    expect(blockers.map((b) => b.reason)).toEqual(
      expect.arrayContaining(["draft", "todo", "unverified"]),
    );
  });

  it("holds no verified item and invents nothing: unfilled sections are empty", () => {
    const pack = parseSchoolPack(rawDarden());
    expect(citedNodes(pack).every((n) => n.verifiedAt === null)).toBe(true);
    expect(pack.rounds).toEqual([]);
    expect(pack.interview).toBeNull();
    expect(pack.careers.employment_report).toBeNull();
    expect(pack.class_profile).toBeNull();
    expect(pack.ai_policy.stance).toBe("unknown");
    // The scholarship prompt was only paraphrased, so it has no verbatim wording.
    expect(
      pack.application.essays.find((e) => e.key === "batten_scholars")?.prompt_verbatim,
    ).toBeNull();
  });
});

describe("pack integrity", () => {
  const base = () => structuredClone(fixture("halvorsen"));

  it("refuses a duplicate K id", () => {
    const pack = base();
    const [first, second] = pack.values.stated;
    if (!first || !second) throw new Error("fixture changed");
    second.id = first.id;
    expect(
      packIntegrityIssues(pack)
        .map((i) => i.message)
        .join(),
    ).toContain("already used");
    expect(SchoolPack.safeParse(pack).success).toBe(false);
  });

  it("refuses a source id that isn't in sources", () => {
    const pack = base();
    pack.avoid[0]?.source_ids.push("nowhere");
    expect(packIntegrityIssues(pack).map((i) => i.message)).toContain("Unknown source nowhere");
  });

  it("refuses K ids in the retrieval range and a non-canonical id", () => {
    const pack = base();
    const item = pack.avoid[0];
    if (!item) throw new Error("fixture changed");
    item.id = `K${RETRIEVAL_CODE_BASE + 1}`;
    expect(packIntegrityIssues(pack).some((i) => i.message.includes("retrieval range"))).toBe(true);
    item.id = "K7";
    expect(SchoolPack.safeParse(pack).success).toBe(false);
  });

  it("refuses a k_high_water below an id in use", () => {
    const pack = base();
    pack.k_high_water = 3;
    expect(packIntegrityIssues(pack).some((i) => i.path === "k_high_water")).toBe(true);
  });

  it("refuses a complete pack with a prompt that has no verbatim wording", () => {
    const pack = base();
    const essay = pack.application.essays[0];
    if (!essay) throw new Error("fixture changed");
    essay.prompt_verbatim = null;
    expect(packIntegrityIssues(pack).some((i) => i.message.includes("no verbatim wording"))).toBe(
      true,
    );
    expect(packIntegrityIssues({ ...pack, status: "draft" })).toEqual([]);
  });
});
