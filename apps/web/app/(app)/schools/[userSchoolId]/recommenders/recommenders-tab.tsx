"use client";

import { briefSections, type Cite } from "@admitstory/shared/kit";
import { BriefSheet, Button, ChatPanel, FilesPane, WorkspaceLayout } from "@admitstory/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SchoolHeader } from "@/components/school-header";
import { useChat } from "@/lib/chat/use-chat";
import type { SchoolRecommendersView } from "@/lib/school/recommenders";

// The school's Recommenders tab (school workspace redesign): who writes for this school on the
// left, the selected brief in the middle, and the chat that reshapes it on the right ("make the
// second point about the Lagos launch", "less formal cover note").

const BRIEF_ASKS = [
  "Make the points more concrete",
  "Warmer cover note",
  "Focus on leadership",
  "Shorter",
];

export function RecommendersTab({
  initial,
  now,
  timeZone,
}: {
  initial: SchoolRecommendersView;
  now: number;
  timeZone: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const selected = view.selected;
  const brief = selected?.brief;
  const href = (key: string) => `?r=${key}`;

  const recommenderId = selected?.recommenderId;
  const groupKey = selected?.brief?.groupKey;
  const reload = useCallback(async () => {
    if (!recommenderId || !groupKey) return;
    const response = await fetch(
      `/api/recommenders/${recommenderId}/brief?group=${encodeURIComponent(groupKey)}`,
    ).catch(() => null);
    if (!response?.ok) return;
    const next = (await response.json()) as NonNullable<typeof brief>;
    setView((v) => (v.selected ? { ...v, selected: { ...v.selected, brief: next } } : v));
  }, [recommenderId, groupKey]);

  const chat = useChat(selected?.thread || "none", {
    initial: selected?.turns ?? [],
    onChanged: reload,
  });
  const sourceLabel = (cite: Cite) => brief?.sources[cite]?.label ?? null;
  const ready = Boolean(brief?.brief && brief.meta);

  const document = !selected ? (
    <div className="mx-auto flex max-w-essay flex-col gap-4 px-6 py-12">
      <h2 className="font-display text-[1.75rem] leading-tight text-text">
        No one is writing for {view.tabs.school} yet
      </h2>
      <p className="text-text-soft">
        Add the people who will recommend you and tell us what they saw you do. We turn that into a
        brief for each of them: what to cover for {view.tabs.school}, with the stories to tell.
      </p>
      <div>
        <Button asChild>
          <Link href="/recommenders">Add a recommender</Link>
        </Button>
      </div>
    </div>
  ) : ready && brief?.brief && brief.meta ? (
    <div className="flex justify-center px-4 py-8 sm:px-8">
      <BriefSheet
        sections={briefSections(brief.brief, brief.meta, "applicant")}
        sourceLabel={sourceLabel}
        now={now}
        timeZone={timeZone}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="meta text-text-soft">Brief for {selected.name}</p>
            <Link
              href={`/recommenders/${selected.recommenderId}`}
              className="text-sm text-text-soft underline-offset-4 hover:text-text hover:underline"
            >
              Invite, export and reminders
            </Link>
          </div>
        }
      />
    </div>
  ) : (
    <div className="mx-auto flex max-w-essay flex-col gap-4 px-6 py-12">
      <h2 className="font-display text-[1.75rem] leading-tight text-text">
        {brief?.status === "building"
          ? `Building ${selected.name}'s brief`
          : `${selected.name}'s brief isn't built yet`}
      </h2>
      <p className="text-text-soft">
        {brief?.status === "building"
          ? "About a minute. It appears here as soon as it's done."
          : `Tell us a few stories ${selected.name} saw, then build the brief. You can shape it here afterwards.`}
      </p>
      <div>
        <Button asChild variant="secondary">
          <Link href={`/recommenders/${selected.recommenderId}`}>Open {selected.name}</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <WorkspaceLayout
      header={<SchoolHeader view={view.tabs} active="recommenders" />}
      files={
        <FilesPane
          heading="Recommenders"
          files={view.files}
          selectedKey={selected?.recommenderId ?? null}
          onSelect={(key) => router.push(href(key))}
          hrefFor={href}
        />
      }
      document={document}
      coach={
        <ChatPanel
          turns={chat.turns}
          busy={chat.busy}
          onSend={ready ? chat.send : () => undefined}
          onUndo={(id) => void chat.undo(id)}
          subject={selected ? `${selected.name}'s brief` : "a brief"}
          suggestions={ready ? BRIEF_ASKS : []}
          notice={
            chat.error ? (
              <span className="text-risk">{chat.error}</span>
            ) : !ready ? (
              "The chat opens once this brief is built."
            ) : null
          }
        />
      }
    />
  );
}
