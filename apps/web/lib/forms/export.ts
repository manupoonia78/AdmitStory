import "server-only";

import { bulletText, normalizeForPortal, orderedSections } from "@admitstory/linters";
import type { BulletDecision, ResumeReview } from "@admitstory/shared/kit";
import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";

// The MBA-résumé export (spec §5.10, canon RES-01): one column, standard headings, real bullet
// lists, a common font and no tables, text boxes, images or header/footer content, so applicant
// tracking systems read it in order. Made on demand from the review and the applicant's decisions
// (the same bulletText the page shows), streamed back, stored nowhere.

const FONT = "Calibri";
/** Half-points: 10.5 pt body, 11 pt headings, 16 pt name (the layout the page estimate assumes). */
const SIZE = { body: 21, heading: 22, name: 32 } as const;
/** Twips: 0.6 in margins; a right tab at the text edge for dates. */
const MARGIN = 864;
const TEXT_EDGE = 12_240 - 2 * MARGIN;

const plain = (text: string) => normalizeForPortal(text).trim();
const run = (text: string, options: { bold?: boolean; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text: plain(text), font: FONT, size: options.size ?? SIZE.body, ...options });

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "808080", space: 1 } },
    // The heading as the applicant wrote it: their résumé, their conventions.
    children: [run(text, { bold: true, size: SIZE.heading })],
  });
}

export function resumeDocument(
  review: ResumeReview,
  decisions: Readonly<Record<string, BulletDecision>>,
  useSuggestedOrder: boolean,
): Document {
  const children: Paragraph[] = [];
  if (review.header.name)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run(review.header.name, { bold: true, size: SIZE.name })],
      }),
    );
  if (review.header.lines.length > 0)
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [run(review.header.lines.join(" | "))],
      }),
    );

  for (const section of orderedSections(review, useSuggestedOrder)) {
    children.push(heading(section.heading));
    for (const role of section.roles) {
      children.push(
        new Paragraph({
          spacing: { before: 100 },
          tabStops: [{ type: TabStopType.RIGHT, position: TEXT_EDGE }],
          children: [
            run(role.organisation, { bold: true }),
            ...(role.location ? [run(`, ${role.location}`)] : []),
            ...(role.dates ? [run(`\t${role.dates}`)] : []),
          ],
        }),
      );
      if (role.title)
        children.push(new Paragraph({ children: [run(role.title, { italics: true })] }));
      for (const bullet of role.bullets)
        children.push(
          new Paragraph({
            numbering: { reference: "resume-bullets", level: 0 },
            children: [run(bulletText(bullet, decisions[bullet.id]))],
          }),
        );
    }
    for (const line of section.lines) children.push(new Paragraph({ children: [run(line)] }));
  }

  return new Document({
    creator: review.header.name ?? "Applicant",
    title: review.header.name ? `${review.header.name} résumé` : "Résumé",
    styles: { default: { document: { run: { font: FONT, size: SIZE.body } } } },
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children,
      },
    ],
  });
}

export async function resumeDocx(
  review: ResumeReview,
  decisions: Readonly<Record<string, BulletDecision>>,
  useSuggestedOrder: boolean,
): Promise<Uint8Array> {
  return new Uint8Array(
    await Packer.toBuffer(resumeDocument(review, decisions, useSuggestedOrder)),
  );
}
