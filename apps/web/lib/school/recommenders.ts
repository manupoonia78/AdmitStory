import "server-only";

import { getDb, listLorBriefs, listRecommenders } from "@admitstory/db";
import type { BriefView } from "@admitstory/shared/kit";
import type { FileEntry } from "@admitstory/ui";
import type { ChatTurn } from "@/lib/chat/types";
import { loadThread } from "@/lib/chat/server";
import { loadBriefView } from "@/lib/recommenders/view";
import type { SchoolTabsView } from "./tabs";

// The school's Recommenders tab (school workspace redesign): the recommenders writing for this
// school on the left, the selected one's brief in the middle, the chat that reshapes it on the
// right. Adding people and building briefs stays on /recommenders.

export interface SchoolRecommendersView {
  tabs: SchoolTabsView;
  files: FileEntry[];
  selected: {
    recommenderId: string;
    name: string;
    thread: string;
    brief: BriefView | null;
    turns: ChatTurn[];
  } | null;
}

export async function loadSchoolRecommenders(
  userId: string,
  tabs: SchoolTabsView,
  schoolCycleId: string,
  pick: string | null,
): Promise<SchoolRecommendersView> {
  const db = getDb();
  const [people, briefs] = await Promise.all([
    listRecommenders(db, userId, { userSchoolId: tabs.userSchoolId }),
    listLorBriefs(db, userId),
  ]);
  const briefFor = (recommenderId: string) =>
    briefs.find(
      (b) => b.recommenderId === recommenderId && b.schoolCycleIds.includes(schoolCycleId),
    ) ?? briefs.find((b) => b.recommenderId === recommenderId);
  const files: FileEntry[] = people.map((p) => {
    const brief = briefFor(p.id);
    return {
      key: p.id,
      title: p.name,
      group: "recommenders",
      status:
        brief?.status === "ready"
          ? "draft_ready"
          : brief?.status === "building"
            ? "drafting"
            : brief?.status === "failed"
              ? "failed"
              : "waiting",
    };
  });
  const person = people.find((p) => p.id === pick) ?? people[0];
  if (!person) return { tabs, files, selected: null };
  const row = briefFor(person.id);
  const brief = row ? await loadBriefView(userId, person.id, row.groupKey) : null;
  const thread = row ? `brief:${person.id}:${row.groupKey}` : null;
  const turns =
    thread && row?.content
      ? (
          await loadThread(userId, {
            kind: "brief",
            recommenderId: person.id,
            groupKey: row.groupKey,
          })
        ).turns
      : [];
  return {
    tabs,
    files,
    selected: { recommenderId: person.id, name: person.name, thread: thread ?? "", brief, turns },
  };
}
