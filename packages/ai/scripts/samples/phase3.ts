/**
 * Fixed inputs for the Phase 3 tasks, shared by the synthetic recorder (record-phase3.ts), the
 * request check (check-tasks.ts) and the replay tests. Everything is fictional (spec §0):
 *
 * - The applicant is the `engineer-to-product` fixture (fixtures/applicants), compiled into a
 *   compact dossier with compileDossier(). His sensitive story has no consent, so the dossier
 *   withholds it, which is what the Strategist's consent check is tested against.
 * - The school is the fictional Halvorsen School of Management (fixtures/schools/halvorsen). Its
 *   compiled pack is frozen in halvorsen.compiled.txt, produced by packages/kb `compilePack` with
 *   cycle 2026-27, so the replay fixtures do not move when the kb compiler changes. Regenerate it
 *   (and re-record) when the pack or the compiler changes on purpose.
 *
 * Changing any value here changes a request hash: re-run `pnpm --filter @admitstory/ai
 * record:phase3 --synthetic` afterwards.
 */
import { readFileSync } from "node:fs";
import { compileDossier, type DossierInput } from "@admitstory/shared";
import { compareToMedian } from "@admitstory/shared/kit";
import type { RunContext, TaskInput } from "../../src";
import { findRepoRoot } from "../../src/paths";

const root = findRepoRoot(process.cwd());
if (!root) throw new Error("Run from inside the AdmitStory repo");

/** L1: the Halvorsen pack as compiled for cycle 2026-27 (see the module comment). */
export const HALVORSEN_PACK = readFileSync(
  `${root}/packages/ai/scripts/samples/halvorsen.compiled.txt`,
  "utf8",
).trimEnd();

/** Halvorsen's `class_profile` (K42), as fixtures/schools/halvorsen/pack.json has it. */
export const HALVORSEN_CLASS_PROFILE = {
  gmat_focus_median: 655,
  gmat_classic_median: null,
  gre_median: { verbal: 161, quant: 160 },
  gpa_median: 3.5,
  gpa_scale: 4,
  work_experience_years_median: 5,
} as const;

const fact = (code: string, key: string, value: string, note: string | null = null) => ({
  code,
  key,
  value,
  note,
  status: "confirmed" as const,
  sensitivity: "none" as const,
  consentToUse: true,
});

const APPLICANT_NUMBERS = {
  test: { type: "GMAT", score: 705 },
  gpa: { value: 8.4, scale: 10 },
  yearsExperience: 5.5,
};

