// Home's headline (spec §5.1, screen A): the single most useful next step, in order of the
// journey: talk, read the Profile Read, add schools, preview, unlock, then the kit's own work.
// Pure, so the order is tested without a database.

export interface HomeFacts {
  stories: number;
  hasProfileRead: boolean;
  schools: {
    userSchoolId: string;
    name: string;
    published: boolean;
    status: string;
    preview: boolean;
    kit: {
      id: string;
      status: string;
      openNeeds: number;
      firstNeedDeliverable: string | null;
    } | null;
  }[];
}

export interface NextStep {
  title: string;
  action: string;
  href: string;
}

/** Below this many stories the Studio is still the best use of time. */
export const STORIES_BEFORE_READ = 2;

export function nextStep(facts: HomeFacts): NextStep {
  if (facts.stories < STORIES_BEFORE_READ)
    return {
      title: "Tell your first stories in Story Studio",
      action: "Start talking",
      href: "/studio",
    };
  const building = facts.schools.find(
    (s) => s.kit && (s.kit.status === "pending" || s.kit.status === "running"),
  );
  if (building?.kit)
    return {
      title: `Your ${building.name} kit is being built`,
      action: "Watch it come together",
      href: `/kits/${building.kit.id}`,
    };
  const needs = facts.schools.find((s) => s.kit && s.kit.status === "ready" && s.kit.openNeeds > 0);
  if (needs?.kit)
    return {
      title: `Answer ${needs.kit.openNeeds} ${needs.kit.openNeeds === 1 ? "question" : "questions"} to finish your ${needs.name} drafts`,
      action: "Answer them",
      href: needs.kit.firstNeedDeliverable
        ? `/workspace/${needs.kit.firstNeedDeliverable}`
        : `/kits/${needs.kit.id}`,
    };
  if (!facts.hasProfileRead)
    return {
      title: "See how an admissions reader is likely to read you",
      action: "Open your Profile Read",
      href: "/profile-read",
    };
  if (facts.schools.length === 0)
    return { title: "Add the schools you're considering", action: "Add schools", href: "/schools" };
  const toPreview = facts.schools.find((s) => s.published && !s.preview && !s.kit);
  if (toPreview)
    return {
      title: `Preview your ${toPreview.name} kit`,
      action: `Preview ${toPreview.name}`,
      href: `/schools/${toPreview.userSchoolId}/preview`,
    };
  const ready = facts.schools.find((s) => s.kit && s.kit.status === "ready");
  if (ready?.kit)
    return {
      title: `Your ${ready.name} drafts are ready to read`,
      action: "Open your kit",
      href: `/kits/${ready.kit.id}`,
    };
  const toUnlock = facts.schools.find((s) => s.published && s.preview && !s.kit);
  if (toUnlock)
    return {
      title: `Your ${toUnlock.name} preview is ready`,
      action: "Read the preview",
      href: `/schools/${toUnlock.userSchoolId}/preview`,
    };
  return {
    title: "Compare your schools and plan your rounds",
    action: "Open School Strategy",
    href: "/schools",
  };
}
