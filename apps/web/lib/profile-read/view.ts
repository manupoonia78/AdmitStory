// Profile Read content → what screen D renders (spec §5.4, §6.10 D). Pure. Every claim keeps only
// the cites that resolve to the applicant's own stories and facts, and a claim left with none is
// dropped: "every claim cites stories/facts by link" (§5.4 AC).

import {
  LENS_IDS,
  chapter,
  traitLabel,
  type ChapterId,
  type CoverageLevel,
  type LensId,
} from "@admitstory/shared";
import type { ProfileRead } from "@admitstory/shared/kit";
import type {
  EvidenceItem,
  EvidenceRef,
  Finding,
  FindingAction,
  LensFindingsData,
  LensReading,
} from "@admitstory/ui";
import type { ReadBasis } from "./policy";

export interface ViewStory {
  id: string;
  code: string;
  nickname: string;
  era: string;
  chapter: string;
  lenses: readonly string[];
  situation: string | null;
  lineCodes: readonly string[];
}

export interface ViewFact {
  id: string;
  code: string;
  key: string;
  value: string;
}

/** The stored row's `content`: the validated read and what it was built from. */
export interface StoredRead {
  read: ProfileRead;
  basis: ReadBasis | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStoredRead(content: unknown): StoredRead | null {
  if (!isRecord(content) || !isRecord(content.read) || !isRecord(content.read.lenses)) return null;
  const basis = isRecord(content.basis)
    ? {
        storyCodes: Array.isArray(content.basis.storyCodes)
          ? content.basis.storyCodes.filter((c): c is string => typeof c === "string")
          : [],
        factCodes: Array.isArray(content.basis.factCodes)
          ? content.basis.factCodes.filter((c): c is string => typeof c === "string")
          : [],
      }
    : null;
  return { read: content.read as unknown as ProfileRead, basis };
}

/** "Team size: 14" from `team_size` and "14". */
export function factTitle(fact: Pick<ViewFact, "key" | "value">): string {
  const key = fact.key.replace(/_/g, " ");
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}: ${fact.value}`.slice(0, 120);
}

function chapterLabel(id: string): string {
  try {
    return chapter(id as ChapterId).label;
  } catch {
    return "";
  }
}

export interface EvidenceIndex {
  refs(cites: readonly string[]): EvidenceRef[];
  item(ref: EvidenceRef): EvidenceItem | null;
}

export function evidenceIndex(
  stories: readonly ViewStory[],
  facts: readonly ViewFact[],
): EvidenceIndex {
  const storyByCode = new Map(stories.map((s) => [s.code, s] as const));
  const storyByLine = new Map<string, ViewStory>();
  for (const story of stories) for (const line of story.lineCodes) storyByLine.set(line, story);
  const factByCode = new Map(facts.map((f) => [f.code, f] as const));
  const storyById = new Map(stories.map((s) => [s.id, s] as const));
  const factById = new Map(facts.map((f) => [f.id, f] as const));

  return {
    refs(cites) {
      const out: EvidenceRef[] = [];
      const seen = new Set<string>();
      for (const cite of cites) {
        const story = storyByCode.get(cite) ?? storyByLine.get(cite);
        const fact = story ? undefined : factByCode.get(cite);
        const ref: EvidenceRef | null = story
          ? { id: story.id, kind: "story", title: story.nickname }
          : fact
            ? { id: fact.id, kind: "fact", title: factTitle(fact) }
            : null;
        if (!ref || seen.has(ref.id)) continue;
        seen.add(ref.id);
        out.push(ref);
      }
      return out;
    },
    item(ref) {
      if (ref.kind === "story") {
        const story = storyById.get(ref.id);
        if (!story) return null;
        const context = [chapterLabel(story.chapter), story.era].filter(Boolean).join(", ");
        return {
          ...ref,
          ...(context ? { context } : {}),
          ...(story.situation ? { excerpt: story.situation.slice(0, 400) } : {}),
          href: "/dossier?tab=stories",
        };
      }
      const fact = factById.get(ref.id);
      return fact ? { ...ref, context: "Fact Sheet", href: "/dossier?tab=facts" } : null;
    },
  };
}

export interface ProfileReadView {
  readings: LensReading[];
  lenses: LensFindingsData[];
  plan: FindingAction[];
  brand: Finding[];
}

export function profileReadView(input: {
  read: ProfileRead;
  stories: readonly ViewStory[];
  facts: readonly ViewFact[];
  levels: Partial<Record<LensId, CoverageLevel>>;
}): ProfileReadView {
  const index = evidenceIndex(input.stories, input.facts);
  const cited = <T extends { cites: readonly string[] }>(
    items: readonly T[],
    build: (item: T, evidence: EvidenceRef[], n: number) => Finding | FindingAction,
  ) =>
    items.flatMap((item, n) => {
      const evidence = index.refs(item.cites);
      return evidence.length > 0 ? [build(item, evidence, n)] : [];
    });

  const lenses = LENS_IDS.map((lens): LensFindingsData => {
    const read = input.read.lenses[lens];
    return {
      lens,
      level: input.levels[lens] ?? "none",
      helps: cited(read.helps, (h, evidence, n) => ({
        id: `${lens}-h${n}`,
        text: h.text,
        evidence,
      })),
      doubts: cited(read.doubts, (d, evidence, n) => ({
        id: `${lens}-d${n}`,
        text: d.text,
        evidence,
      })),
      actions: cited(read.do, (a, evidence, n) => ({
        id: `${lens}-a${n}`,
        text: a.action,
        time: a.time_estimate,
        evidence,
      })) as FindingAction[],
    };
  });

  const readings = LENS_IDS.map((lens): LensReading => ({
    lens,
    level: input.levels[lens] ?? "none",
    stories: input.stories
      .filter((s) => s.lenses.includes(lens))
      .map((s) => ({ id: s.id, title: s.nickname, ...(s.era ? { context: s.era } : {}) })),
  }));

  const plan = cited(input.read.strengthening_plan, (p, evidence, n) => ({
    id: `plan-${n}`,
    text: p.action,
    time: p.time_estimate,
    why: p.why,
    evidence,
  })) as FindingAction[];

  const brand = cited(input.read.brand_preview, (b, evidence, n) => ({
    id: `brand-${n}`,
    text: `${traitLabel(b.trait)}: ${b.why}`,
    evidence,
  }));

  return { readings, lenses, plan, brand };
}

/** Lens readings straight from the dossier, for the empty state and before the first read. */
export function readingsFromStories(
  stories: readonly ViewStory[],
  levels: Partial<Record<LensId, CoverageLevel>>,
): LensReading[] {
  return LENS_IDS.map((lens) => ({
    lens,
    level: levels[lens] ?? "none",
    stories: stories
      .filter((s) => s.lenses.includes(lens))
      .map((s) => ({ id: s.id, title: s.nickname, ...(s.era ? { context: s.era } : {}) })),
  }));
}
