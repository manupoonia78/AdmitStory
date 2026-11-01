import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  citableCodes,
  compareToMedian,
  dossierBrandTraits,
  dossierStoryCodes,
  fileMapIssues,
  labelAgainstMedian,
  MEDIAN_NEAR_THRESHOLDS,
  oddsLanguage,
  positioningIssues,
  RED_FLAG_IDS,
  unresolvedCites,
  type FileMap,
  type Positioning,
} from "../src/kit";
import {
  Angle,
  CoachBeats,
  CriticReport,
  Draft,
  DrillFeedback,
  FileMap as FileMapSchema,
  LorBrief,
  Patch,
  Positioning as PositioningSchema,
  ProfileRead,
  RevisionResult,
  SchoolFit,
} from "../src/schemas";

const positioning: Positioning = {
  must_see: [{ text: "A practical collaborator.", cites: ["K25", "S02"] }],
  lead_traits: [
    { trait: "brings_people_along", why: "Proved by the rewrite.", cites: ["S02", "K27"] },
    { trait: "commercial_judgment", why: "Proved by the ward.", cites: ["S06"] },
  ],
  red_flags: [{ flag: "Technical background", address_in: "essay", how: "Plain language." }],
  career_lane_check: {
    short_term: "PM",
    realism: "Realistic.",
    plan_b: "Consulting",
    risks: [],
    cites: ["K39"],
  },
  reapplicant_angle: null,
};

const fileMap: FileMap = {
  items: [
    {
      deliverable_key: "goals",
      primary_story: "S06",
      primary_reason_if_none: null,
      supporting: ["S01"],
      traits_shown: ["commercial_judgment"],
      lenses: ["employability"],
      why: "Where the goal started.",
    },
    {
      deliverable_key: "optional",
      primary_story: null,
      primary_reason_if_none: "Nothing to explain.",
      supporting: [],
      traits_shown: [],
      lenses: [],
      why: "Not needed.",
    },
  ],
  recommender_plan: [{ recommender_id: "R1", strengths: [], stories: ["S01"], facets: [] }],
  coverage_gaps: [],
  warnings: [],
};

const RULES = {
  storyCodes: new Set(["S01", "S06"]),
  deliverableKeys: ["goals", "optional"],
  recommenderIds: ["R1"],
};

