import "server-only";

import { countAfterNormalize, normalizeForPortal } from "@admitstory/linters";
import { Document, Header, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Exports (spec §5.8): "Copy for portal" text with the count checked on exactly what is copied, and
// DOCX or PDF made on demand and streamed back. Nothing is stored. Each file carries a quiet mark
// in its header: the applicant's name and "Written from your own words".

export type ExportFormat = "copy" | "docx" | "pdf";

export interface ExportInput {
  title: string;
  prompt: string;
  paragraphs: string[];
  /** The applicant's name for the header mark. */
  author: string;
  school: string;
  rule: { kind: "words" | "chars_incl_spaces" | "chars_excl_spaces"; value: number } | null;
}

export function portalCopy(input: ExportInput): { text: string; count: number; over: number } {
  const text = normalizeForPortal(input.paragraphs.join("\n\n"));
  const kind = input.rule?.kind ?? "words";
  const count = countAfterNormalize(text, kind);
  return { text, count, over: input.rule ? Math.max(0, count - input.rule.value) : 0 };
}

const mark = (input: ExportInput) =>
  `${input.author} · ${input.school} · Written from your own words`;

export async function toDocx(input: ExportInput): Promise<Uint8Array> {
  const doc = new Document({
    creator: input.author,
    title: input.title,
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: mark(input), size: 16, color: "6B6B6B" })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ children: [new TextRun({ text: input.title, bold: true, size: 28 })] }),
          new Paragraph({
            children: [new TextRun({ text: input.prompt, italics: true, size: 20 })],
          }),
          new Paragraph({ children: [] }),
          ...normalizeForPortal(input.paragraphs.join("\n\n"))
            .split("\n\n")
            .map(
              (p) =>
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun({ text: p, size: 24 })],
                }),
            ),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Helvetica in pdf-lib covers WinAnsi only; anything else becomes its closest plain form. */
function winAnsi(text: string): string {
  return normalizeForPortal(text)
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

export async function toPdf(input: ExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title);
  pdf.setAuthor(input.author);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M] = [595.28, 841.89, 64];
  const width = W - M * 2;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const header = () => {
    page.drawText(winAnsi(mark(input)), {
      x: M,
      y: H - 36,
      size: 8,
      font,
      color: rgb(0.42, 0.42, 0.42),
    });
  };
  header();
  const write = (text: string, size: number, f = font, gap = 6) => {
    for (const line of wrap(winAnsi(text), width, (s) => f.widthOfTextAtSize(s, size))) {
      if (y < M + size) {
        page = pdf.addPage([W, H]);
        header();
        y = H - M;
      }
      page.drawText(line, { x: M, y, size, font: f });
      y -= size * 1.45;
    }
    y -= gap;
  };
  write(input.title, 15, bold);
  write(input.prompt, 10, font, 14);
  for (const p of input.paragraphs) write(p, 11.5, font, 10);
  return pdf.save();
}