export const ENGINEER_DOSSIER_INPUT: DossierInput = {
  applicant: {
    handle: "A-e2p",
    programType: "MBA",
    targetIntake: 2027,
    country: "IN",
    ...APPLICANT_NUMBERS,
  },
  facts: [
    fact(
      "F01",
      "employer_current",
      "Meridian Health Systems",
      "hospital software; 40+ hospitals in India and the US",
    ),
    fact("F02", "title_current", "Senior Software Engineer", "since April 2024"),
    fact("F03", "team_size", "4 engineers he coordinates, no formal reports"),
    fact("F04", "location_current", "Bengaluru, India"),
    fact("F05", "degree", "B.Tech in Computer Science, Vellore Institute of Technology, 2020"),
    fact("F06", "gmat_total", "705", "Q50 V34, taken September 2026"),
    fact(
      "F07",
      "promotion",
      "Promoted to Senior Software Engineer in April 2024, two years ahead of the usual track",
    ),
    fact(
      "F08",
      "side_project",
      "Runs a Saturday coding class for 12 government-school students in Bengaluru, since 2023",
    ),
  ],
  stories: [
    {
      code: "S01",
      nickname: "The night-shift fix",
      era: "2024",
      context: "professional",
      lenses: ["employability", "leadership"],
      traits: ["delivers_under_pressure", "originates_ideas", "cross_functional_influence"],
      status: "confirmed",
      situation:
        "Go-live at a 900-bed hospital; the lab feed dropped every fourth message at 2 a.m.",
      stakes: "Rollback at the 6 a.m. shift change and a contract fourteen months in the winning",
      actions: [
        "found the retry logic re-sent whole batches",
        "rewrote the retry per message and tested it on replayed traffic",
        "persuaded the vendor's on-call engineer to widen the batch window from 30 to 90 seconds",
        "wrote a runbook for the hospital's IT staff",
      ],
      result:
        "Go-live held; no dropped messages in twenty months; the runbook became Meridian's template",
      reflection: "Spent four hours alone before calling the vendor; asks for help earlier now",
      lines: [
        { code: "L001", text: "It was 2 a.m. and nobody else on the call knew the old interface." },
      ],
      people: [
        { code: "P1", name: "Ravi Menon", roleInLife: "engineering manager", mayName: true },
      ],
      usedIn: [],
      sensitivity: "none",
      consentToUse: true,
    },
    {
      code: "S02",
      nickname: "The rewrite I talked them out of",
      era: "2025",
      context: "professional",
      lenses: ["academics", "employability", "leadership"],
      traits: ["brings_people_along", "analytical", "commercial_judgment"],
      status: "confirmed",
      situation: "A director wanted a six-month rewrite of the scheduling module for a US customer",
      stakes: "The whole backend team for six months; the customer's deadline was in five",
      actions: [
        "instrumented the module over a weekend: 80% of slow requests came from three queries",
        "built a working fix for two of them in four days",
        "showed before-and-after numbers in fifteen minutes at planning",
        "offered to revisit the architecture after go-live",
      ],
      result:
        "Rewrite shelved; page loads from 4.2 seconds to 900 milliseconds; customer live a month early",
      reflection: "Had not asked why the director wanted the rewrite until after building his case",
      lines: [
        { code: "L002", text: "I showed them the numbers instead of arguing the principle." },
      ],
      people: [],
      usedIn: [],
      sensitivity: "none",
      consentToUse: true,
    },
    {
      code: "S03",
      nickname: "Twelve kids on a Saturday",
      era: "2023 onwards",
      context: "community",
      lenses: ["self_awareness", "leadership"],
      traits: ["community_builder", "develops_people", "acts_unasked"],
      status: "confirmed",
      situation: "A government school had donated computers and nobody to teach with them",
      stakes: "Two of the first four students had never used a keyboard",
      actions: [
        "taught every Saturday for a year",
        "rewrote the curriculum after one term: typing and files before programming",
        "recruited three colleagues to take alternate Saturdays",
      ],
      result: "Twelve students; four moved on to a paid bootcamp; runs without him for six months",
      reflection: "The barrier was confidence, not computers; builds things to run without him now",
      lines: [
        { code: "L003", text: "The class has not needed me for six months, which was the point." },
      ],
      people: [
        { code: "P2", name: "Lakshmi", roleInLife: "the school's headmistress", mayName: true },
      ],
      usedIn: [],
      sensitivity: "none",
      consentToUse: true,
    },
    {
      code: "S04",
      nickname: "The migration I got wrong",
      era: "2022",
      context: "professional",
      lenses: ["self_awareness"],
      traits: ["honest_about_limits", "acts_on_feedback", "self_aware"],
      status: "confirmed",
      situation:
        "A migration tested on a three-month-old copy corrupted about 1,100 appointment records",
      stakes: "The hospital phoned patients all Saturday; he had to be on the customer call",
      actions: [
        "restored from backup within two hours",
        "wrote the incident note himself without softening his part",
        "added a schema check that has blocked four migrations since",
      ],
      result: "No appointments permanently lost; promoted eighteen months later",
      reflection: "Had not asked anyone to check his plan because he did not want to look slow",
      lines: [],
      people: [
        { code: "P1", name: "Ravi Menon", roleInLife: "engineering manager", mayName: true },
      ],
      usedIn: [],
      sensitivity: "none",
      consentToUse: true,
    },
    {
      // Sensitive and without consent: compileDossier withholds it (§8.7, §14.3).
      code: "S05",
      nickname: "The year I worked from the hospital",
      era: "2021",
      context: "personal",
      lenses: ["self_awareness"],
      traits: ["resilient", "self_aware"],
      status: "confirmed",
      situation: "A family illness and eight months of rehabilitation",
      actions: ["asked for his hours to be moved rather than reduced"],
      result: "His review the following year was his best",
      lines: [],
      people: [],
      usedIn: [],
      sensitivity: "sensitive",
      consentToUse: false,
    },
    {
      code: "S06",
      nickname: "Watching the ward use what I built",
      era: "2024",
      context: "professional",
      lenses: ["self_awareness", "employability"],
      traits: ["curious_learner", "commercial_judgment", "acts_unasked"],
      status: "confirmed",
      situation: "Nurses had a paper workaround for a screen he built",
      stakes: "Nothing broke; the system worked as specified and was still wrong",
      actions: [
        "sat with four nurses through a full shift and listed every workaround",
        "took the list to the product team instead of patching the code",
        "argued for two months to get the field order changed",
      ],
      result: "Screen changed, workaround gone; he has sat in product reviews since",
      reflection: "The decision about what to build interests him more than the building",
      lines: [
        { code: "L004", text: "It was working exactly as specified, and it was still wrong." },
      ],
      people: [],
      usedIn: [],
      sensitivity: "none",
      consentToUse: true,
    },
  ],
  brand: [
    { trait: "brings_people_along", stories: ["S02", "S01"] },
    { trait: "commercial_judgment", stories: ["S02", "S06"] },
    { trait: "community_builder", stories: ["S03"] },
  ],
  voice: {
    card: 'sent_len≈11w var=low register=plain humour=none opens_with=statement avoids=[jargon,"passionate","I led"]',
  },
  goals: {
    shortTerm: "Product manager on a health-data team, owning a clinical workflow",
    longTerm: "Shared health records across Indian hospitals",
    planB: "Health-tech strategy consulting, then product",
  },
};

