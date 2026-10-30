import "server-only";

import {
  createGoldenLines,
  createStories,
  getDb,
  listFacts,
  listStories,
  upsertFacts,
  upsertPeople,
  type NewStory,
} from "@admitstory/db";
import {
  isChapterId,
  isTraitId,
  lensesForTraits,
  type ChapterId,
  type TraitId,
} from "@admitstory/shared";
import { isSlotKey, type SlotKey } from "@admitstory/slots";
import type { ExtractionOutput } from "@admitstory/ai";
import { ai } from "@/lib/ai";

// Extraction (spec §7.3 step 2a, §8.5.2). Runs after the turn's response has been sent, so it never
// delays the next question, and writes what it finds into the Fact Sheet and Story Bank.
//
// Three rules are applied here rather than trusted to the model:
//  - a story that discloses something sensitive is stored as sensitive, which makes it private by
//    default (§14.3) — the model only says which span is sensitive, never whether to use it;
//  - a trait the model invents is dropped rather than stored, so the taxonomy stays closed;
//  - lenses are derived from traits (Appendix D), not from the model's own `lenses` answer, so the
//    coverage meter cannot disagree with the story cards.

export interface ExtractionResult {
  factsCreated: number;
  conflictsRaised: number;
  storiesCreated: { id: string; code: string; nickname: string }[];
  linesCreated: number;
  /**
   * The answer disclosed something sensitive that is not inside one story (spec §14.3). The
   * Interviewer answers that with a CARE move; this is recorded so the session summary can offer
   * the consent choice again if the moment passed.
   */
  sensitiveDisclosure: boolean;
}

export interface ExtractOptions {
  /** The slot the question targeted; the story it produces fills that slot. */
  targetSlot?: string | null;
  chapter: ChapterId;
  sourceId: string;
}

/** Only traits in Appendix D survive. */
function knownTraits(traits: readonly string[]): TraitId[] {
  return traits.filter((trait): trait is TraitId => isTraitId(trait));
}

export async function extractFromAnswer(
  userId: string,
  text: string,
  options: ExtractOptions,
): Promise<ExtractionResult> {
  const db = getDb();
  const [knownFacts, knownStories] = await Promise.all([
    listFacts(db, userId),
    listStories(db, userId),
  ]);

  const output = await ai().run(
    "studio.extract",
    {
      text,
      chapter: options.chapter,
      targetSlot: options.targetSlot ?? null,
      knownFacts: knownFacts.map((fact) => ({
        code: fact.code,
        key: fact.key,
        value: fact.value,
      })),
      knownStories: knownStories.map((story) => ({
        code: story.code,
        nickname: story.nickname,
      })),
    },
    { userId },
  );

  return persistExtraction(userId, output, options);
}

/** Writes an extraction's results. Shared by the Studio turn path and the upload importer. */
export async function persistExtraction(
  userId: string,
  output: ExtractionOutput,
  options: ExtractOptions,
): Promise<ExtractionResult> {
  const db = getDb();

  const facts = await upsertFacts(
    db,
    userId,
    output.facts
      // Below this the Extractor is guessing; a guess must not enter the Fact Sheet (§8.7).
      .filter((fact) => fact.confidence >= 0.5)
      .map((fact) => ({
        key: fact.key,
        value: fact.value,
        note: fact.note,
        status: "needs_confirmation" as const,
        evidence: [{ sourceId: options.sourceId, spans: [fact.evidence_span] }],
      })),
  );

  // Which story candidates disclose something sensitive, by the spans the model flagged.
  const sensitiveByIndex = new Set(
    output.sensitive
      .map((entry) => entry.story_index)
      .filter((index): index is number => index !== null),
  );
  const looseSensitive = output.sensitive.some((entry) => entry.story_index === null);

  const people = await upsertPeople(
    db,
    userId,
    output.story_candidates.flatMap((candidate) =>
      candidate.people.map((person) => ({ name: person.name, roleInLife: person.role })),
    ),
  );
  const personCodeByName = new Map(
    people.map((person) => [person.name.toLowerCase(), person.code]),
  );

  const slotKeys: SlotKey[] =
    options.targetSlot && isSlotKey(options.targetSlot) ? [options.targetSlot] : [];

  const storyInputs: NewStory[] = output.story_candidates.map((candidate, index) => {
    const traits = knownTraits(candidate.traits);
    const sensitive = sensitiveByIndex.has(index);
    return {
      nickname: candidate.nickname,
      era: candidate.era,
      context: candidate.context,
      chapter: isChapterId(options.chapter) ? options.chapter : null,
      situation: candidate.situation,
      stakes: candidate.stakes,
      actions: candidate.actions,
      result: candidate.result,
      reflection: candidate.reflection,
      numbers: candidate.numbers.map((number) => ({ label: number.label, value: number.value })),
      traits,
      // Appendix D is the authority on which lens a trait evidences.
      lenses: lensesForTraits(traits),
      archetypes: candidate.archetypes,
      slotKeys,
      peopleCodes: candidate.people
        .map((person) => personCodeByName.get(person.name.toLowerCase()))
        .filter((code): code is string => code !== undefined),
      // The Consolidator decides `confirmed`; a single turn never does (§8.5.3).
      status: candidate.confidence >= 0.5 ? ("partial" as const) : ("unconfirmed" as const),
      missing: candidate.missing.map((entry) => ({
        question: entry.question,
        approxWords: entry.approx_words,
      })),
      sensitivity: sensitive ? ("sensitive" as const) : ("none" as const),
      evidence: candidate.evidence_spans.map((span) => ({
        sourceId: options.sourceId,
        spans: [span],
      })),
      confidence: candidate.confidence.toFixed(2),
    };
  });

  const stories = await createStories(db, userId, storyInputs);

  // Which story a golden line belongs to. The model answers with a position in its own
  // `story_candidates` array, and createStories inserts in that order, so position usually maps
  // straight across — but it is checked against the nickname rather than trusted, because a line
  // attached to the wrong story would put one of the applicant's sentences under something they
  // did not say it about. An unresolvable position attaches to nothing rather than to a guess.
  const storyIdAt = (index: number | null): string | null => {
    if (index === null) return null;
    const candidate = output.story_candidates[index];
    if (!candidate) return null;
    const positional = stories[index];
    if (positional?.nickname === candidate.nickname) return positional.id;
    return stories.find((story) => story.nickname === candidate.nickname)?.id ?? null;
  };

  const lines = await createGoldenLines(
    db,
    userId,
    output.golden_lines.map((line) => ({
      storyId: storyIdAt(line.story_index),
      text: line.text,
      english: line.english,
      sourceId: options.sourceId,
      span: line.span,
    })),
  );

  return {
    factsCreated: facts.created.length,
    conflictsRaised: facts.conflicted.length,
    storiesCreated: stories.map((story) => ({
      id: story.id,
      code: story.code,
      nickname: story.nickname,
    })),
    linesCreated: lines.length,
    sensitiveDisclosure: looseSensitive || sensitiveByIndex.size > 0,
  };
}
