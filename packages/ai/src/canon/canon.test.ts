import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CANON_DIR, loadCanon, normalizeRuleId } from "./index";

const canon = loadCanon();
const allRules = canon.docs.flatMap((doc) => doc.rules);
const prefixOf = (id: string) => id.slice(0, id.indexOf("-"));

const EXPECTED: Record<string, { file: string; count: number }> = {
  ARCH: { file: "prompt-archetypes", count: 16 },
  CRAFT: { file: "story-craft", count: 23 },
  DEC: { file: "decisions", count: 4 },
  FILE: { file: "file-strategy", count: 10 },
  FLAG: { file: "red-flags", count: 11 },
  FORM: { file: "forms", count: 6 },
  GOAL: { file: "career-vision", count: 11 },
  INT: { file: "interview", count: 10 },
  LENS: { file: "admissions-lens", count: 9 },
  LOR: { file: "lor", count: 10 },
  RES: { file: "resume", count: 6 },
  STU: { file: "studio-interviewing", count: 7 },
  TELL: { file: "anti-ai-tells", count: 3 },
  TRUTH: { file: "truth-discipline", count: 8 },
  WHY: { file: "why-mba", count: 5 },
};

describe("canon v1 (spec Appendix A)", () => {
  it("loads the default directory regardless of cwd", () => {
    expect(CANON_DIR.endsWith(join("knowledge", "canon"))).toBe(true);
  });

  it("has exactly the 15 Appendix A files, all at version 1", () => {
    expect(canon.docs.map((doc) => doc.slug).sort()).toEqual([
      "admissions-lens",
      "anti-ai-tells",
      "career-vision",
      "decisions",
      "file-strategy",
      "forms",
      "interview",
      "lor",
      "prompt-archetypes",
      "red-flags",
      "resume",
      "story-craft",
      "studio-interviewing",
      "truth-discipline",
      "why-mba",
    ]);
    for (const doc of canon.docs) expect(doc.version).toBe(1);
    expect(canon.getDoc("admissions-lens").title).toBe("How admissions readers think");
  });

  it("has the expected rule count per prefix, each prefix in its own file", () => {
    const counts: Record<string, number> = {};
    for (const rule of allRules) {
      const prefix = prefixOf(rule.id);
      counts[prefix] = (counts[prefix] ?? 0) + 1;
      expect(rule.slug, rule.id).toBe(EXPECTED[prefix]?.file);
    }
    expect(counts).toEqual(
      Object.fromEntries(Object.entries(EXPECTED).map(([p, e]) => [p, e.count])),
    );
    expect(allRules).toHaveLength(139);
  });

  it("has unique IDs and contiguous numbering", () => {
    const ids = allRules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const [prefix, { count }] of Object.entries(EXPECTED)) {
      const numbered = ids.filter((id) => prefixOf(id) === prefix && /-\d+$/.test(id));
      if (prefix === "ARCH") {
        expect(numbered).toEqual([]);
        continue;
      }
      const expected = Array.from(
        { length: count },
        (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`,
      );
      expect(numbered).toEqual(expected);
    }
  });

  it("parses table rows, word IDs and bold-led bullets", () => {
    const flag = canon.getRule("FLAG-07").text;
    expect(flag).toBe(
      "Test score or GPA below the school's range — Brief factual context only if real; point to other quantitative evidence; consider a retake if time allows",
    );
    expect(canon.getRule("ARCH-LIST").text).toBe(
      '**"N things about you".** Range across life; each item in its own tone; open and close personal; achievement items show value quietly; no essay repeats.',
    );
    expect(
      canon.getRule("ARCH-GOALS").text.startsWith("**Career goals / why MBA.** Tests realism"),
    ).toBe(true);
    expect(canon.getRule("CRAFT-03").text).toBe(
      "**Dramatise, don't label.** Don't write \"I realised I had been wrong.\" Stage the moment so the reader gets there one beat before the applicant says it.",
    );
    expect(canon.getRule("LENS-01").text).toBe(
      "Readers move fast and screen risk against reward. Every component either removes a doubt or adds evidence.",
    );
  });

  it("keeps non-rule prose in the body without parsing it as rules", () => {
    const craft = canon.getDoc("story-craft");
    expect(craft.rules).toHaveLength(23);
    expect(craft.rules.some((rule) => rule.text.includes("Nobody had asked her anything"))).toBe(
      false,
    );
    expect(craft.body).toContain("| Generic | Better |");
    expect(craft.body).toContain(
      '"She had been on the call for forty minutes. Nobody had asked her anything. Neither had I."',
    );
    expect(craft.body).toContain("Openings that work: one sentence, concrete, unanswerable");
    expect(
      craft.body.endsWith("If it makes the reader re-read the opening differently, it is."),
    ).toBe(true);

    const flags = canon.getDoc("red-flags");
    expect(flags.body.startsWith("Never leave a doubt unaddressed")).toBe(true);
    expect(flags.body).toContain("Structure for addressing a flag directly");
    expect(flags.rules.every((rule) => !rule.text.includes("Structure for addressing"))).toBe(true);
  });

  it("keeps the TELL-01 banned phrase list intact", () => {
    const tell = canon.getRule("TELL-01").text;
    for (const phrase of [
      "leverage/leveraged/leveraging",
      "spearhead(ed)",
      "delve",
      "tapestry",
      "dynamic environment",
    ]) {
      expect(tell).toContain(phrase);
    }
    expect(tell.endsWith("holistic, dynamic environment.")).toBe(true);
  });
});

describe("normalizeRuleId", () => {
  it.each([
    ["CRAFT-3", "CRAFT-03"],
    ["craft-07", "CRAFT-07"],
    ["CRAFT-07", "CRAFT-07"],
    [" lens-1 ", "LENS-01"],
    ["CRAFT-007", "CRAFT-07"],
    ["ARCH-GOALS", "ARCH-GOALS"],
    ["arch-why-school", "ARCH-WHY-SCHOOL"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeRuleId(input)).toBe(expected);
  });

  it.each(["", "CRAFT", "CRAFT-", "CRAFT-0", "-07", "CRAFT_07", "CRAFT-7a", "CRAFT 07", "12-03"])(
    "rejects %j",
    (input) => {
      expect(() => normalizeRuleId(input)).toThrow(/Invalid canon rule ID/);
    },
  );
});

describe("library lookups", () => {
  it("normalizes rule refs and throws on unknown keys", () => {
    expect(canon.getRule("CRAFT-3").id).toBe("CRAFT-03");
    expect(() => canon.getRule("CRAFT-99")).toThrow(/Unknown canon rule/);
    expect(() => canon.getRule("not a rule")).toThrow(/Invalid canon rule ID/);
    expect(() => canon.getDoc("nope")).toThrow(/Unknown canon file/);
  });
});

describe("compile", () => {
  it("returns empty output for an empty selector", () => {
    const out = canon.compile({});
    expect(out.text).toBe("");
    expect(out.ruleIds).toEqual([]);
  });

  it("is deterministic and orders rules canonically", () => {
    const a = canon.compile({ rules: ["CRAFT-3", "LENS-02", "CRAFT-01", "TELL-01"] });
    const b = canon.compile({ rules: ["TELL-01", "craft-01", "LENS-2", "CRAFT-03"] });
    expect(a.text).toBe(b.text);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.ruleIds).toEqual(["LENS-02", "TELL-01", "CRAFT-01", "CRAFT-03"]);
    expect(canon.compile({ rules: ["CRAFT-3", "LENS-02", "CRAFT-01", "TELL-01"] }).hash).toBe(
      a.hash,
    );
  });

  it("renders whole files in the order given, then rule groups", () => {
    const out = canon.compile({ files: ["why-mba", "admissions-lens"], rules: ["FLAG-02"] });
    expect(
      out.text.startsWith("## Why an MBA, why now, why here (why-mba v1)\n\n- **WHY-01**"),
    ).toBe(true);
    const lensAt = out.text.indexOf("## How admissions readers think (admissions-lens v1)");
    const flagAt = out.text.indexOf(
      "## Common doubts and how to address them (red-flags v1)\n\n- **FLAG-02** No formal management title — ",
    );
    expect(lensAt).toBeGreaterThan(0);
    expect(flagAt).toBeGreaterThan(lensAt);
    expect(out.ruleIds).toEqual([
      "WHY-01",
      "WHY-02",
      "WHY-03",
      "WHY-04",
      "WHY-05",
      ...canon.getDoc("admissions-lens").rules.map((r) => r.id),
      "FLAG-02",
    ]);
    expect(out.text).not.toMatch(/[ \t]+$/m);
    expect(out.text).not.toMatch(/\n{3,}/);
    expect(out.text.endsWith("\n")).toBe(false);
  });

  it("does not repeat a rule already included by its whole file", () => {
    const withRule = canon.compile({ files: ["story-craft"], rules: ["CRAFT-07"] });
    const fileOnly = canon.compile({ files: ["story-craft"] });
    expect(withRule.text).toBe(fileOnly.text);
    expect(withRule.ruleIds.filter((id) => id === "CRAFT-07")).toHaveLength(1);
    expect(withRule.text.match(/\*\*CRAFT-07\*\*/g)).toHaveLength(1);
  });

  it("throws on unknown files or rules", () => {
    expect(() => canon.compile({ files: ["story-craft", "missing"] })).toThrow(
      /Unknown canon file "missing"/,
    );
    expect(() => canon.compile({ rules: ["CRAFT-40"] })).toThrow(/Unknown canon rule/);
  });
});

describe("load-time validation", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const write = (files: Record<string, string>) => {
    dir = mkdtempSync(join(tmpdir(), "canon-"));
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return dir;
  };
  const doc = (slug: string, body: string, title = "Test") =>
    `---\nslug: ${slug}\ntitle: ${title}\nversion: 1\n---\n\n# ${title}\n\n${body}\n`;

  it("loads a well-formed directory", () => {
    const lib = loadCanon(
      write({
        "a.md": doc(
          "a",
          "Intro.\n\n- **AAA-01** First.\n\n| ID | X |\n|---|---|\n| AAA-02 | Two | Cells |",
        ),
      }),
    );
    expect(lib.getDoc("a").rules).toEqual([
      { id: "AAA-01", slug: "a", text: "First." },
      { id: "AAA-02", slug: "a", text: "Two — Cells" },
    ]);
  });

  it("throws on duplicate IDs across files", () => {
    const path = write({
      "a.md": doc("a", "- **AAA-01** One."),
      "b.md": doc("b", "| AAA-01 | Again |"),
    });
    expect(() => loadCanon(path)).toThrow(/Duplicate canon rule ID AAA-01 in a\.md and b\.md/);
  });

  it.each([
    ["unpadded", "- **AAA-1** One."],
    ["lowercase", "- **aaa-01** One."],
    ["table cell", "| AAA-1 | One |"],
    ["word with digit", "- **ARCH-GOALS2 — Goals.** Text."],
  ])("throws on a malformed ID (%s)", (_label, body) => {
    expect(() => loadCanon(write({ "a.md": doc("a", body) }))).toThrow(/a\.md: malformed rule ID/);
  });

  it.each([
    ["missing front matter", "# Test\n\nBody\n"],
    ["unclosed front matter", "---\nslug: a\ntitle: Test\nversion: 1\n# Test\n"],
    ["missing title", "---\nslug: a\nversion: 1\n---\n\n# Test\n"],
    ["bad version", "---\nslug: a\ntitle: Test\nversion: one\n---\n\n# Test\n"],
    ["unknown key", "---\nslug: a\ntitle: Test\nversion: 1\nauthor: x\n---\n\n# Test\n"],
    ["slug mismatch", "---\nslug: b\ntitle: Test\nversion: 1\n---\n\n# Test\n"],
    ["heading mismatch", "---\nslug: a\ntitle: Test\nversion: 1\n---\n\n# Other\n"],
  ])("throws with the file name on bad front matter (%s)", (_label, content) => {
    expect(() => loadCanon(write({ "a.md": content }))).toThrow(/Canon file a\.md/);
  });
});
