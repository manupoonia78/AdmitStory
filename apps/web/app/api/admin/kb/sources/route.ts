import { addKbSource, getDraftPack, getPublishedPack } from "@admitstory/db";
import {
  UnsupportedSourceError,
  extractText,
  hostAllowed,
  sourceFormatFor,
} from "@admitstory/kb/ingest";
import { ApiError, badRequest, readJson } from "@/lib/api";
import { startIngest } from "@/lib/admin/dispatch";
import { findCycleByName, schoolOrThrow } from "@/lib/admin/drafts";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { allowedHosts, officialUrlsOf } from "@/lib/admin/pack";
import { SourceBody, SourceTags } from "@/lib/admin/schemas";

// POST /api/admin/kb/sources (spec §5.18 "add sources", §9.3 "Add source"). Three ways in:
//   - JSON `{mode: "paste", text}`: the text is stored (encrypted) as it is.
//   - JSON `{mode: "url", url}`: the host must be on the school's allowlist (its website and the
//     pack's official URLs, §14.6); the page is fetched by the ingestion job, SSRF-guarded.
//   - multipart with `file`: a PDF, DOCX or text file is read here and only its text is kept (no
//     object storage yet, as for applicant uploads). Audio needs a prerecorded transcription
//     path, which packages/voice doesn't have yet, so it is refused with that reason.
// Then ingestion starts: chunk, embed, normalise into proposals.

const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function allowlistFor(
  admin: Parameters<typeof findCycleByName>[0],
  schoolId: string,
  cycle: string | null | undefined,
  website: string | null,
): Promise<string[]> {
  const ref = cycle ? await findCycleByName(admin, schoolId, cycle) : null;
  let data: unknown;
  if (ref) data = (await getDraftPack(admin, ref.cycle.id))?.data;
  if (ref && data === undefined) data = (await getPublishedPack(admin.db, ref.cycle.id))?.data;
  return allowedHosts(website, officialUrlsOf(data));
}

export const POST = adminRoute(async (admin, request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      badRequest("Send the file as multipart form data.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) badRequest("Attach a file to upload.");
    if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "That file is larger than 25 MB.");
    const fields = Object.fromEntries(
      [...form.entries()].filter(([key, value]) => key !== "file" && typeof value === "string"),
    );
    const parsed = SourceTags.safeParse({
      ...fields,
      cycle: fields.cycle || null,
      trust: fields.trust || undefined,
    });
    if (!parsed.success)
      badRequest(
        "Some values in that request were not valid.",
        parsed.error.issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
        })),
      );
    const tags = parsed.data;
    await schoolOrThrow(admin, tags.schoolId);

    let text: string;
    try {
      const format = sourceFormatFor({ mimeType: file.type, name: file.name });
      if (format === "audio")
        throw new AdminActionError(
          "Audio transcription for knowledge sources isn't connected yet (packages/voice has live dictation only). Paste the transcript as text instead.",
          422,
        );
      const extracted = await extractText({
        bytes: new Uint8Array(await file.arrayBuffer()),
        format,
        mimeType: file.type,
      });
      if (extracted.needsOcr)
        throw new AdminActionError(
          "That PDF looks scanned: it has almost no text layer, and OCR isn't connected yet.",
          422,
        );
      text = extracted.text;
    } catch (error) {
      if (error instanceof AdminActionError) throw error;
      if (error instanceof UnsupportedSourceError) throw new AdminActionError(error.message, 415);
      throw new AdminActionError("We couldn't read any text in that file.", 422);
    }
    if (text.trim().length < 40)
      throw new AdminActionError("That file has almost no text in it.", 422);

    const source = await addKbSource(admin, {
      ...tags,
      text,
      meta: { fileName: file.name.slice(0, 200), bytes: file.size },
    });
    const mode = await startIngest(source.id);
    return Response.json({ sourceId: source.id, mode }, { status: 201 });
  }

  const body = await readJson(request, SourceBody);
  const school = await schoolOrThrow(admin, body.schoolId);
  const { mode: _mode, ...tags } = body;
  if (body.mode === "url") {
    const hosts = await allowlistFor(admin, school.id, body.cycle, school.website);
    const host = new URL(body.url).hostname;
    if (!hostAllowed(host, hosts))
      throw new AdminActionError(
        hosts.length === 0
          ? `${school.shortName} has no website or official URLs yet, so no address is allowed. Add its website first.`
          : `${host} isn't one of ${school.shortName}'s sites (${hosts.join(", ")}).`,
        422,
      );
  }
  const source = await addKbSource(admin, {
    ...("text" in tags ? { ...tags } : { ...tags, text: null }),
  });
  const mode = await startIngest(source.id);
  return Response.json({ sourceId: source.id, mode }, { status: 201 });
});
