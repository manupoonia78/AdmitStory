import "server-only";

// Text extraction for uploaded documents (spec §5.1 step 3, §5.2 "Upload").
//
// Phase 1 has no R2 bucket, so by decision the route extracts the text, stores it encrypted in
// `sources`, and discards the file (see docs/phase-1.md). That also means §8.3's note about sending
// a PDF to the model as a document input does not apply yet: the model receives text.
//
// Both parsers are loaded on demand, so a request that uploads nothing never pays for them.

export const ACCEPTED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
} as const;

export type DocumentFormat = (typeof ACCEPTED_MIME_TYPES)[keyof typeof ACCEPTED_MIME_TYPES];

/** Spec §5.1: a resume, a LinkedIn export, past essays or a notes document. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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

export async function extractDocumentText(
  bytes: Uint8Array,
  format: DocumentFormat,
): Promise<string> {
  if (format === "txt") return tidy(new TextDecoder().decode(bytes));

  if (format === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return tidy(Array.isArray(text) ? text.join("\n\n") : text);
  }

  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  });
  return tidy(value);
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