describe("Appendix I schemas", () => {
  it("accept well-formed output", () => {
    expect(PositioningSchema.safeParse(positioning).success).toBe(true);
    expect(FileMapSchema.safeParse(fileMap).success).toBe(true);
  });

  it("enforce the 1–5 score range in code, after parsing", () => {
    const report = (score: number) => ({
      findings: [],
      scores: { answers_prompt: score, story_quality: 3, voice_fidelity: 3 },
    });
    expect(CriticReport.safeParse(report(5)).success).toBe(true);
    expect(CriticReport.safeParse(report(0)).success).toBe(false);
    expect(CriticReport.safeParse(report(6)).success).toBe(false);
    expect(CriticReport.safeParse(report(2.5)).success).toBe(false);
    const drill = (score: number) => ({
      scores: [{ criterion: "Structure", score, quote: "" }],
      fixes: [],
      stronger_version: "A stronger answer.",
      consistency_flags: [],
    });
    expect(DrillFeedback.safeParse(drill(1)).success).toBe(true);
    expect(DrillFeedback.safeParse(drill(9)).success).toBe(false);
  });

  it("hold the Strategist to two or three lead traits", () => {
    const one = { ...positioning, lead_traits: positioning.lead_traits.slice(0, 1) };
    const four = {
      ...positioning,
      lead_traits: [...positioning.lead_traits, ...positioning.lead_traits],
    };
    expect(PositioningSchema.safeParse(one).success).toBe(false);
    expect(PositioningSchema.safeParse(four).success).toBe(false);
  });

  it("reject a story code that is not one and an unknown trait", () => {
    const bad = { ...fileMap.items[0], primary_story: "F01" };
    expect(FileMapSchema.safeParse({ ...fileMap, items: [bad] }).success).toBe(false);
    const trait = { ...fileMap.items[0], traits_shown: ["charisma"] };
    expect(FileMapSchema.safeParse({ ...fileMap, items: [trait] }).success).toBe(false);
  });

  it("tie a patch's sentences to its op", () => {
    const sentence = { text: "It was 2 a.m.", kind: "verbatim", sources: ["L001"] };
    expect(Patch.safeParse({ op: "delete", paragraph_id: "p1", sentences: null }).success).toBe(
      true,
    );
    expect(
      Patch.safeParse({ op: "delete", paragraph_id: "p1", sentences: [sentence] }).success,
    ).toBe(false);
    expect(Patch.safeParse({ op: "replace", paragraph_id: "p1", sentences: null }).success).toBe(
      false,
    );
    expect(
      RevisionResult.safeParse({
        patches: [{ op: "replace", paragraph_id: "p1", sentences: [sentence] }],
        summary: "Tightened the opening.",
      }).success,
    ).toBe(true);
  });

  it("parse the remaining shapes", () => {
    expect(
      Angle.safeParse({
        deliverable_key: "goals",
        label: "A",
        pitch: "The ward.",
        opening_line: "The nurses had a paper workaround.",
        stories: ["S06"],
        beats: [{ beat: "Scene", words: 80, sources: ["S06"] }],
        proves: ["commercial_judgment"],
        risks: [],
        recommended: true,
        reason: "Strongest origin.",
      }).success,
    ).toBe(true);
    expect(
      Draft.safeParse({
        paragraphs: [
          { id: "p1", sentences: [{ text: "It was wrong.", kind: "adapted", sources: ["L004"] }] },
        ],
        needs: [
          { paragraph_id: "p1", after_sentence: 0, question: "How many nurses?", approx_words: 20 },
        ],
        prompt_parts_answered: [{ part: "Role", paragraph_ids: ["p1"] }],
        notes: {
          why_this_story: "Origin.",
          what_it_proves: "Judgment.",
          school_fit_points: [{ text: "Trek", k_ids: ["K38"] }],
        },
        verify: [],
      }).success,
    ).toBe(true);
    expect(
      CoachBeats.safeParse({
        beats: [
          {
            beat: "Open",
            words: 60,
            your_lines: [{ text: "Still wrong.", source: "L004" }],
            questions: [],
          },
        ],
      }).success,
    ).toBe(true);
    // A brief carries talking points only; there is nowhere to put letter prose (§5.11).
    const brief = LorBrief.safeParse({
      cover_note: "Thank you.",
      schools: [],
      other_recommender_covers: [],
      development_arc: null,
      key_facts: [],
      letter: "Dear committee",
    });
    expect(brief.success && !("letter" in brief.data)).toBe(true);
  });

  it("validate the Phase 3 reads", () => {
    const lens = {
      helps: [],
      doubts: [{ flag_id: "FLAG-07", text: "Below.", cites: ["F06"] }],
      do: [],
    };
    const read = {
      lenses: { academics: lens, self_awareness: lens, employability: lens, leadership: lens },
      strengthening_plan: [
        { action: "Retake", time_estimate: "6 weeks", cites: [], why: "Score." },
      ],
      brand_preview: [],
    };
    expect(ProfileRead.safeParse(read).success).toBe(true);
    const badFlag = { ...lens, doubts: [{ flag_id: "FLAG-99", text: "x", cites: ["F06"] }] };
    expect(
      ProfileRead.safeParse({ ...read, lenses: { ...read.lenses, academics: badFlag } }).success,
    ).toBe(false);
    expect(
      SchoolFit.safeParse({
        honest_flags: [{ text: "Few in tech.", cites: ["S01"] }],
        looks_for: [],
        outcome_in_target_function: null,
      }).success,
    ).toBe(false);
  });
});

describe("RED_FLAG_IDS", () => {
  it("matches the canon's red-flag rules", () => {
    const canon = readFileSync(
      new URL("../../../knowledge/canon/red-flags.md", import.meta.url),
      "utf8",
    );
    const ids = [...new Set(canon.match(/\bFLAG-\d+\b/g))].sort();
    expect([...RED_FLAG_IDS]).toEqual(ids);
  });
});

