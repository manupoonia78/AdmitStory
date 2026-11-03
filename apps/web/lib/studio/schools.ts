import "server-only";

import type { ArchetypeId } from "@admitstory/shared";
import { getDb } from "@admitstory/db";
import { packNeed, type NeedContext, type NeedFn } from "@admitstory/slots";
import { loadUserSchools } from "@/lib/strategy/server";
import { writtenPrompts } from "@/lib/strategy/pack";

// What the applicant's school list tells the Studio (spec §5.2, Phase 3): need() from the archetypes
// their schools' published prompts ask for, reapplicant questions when any school is a reapplication,
// and the school names dictation should expect. Schools without a published pack add only their name.

export interface StudioSchools {
  need: NeedFn;
  context: NeedContext;
  /** "Darden", "Kestrel Lake", in list order, for dictation keyterms. */
  schoolNames: string[];
}

export async function studioSchools(userId: string): Promise<StudioSchools> {
  const schools = await loadUserSchools(getDb(), userId);
  const asked = new Set<ArchetypeId>();
  for (const school of schools)
    if (school.pack)
      for (const prompt of writtenPrompts(school.pack))
        for (const id of prompt.archetypes) asked.add(id);
  return {
    need: packNeed(asked),
    context: { isReapplicant: schools.some((s) => s.row.isReapplicant) },
    schoolNames: schools.flatMap((s) => [s.row.school.name, s.row.school.shortName]),
  };
}
