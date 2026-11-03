// Text extraction for knowledge sources (spec §9.3, "Add source ──► extract text"). PDFs and DOCX
// files go through the same parsers the Studio's upload route uses (apps/web/lib/studio/documents.ts),
// loaded on demand so importing this module costs nothing until a file arrives. Fetched web pages
// arrive as HTML and are reduced to text here too.
//
// Out of scope for Phase 3, as hooks only:
//   - OCR (deferred): a PDF whose pages carry almost no text layer comes back with `needsOcr`, so
//     the admin sees "scanned PDF, OCR not yet available" rather than an empty source.
//   - Audio → STT: pass a `Transcriber` (packages/voice's batch STT can implement it). Without one,
//     audio is refused with a clear error rather than silently stored empty.
//
// Extracted text is data, never instructions (§14.6): the Normalizer's prompt wraps it in a
// delimited block. Nothing here interprets it.

export const SOURCE_FORMATS = ["pdf", "docx", "txt", "html", "audio"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

const BY_MIME: Record<string, SourceFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
  "text/csv": "txt",
  "text/html": "html",
  "application/xhtml+xml": "html",
};

const BY_EXTENSION: Record<string, SourceFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "txt",
  csv: "txt",
  html: "html",
  htm: "html",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  webm: "audio",
  ogg: "audio",
};

export class UnsupportedSourceError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "UnsupportedSourceError";
  }
}

/** The format from a MIME type (parameters ignored), falling back to the file name's extension. */
export function sourceFormatFor(file: {
  mimeType?: string | null;
  name?: string | null;
}): SourceFormat {
  const mime = (file.mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.startsWith("audio/")) return "audio";
  const byMime = BY_MIME[mime];
  if (byMime) return byMime;
  const extension = (file.name ?? "").toLowerCase().split(".").pop() ?? "";
  const byExtension = BY_EXTENSION[extension];
  if (byExtension) return byExtension;
  throw new UnsupportedSourceError(
    "That file type isn't supported. Add a PDF, a Word document (.docx), a text file or a web page.",
  );
}

/** The audio → text hook (§9.3). Phase 3 has no implementation; packages/voice can provide one. */
export interface Transcriber {
  transcribe(audio: { bytes: Uint8Array; mimeType: string }): Promise<{ text: string }>;
}

export interface ExtractedText {
  text: string;
  format: SourceFormat;
  /** PDFs only. */
  pages?: number;
  /** A PDF with (almost) no text layer: it needs OCR, which is deferred. */
  needsOcr: boolean;
}

/** Collapses extractor whitespace without losing paragraph breaks. */
export function tidyText(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const n =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const BLOCK_TAGS =
  /<\/?(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|table|tr|h[1-6]|blockquote|br|hr|dd|dt|dl|figcaption|pre)\b[^>]*>/gi;

/** Readable text from an HTML page: scripts, styles and markup gone, block breaks kept. */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(td|th)\b[^>]*>/gi, " | ")
    .replace(BLOCK_TAGS, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return tidyText(decodeEntities(body));
}

/** Under this many characters per page, a PDF is treated as scanned. */
const MIN_CHARS_PER_PAGE = 40;

export async function extractText(
  input: { bytes: Uint8Array; format: SourceFormat; mimeType?: string },
  options: { transcriber?: Transcriber } = {},
): Promise<ExtractedText> {
  const { bytes, format } = input;
  switch (format) {
    case "txt":
      return { text: tidyText(new TextDecoder().decode(bytes)), format, needsOcr: false };
    case "html":
      return { text: htmlToText(new TextDecoder().decode(bytes)), format, needsOcr: false };
    case "pdf": {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      // pdf.js may transfer (detach) the buffer it is given; keep the caller's intact.
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text, totalPages } = await pdfText(pdf, { mergePages: false });
      const tidied = tidyText(text.join("\n\n"));
      return {
        text: tidied,
        format,
        pages: totalPages,
        needsOcr: tidied.length < MIN_CHARS_PER_PAGE * Math.max(1, totalPages),
      };
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({
        buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      });
      return { text: tidyText(value), format, needsOcr: false };
    }
    case "audio": {
      if (!options.transcriber)
        throw new UnsupportedSourceError(
          "Audio sources need transcription, which isn't connected yet. Add a transcript as text instead.",
        );
      const { text } = await options.transcriber.transcribe({
        bytes,
        mimeType: input.mimeType ?? "application/octet-stream",
      });
      return { text: tidyText(text), format, needsOcr: false };
    }
  }
}
