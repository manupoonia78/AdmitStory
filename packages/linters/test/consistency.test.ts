import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkConsistency } from "../src/consistency/check";
import { findDates, normaliseMonth, sameDate } from "../src/consistency/dates";
import { readNumber } from "../src/consistency/numbers";
import { findTeamClaims } from "../src/consistency/team";
import type {
  ConsistencyDoc,
  ConsistencyFinding,
  ConsistencyInput,
  ConsistencyRole,
  ConsistencySubject,
} from "../src/consistency/types";
import type { FactRef } from "../src/types";

// Seeded mismatches over the twelve fictional applicants (spec §5.10 AC: "consistency check
// catches seeded mismatches in fixtures"). Every name, employer and number is invented.

interface Seed {
  id: string;
  subject: ConsistencySubject;
  doc_id: string;
  ref: string;
  from: string;
  to: string;
  note: string;
}

interface Fixture {
  applicant: string;
  facts: FactRef[];
  roles: ConsistencyRole[];
  clean: ConsistencyDoc[];
  seeded: Seed[];
}

const DIR = join(__dirname, "../../../fixtures/consistency");
const FIXTURES: Fixture[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Fixture);

function replaceOnce(text: string, from: string, to: string, where: string): string {
  const at = text.indexOf(from);
  if (at === -1 || text.indexOf(from, at + 1) !== -1)
    throw new Error(`${where}: "${from}" must occur exactly once`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** The fixture's clean input with the given seeds applied, each a single substitution. */
function seededInput(fx: Fixture, seeds: readonly Seed[]): ConsistencyInput {
  const docs: ConsistencyDoc[] = structuredClone(fx.clean);
  const roles: ConsistencyRole[] = structuredClone(fx.roles);
  for (const seed of seeds) {
    const field = /^(r\d+)\.(title|dates|organisation)$/u.exec(seed.ref);
    const doc = docs.find((d) => d.id === seed.doc_id);
    if (field && doc?.kind === "resume") {
      const role = roles.find((r) => r.ref === field[1]);
      const key = field[2] as "title" | "dates" | "organisation";
      if (!role) throw new Error(`${seed.id}: no role ${field[1]}`);
      role[key] = replaceOnce(role[key] ?? "", seed.from, seed.to, seed.id);
      continue;
    }
    const segment = doc?.segments.find((s) => s.ref === seed.ref);
    if (!segment) throw new Error(`${seed.id}: no segment ${seed.doc_id}/${seed.ref}`);
    segment.text = replaceOnce(segment.text, seed.from, seed.to, seed.id);
  }
  return { facts: fx.facts, roles, docs };
}

const caught = (findings: readonly ConsistencyFinding[], seed: Seed) =>
  findings.some(
    (f) =>
      f.subject === seed.subject &&
      f.values.some((v) => v.docId === seed.doc_id && v.ref === seed.ref),
  );

const describeFindings = (findings: readonly ConsistencyFinding[]) =>
  findings.map((f) => `${f.subject}: ${f.explanation}`).join("\n");

describe("consistency fixtures", () => {
  it("covers all twelve applicants, every subject eight times or more, every document kind", () => {
    expect(FIXTURES).toHaveLength(12);
    const seeds = FIXTURES.flatMap((fx) => fx.seeded);
    for (const fx of FIXTURES) expect(fx.seeded.length).toBeGreaterThanOrEqual(4);
    const bySubject = new Map<string, number>();
    for (const s of seeds) bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + 1);
    for (const subject of ["employer", "title", "date", "team_size", "number"])
      expect(bySubject.get(subject) ?? 0).toBeGreaterThanOrEqual(8);
    const kinds = new Set(
      FIXTURES.flatMap((fx) => fx.seeded.map((s) => fx.clean.find((d) => d.id === s.doc_id)?.kind)),
    );
    expect([...kinds].sort()).toEqual(["brief", "essay", "form", "resume"]);
  });

  describe.each(FIXTURES.map((fx) => [fx.applicant, fx] as const))("%s", (_, fx) => {
    it("finds nothing in the clean documents", () => {
      const findings = checkConsistency({ facts: fx.facts, roles: fx.roles, docs: fx.clean });
      expect(describeFindings(findings)).toBe("");
    });

    it.each(fx.seeded.map((s) => [s.id, s] as const))("catches %s alone", (_, seed) => {
      const findings = checkConsistency(seededInput(fx, [seed]));
      expect(caught(findings, seed), `${seed.note}\n${describeFindings(findings)}`).toBe(true);
    });

    it("catches every seed when all are applied together", () => {
      const findings = checkConsistency(seededInput(fx, fx.seeded));
      const missed = fx.seeded.filter((s) => !caught(findings, s)).map((s) => s.id);
      expect(missed).toEqual([]);
    });
  });

  it("catches 100% of the seeded mismatches with no false positives", () => {
    const seeds = FIXTURES.flatMap((fx) => fx.seeded.map((s) => ({ fx, s })));
    const hits = seeds.filter(({ fx, s }) => caught(checkConsistency(seededInput(fx, [s])), s));
    const falsePositives = FIXTURES.reduce(
      (n, fx) => n + checkConsistency({ facts: fx.facts, roles: fx.roles, docs: fx.clean }).length,
      0,
    );
    const rate = hits.length / seeds.length;
    console.info(
      `consistency: caught ${hits.length}/${seeds.length} seeded mismatches (${(rate * 100).toFixed(1)}%), ${falsePositives} false positives on clean documents`,
    );
    expect(rate).toBe(1);
    expect(falsePositives).toBe(0);
  });
});

/* Units ------------------------------------------------------------------------------------------ */

const FACTS: FactRef[] = [
  {
    code: "F01",
    key: "employer_current",
    value: "Meridian Health Systems",
    approvedPhrasing: null,
  },
  { code: "F02", key: "title_current", value: "Senior Software Engineer", approvedPhrasing: null },
  {
    code: "F03",
    key: "team_size",
    value: "13",
    approvedPhrasing: "I lead a 13-person engineering team.",
  },
];

const essay = (id: string, ...texts: string[]): ConsistencyDoc => ({
  id,
  kind: "essay",
  label: id === "essay-1" ? "Essay 1" : "Essay 2",
  segments: texts.map((text, i) => ({ ref: `p${i + 1}`, text })),
});

describe("number and date normalisation", () => {
  it('reads "thirteen" as 13 in a team size', () => {
    const [claim] = findTeamClaims("I lead a team of thirteen engineers.");
    expect(claim?.value).toBe(13);
    expect(findTeamClaims("I manage twenty-two people across two shifts.")[0]?.value).toBe(22);
  });

  it('reads "$1.2M" as "$1,200,000"', () => {
    expect(readNumber("$1.2M")).toEqual(readNumber("$1,200,000"));
    expect(readNumber("$1.2M")?.value).toBe(1_200_000);
  });

  it("normalises month names and abbreviations", () => {
    expect(normaliseMonth("Apr")).toBe(4);
    expect(normaliseMonth("April")).toBe(4);
    expect(normaliseMonth("sept.")).toBe(9);
    expect(normaliseMonth("Tuesday")).toBeNull();
    const [range] = findDates("Apr 2024 – Present");
    const [since] = findDates("since April 2024");
    expect(range?.kind).toBe("range");
    expect(range?.to?.value).toBe("present");
    expect(since?.kind).toBe("since");
    expect(range && since && sameDate(range.from.value, since.from.value)).toBe(true);
    const [to] = findDates("July 2020 to March 2024");
    expect(to?.from.value).toEqual({ y: 2020, m: 7 });
    expect(to?.to?.value).toEqual({ y: 2024, m: 3 });
    expect(findDates("2021—2024")[0]?.to?.value).toEqual({ y: 2024, m: null });
  });
});

describe("checkConsistency", () => {
  it("does not flag a possessive or a change of case", () => {
    const findings = checkConsistency({
      facts: FACTS,
      docs: [
        essay(
          "essay-1",
          "Meridian Health Systems' scheduling platform failed at 2 a.m.",
          "I stayed until MERIDIAN HEALTH SYSTEMS had its results back.",
        ),
      ],
    });
    expect(findings).toEqual([]);
  });

  it("flags a short employer name against the Fact Sheet, Fact Sheet first", () => {
    const [f] = checkConsistency({
      facts: FACTS,
      docs: [
        {
          id: "resume",
          kind: "resume",
          label: "Resume",
          segments: [
            { ref: "b1", text: "Led the go-live at Meridian Health for a 900-bed hospital." },
          ],
        },
      ],
    });
    expect(f?.subject).toBe("employer");
    expect(f?.values[0]?.docKind).toBe("fact_sheet");
    expect(f?.values[0]?.ref).toBe("F01");
    expect(f?.values[1]?.said).toBe("Meridian Health");
    expect(f?.expected).toBe("Meridian Health Systems");
    expect(f?.explanation).toBe(
      'Your resume says "Meridian Health"; your Fact Sheet says "Meridian Health Systems".',
    );
    expect(f?.fix_hint).toBe('Use "Meridian Health Systems" everywhere.');
    expect(f?.severity).toBe("must");
    expect(f?.rule_id).toBe("consistency.employer");
  });

  it("does not flag a different, unrelated company", () => {
    const findings = checkConsistency({
      facts: FACTS,
      docs: [
        essay(
          "essay-1",
          "Before Meridian Health Systems, I interned at Apollo Hospitals in Chennai.",
        ),
      ],
    });
    expect(findings).toEqual([]);
  });

  it("ignores other people's titles", () => {
    const findings = checkConsistency({
      facts: FACTS,
      docs: [
        essay(
          "essay-1",
          "My manager, a Senior Director, was on a flight. Her director was promoted to Vice President the next year.",
          "As a Senior Software Engineer I called the vendor myself.",
        ),
      ],
    });
    expect(findings).toEqual([]);
  });

  it("flags a title the applicant gives themselves that the Fact Sheet doesn't", () => {
    const [f] = checkConsistency({
      facts: FACTS,
      docs: [essay("essay-1", "In 2024 I was promoted to Lead Software Engineer.")],
    });
    expect(f?.subject).toBe("title");
    expect(f?.what).toBe("Your title at Meridian Health Systems");
    expect(f?.values.map((v) => v.said)).toEqual([
      "Senior Software Engineer",
      "Lead Software Engineer",
    ]);
    expect(f?.expected).toBe("Senior Software Engineer");
  });

  it("puts the canonical team size in `expected` when the phrasing is a sentence", () => {
    const [f] = checkConsistency({
      facts: FACTS,
      docs: [essay("essay-1", "I led a team of fifteen engineers through the go-live.")],
    });
    expect(f?.subject).toBe("team_size");
    expect(f?.expected).toBe("13");
    expect(f?.values[0]?.docId).toBe("fact_sheet");
    expect(f?.values[1]?.said).toBe("fifteen");
  });

  it("compares documents with each other when the Fact Sheet is silent", () => {
    const docs = [
      essay("essay-1", "We cut onboarding time by 30% across the network."),
      essay("essay-2", "The new checklist cut onboarding time by 35% across the network."),
    ];
    const [f] = checkConsistency({ facts: [], docs });
    expect(f?.subject).toBe("number");
    expect(f?.expected).toBeNull();
    expect(f?.values.map((v) => v.said)).toEqual(["30%", "35%"]);
    expect(f?.explanation).toBe('Essay 1 says "30%"; Essay 2 says "35%".');
  });

  it("treats 50+ and 52 as the same, 50+ and 40 as different", () => {
    const run = (a: string, b: string) =>
      checkConsistency({
        facts: [],
        docs: [
          essay("essay-1", `Our platform now serves ${a} hospitals across India.`),
          essay("essay-2", `The platform serves ${b} hospitals across India today.`),
        ],
      });
    expect(run("50+", "52")).toEqual([]);
    expect(run("50+", "40")).toHaveLength(1);
  });

  it("gives the same ids whatever the order of the documents", () => {
    const docs = [
      essay("essay-1", "I joined Meridian Health in 2020 and led a team of 15 engineers."),
      essay("essay-2", "We cut onboarding time by 30% across the network."),
      {
        id: "form:jobs",
        kind: "form" as const,
        label: "Form: Employment history",
        segments: [{ ref: "jobs/i1", text: "Cut onboarding time by 35% across the network." }],
      },
    ];
    const a = checkConsistency({ facts: FACTS, docs });
    const b = checkConsistency({ facts: FACTS, docs: [...docs].reverse() });
    expect(a.length).toBeGreaterThan(2);
    expect(b.map((f) => f.id)).toEqual(a.map((f) => f.id));
    expect(b).toEqual(a);
  });

  it("leaves out dismissed findings", () => {
    const docs = [essay("essay-1", "I led a team of fifteen engineers at Meridian Health.")];
    const all = checkConsistency({ facts: FACTS, docs });
    expect(all.length).toBe(2);
    const first = all[0];
    if (!first) throw new Error("expected a finding");
    const rest = checkConsistency({ facts: FACTS, docs, dismissed: new Set([first.id]) });
    expect(rest.map((f) => f.id)).toEqual(all.slice(1).map((f) => f.id));
  });

  it("sorts by subject, then what is compared", () => {
    const docs = [essay("essay-1", "I led a team of fifteen engineers at Meridian Health.")];
    expect(checkConsistency({ facts: FACTS, docs }).map((f) => f.subject)).toEqual([
      "employer",
      "team_size",
    ]);
  });
});
