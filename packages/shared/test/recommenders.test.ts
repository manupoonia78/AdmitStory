import { describe, expect, it } from "vitest";
import { CODE_KINDS, code, isCode, nextCode, parseCode, sortCodes } from "../src/codes";
import {
  COMMON_GROUP_KEY,
  COMMON_LOR_QUESTIONS,
  COMMON_LOR_SOURCE,
  INTAKE_QUESTIONS,
  LOR_ADMISSIONS_EXPLAINER,
  OWN_WORDS_REMINDER,
  RELATIONSHIP_LABELS,
  RELATIONSHIPS,
  RECOMMENDER_STATUS_LABELS,
  RECOMMENDER_STATUSES,
  REMINDER_KINDS,
  REMINDER_LABELS,
  briefSections,
  inviteExpiry,
  letterKey,
  planReminders,
  recommenderModeFor,
  recommenderStatusOf,
  schoolGroups,
  sendAtFor,
  type BriefMeta,
} from "../src/kit/recommenders";
import type { LorBrief } from "../src/kit/types";

// Phase 6 shared helpers (plan §3): the reminder schedule (AC "ask 6–8 weeks, 3 w, 1 w"), link
// expiry (decision 10), school groups (decision 15), status precedence, portal mode (decision 20)
// and the brief's sections, whose recommender audience carries no cite codes.

describe("codes: the R kind (Phase 6)", () => {
  it("adds lor_story with prefix R and two digits", () => {
    expect(CODE_KINDS).toEqual([
      "fact",
      "story",
      "line",
      "person",
      "conversation",
      "pack",
      "lor_story",
    ]);
    expect(code("lor_story", 1)).toBe("R01");
    expect(code("lor_story", 120)).toBe("R120");
    expect(parseCode("R07")).toEqual({ kind: "lor_story", n: 7 });
    expect(isCode("R07", "lor_story")).toBe(true);
    expect(isCode("R07", "story")).toBe(false);
    expect(nextCode("lor_story", ["R01", "R03", "S09"])).toBe("R04");
    expect(sortCodes(["R02", "F01", "R01", "K03"])).toEqual(["F01", "K03", "R01", "R02"]);
  });
});

describe("copy constants", () => {
  it("labels every relationship, status and reminder kind", () => {
    for (const r of RELATIONSHIPS) expect(RELATIONSHIP_LABELS[r]).toBeTruthy();
    for (const s of RECOMMENDER_STATUSES) expect(RECOMMENDER_STATUS_LABELS[s]).toBeTruthy();
    for (const k of REMINDER_KINDS) expect(REMINDER_LABELS[k]).toBeTruthy();
  });

  it("has the seven Appendix F questions in order, each naming the recommender", () => {
    expect(INTAKE_QUESTIONS.map((q) => q.id)).toEqual([
      "how_you_know",
      "strengths",
      "stories",
      "feedback",
      "said_to_others",
      "background",
      "logistics",
    ]);
    expect(INTAKE_QUESTIONS.filter((q) => q.repeatable).map((q) => q.id)).toEqual(["stories"]);
    for (const q of INTAKE_QUESTIONS) {
      expect(q.prompt("Ravi")).toContain("Ravi");
      expect(q.hint.length).toBeGreaterThan(10);
      // §6.1/§6.9: plain copy, no shouting.
      expect(q.prompt("Ravi")).not.toMatch(/!/);
    }
  });

  it("keeps the common-form wording unverified until Manu checks it", () => {
    expect(COMMON_LOR_QUESTIONS.length).toBe(3);
    expect(new Set(COMMON_LOR_QUESTIONS.map((q) => q.id)).size).toBe(3);
    expect(COMMON_LOR_SOURCE.verifiedAt).toBeNull();
    expect(LOR_ADMISSIONS_EXPLAINER).toHaveLength(5);
    expect(OWN_WORDS_REMINDER).toBe(
      "These are facts and memories to jog yours. Please write in your own words: schools ask that the letter is entirely yours.",
    );
    expect(letterKey("common", "c2")).toBe("common/c2");
  });
});

