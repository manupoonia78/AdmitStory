import {
  getDb,
  listGoldenLines,
  listSourceTexts,
  listStories,
  listFacts,
  mergeStories,
  saveBrand,
  saveDossierSnapshot,
  saveVoiceProfile,
  saveVoiceprint,
  updateFact,
  updateStory,
} from "@admitstory/db";
import { identityFromText, isTraitId } from "@admitstory/shared";
import { ai } from "../../lib/ai";
import { voiceSamplesFrom, voiceStatsFrom } from "../../lib/studio/voice";
import { dossierConsolidate, inngest } from "../client";

// Spec §7.4 `dossier/consolidate`, §8.5.3. Merges duplicate stories, settles statuses, raises fact
// conflicts, proposes the brand, refreshes the voice card, and writes the compact dossier snapshot
// the drafting engine reads (§8.2).
//
// Concurrency is keyed by user: two consolidations for one applicant would fight over the same
// stories, and the later snapshot would be built from a half-applied merge.

export const dossierConsolidateFn = inngest.createFunction(
  {
    id: "dossier-consolidate",
    name: "dossier/consolidate",
    triggers: [dossierConsolidate],
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { userId } = event.data;
    const db = getDb();

    const material = await step.run("read the dossier", async () => {
      const [stories, facts, lines, sources] = await Promise.all([
        listStories(db, userId),
        listFacts(db, userId),
        listGoldenLines(db, userId),
        listSourceTexts(db, userId, {
          kinds: ["text_turn", "voice_turn", "need_answer"],
          limit: 80,
        }),
      ]);
      const texts = sources.map((source) => source.text);
      return {
        stories: stories.map((story) => ({
          id: story.id,
          code: story.code,
          nickname: story.nickname,
          era: story.era ?? "",
          context: story.context,
          situation: story.situation ?? "",
          stakes: story.stakes ?? "",
          actions: story.actions,
          result: story.result ?? "",
          reflection: story.reflection ?? "",
          traits: story.traits,
          status: story.status,
          lines: lines
            .filter((line) => line.storyId === story.id)
            .map((line) => ({ code: line.code, text: line.text })),
        })),
        facts: facts.map((fact) => ({
          id: fact.id,
          code: fact.code,
          key: fact.key,
          value: fact.value,
          status: fact.status,
        })),
        voiceStats: voiceStatsFrom(texts),
        voiceSamples: voiceSamplesFrom(texts),
        answerTexts: texts,
      };
    });

    // Nothing to consolidate yet.
    if (material.stories.length === 0 && material.facts.length === 0) return { skipped: true };

    const result = await step.run("consolidate", async () => {
      const output = await ai().run(
        "studio.consolidate",
        {
          stories: material.stories.map(({ id: _id, ...rest }) => rest),
          facts: material.facts.map(({ id: _id, ...rest }) => rest),
          voiceStats: material.voiceStats,
          voiceSamples: material.voiceSamples,
        },
        { userId },
      );
      await ai().flush();
      return output;
    });

    await step.run("apply merges and statuses", async () => {
      const idByCode = new Map(material.stories.map((story) => [story.code, story.id] as const));

      for (const merge of result.merges) {
        const keepId = idByCode.get(merge.keep);
        const mergeId = idByCode.get(merge.merge);
        if (keepId && mergeId && keepId !== mergeId)
          await mergeStories(db, userId, keepId, mergeId);
      }

      const merged = new Set(result.merges.map((merge) => merge.merge));
      for (const status of result.statuses) {
        if (merged.has(status.code)) continue;
        const storyId = idByCode.get(status.code);
        if (!storyId) continue;
        const nickname = result.nicknames.find((entry) => entry.code === status.code)?.nickname;
        await updateStory(db, userId, storyId, {
          status: status.status,
          ...(nickname ? { nickname } : {}),
          missing:
            status.status === "partial" && status.missing
              ? [
                  {
                    question: status.missing,
                    ...(status.approx_words ? { approxWords: status.approx_words } : {}),
                  },
                ]
              : null,
        });
      }
    });

    await step.run("raise fact conflicts", async () => {
      const byCode = new Map(material.facts.map((fact) => [fact.code, fact] as const));
      for (const conflict of result.fact_conflicts) {
        const fact = byCode.get(conflict.code);
        if (!fact || fact.status === "conflict") continue;
        await updateFact(db, userId, fact.id, { status: "conflict" });
      }
    });

    await step.run("save brand and voice", async () => {
      const traits = result.brand.filter((entry) => isTraitId(entry.trait));
      if (traits.length > 0)
        await saveBrand(db, userId, {
          traits: traits.map((entry) => ({
            traitId: entry.trait,
            storyCodes: entry.story_codes,
            why: entry.why,
          })),
          positioningLine: result.positioning_line,
        });

      await saveVoiceProfile(db, userId, {
        stats: material.voiceStats,
        card: result.voice_card,
      });

      // Spec §6.2: someone who has only written gets a Voiceprint seeded from their writing. Once
      // Phase 2 computes one from speech, that one stands: saveVoiceprint never overwrites a
      // speech-derived identity, checked in the same statement that writes.
      if (material.answerTexts.length > 0)
        await saveVoiceprint(db, userId, identityFromText(material.answerTexts));
    });

    const snapshot = await step.run("compile the snapshot", async () => {
      const { snapshot: row } = await saveDossierSnapshot(db, userId);
      return { version: row.version, tokenCount: row.tokenCount };
    });

    return { userId, snapshot, merges: result.merges.length, notes: result.notes };
  },
);
