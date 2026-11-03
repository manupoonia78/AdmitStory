import "server-only";

import { stripInvisible } from "@admitstory/ai";

// Text extraction for uploaded documents (spec §5.1 step 3, §5.2 "Upload").
//
// Phase 1 has no R2 bucket, so by decision the route extracts the text, stores it encrypted in
// `sources`, and discards the file (see docs/phase-1.md). That also means §8.3's note about sending
// a PDF to the model as a document input does not apply yet: the model receives text.
//
// Both parsers are loaded on demand, so a request that uploads nothing never pays for them.
//
// Hostile files (Phase 9b §9): the bytes must match the claimed format (a PDF starts "%PDF-", a
// DOCX is a zip holding word/document.xml), a DOCX may not inflate past 20 MB (zip bombs), a PDF
// is read to 60 pages, extraction stops after 10 seconds, the text is capped at 200,000
// characters, and invisible and bidi control characters are stripped before anything stores it.

export const ACCEPTED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
} as const;

export type DocumentFormat = (typeof ACCEPTED_MIME_TYPES)[keyof typeof ACCEPTED_MIME_TYPES];

/** Spec §5.1: a resume, a LinkedIn export, past essays or a notes document. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;
export const MAX_EXTRACTED_CHARS = 200_000;
export const MAX_DOCX_INFLATED_BYTES = 20 * 1024 * 1024;
export const EXTRACT_TIMEOUT_MS = 10_000;

export class UnsupportedDocumentError extends Error {
  readonly status = 415;
  constructor(detail: string) {
    super(detail);
    this.name = "UnsupportedDocumentError";
  }
}

export function formatFor(file: { type: string; name: string }): DocumentFormat {
  const byMime = ACCEPTED_MIME_TYPES[file.type as keyof typeof ACCEPTED_MIME_TYPES];
  if (byMime) return byMime;
  // Browsers sometimes send an empty or generic type; fall back to the extension.
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "txt" || extension === "md") return "txt";
  throw new UnsupportedDocumentError(
    "That file type isn't supported. Upload a PDF, a Word document (.docx) or a text file.",
  );
}

/** Collapses the whitespace a PDF extractor leaves behind, without losing paragraph breaks. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MISMATCH =
  "That file isn't what its name says it is. Upload a PDF, a Word document (.docx) or a text file.";

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((b, i) => bytes[i] === b);
}

/**
 * Reads a zip's central directory: the total uncompressed size and whether word/document.xml is
 * there. Null when it isn't a readable zip. Nothing is inflated.
 */
function zipDirectory(bytes: Uint8Array): { inflated: number; hasDocument: boolean } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: the last 22 bytes, plus up to 64 KB of comment.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let inflated = 0;
  let hasDocument = false;
  const decoder = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    inflated += view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name === "word/document.xml") hasDocument = true;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { inflated, hasDocument };
}

/** Refuses bytes that don't match the claimed format (415), and DOCX zip bombs (413). */
function sniff(bytes: Uint8Array, format: DocumentFormat): void {
  if (format === "pdf") {
    // "%PDF-", allowing a little junk before it as readers do.
    const head = new TextDecoder().decode(bytes.subarray(0, 1024));
    if (!head.includes("%PDF-")) throw new UnsupportedDocumentError(MISMATCH);
    return;
  }
  if (format === "docx") {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw new UnsupportedDocumentError(MISMATCH);
    const directory = zipDirectory(bytes);
    if (!directory?.hasDocument) throw new UnsupportedDocumentError(MISMATCH);
    if (directory.inflated > MAX_DOCX_INFLATED_BYTES)
      throw new DocumentTooLargeError(
        "That Word document is too large to read. Try saving it as a PDF.",
      );
    return;
  }
  // Text: no NUL bytes in the first 8 KB (binaries renamed .txt).
  if (bytes.subarray(0, 8192).includes(0)) throw new UnsupportedDocumentError(MISMATCH);
}

export class DocumentTooLargeError extends Error {
  readonly status = 413;
  constructor(detail: string) {
    super(detail);
    this.name = "DocumentTooLargeError";
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new DocumentTooLargeError(
            "That file took too long to read. Try a shorter one, or paste the text.",
          ),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function extractRaw(bytes: Uint8Array, format: DocumentFormat): Promise<string> {
  if (format === "txt") return new TextDecoder().decode(bytes);

  if (format === "pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const pages: string[] = [];
    const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
          .join(""),
      );
    }
    return pages.join("\n\n");
  }

  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  });
  return value;
}

export async function extractDocumentText(
  bytes: Uint8Array,
  format: DocumentFormat,
): Promise<string> {
  sniff(bytes, format);
  const raw = await withTimeout(extractRaw(bytes, format), EXTRACT_TIMEOUT_MS);
  return tidy(stripInvisible(raw)).slice(0, MAX_EXTRACTED_CHARS);
}

/** What kind of document this is, guessed from the file name and its own first lines. */
export function guessDocumentKind(
  fileName: string,
  text: string,
): "resume" | "linkedin" | "essay" | "notes" | "other" {
  const name = fileName.toLowerCase();
  if (name.includes("linkedin")) return "linkedin";
  if (/\b(resume|cv)\b/.test(name)) return "resume";
  if (name.includes("essay")) return "essay";

  const head = text.slice(0, 2000).toLowerCase();
  // A resume names its own sections; prose does not.
  const sections = ["experience", "education", "skills", "certifications", "projects"].filter(
    (section) => head.includes(section),
  );
  if (sections.length >= 2) return "resume";
  if (head.includes("linkedin.com/in/")) return "linkedin";
  return "other";
}
