import "server-only";

import type { BriefMeta, BriefSection, LorBrief } from "@admitstory/shared/kit";
import { briefSections } from "@admitstory/shared/kit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// A brief as something to hand over (Phase 6 plan §6, §8): a PDF to attach, or the same words as
// plain text to paste into an email. Both are made on demand and never stored.
//
// Both are written for the recommender (`briefSections(…, "recommender")`): no cite codes, no
// story codes, no applicant-only dates. The questions are verbatim, from code, and neither export
// has anywhere to put letter prose.

export type BriefExportFormat = "pdf" | "text";

/** One flat list of lines, so the PDF and the email text say exactly the same thing. */
interface Line {
  text: string;
  style: "title" | "heading" | "body" | "quote" | "bullet" | "small";
}

const dateWords = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
};

function sectionLines(section: BriefSection): Line[] {
  const lines: Line[] = [{ text: section.heading, style: "heading" }];
  switch (section.kind) {
    case "note":
    case "reminder":
      lines.push({ text: section.text, style: section.kind === "note" ? "quote" : "body" });
      break;
    case "explainer":
      for (const bullet of section.bullets) lines.push({ text: bullet, style: "bullet" });
      break;
    case "school": {
      if (section.deadline)
        lines.push({ text: `Deadline: ${dateWords(section.deadline)}`, style: "small" });
      lines.push({ text: `How to submit: ${section.howToSubmit}`, style: "small" });
      for (const note of section.packNotes) lines.push({ text: note, style: "small" });
      for (const question of section.questions) {
        lines.push({
          text: question.limit ? `${question.text} (${question.limit})` : question.text,
          style: "quote",
        });
        for (const point of question.points) {
          lines.push({ text: point.point, style: "bullet" });
          const evidence = [point.evidence, point.trait ? `Shows: ${point.trait}` : ""]
            .filter(Boolean)
            .join(" · ");
          if (evidence) lines.push({ text: evidence, style: "small" });
        }
      }
      break;
    }
    case "traits":
      for (const item of section.items)
        lines.push({ text: `${item.trait}: ${item.why}`, style: "bullet" });
      break;
    case "covers":
      for (const item of section.items) lines.push({ text: item, style: "bullet" });
      break;
    case "arc":
      for (const step of section.steps)
        lines.push({ text: `${step.label}: ${step.text}`, style: "bullet" });
      break;
    case "facts":
      for (const item of section.items) lines.push({ text: item.text, style: "bullet" });
      break;
    case "timeline":
      for (const item of section.items)
        lines.push({ text: `${dateWords(item.date)} — ${item.text}`, style: "bullet" });
      break;
  }
  return lines;
}

function briefLines(brief: LorBrief, meta: BriefMeta): Line[] {
  const name = meta.recommender.name;
  return [
    { text: `A brief for ${name}`, style: "title" },
    { text: `From ${meta.applicant.name}`, style: "small" },
    ...briefSections(brief, meta, "recommender").flatMap(sectionLines),
  ];
}

/** "Copy email text": the brief as plain text, ready to paste into a message. */
export function briefText(brief: LorBrief, meta: BriefMeta): string {
  const blocks = briefLines(brief, meta).map((line) => {
    switch (line.style) {
      case "title":
        return `${line.text}\n${"=".repeat(Math.min(line.text.length, 72))}`;
      case "heading":
        return `\n${line.text.toUpperCase()}`;
      case "bullet":
        return `- ${line.text}`;
      case "quote":
        return `"${line.text}"`;
      default:
        return line.text;
    }
  });
  return `${blocks.join("\n")}\n`;
}

/* The PDF ------------------------------------------------------------------------------------- */

const SIZES: Record<Line["style"], number> = {
  title: 17,
  heading: 12.5,
  body: 11,
  quote: 11.5,
  bullet: 11,
  small: 9.5,
};

function latin1(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export async function briefPdf(brief: LorBrief, meta: BriefMeta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`A brief for ${meta.recommender.name}`);
  pdf.setAuthor(meta.applicant.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const [W, H, M] = [595.28, 841.89, 64];
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const footer = (target: typeof page) => {
    target.drawText(latin1("The words of the letter are yours."), {
      x: M,
      y: 36,
      size: 8,
      font,
      color: rgb(0.42, 0.42, 0.42),
    });
  };
  footer(page);

  for (const line of briefLines(brief, meta)) {
    const size = SIZES[line.style];
    const face =
      line.style === "title" || line.style === "heading"
        ? bold
        : line.style === "quote"
          ? italic
          : font;
    const indent = line.style === "bullet" ? 14 : 0;
    const text = line.style === "bullet" ? `- ${line.text}` : line.text;
    if (line.style === "heading") y -= 8;
    for (const wrapped of wrap(latin1(text), W - M * 2 - indent, (s) =>
      face.widthOfTextAtSize(s, size),
    )) {
      if (y < M + size) {
        page = pdf.addPage([W, H]);
        footer(page);
        y = H - M;
      }
      page.drawText(wrapped, {
        x: M + indent,
        y,
        size,
        font: face,
        color: line.style === "small" ? rgb(0.38, 0.38, 0.38) : rgb(0.09, 0.09, 0.09),
      });
      y -= size * 1.45;
    }
    y -= line.style === "title" ? 10 : 4;
  }
  return pdf.save();
}

/** A file name a recommender can recognise in their downloads: "brief-for-ravi-menon.pdf". */
export function briefFileName(meta: BriefMeta, format: BriefExportFormat): string {
  const slug =
    meta.recommender.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "recommender";
  return `brief-for-${slug}.${format === "pdf" ? "pdf" : "txt"}`;
}
