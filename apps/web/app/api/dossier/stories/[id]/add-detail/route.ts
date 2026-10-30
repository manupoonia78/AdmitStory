import { createSource, getDb, getStory, updateStory } from "@admitstory/db";
import { after } from "next/server";
import { z } from "zod";
import { dossierConsolidate, inngest } from "@/inngest";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ai } from "@/lib/ai";
import { extractFromAnswer } from "@/lib/studio/extract";

// POST /api/dossier/stories/:id/add-detail (spec §11, §5.3b "add detail by voice"). Phase 1 takes
// the detail as text; Phase 2 adds dictation to the same route. The answer is stored as a source
// and extracted from, so the new material carries provenance like everything else.

const Body = z.object({ text: z.string().trim().min(1).max(20_000) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("dossierWrites", userId, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const { text } = await readJson(request, Body);

    const db = getDb();
    const story = await getStory(db, userId, id);
    if (!story) notFound("That story");

    const source = await createSource(db, userId, { kind: "need_answer", text });
    // The detail answers what was missing, so the question goes.
    await updateStory(db, userId, id, { missing: null });

    after(async () => {
      try {
        await extractFromAnswer(userId, text, {
          targetSlot: story.slotKeys[0] ?? null,
          chapter: story.chapter ?? "work",
          sourceId: source.id,
        });
        await inngest.send(dossierConsolidate.create({ userId, reason: "manual" }));
        await ai().flush();
      } catch (error) {
        console.error("[dossier] add-detail extraction failed", error);
      }
    });

    return Response.json({ recorded: true, sourceId: source.id });
  });
}
