import type { EvidenceItem } from "@admitstory/ui";
import type { Metadata } from "next";
import { profileReadRequested } from "@/inngest/events";
import { requireOnboardedUser } from "@/lib/app-user";
import { MIN_STORIES_FOR_READ } from "@/lib/profile-read/policy";
import { loadProfileRead, runProfileRead } from "@/lib/profile-read/server";
import { evidenceIndex, profileReadView, readingsFromStories } from "@/lib/profile-read/view";
import { dispatch } from "@/lib/strategy/dispatch";
import { ProfileReadHost } from "./profile-read-host";

export const metadata: Metadata = { title: "Profile Read" };

/**
 * Profile Read (spec §5.4, screen D): how an admissions reader is likely to see the applicant, by
 * the four lenses, every claim citing their own stories and facts. The first visit with enough
 * stories queues the first read; after that it rebuilds on its own at most once a day.
 */
export default async function ProfileReadPage() {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const data = await loadProfileRead(userId);
  const enough = data.stories.length >= MIN_STORIES_FOR_READ;
  if (!data.read && enough)
    await dispatch(profileReadRequested.create({ userId, reason: "first_visit" }), () =>
      runProfileRead(userId, "first_visit"),
    );

  const view = data.read
    ? profileReadView({
        read: data.read.read,
        stories: data.stories,
        facts: data.facts,
        levels: data.levels,
      })
    : null;
  // The drawer's contents, resolved here so the browser never needs the whole dossier.
  const index = evidenceIndex(data.stories, data.facts);
  const evidence: Record<string, EvidenceItem> = {};
  for (const story of data.stories) {
    const item = index.item({ id: story.id, kind: "story", title: story.nickname });
    if (item) evidence[story.id] = item;
  }
  for (const fact of data.facts) {
    const [ref] = index.refs([fact.code]);
    const item = ref ? index.item(ref) : null;
    if (item) evidence[fact.id] = item;
  }

  return (
    <ProfileReadHost
      readings={view?.readings ?? readingsFromStories(data.stories, data.levels)}
      lenses={view?.lenses ?? []}
      plan={view?.plan ?? []}
      brand={view?.brand ?? []}
      evidence={evidence}
      version={data.version}
      builtAt={data.builtAt}
      behind={data.behind}
      state={data.read ? "ready" : enough ? "building" : "thin"}
    />
  );
}