describe("planReminders (decision 18)", () => {
  const deadlines = [
    { schoolCycleId: "halvorsen", date: "2027-01-06" },
    { schoolCycleId: "marrowgate", date: "2027-01-06" },
    { schoolCycleId: "quillfeather", date: "2027-01-13" },
  ];

  it("asks 7 weeks before the earliest deadline, inside the 6–8 week window", () => {
    const plan = planReminders({ today: "2026-10-01", deadlines });
    const ask = plan.find((r) => r.kind === "ask")!;
    expect(ask).toEqual({
      kind: "ask",
      deadline: "2027-01-06",
      sendOn: "2026-11-18",
      schoolCycleIds: ["halvorsen", "marrowgate", "quillfeather"],
    });
    const weeks = (Date.parse("2027-01-06") - Date.parse(ask.sendOn)) / (7 * 86_400_000);
    expect(weeks).toBeGreaterThanOrEqual(6);
    expect(weeks).toBeLessThanOrEqual(8);
  });

  it("checks in 3 weeks and 1 week before each distinct deadline", () => {
    const plan = planReminders({ today: "2026-10-01", deadlines });
    expect(plan.filter((r) => r.kind !== "ask").map((r) => [r.kind, r.deadline, r.sendOn])).toEqual(
      [
        ["checkin_3w", "2027-01-06", "2026-12-16"],
        ["checkin_3w", "2027-01-13", "2026-12-23"],
        ["checkin_1w", "2027-01-06", "2026-12-30"],
        ["checkin_1w", "2027-01-13", "2027-01-06"],
      ],
    );
    expect(plan.find((r) => r.kind === "checkin_1w" && r.deadline === "2027-01-06")).toMatchObject({
      schoolCycleIds: ["halvorsen", "marrowgate"],
    });
    // Sorted by date.
    const dates = plan.map((r) => r.sendOn);
    expect([...dates].sort()).toEqual(dates);
  });

  it("clamps a late ask to today and drops check-ins already past", () => {
    const plan = planReminders({ today: "2026-12-20", deadlines });
    expect(plan[0]).toMatchObject({ kind: "ask", sendOn: "2026-12-20" });
    expect(plan.map((r) => `${r.kind}:${r.deadline}`)).toEqual([
      "ask:2027-01-06",
      "checkin_3w:2027-01-13",
      "checkin_1w:2027-01-06",
      "checkin_1w:2027-01-13",
    ]);
  });

  it("ignores past and malformed deadlines, and plans nothing without one", () => {
    expect(planReminders({ today: "2026-10-01", deadlines: [] })).toEqual([]);
    expect(
      planReminders({
        today: "2026-10-01",
        deadlines: [
          { schoolCycleId: "a", date: "2026-09-01" },
          { schoolCycleId: "b", date: "not a date" },
          { schoolCycleId: "c", date: "2026-02-30" },
        ],
      }),
    ).toEqual([]);
  });
});