/** L2: the compiled compact dossier. */
export const ENGINEER_DOSSIER = compileDossier(ENGINEER_DOSSIER_INPUT).text;

/** compareToMedian against Halvorsen: GMAT 705 vs 655 above, GPA on a 10-point scale unknown, 5.5 vs 5 years near. */
export const ENGINEER_VS_HALVORSEN = compareToMedian(APPLICANT_NUMBERS, HALVORSEN_CLASS_PROFILE);

/** One retrieved long-tail chunk (§8.9), coded in the retrieval range (packages/kb K900001+). */
export const HALVORSEN_RETRIEVAL = [
  {
    id: "K900001",
    source: "Halvorsen product club officer conversation (insider)",
    verified_at: "2026-09-12",
    text: "The Product Management Club runs a product case series every other Thursday in the autumn and helps first-years prepare for the West Coast Technology Trek in January.",
  },
];

export const PROFILE_READ_INPUT: TaskInput<"profile.read"> = {
  targets: [{ school: "Halvorsen School of Management", medians: ENGINEER_VS_HALVORSEN }],
};

export const SCHOOL_FIT_INPUT: TaskInput<"strategy.school_fit"> = {
  school: "Halvorsen School of Management",
  cycle: "2026-27",
  applicant: {
    summary:
      "Backend engineer at a hospital-software company in Bengaluru, 5.5 years, moving into product management in health data.",
    target_function: "Product management",
    brand_traits: ["brings_people_along", "commercial_judgment", "community_builder"],
    international: true,
    round: "R2",
  },
  medians: ENGINEER_VS_HALVORSEN,
  retrieval: HALVORSEN_RETRIEVAL,
};

