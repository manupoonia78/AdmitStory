import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "@admitstory/shared";
import { describe, expect, it } from "vitest";
import { chunkText } from "../src/ingest/chunker";
import {
  UnsupportedSourceError,
  extractText,
  htmlToText,
  sourceFormatFor,
} from "../src/ingest/extract";

/* A stored (uncompressed) zip, enough to make a .docx for mammoth without a zip library. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

function docx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  return zip({
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });
}

describe("sourceFormatFor", () => {
  it("reads the MIME type, then the extension", () => {
    expect(sourceFormatFor({ mimeType: "application/pdf; charset=binary" })).toBe("pdf");
    expect(sourceFormatFor({ mimeType: "audio/mpeg" })).toBe("audio");
    expect(sourceFormatFor({ mimeType: "application/octet-stream", name: "Notes.DOCX" })).toBe(
      "docx",
    );
    expect(sourceFormatFor({ name: "report.htm" })).toBe("html");
    expect(() => sourceFormatFor({ name: "deck.pptx" })).toThrow(UnsupportedSourceError);
  });
});

describe("extractText", () => {
  it("tidies plain text but keeps paragraph breaks", async () => {
    const bytes = new TextEncoder().encode("﻿Line one  \r\n\r\n\r\n\tLine   two\n");
    const result = await extractText({ bytes, format: "txt" });
    expect(result).toEqual({ text: "Line one\n\nLine two", format: "txt", needsOcr: false });
  });

  it("reduces HTML to readable text without scripts, styles or markup", () => {
    const html =
      "<html><head><style>p{}</style><script>alert('x')</script></head><body><h1>Essays</h1><!-- hidden --><p>Goals &amp; plans&nbsp;&#8212; 500&nbsp;words</p><table><tr><td>R1</td><td>16 Sep</td></tr></table></body></html>";
    expect(htmlToText(html)).toBe("Essays\n\nGoals & plans — 500 words\n\n| R1 | 16 Sep");
  });

  it("extracts a PDF's text layer", async () => {
    const path = fileURLToPath(
      new URL("../../../fixtures/applicants/engineer-to-product/resume.pdf", import.meta.url),
    );
    const bytes = new Uint8Array(readFileSync(path));
    const result = await extractText({ bytes, format: "pdf" });
    expect(result.format).toBe("pdf");
    expect(result.pages).toBeGreaterThanOrEqual(1);
    expect(result.needsOcr).toBe(false);
    expect(result.text.length).toBeGreaterThan(200);
    // The caller's buffer survives pdf.js.
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("extracts a Word document's text", async () => {
    const result = await extractText({
      bytes: docx(["Class profile", "Median GMAT Focus 655"]),
      format: "docx",
    });
    expect(result.text).toBe("Class profile\n\nMedian GMAT Focus 655");
  });

  it("refuses audio without a transcriber, and uses one when given (the STT hook)", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(extractText({ bytes, format: "audio" })).rejects.toThrow(UnsupportedSourceError);
    const transcriber = {
      transcribe: async ({ mimeType }: { bytes: Uint8Array; mimeType: string }) => ({
        text: ` heard ${mimeType} `,
      }),
    };
    const result = await extractText(
      { bytes, format: "audio", mimeType: "audio/webm" },
      { transcriber },
    );
    expect(result.text).toBe("heard audio/webm");
  });
});

const sentence = (i: number) =>
  `Sentence number ${i} talks about the school's clubs and recruiting calendar.`;
const paragraph = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => sentence(from + i)).join(" ");

describe("chunkText (§9.3: ~600 tokens, 80 overlap)", () => {
  const text = Array.from({ length: 30 }, (_, p) => paragraph(p * 8, 8)).join("\n\n");

  it("returns nothing for empty text and one chunk for a short one", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
    expect(chunkText("A short note.")).toEqual([
      {
        index: 0,
        text: "A short note.",
        tokenCount: estimateTokens("A short note."),
        start: 0,
        end: 13,
      },
    ]);
  });

  it("keeps chunks near the target, in order, with spans that cover the text", () => {
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(3);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.tokenCount).toBeLessThanOrEqual(600);
      expect(chunk.tokenCount).toBe(estimateTokens(chunk.text));
      expect(chunk.text.endsWith(text.slice(chunk.start, chunk.end))).toBe(true);
      if (i > 0) expect(chunk.start).toBeGreaterThanOrEqual(chunks[i - 1]?.end ?? 0);
    });
    // Nothing is lost between chunks: only paragraph whitespace sits between spans.
    for (let i = 1; i < chunks.length; i++)
      expect(text.slice(chunks[i - 1]?.end, chunks[i]?.start).trim()).toBe("");
  });

  it("breaks between paragraphs when paragraphs fit", () => {
    for (const chunk of chunkText(text)) {
      expect(text.slice(chunk.start - 2, chunk.start) === "\n\n" || chunk.start === 0).toBe(true);
      expect(text.slice(chunk.end, chunk.end + 2) === "\n\n" || chunk.end === text.length).toBe(
        true,
      );
    }
  });

  it("opens each chunk after the first with ~80 tokens of the one before", () => {
    const chunks = chunkText(text);
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const previous = chunks[i - 1];
      if (!chunk || !previous) continue;
      const own = text.slice(chunk.start, chunk.end);
      const lead = chunk.text.slice(0, chunk.text.length - own.length).trim();
      expect(lead.length).toBeGreaterThan(0);
      expect(estimateTokens(lead)).toBeLessThanOrEqual(80);
      expect(estimateTokens(lead)).toBeGreaterThan(50);
      expect(text.slice(previous.start, previous.end).endsWith(lead)).toBe(true);
    }
  });

  it("splits a paragraph longer than a chunk at sentence ends, and a run-on sentence between words", () => {
    const long = paragraph(0, 120);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1))
      expect(long.slice(chunk.start, chunk.end)).toMatch(/\.$/);
    const runOn = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    const pieces = chunkText(runOn, { targetTokens: 200, overlapTokens: 20 });
    expect(pieces.length).toBeGreaterThan(5);
    for (const piece of pieces) expect(piece.tokenCount).toBeLessThanOrEqual(200);
  });

  it("is deterministic, and refuses an overlap as big as the chunk", () => {
    expect(chunkText(text)).toEqual(chunkText(text));
    expect(() => chunkText(text, { targetTokens: 100, overlapTokens: 100 })).toThrow();
  });
});
