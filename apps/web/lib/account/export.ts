import "server-only";

import { currentDraftsForExport, exportSections, getDb } from "@admitstory/db";
import { normalizeForPortal } from "@admitstory/linters";
import { APP_NAME } from "@admitstory/shared";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

// Settings › Privacy › Download (spec §11, §14.4, Phase 9b decision 14). Two files, made on request
// and never stored:
//  - "Your data (JSON)": every row the applicant owns, streamed one table at a time, so a large
//    account never has to fit in one buffered response.
//  - "Your drafts (Word)": the current draft of every deliverable, grouped by school.

const encoder = new TextEncoder();

/** A ReadableStream of one JSON object: `{ "exportedAt": …, "account": [...], "drafts": [...], … }`. */
export function dataExportStream(userId: string): ReadableStream<Uint8Array> {
  const sections = exportSections(getDb(), userId);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `{\n"exportedAt": ${JSON.stringify(new Date().toISOString())},\n"about": ${JSON.stringify(
            `Everything ${APP_NAME} holds for your account. Recommenders' own notes and letters are theirs and are not included.`,
          )}`,
        ),
      );
    },
    async pull(controller) {
      try {
        const next = await sections.next();
        if (next.done) {
          controller.enqueue(encoder.encode("\n}\n"));
          controller.close();
          return;
        }
        const { key, rows } = next.value;
        controller.enqueue(
          encoder.encode(`,\n${JSON.stringify(key)}: ${JSON.stringify(rows, null, 1)}`),
        );
      } catch (error) {
        console.error(
          "[export] data export failed:",
          error instanceof Error ? error.message : error,
        );
        controller.error(error);
      }
    },
    async cancel() {
      await sections.return(undefined);
    },
  });
}

/** One Word file with the current draft of every deliverable, by school. */
export async function draftsDocx(userId: string, author: string): Promise<Uint8Array> {
  const rows = await currentDraftsForExport(getDb(), userId);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`Your drafts from ${APP_NAME}`)],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported ${new Date().toISOString().slice(0, 10)}. The current version of every draft.`,
          italics: true,
          size: 20,
        }),
      ],
    }),
  ];
  if (rows.length === 0)
    children.push(new Paragraph({ children: [new TextRun("You don't have any drafts yet.")] }));
  let school = "";
  for (const row of rows) {
    if (row.school !== school) {
      school = row.school;
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(school)] }),
      );
    }
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun(`${row.title} (version ${row.version}${row.isFinal ? ", final" : ""})`),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: row.prompt, italics: true, size: 20 })] }),
      ...normalizeForPortal(row.text)
        .split(/\n{2,}/)
        .map(
          (p) =>
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: p, size: 24 })],
            }),
        ),
    );
  }
  const doc = new Document({
    creator: author || APP_NAME,
    title: `Your drafts from ${APP_NAME}`,
    sections: [{ children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