describe("compareToMedian", () => {
  const profile = {
    gmat_focus_median: 655,
    gmat_classic_median: 720,
    gre_median: { verbal: 161, quant: 160 },
    gpa_median: 3.5,
    gpa_scale: 4,
    work_experience_years_median: 5,
  };

  it("labels each number against its median", () => {
    expect(
      compareToMedian(
        { test: { type: "GMAT", score: 705 }, gpa: { value: 3.2, scale: 4 }, yearsExperience: 5.5 },
        profile,
      ),
    ).toEqual({ test: "above", gpa: "below", years_experience: "near" });
  });

  it("treats a difference exactly at the threshold as near, despite float noise", () => {
    expect(labelAgainstMedian(675, 655, MEDIAN_NEAR_THRESHOLDS.gmat)).toBe("near");
    expect(labelAgainstMedian(676, 655, MEDIAN_NEAR_THRESHOLDS.gmat)).toBe("above");
    expect(labelAgainstMedian(3.6, 3.5, MEDIAN_NEAR_THRESHOLDS.gpa)).toBe("near");
    expect(labelAgainstMedian(3.39, 3.5, MEDIAN_NEAR_THRESHOLDS.gpa)).toBe("below");
  });

  it("compares a GMAT only on its own scale", () => {
    // Focus scores end in 5, classic in 0.
    expect(compareToMedian({ test: { type: "GMAT", score: 700 } }, profile).test).toBe("near");
    expect(
      compareToMedian({ test: { type: "gmat", score: 690 } }, { gmat_focus_median: 655 }).test,
    ).toBe("unknown");
    expect(compareToMedian({ test: { type: "GMAT", score: 803 } }, profile).test).toBe("unknown");
  });

  it("compares a GRE as the Verbal + Quant total", () => {
    expect(compareToMedian({ test: { type: "GRE", score: 322 } }, profile).test).toBe("near");
    expect(compareToMedian({ test: { type: "GRE", score: 330 } }, profile).test).toBe("above");
    expect(compareToMedian({ test: { type: "GRE", score: 330 } }, { gre_median: null }).test).toBe(
      "unknown",
    );
  });

  it("says unknown rather than converting scales or guessing", () => {
    const result = compareToMedian(
      {
        test: { type: "Executive Assessment", score: 155 },
        gpa: { value: 8.4, scale: 10 },
        yearsExperience: null,
      },
      profile,
    );
    expect(result).toEqual({ test: "unknown", gpa: "unknown", years_experience: "unknown" });
    expect(compareToMedian({}, {})).toEqual({
      test: "unknown",
      gpa: "unknown",
      years_experience: "unknown",
    });
  });

  it("reads a missing GPA scale as 4.0 and scales the threshold for another scale", () => {
    expect(compareToMedian({ gpa: { value: 3.55, scale: 4 } }, { gpa_median: 3.5 }).gpa).toBe(
      "near",
    );
    expect(
      compareToMedian({ gpa: { value: 8.4, scale: 10 } }, { gpa_median: 8.0, gpa_scale: 10 }).gpa,
    ).toBe("above");
  });
});

