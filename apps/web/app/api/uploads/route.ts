import { createSource, getDb } from "@admitstory/db";
import { importParseUpload, inngest } from "@/inngest";
import { ApiError, RATE_LIMITS, badRequest, checkRateLimit, handle, requireUser } from "@/lib/api";
import {
  MAX_UPLOAD_BYTES,
  UnsupportedDocumentError,
  extractDocumentText,
  formatFor,
  guessDocumentKind,
} from "@/lib/studio/documents";

// POST /api/uploads (spec §5.1 step 3, §5.2 "Upload").
//
// Spec §11 lists `POST /uploads/sign` and `POST /uploads/:id/complete`, the two halves of a signed
// direct-to-R2 upload. Phase 1 has no R2 bucket by decision, so this one route takes the file,
// extracts its text, stores the text encrypted in `sources` and discards the file — no object
// storage, and the original never lands on disk. The signed pair returns with R2 (see
// docs/phase-1.md).

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session: auth } = await requireUser();
    const userId = auth.user.id;
    checkRateLimit("uploads", userId, RATE_LIMITS.uploads);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      badRequest("Send the document as multipart form data.");
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) badRequest("Attach a document to upload.");
    if (file.size > MAX_UPLOAD_BYTES)
      throw new ApiError(
        413,
        `That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      );

    let text: string;
    let format: string;
    try {
      const resolved = formatFor(file);
      format = resolved;
      text = await extractDocumentText(new Uint8Array(await file.arrayBuffer()), resolved);
    } catch (error) {
      if (error instanceof UnsupportedDocumentError)
        throw new ApiError(error.status, error.message);
      // A corrupt or image-only PDF: say so plainly rather than failing silently.
      throw new ApiError(
        422,
        "We couldn't read any text in that file. If it's a scan, a PDF exported from Word or Google Docs works better.",
      );
    }

    if (text.trim().length < 40)
      throw new ApiError(
        422,
        "That file has almost no text in it. If it's a scan, a text-based PDF works better.",
      );

    // The Résumé page says what it sends; elsewhere the kind is guessed from the file.
    const documentKind =
      form.get("kind") === "resume" ? "resume" : guessDocumentKind(file.name, text);
    const source = await createSource(getDb(), userId, {
      kind: "upload",
      text,
      meta: { fileName: file.name, format, bytes: file.size, documentKind },
    });

    // Parsing starts immediately in the background (spec §5.1 step 3).
    await inngest.send(
      importParseUpload.create({
        userId,
        sourceId: source.id,
        documentKind,
        fileName: file.name,
      }),
    );

    return Response.json({
      sourceId: source.id,
      fileName: file.name,
      documentKind,
      characters: text.length,
      /** The client shows this while the Fact Sheet fills in. */
      parsing: true,
    });
  });
}
