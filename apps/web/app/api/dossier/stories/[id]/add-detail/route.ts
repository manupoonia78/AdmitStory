import { createSource, getDb, getStory, updateStory } from "@admitstory/db";
import { after } from "next/server";
import { z } from "zod";
import { dossierConsolidate, inngest } from "@/inngest";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ai } from "@/lib/ai";
import { extractFromAnswer } from "@/lib/studio/extract";
import { LanguageTag, MAX_VOICE_SECONDS_PER_ANSWER } from "@/lib/voice/schemas";
import { meterLooseDictation, voiceSettingsOf } from "@/lib/voice/server";

// POST /api/dossier/stories/:id/add-detail (spec §11, §5.3b "add detail by voice"). The detail is
// typed or dictated (Phase 2: the same VoiceTurnFields as a Studio answer, metered the same way).
// The answer is stored as a source and extracted from, so the new material carries provenance
// like everything else.

const Body = z.object({
  text: z.string().trim().min(1).max(20_000),
  inputMode: z.enum(["voice", "text"]).default("text"),
  voiceSeconds: z
    .number()
    .finite()
    .min(0)
    .transform((seconds) => Math.min(seconds, MAX_VOICE_SECONDS_PER_ANSWER))
    .optional(),
  language: LanguageTag.optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session, profile } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("dossierWrites", userId, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const body = await readJson(request, Body);
    const { text } = body;
    const voice = body.inputMode === "voice";
    // As in the Studio (§7.5): the language Deepgram reported, else the one chosen in Settings.
    const speechLanguage = voiceSettingsOf(profile).speechLanguage;
    const language = voice
      ? (body.language ?? (speechLanguage === "multi" ? "en" : speechLanguage))
      : null;

    const db = getDb();
    const story = await getStory(db, userId, id);
    if (!story) notFound("That story");

    const source = await createSource(db, userId, { kind: "need_answer", text, language });
    if (voice && body.voiceSeconds) await meterLooseDictation(userId, body.voiceSeconds);
    // The detail answers what was missing, so the question goes.
    await updateStory(db, userId, id, { missing: null });

    after(async () => {
      try {
        await extractFromAnswer(userId, text, {
          targetSlot: story.slotKeys[0] ?? null,
          chapter: story.chapter ?? "work",
          sourceId: source.id,
          language,
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