export const KIT_POSITIONING_INPUT: TaskInput<"kit.positioning_filemap"> = {
  school: "Halvorsen School of Management",
  cycle: "2026-27",
  deliverables: [
    {
      key: "goals",
      kind: "essay",
      prompt:
        "What do you want to be doing five years after you graduate, and how will the Halvorsen MBA help you get there?",
      limit: "500 words",
      required: true,
    },
    {
      key: "shaped",
      kind: "essay",
      prompt:
        "Tell us about a time you changed how a group worked. What did you do, and what did you learn about yourself?",
      limit: "400 words",
      required: true,
    },
    {
      key: "optional",
      kind: "optional_essay",
      prompt: "Is there anything else you would like the admissions committee to know?",
      limit: "250 words",
      required: false,
    },
    {
      key: "activities",
      kind: "form_section",
      prompt: "Community involvement: up to 5 entries, role and time per month.",
      limit: "250 characters each",
      required: true,
    },
    {
      key: "interview_resume",
      kind: "interview_question",
      prompt: "Walk me through your resume.",
      limit: null,
      required: true,
    },
  ],
  is_reapplicant: false,
  recommenders: [
    { id: "R1", role: "Engineering manager", relationship: "His direct manager since 2022" },
    {
      id: "R2",
      role: "Product director",
      relationship: "Senior colleague on the scheduling module",
    },
  ],
  retrieval: HALVORSEN_RETRIEVAL,
};

export const KB_NORMALIZE_OFFICIAL_INPUT: TaskInput<"kb.normalize"> = {
  school: "Halvorsen School of Management",
  cycle: "2026-27",
  source: {
    type: "official",
    title: "Halvorsen admissions: deadlines 2026-27",
    url: "https://www.halvorsen.example/admissions/deadlines",
    trust: 5,
    text: [
      "Application deadlines for the class entering in 2027.",
      "Round 1: applications due 16 September 2026; decisions released 10 December 2026.",
      "Round 2: applications due 13 January 2027; decisions released 24 March 2027.",
      "Round 3: applications due 7 April 2027; decisions released 19 May 2027.",
    ].join("\n"),
  },
  current_pack: JSON.stringify({
    rounds: [
      { id: "K01", name: "R1", deadline: "2026-09-16", decision_date: "2026-12-10" },
      { id: "K02", name: "R2", deadline: "2027-01-06", decision_date: "2027-03-24" },
      { id: "K04", name: "R3", deadline: "2027-04-07", decision_date: "2027-05-19" },
    ],
  }),
};

/** Third-party notes (§9.6): the first synthetic reply copies them and the repair rewrites. */
export const KB_NORMALIZE_THIRD_PARTY_INPUT: TaskInput<"kb.normalize"> = {
  school: "Halvorsen School of Management",
  cycle: "2026-27",
  source: {
    type: "third_party_reference",
    title: "Manu's notes from a paid applicant guide",
    url: null,
    trust: 2,
    text: "Halvorsen interviewers tend to probe how the applicant handled a disagreement with a manager, and they come back to it more than once in the same conversation.",
  },
  current_pack: "{}",
};

export const KB_REFRESH_CHECK_INPUT: TaskInput<"kb.refresh_check"> = {
  school: "Halvorsen School of Management",
  url: "https://www.halvorsen.example/admissions/deadlines",
  url_kind: "deadlines",
  old_text: [
    "Round 1: applications due 16 September 2026.",
    "Round 2: applications due 6 January 2027.",
    "Round 3: applications due 7 April 2027.",
    "Questions? Contact admissions.",
  ].join("\n"),
  new_text: [
    "Round 1: applications due 16 September 2026.",
    "Round 2: applications due 13 January 2027.",
    "Round 3: applications due 7 April 2027.",
    "Questions? Visit our new help centre.",
  ].join("\n"),
  allowed_domains: ["www.halvorsen.example"],
};

/** The layers each sample runs with. */
export const PACK_CTX: RunContext = { schoolPack: HALVORSEN_PACK };
export const DOSSIER_CTX: RunContext = { dossier: ENGINEER_DOSSIER };
export const KIT_CTX: RunContext = { schoolPack: HALVORSEN_PACK, dossier: ENGINEER_DOSSIER };
