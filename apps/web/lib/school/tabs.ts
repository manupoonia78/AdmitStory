import type { FileEntry, FileGroupId } from "@admitstory/ui";

// The tabs inside a school (school workspace redesign): everything the school asks for, one tab
// per kind, each with the document in the middle and the chat on the right. Plain, so client
// screens and server pages share it.

export type SchoolTabId = "essays" | "application" | "video" | "recommenders" | "resume";

export interface SchoolTab {
  id: SchoolTabId;
  label: string;
  href: string;
  /** Items in the tab that need the applicant. */
  needs?: number;
}

export interface SchoolTabsView {
  userSchoolId: string;
  school: string;
  cycle: string;
  tabs: SchoolTab[];
}

/** Which Files groups each document tab lists on its left. */
export const TAB_GROUPS: Record<"essays" | "application" | "video", readonly FileGroupId[]> = {
  essays: ["essays", "short_answers"],
  application: ["form"],
  video: ["video"],
};

export function tabOfGroup(group: FileGroupId): SchoolTabId {
  if (group === "form") return "application";
  if (group === "video") return "video";
  if (group === "recommenders") return "recommenders";
  if (group === "resume") return "resume";
  return "essays";
}

export const schoolHref = (userSchoolId: string, tab?: "recommenders" | "resume") =>
  tab ? `/schools/${userSchoolId}/${tab}` : `/schools/${userSchoolId}`;

/** The tabs for one school, from its Files list (deliverables only; the résumé and briefs are tabs). */
export function schoolTabs(
  base: { userSchoolId: string; school: string; cycle: string },
  files: readonly FileEntry[],
): SchoolTabsView {
  const tabs: SchoolTab[] = [];
  for (const [id, label] of [
    ["essays", "Essays"],
    ["application", "Application"],
    ["video", "Video"],
  ] as const) {
    const inTab = files.filter((f) => TAB_GROUPS[id].includes(f.group));
    const first = inTab[0];
    if (!first) continue;
    const needs = inTab.filter((f) => f.status === "needs_you").length;
    tabs.push({ id, label, href: `/workspace/${first.key}`, ...(needs > 0 ? { needs } : {}) });
  }
  tabs.push({
    id: "recommenders",
    label: "Recommenders",
    href: schoolHref(base.userSchoolId, "recommenders"),
  });
  tabs.push({ id: "resume", label: "Résumé", href: schoolHref(base.userSchoolId, "resume") });
  return { ...base, tabs };
}

/** The Files list a document tab shows: only its own groups. */
export function filesForTab(files: readonly FileEntry[], tab: SchoolTabId): FileEntry[] {
  if (tab === "recommenders" || tab === "resume") return [];
  return files.filter((f) => TAB_GROUPS[tab].includes(f.group));
}
