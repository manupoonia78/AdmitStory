import { getDb, getResumableSession, listStories } from "@admitstory/db";
import { DEFAULT_IDENTITY } from "@admitstory/shared";
import { VoiceprintStill, paramsFromIdentity, voiceHueStyle } from "@admitstory/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadKnowledge } from "@/lib/studio/state";
import { remainingVoiceSeconds, voiceSettingsOf } from "@/lib/voice/server";
import { StudioScreen } from "./studio-screen";
import { toCard } from "./types";

export const metadata: Metadata = { title: "Story Studio" };

/**
 * Story Studio (spec §5.2, screen B). The server renders everything that is already known — the
 * shelf, the coverage meter, the facts counter — so the screen arrives whole rather than empty;
 * the first question is fetched by the client, which is also what resumes a session. Voice comes
 * with what decides whether it is on offer: the read-aloud setting, the free minutes left and a
 * verified email (§12.4).
 */
export default async function StudioPage() {
  const { session, profile } = await requireOnboardedUser();
  // First run ends in the Studio (spec §5.1), so an account that has not done it starts there.
  if (!profile.firstRunCompletedAt) redirect("/first-run");

  const userId = session.user.id;
  const db = getDb();
  const [knowledge, open, stories, remainingSeconds] = await Promise.all([
    loadKnowledge(userId),
    getResumableSession(db, userId),
    listStories(db, userId),
    remainingVoiceSeconds(userId),
  ]);
  const identity = profile.voiceprint ?? DEFAULT_IDENTITY;

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
      identity={identity}
      still={
        <span aria-hidden className="block size-full">
          <VoiceprintStill identity={identity} size="fill" label="" />
        </span>
      }
      hueStyle={voiceHueStyle(profile.voiceprintHue ?? paramsFromIdentity(identity).hueIndex)}
      hueChosen={profile.voiceprintHue !== null}
      voice={{
        readAloud: voiceSettingsOf(profile).readAloud,
        remainingSeconds,
        emailVerified: session.user.emailVerified === true,
      }}
      initialStories={stories
        .filter((story) => story.mergedInto === null)
        .map((story) =>
          toCard({
            id: story.id,
            nickname: story.nickname,
            era: story.era ?? "",
            context: story.context,
            traits: story.traits,
            status: story.status,
          }),
        )}
      initialCoverage={knowledge.coverage}
      initialFactCount={knowledge.factCount}
    />
  );
}