describe("post-parse rules", () => {
  it("find the stories and brand a compact dossier holds", () => {
    const dossier = [
      'S01 "The night-shift fix" | professional 2024',
      '  lines: L001 "It was 2 a.m."',
      'S06 "Watching the ward" | professional 2024',
      "BRAND  brings_people_along (S01,S02) | commercial_judgment (S06)",
      "SENSITIVE(excluded unless consent): 1 item withheld",
    ].join("\n");
    expect(dossierStoryCodes(dossier)).toEqual(new Set(["S01", "S06"]));
    expect(dossierBrandTraits(dossier)).toEqual(
      new Set(["brings_people_along", "commercial_judgment"]),
    );
    expect(dossierBrandTraits("APPLICANT  A-1")).toEqual(new Set());
  });

  it("accept a file map that keeps the rules", () => {
    expect(fileMapIssues(fileMap, RULES)).toEqual([]);
  });

  it("flag a story that is primary twice, withheld, unmapped deliverables and unknown recommenders", () => {
    const broken: FileMap = {
      ...fileMap,
      items: [
        fileMap.items[0]!,
        { ...fileMap.items[0]!, deliverable_key: "optional", supporting: ["S05"] },
        { ...fileMap.items[1]!, deliverable_key: "video", primary_reason_if_none: " " },
      ],
      recommender_plan: [{ recommender_id: "R9", strengths: [], stories: [], facets: [] }],
    };
    const messages = fileMapIssues(broken, RULES).map((issue) => `${issue.path}: ${issue.message}`);
    expect(messages.some((m) => m.includes("already primary"))).toBe(true);
    expect(
      messages.some((m) => m.startsWith("file_map.items.1.supporting.0") && m.includes("S05")),
    ).toBe(true);
    expect(messages.some((m) => m.includes('Unknown deliverable "video"'))).toBe(true);
    expect(messages.some((m) => m.includes("Say why no story leads"))).toBe(true);
    expect(messages.some((m) => m.includes('Unknown recommender "R9"'))).toBe(true);
  });

  it("flag a withheld story planned as primary", () => {
    const planned: FileMap = {
      ...fileMap,
      items: [
        fileMap.items[0]!,
        { ...fileMap.items[1]!, primary_story: "S05", primary_reason_if_none: null },
      ],
    };
    expect(fileMapIssues(planned, RULES)).toEqual([
      expect.objectContaining({ path: "file_map.items.1.primary_story" }),
    ]);
  });

  it("check positioning cites and the reapplicant angle", () => {
    const brand = new Set(["brings_people_along", "commercial_judgment"]);
    expect(positioningIssues(positioning, { isReapplicant: false, brandTraits: brand })).toEqual(
      [],
    );
    const issues = positioningIssues(
      {
        ...positioning,
        must_see: [{ text: "x", cites: ["S02"] }],
        lead_traits: [
          { trait: "analytical", why: "x", cites: ["K01"] },
          positioning.lead_traits[1]!,
        ],
      },
      { isReapplicant: true, brandTraits: brand },
    ).map((issue) => issue.path);
    expect(issues).toEqual([
      "positioning.must_see.0.cites",
      "positioning.lead_traits.0.trait",
      "positioning.lead_traits.0.cites",
      "positioning.reapplicant_angle",
    ]);
  });

  it("lead traits come from the brand only when it has enough traits to choose from", () => {
    const thin = new Set(["brings_people_along"]);
    expect(positioningIssues(positioning, { isReapplicant: false, brandTraits: thin })).toEqual([]);
  });

  it("resolve each code kind only from its own layer, and never a withheld story", () => {
    const known = citableCodes({
      dossier: [
        'F01 employer_current = "Meridian" [confirmed]',
        'S01 "The night-shift fix" | professional 2024',
        '  lines: L001 "It was 2 a.m." | used: S05 K12',
        "  people: P1 Ravi (manager; may_name=yes)",
      ].join("\n"),
      schoolPack: "K03 Round 2 deadline | F09 S09",
      retrievalIds: ["K900001"],
    });
    expect([...known].sort()).toEqual(["F01", "K03", "K900001", "L001", "P1", "S01"]);
  });

  it("find citations that point at nothing, or at the wrong kind", () => {
    const output = { a: { cites: ["F01", "K99"] }, b: [{ sources: ["S01"] }], k_ids: ["K02"] };
    expect(unresolvedCites(output, new Set(["F01", "S01", "K02"]))).toEqual([
      { path: "a.cites.1", message: "K99 does not exist in the material provided" },
    ]);
    expect(
      unresolvedCites(output, new Set(["F01", "S01", "K02", "K99"]), ["pack"]).map((i) => i.path),
    ).toEqual(["a.cites.0", "b.0.sources.0"]);
  });

  it("refuse admission odds anywhere in an output", () => {
    expect(oddsLanguage({ a: ["A 40% chance of admission here."] })).toHaveLength(1);
    expect(oddsLanguage({ a: "Your odds of getting in are low." })).toHaveLength(1);
    expect(oddsLanguage({ a: "You score 72 out of 100." })).toHaveLength(1);
    expect(oddsLanguage({ a: "Product took 19% of the class." })).toEqual([]);
  });
});
