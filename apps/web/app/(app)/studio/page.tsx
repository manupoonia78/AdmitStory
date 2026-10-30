import { getDb, getResumableSession, listStories } from "@admitstory/db";
import { DEFAULT_IDENTITY } from "@admitstory/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadKnowledge } from "@/lib/studio/state";
import { StudioScreen } from "./studio-screen";

export const metadata: Metadata = { title: "Story Studio" };

/**
 * Story Studio (spec §5.2, screen B). The server renders everything that is already known — the
 * shelf, the coverage meter, the facts counter — so the screen arrives whole rather than empty;
 * the first question is fetched by the client, which is also what resumes a session.
 */
export default async function StudioPage() {
  const { session, profile } = await requireOnboardedUser();
  // First run ends in the Studio (spec §5.1), so an account that has not done it starts there.
  if (!profile.firstRunCompletedAt) redirect("/first-run");

  const userId = session.user.id;
  const db = getDb();
  const [knowledge, open, stories] = await Promise.all([
    loadKnowledge(userId),
    getResumableSession(db, userId),
    listStories(db, userId),
  ]);

  return (
    <StudioScreen
      mode={profile.studioMode ?? "standard"}
      resumable={
        open
          ? {
              id: open.id,
              chapter: open.currentChapter,
              mode: open.mode,
            }
          : null
      }
      identity={profile.voiceprint ?? DEFAULT_IDENTITY}
      hue={profile.voiceprintHue}
      initialStories={stories
        .filter((story) => story.mergedInto === null)
        .map((story) => ({
          id: story.id,
          code: story.code,
          nickname: story.nickname,
          era: story.era ?? "",
          context: story.context,
          traits: story.traits,
          status: story.status,
        }))}
      initialCoverage={knowledge.coverage}
      initialFactCount={knowledge.factCount}
    />
  );
}