describe("sendAtFor", () => {
  it("is 09:00 local in the applicant's zone", () => {
    expect(sendAtFor("2026-11-18", "Asia/Kolkata").toISOString()).toBe("2026-11-18T03:30:00.000Z");
    expect(sendAtFor("2026-11-18", "Europe/London").toISOString()).toBe("2026-11-18T09:00:00.000Z");
  });

  it("is DST-safe on both change days", () => {
    // US daylight time starts 8 March 2026 and ends 1 November 2026.
    expect(sendAtFor("2026-03-08", "America/New_York").toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    );
    expect(sendAtFor("2026-11-01", "America/New_York").toISOString()).toBe(
      "2026-11-01T14:00:00.000Z",
    );
    expect(sendAtFor("2026-03-29", "Europe/Berlin").toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("falls back to 09:00 UTC without a zone or with an unknown one", () => {
    expect(sendAtFor("2026-11-18", null).toISOString()).toBe("2026-11-18T09:00:00.000Z");
    expect(sendAtFor("2026-11-18", "Mars/Olympus").toISOString()).toBe("2026-11-18T09:00:00.000Z");
  });
});

describe("inviteExpiry (decision 10)", () => {
  const issued = new Date("2026-11-01T10:00:00Z");
  const days = (date: Date) => (date.getTime() - issued.getTime()) / 86_400_000;

  it("is 14 days after the latest deadline", () => {
    expect(inviteExpiry(issued, ["2026-12-01", "2027-01-06"]).toISOString()).toBe(
      "2027-01-20T00:00:00.000Z",
    );
  });

  it("never ends sooner than 14 days after issue", () => {
    expect(days(inviteExpiry(issued, ["2026-10-20"]))).toBe(14);
  });

  it("is capped at 180 days after issue", () => {
    expect(days(inviteExpiry(issued, ["2027-09-01"]))).toBe(180);
  });

  it("defaults to 30 days without a known deadline", () => {
    expect(days(inviteExpiry(issued, []))).toBe(30);
    expect(days(inviteExpiry(issued, ["soon"]))).toBe(30);
  });
});

describe("schoolGroups (decision 15)", () => {
  it("puts common, unknown and question-less schools in one group, specific ones alone", () => {
    expect(
      schoolGroups([
        { schoolCycleId: "halvorsen", format: "gmac_common", questions: 0 },
        { schoolCycleId: "marrowgate", format: "school_specific", questions: 2 },
        { schoolCycleId: "unknown", format: "unknown", questions: 0 },
        { schoolCycleId: "empty", format: "school_specific", questions: 0 },
        { schoolCycleId: "halvorsen", format: "gmac_common", questions: 0 },
      ]),
    ).toEqual([
      { key: COMMON_GROUP_KEY, schoolCycleIds: ["halvorsen", "unknown", "empty"] },
      { key: "marrowgate", schoolCycleIds: ["marrowgate"] },
    ]);
  });

  it("has no common group when every school asks its own questions", () => {
    expect(schoolGroups([{ schoolCycleId: "m", format: "school_specific", questions: 1 }])).toEqual(
      [{ key: "m", schoolCycleIds: ["m"] }],
    );
  });
});

describe("recommenderStatusOf", () => {
  const base = {
    invite: null,
    openedAt: null,
    progressAt: null,
    submitted: {},
    schoolCycleIds: ["a", "b"],
  };
  const invite = { status: "active", sentAt: "2026-11-01T09:00:00Z" };

  it("follows submitted › in progress › opened › invited › not invited", () => {
    expect(recommenderStatusOf(base)).toBe("not_invited");
    expect(recommenderStatusOf({ ...base, invite })).toBe("invited");
    expect(recommenderStatusOf({ ...base, invite, openedAt: "x" })).toBe("opened");
    expect(recommenderStatusOf({ ...base, invite, openedAt: "x", progressAt: "y" })).toBe(
      "in_progress",
    );
    expect(recommenderStatusOf({ ...base, invite, submitted: { a: "t" } })).toBe("in_progress");
    expect(
      recommenderStatusOf({ ...base, invite, openedAt: "x", submitted: { a: "t", b: "t" } }),
    ).toBe("submitted");
  });

  it("treats a revoked link as not invited and an expired one as invited", () => {
    expect(recommenderStatusOf({ ...base, invite: { ...invite, status: "revoked" } })).toBe(
      "not_invited",
    );
    expect(recommenderStatusOf({ ...base, invite: { ...invite, status: "expired" } })).toBe(
      "invited",
    );
  });

  it("never calls a recommender with no schools submitted", () => {
    expect(recommenderStatusOf({ ...base, schoolCycleIds: [], invite })).toBe("invited");
  });
});

describe("recommenderModeFor (decision 20)", () => {
  it("is coach when any school restricts AI for recommendations, the strictest wins", () => {
    expect(recommenderModeFor([])).toBe("assist");
    expect(
      recommenderModeFor([{ stance: "permitted_with_disclosure", applies_to: ["essays"] }]),
    ).toBe("assist");
    expect(recommenderModeFor([{ stance: "prohibited", applies_to: ["essays"] }])).toBe("assist");
    expect(
      recommenderModeFor([
        { stance: "permitted", applies_to: ["essays", "recommendations"] },
        { stance: "limited", applies_to: ["essays", "recommendations"] },
      ]),
    ).toBe("coach");
    expect(
      recommenderModeFor([{ stance: "prohibited", applies_to: ["essays", "recommendations"] }]),
    ).toBe("coach");
  });
});

describe("briefSections", () => {
  const brief: LorBrief = {
    cover_note: "Thank you for doing this, Ravi. The Halvorsen deadline is 6 January (S01).",
    schools: [
      {
        school_cycle_id: "halvorsen",
        questions: [
          {
            question_id: "c2",
            question_verbatim: COMMON_LOR_QUESTIONS[1]!.text,
            talking_points: [
              {
                point: "Fixed the dropped lab feed overnight before the 6 a.m. rollback [R01].",
                evidence: "No dropped messages in twenty months.",
                trait: "delivers_under_pressure",
                story: "R01",
                facet: "The fix",
                cites: ["S01", "R01"],
              },
            ],
          },
        ],
      },
    ],
    traits_to_reinforce: [
      { trait: "brings_people_along", why: "He brought the vendor round.", cites: ["S01"] },
    ],
    other_recommender_covers: ["Kavita covers the ward screen."],
    development_arc: {
      feedback: "Ask for help earlier.",
      response: "He agreed.",
      steps: ["Calls the vendor within the hour now."],
      evidence: "The 2025 go-lives had no overnight solo work.",
      cites: ["S01"],
    },
    key_facts: [{ text: "Senior Software Engineer since April 2024", cites: ["F02"] }],
  };
  const meta: BriefMeta = {
    applicant: { name: "Arjun Rao", firstName: "Arjun" },
    recommender: {
      name: "Ravi Menon",
      firstName: "Ravi",
      title: "Engineering manager",
      organisation: null,
    },
    groupKey: COMMON_GROUP_KEY,
    schools: [
      {
        schoolCycleId: "halvorsen",
        school: "Halvorsen School of Management",
        round: "R2",
        deadline: "2027-01-06",
        format: "gmac_common",
        howToSubmit: "Halvorsen emails you a link once Arjun submits.",
        packNotes: ["At least one recommender should be a current or recent direct supervisor."],
        questions: COMMON_LOR_QUESTIONS.map((q) => ({
          id: q.id,
          text: q.text,
          limit: q.limit,
          source: "common_form" as const,
        })),
      },
    ],
    askBy: "2026-11-18",
    checkIns: ["2026-12-16", "2026-12-30"],
    builtAt: "2026-11-02T10:00:00Z",
  };

  it("gives the applicant every cite, story and the ask-by date", () => {
    const sections = briefSections(brief, meta, "applicant");
    expect(sections.map((s) => s.kind)).toEqual([
      "note",
      "reminder",
      "explainer",
      "school",
      "traits",
      "covers",
      "arc",
      "facts",
      "timeline",
    ]);
    const school = sections.find((s) => s.kind === "school");
    if (school?.kind !== "school") throw new Error("no school section");
    // Every question verbatim from code, the model's points under the one it answered.
    expect(school.questions.map((q) => q.text)).toEqual(COMMON_LOR_QUESTIONS.map((q) => q.text));
    expect(school.questions[1]!.points[0]).toMatchObject({
      story: "R01",
      cites: ["S01", "R01"],
      trait: "Ships when it counts",
    });
    expect(school.questions[0]!.points).toEqual([]);
    const timeline = sections.find((s) => s.kind === "timeline");
    expect(JSON.stringify(timeline)).toContain("Ask Ravi by this date");
  });

  it("gives the recommender no cite codes, no story codes and no ask-by date", () => {
    const sections = briefSections(brief, meta, "recommender");
    const json = JSON.stringify(sections);
    expect(json).not.toMatch(/\b[FSLPCKR]\d{1,6}\b/);
    expect(json).not.toContain("Ask Ravi");
    expect(json).toContain("Fixed the dropped lab feed overnight before the 6 a.m. rollback.");
    const reminder = sections.find((s) => s.kind === "reminder");
    expect(reminder).toMatchObject({ text: OWN_WORDS_REMINDER });
    const arc = sections.find((s) => s.kind === "arc");
    if (arc?.kind !== "arc") throw new Error("no arc");
    expect(arc.steps.map((s) => s.label)).toEqual([
      "The feedback",
      "How Arjun took it",
      "What they did next",
      "How it shows now",
    ]);
  });

  it("leaves out empty optional sections", () => {
    const bare = briefSections(
      {
        ...brief,
        traits_to_reinforce: [],
        other_recommender_covers: [],
        development_arc: null,
        key_facts: [],
      },
      { ...meta, askBy: null, checkIns: [], schools: [{ ...meta.schools[0]!, deadline: null }] },
      "recommender",
    );
    expect(bare.map((s) => s.kind)).toEqual(["note", "reminder", "explainer", "school"]);
  });
});
