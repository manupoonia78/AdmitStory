import { z } from "zod";
import { checkRateLimit, handle, requireUser, RATE_LIMITS, badRequest } from "@/lib/api";
import { dataExportStream, draftsDocx } from "@/lib/account/export";

// GET /api/account/export?format=json|docx (spec §11 Account, §14.4): everything the applicant
// owns as JSON (streamed), or the current drafts as one Word file. Made on request, never stored.
// Three downloads an hour.

const Format = z.enum(["json", "docx"]);

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { session, profile } = await requireUser();
    const userId = session.user.id;
    const parsed = Format.safeParse(new URL(request.url).searchParams.get("format") ?? "json");
    if (!parsed.success) badRequest("Ask for format=json or format=docx.");
    await checkRateLimit("accountExport", userId, RATE_LIMITS.accountExport);
    const day = new Date().toISOString().slice(0, 10);
    if (parsed.data === "json")
      return new Response(dataExportStream(userId), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="admitstory-data-${day}.json"`,
          "Cache-Control": "no-store",
        },
      });
    const bytes = await draftsDocx(userId, profile.displayName ?? session.user.name ?? "");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="admitstory-drafts-${day}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
