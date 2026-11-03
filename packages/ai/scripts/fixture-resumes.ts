// Generates `resume.pdf` for the fixtures the import path is run against (spec Appendix J).
//
//   pnpm --filter @admitstory/ai fixtures:resumes
//
// The PDF is written by hand rather than with a library: it only has to be a text-based PDF that
// `unpdf` can extract, and a dependency that exists solely to build three test files is not worth
// carrying. Everything in it comes from the fixture's own ground truth, so the facts the importer
// finds are checkable against it.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applicantsDir, loadApplicant } from "../src/fixtures";

/** The fixtures whose resumes the import runs use. */
const WITH_RESUMES = ["engineer-to-product", "consultant-to-pe", "nine-year-generalist"];

const PAGE_WIDTH = 595; // A4 at 72 dpi
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const LEADING = 14;

interface Line {
  text: string;
  bold?: boolean;
  size?: number;
  spaceBefore?: number;
}

/** PDF string escaping, and ASCII only: WinAnsi would need an encoding table for anything else. */
function pdfString(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\()]/g, (match) => `\\${match}`);
}

function wrap(text: string, chars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") line = word;
    else if (`${line} ${word}`.length <= chars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function buildPdf(lines: readonly Line[]): Uint8Array {
  const content: string[] = ["BT"];
  let y = PAGE_HEIGHT - MARGIN;
  let currentFont = "";
  for (const line of lines) {
    y -= line.spaceBefore ?? 0;
    const size = line.size ?? 10;
    const font = `/${line.bold ? "F2" : "F1"} ${size} Tf`;
    if (font !== currentFont) {
      content.push(font);
      currentFont = font;
    }
    content.push(`1 0 0 1 ${MARGIN} ${y} Tm (${pdfString(line.text)}) Tj`);
    y -= LEADING;
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

function resumeLines(slug: string): Line[] {
  const fixture = loadApplicant(slug);
  const facts = new Map(fixture.groundTruth.facts.map((fact) => [fact.key, fact] as const));
  const get = (key: string) => facts.get(key)?.value ?? "";

  // A fictional name per fixture, built from the slug so it is stable and obviously synthetic.
  const name = slug
    .split("-")
    .filter((part) => part !== "to")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const lines: Line[] = [
    { text: name, bold: true, size: 18 },
    {
      text: `${get("location_current")} | ${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    },
    { text: "SYNTHETIC FIXTURE - not a real person", size: 8 },
    { text: "EXPERIENCE", bold: true, size: 12, spaceBefore: 18 },
  ];

  const employer = get("employer_current");
  for (const key of ["title_current", "title_previous"]) {
    const fact = facts.get(key);
    if (!fact) continue;
    lines.push({ text: `${fact.value}, ${employer}`, bold: true, spaceBefore: 8 });
    if (fact.note) lines.push({ text: fact.note, size: 9 });
  }

  // Achievements, as a resume states them: the result and its numbers, not the whole story.
  for (const story of fixture.groundTruth.stories.filter(
    (candidate) => candidate.context === "professional",
  )) {
    const numbers = story.numbers.map((entry) => `${entry.label} ${entry.value}`).join("; ");
    for (const line of wrap(`- ${story.result}${numbers === "" ? "" : ` (${numbers})`}`, 88))
      lines.push({ text: line, size: 9 });
  }

  lines.push({ text: "EDUCATION", bold: true, size: 12, spaceBefore: 18 });
  for (const key of ["degree", "gpa"]) {
    const value = get(key);
    if (value !== "") lines.push({ text: value, size: 9 });
  }

  lines.push({ text: "ADDITIONAL", bold: true, size: 12, spaceBefore: 18 });
  for (const key of ["languages", "gmat_total", "ea_total", "side_project"]) {
    const fact = facts.get(key);
    if (!fact) continue;
    for (const line of wrap(`${fact.value}${fact.note ? ` (${fact.note})` : ""}`, 88))
      lines.push({ text: line, size: 9 });
  }

  return lines;
}

let written = 0;
for (const slug of WITH_RESUMES) {
  try {
    const dir = join(applicantsDir(), slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "resume.pdf"), buildPdf(resumeLines(slug)));
    console.log(`wrote fixtures/applicants/${slug}/resume.pdf`);
    written += 1;
  } catch (error) {
    console.error(`skipped ${slug}: ${(error as Error).message}`);
  }
}
console.log(`\n${written} of ${WITH_RESUMES.length} resumes written.`);
