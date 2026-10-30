import {
  getBrand,
  getDb,
  getGoals,
  getProfile,
  getVoiceProfile,
  listFacts,
  listGoldenLines,
  listPeople,
  listStories,
} from "@admitstory/db";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { DossierScreen } from "./dossier-screen";

export const metadata: Metadata = { title: "Your Dossier" };

/**
 * The Applicant Dossier (spec §5.3, screen C): Fact Sheet, Story Bank, Brand and Voice. It is the
 * only thing the drafting engine ever reads about the applicant, so everything on it is theirs to
 * correct — including whether a story may be used at all (§14.3).
 */
export default async function DossierPage() {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const db = getDb();

  const [stories, facts, lines, people, brand, voice, goals, profile] = await Promise.all([
    listStories(db, userId),
    listFacts(db, userId),
    listGoldenLines(db, userId),
    listPeople(db, userId),
    getBrand(db, userId),
    getVoiceProfile(db, userId),
    getGoals(db, userId),
    getProfile(db, userId),
  ]);

  return (
    <DossierScreen
      stories={stories
        .filter((story) => story.mergedInto === null)
        .map((story) => ({
          id: story.id,
          code: story.code,
          nickname: story.nickname,
          era: story.era ?? "",
          context: story.context,
          chapter: story.chapter,
          situation: story.situation,
          stakes: story.stakes,
          actions: story.actions,
          result: story.result,
          reflection: story.reflection,
          numbers: story.numbers ?? [],
          traits: story.traits,
          lenses: story.lenses,
          status: story.status,
          missing: story.missing ?? [],
          sensitivity: story.sensitivity,
          consentToUse: story.consentToUse,
          peopleCodes: story.peopleCodes,
          lines: lines
            .filter((line) => line.storyId === story.id)
            .map((line) => ({
              id: line.id,
              code: line.code,
              text: line.text,
              starred: line.starred,
            })),
        }))}
      facts={facts.map((fact) => ({
        id: fact.id,
        code: fact.code,
        key: fact.key,
        value: fact.value,
        note: fact.note,
        approvedPhrasing: fact.approvedPhrasing,
        status: fact.status,
        sensitivity: fact.sensitivity,
        consentToUse: fact.consentToUse,
        otherValue: fact.conflict?.otherValue ?? null,
      }))}
      people={people.map((person) => ({
        id: person.id,
        code: person.code,
        name: person.name,
        roleInLife: person.roleInLife,
        mayName: person.mayName,
      }))}
      brand={
        brand
          ? {
              traits: brand.traits,
              positioningLine: brand.positioningLine,
              accepted: brand.acceptedAt !== null,
            }
          : null
      }
      voice={{
        card: voice?.card ?? null,
        stats: voice?.stats ?? null,
        tone: profile?.toneSetting ?? null,
        identity: profile?.voiceprint ?? null,
      }}
      goals={
        goals ? { shortTerm: goals.shortTerm, longTerm: goals.longTerm, planB: goals.planB } : null
      }
    />
  );
}
