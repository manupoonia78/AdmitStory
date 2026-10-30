// The shape of a synthetic applicant fixture (spec §8.11, Appendix J). Validated on load, so a
// malformed fixture fails loudly at the start of a run rather than halfway through it.
//
// `ground_truth.json` is the whole point: it is the only material the simulator may answer from,
// and it is what a run's output is scored against. If a fact appears in a draft that is not in
// here, the engine invented it (§8.11's "no invented facts, checked against ground truth").

import { z } from "zod";
import { SPEAKING_STYLES } from "../schemas/applicant-simulator";

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const FixtureProfile = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/, "kebab-case slug"),
  /** One line: "A backend engineer in Bengaluru moving into product management." */
  summary: nonEmpty(400),
  /** The §3 persona this fixture exercises, for reading eval results. */
  persona: z.enum(["sprinter", "switcher", "reapplicant", "international", "perfectionist"]),
  style: z.enum(SPEAKING_STYLES),
  country: z.string().regex(/^[A-Z]{2}$/),
  timezone: nonEmpty(64),
  programType: z.string().default("full_time_mba"),
  targetIntake: z.number().int().min(2026).max(2035),
  studioMode: z.enum(["express", "standard", "deep"]),
  yearsExperience: z.number().min(0).max(40),
  test: z.object({ type: nonEmpty(16), score: z.number().int() }).nullable(),
  gpa: z.object({ value: z.number(), scale: z.number() }).nullable(),
  isReapplicant: z.boolean().default(false),
  /** What makes this applicant hard, in a line. Read when an eval result looks surprising. */
  difficulty: nonEmpty(300),
});

export type FixtureProfile = z.output<typeof FixtureProfile>;

export const GroundTruthFact = z.object({
  key: nonEmpty(80),
  value: nonEmpty(500),
  note: z.string().max(300).optional(),
});

export const GroundTruthStory = z.object({
  /** A stable handle for this story within the fixture, for `expected.json` to point at. */
  ref: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
  nickname: nonEmpty(80),
  era: nonEmpty(60),
  context: z.enum(["professional", "academic", "community", "personal"]),
  situation: nonEmpty(2000),
  stakes: nonEmpty(2000),
  actions: z.array(nonEmpty(600)).min(1).max(12),
  result: nonEmpty(1000),
  reflection: nonEmpty(1000),
  /** Numbers this story genuinely contains. Anything outside this list is an invention. */
  numbers: z.array(z.object({ label: nonEmpty(80), value: nonEmpty(80) })).max(10),
  people: z.array(
    z.object({
      name: nonEmpty(80),
      role: nonEmpty(120),
      /** Whether this fictional person would consent to being named. */
      mayName: z.boolean(),
    }),
  ),
  traits: z.array(nonEmpty(60)).max(8),
  /** Which evidence slots a good Studio run should fill from this story. */
  slots: z.array(nonEmpty(80)).max(10),
  /** Health, bereavement, identity, hardship: the Studio must treat these with care (§14.3). */
  sensitivity: z.enum(["none", "personal", "sensitive"]).default("none"),
});

export const GroundTruth = z.object({
  facts: z.array(GroundTruthFact).min(1),
  stories: z.array(GroundTruthStory).min(1),
  goals: z.object({
    shortTerm: nonEmpty(500),
    longTerm: nonEmpty(500),
    planB: nonEmpty(500),
    whyMba: nonEmpty(500),
    whyNow: nonEmpty(500),
  }),
  /** Doubts an admissions reader would have (Appendix A2), for the Profile Read in Phase 3. */
  redFlags: z.array(nonEmpty(300)).max(8),
  /** Things this applicant would never say about themselves, for voice fidelity scoring. */
  neverSays: z.array(nonEmpty(80)).max(12),
});

export type GroundTruth = z.output<typeof GroundTruth>;

export interface Fixture {
  profile: FixtureProfile;
  groundTruth: GroundTruth;
  /** `transcript_seed.md`, verbatim: how this person talks. */
  transcriptSeed: string;
}

/** Everything the simulator is allowed to draw on, as one block of text. */
export function groundTruthText(fixture: Fixture): string {
  const { groundTruth: truth } = fixture;
  const lines: string[] = [`ABOUT YOU: ${fixture.profile.summary}`, "", "FACTS"];
  for (const fact of truth.facts)
    lines.push(`- ${fact.key}: ${fact.value}${fact.note ? ` (${fact.note})` : ""}`);

  lines.push("", "WHAT HAS HAPPENED TO YOU");
  for (const story of truth.stories) {
    lines.push(`- ${story.nickname} (${story.context}, ${story.era})`);
    lines.push(`  What happened: ${story.situation}`);
    lines.push(`  What was at stake: ${story.stakes}`);
    lines.push(`  What you did: ${story.actions.join("; ")}`);
    lines.push(`  How it turned out: ${story.result}`);
    lines.push(`  Looking back: ${story.reflection}`);
    if (story.numbers.length > 0)
      lines.push(
        `  Numbers you remember: ${story.numbers.map((n) => `${n.label} ${n.value}`).join(", ")}`,
      );
    if (story.people.length > 0)
      lines.push(`  People: ${story.people.map((p) => `${p.name} (${p.role})`).join(", ")}`);
  }

  lines.push(
    "",
    "WHERE YOU ARE GOING",
    `- Short term: ${truth.goals.shortTerm}`,
    `- Long term: ${truth.goals.longTerm}`,
    `- Plan B: ${truth.goals.planB}`,
    `- Why an MBA: ${truth.goals.whyMba}`,
    `- Why now: ${truth.goals.whyNow}`,
    "",
    "HOW YOU TALK",
    fixture.transcriptSeed.trim(),
  );

  if (truth.neverSays.length > 0)
    lines.push("", `WORDS YOU WOULD NEVER USE: ${truth.neverSays.join(", ")}`);

  return lines.join("\n");
}
