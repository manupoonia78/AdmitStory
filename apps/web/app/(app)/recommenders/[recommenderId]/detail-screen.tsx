"use client";

import {
  briefSections,
  type BriefView,
  type Cite,
  type LorStoryFields,
  type RecommenderDetailView,
  type RecommendersPageView,
  type ReminderView,
  type StatusView,
} from "@admitstory/shared/kit";
import {
  BriefPlaceholder,
  BriefSheet,
  Button,
  CoverageBoard,
  CoverageFindingsList,
  IntakePanel,
  RECOMMENDER_TABS,
  RecommenderList,
  Sheet,
  SheetContent,
  StatusPanel,
  StoriesPanel,
  StoryFieldsForm,
  buildingLine,
  failedLine,
  firstNameOf,
  groupLabel,
  rebuildLabel,
  recommenderPrivacyLine,
  staleLine,
  useToast,
  type IntakeAnswerInput,
  type RecommenderTabId,
} from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IntakeRecordHost } from "../intake-record-host";

// Screen H for one recommender (spec §5.11, §6.10 H): the list on the left, the work on the
// right under four tabs. The tab lives in the URL, so switching one is a fresh server read of
// just that tab and the numbers are never stale.
//
// Two rules hold everywhere here: the applicant never sees what the recommender wrote, and the
// private link is never rendered (§14.3, plan decision 7). The Status tab shows dates and words.

export interface DetailScreenProps {
  detail: RecommenderDetailView;
  list: RecommendersPageView;
  tab: RecommenderTabId;
  brief: BriefView | null;
  groupKey: string;
  status: StatusView | null;
  timeZone: string;
  now: number;
}

export function DetailScreen({
  detail,
  list,
  tab,
  brief,
  groupKey,
  status,
  timeZone,
  now,
}: DetailScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [working, setWorking] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [telling, setTelling] = useState(false);
  const [writing, setWriting] = useState(false);

  const id = detail.recommender.id;
  const first = firstNameOf(detail.recommender.name);
  const base = `/recommenders/${id}`;

  function go(next: RecommenderTabId, group?: string) {
    const query = new URLSearchParams({ tab: next });
    if (group) query.set("group", group);
    router.push(`${base}?${query.toString()}`);
  }

  // 1–4 switch tabs (§6.12), outside text fields.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const index = Number(event.key) - 1;
      const next = RECOMMENDER_TABS[index];
      if (next) {
        event.preventDefault();
        go(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function send<T>(
    key: string,
    path: string,
    init: { method: string; body?: unknown; idempotent?: boolean },
  ): Promise<T | null> {
    setWorking(key);
    setProblem(null);
    try {
      const response = await fetch(path, {
        method: init.method,
        headers: {
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
          ...(init.idempotent ? { "idempotency-key": crypto.randomUUID() } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!response.ok) {
        setProblem(body?.error ?? "That didn't work. Try again.");
        return null;
      }
      return body as T;
    } catch {
      setProblem("That didn't work. Try again.");
      return null;
    } finally {
      setWorking(null);
    }
  }

  const after = (title: string) => {
    toast({ title });
    router.refresh();
  };

  /* Stories ---------------------------------------------------------------------------------- */

  async function tellStories(answers: IntakeAnswerInput[]) {
    const result = await send("intake", `/api/recommenders/${id}/stories`, {
      method: "POST",
      idempotent: true,
      body: { kind: "intake", answers },
    });
    if (!result) return;
    setTelling(false);
    after("Stories pulled out of your answers");
  }

  async function addStory(story: LorStoryFields) {
    const result = await send("story", `/api/recommenders/${id}/stories`, {
      method: "POST",
      body: { kind: "manual", story },
    });
    if (!result) return;
    setWriting(false);
    after("Story added");
  }

  async function saveStory(storyId: string, patch: Partial<LorStoryFields>) {
    if (
      await send("story", `/api/recommenders/${id}/stories/${storyId}`, {
        method: "PATCH",
        body: patch,
      })
    )
      after("Story updated");
  }

  async function deleteStory(storyId: string) {
    if (await send("story", `/api/recommenders/${id}/stories/${storyId}`, { method: "DELETE" }))
      after("Story deleted");
  }

  /* Brief ------------------------------------------------------------------------------------ */

  async function buildBrief(group?: string) {
    const result = await send("brief", `/api/recommenders/${id}/brief`, {
      method: "POST",
      idempotent: true,
      body: group ? { groupKey: group } : {},
    });
    if (result) after(`Building ${first}'s brief`);
  }

  async function exportBrief(format: "pdf" | "text") {
    setWorking(`export:${format}`);
    setProblem(null);
    try {
      const response = await fetch(`/api/recommenders/${id}/brief/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group: groupKey, format }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setProblem(body?.error ?? "That didn't work. Try again.");
        return;
      }
      if (format === "text") {
        const { text } = (await response.json()) as { text: string };
        await navigator.clipboard.writeText(text);
        toast({ title: "Email text copied" });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `brief-for-${first.toLowerCase()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setProblem("That didn't work. Try again.");
    } finally {
      setWorking(null);
    }
  }

  /* Coverage and status ---------------------------------------------------------------------- */

  async function rebuildPlan() {
    if (await send("plan", "/api/recommenders/plan", { method: "POST", body: {} }))
      after("Coverage plan rebuilt");
  }

  async function dismissFinding(findingId: string) {
    if (
      await send("finding", "/api/consistency", {
        method: "POST",
        body: { action: "dismiss", findingId },
      })
    )
      after("Marked as different");
  }

  async function invite(body: Record<string, unknown>, title: string) {
    if (
      await send(`invite:${String(body.action)}`, `/api/recommenders/${id}/invite`, {
        method: "POST",
        idempotent: true,
        body,
      })
    )
      after(title);
  }

  async function patchReminder(reminder: ReminderView, patch: Record<string, unknown>) {
    if (
      await send(`reminder:${reminder.id}`, `/api/recommenders/${id}/reminders/${reminder.id}`, {
        method: "PATCH",
        body: patch,
      })
    )
      router.refresh();
  }

  const summary = detail.briefs.find((item) => item.groupKey === groupKey) ?? detail.briefs[0];
  const sourceLabel = (cite: Cite) => brief?.sources[cite]?.label ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12 lg:flex-row lg:gap-10">
      <aside className="flex flex-col gap-3 lg:w-62 lg:shrink-0">
        <RecommenderList
          items={list.recommenders}
          selectedId={id}
          hrefFor={(other) => `/recommenders/${other}`}
          onSelect={(other) => router.push(`/recommenders/${other}`)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-display-sm text-text">{detail.recommender.name}</h1>
          <nav aria-label="Recommender sections">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {RECOMMENDER_TABS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={item.id === tab ? "page" : undefined}
                    onClick={() => go(item.id)}
                    className={
                      item.id === tab
                        ? "min-h-11 border-b-2 border-signal text-text"
                        : "min-h-11 border-b-2 border-transparent text-text-soft hover:text-text"
                    }
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p aria-live="polite" className="min-h-[1lh] text-sm text-needs">
            {problem}
          </p>
        </header>

        {tab === "stories" ? (
          <StoriesPanel
            firstName={first}
            stories={detail.stories}
            missing={detail.intake.extracted?.missing ?? []}
            lockedReason={detail.intake.lockedReason}
            onSaveStory={(storyId, patch) => void saveStory(storyId, patch)}
            onDeleteStory={(storyId) => void deleteStory(storyId)}
            actions={
              <>
                <Button onClick={() => setTelling(true)}>Tell {first}&rsquo;s stories</Button>
                <Button variant="secondary" onClick={() => setWriting(true)}>
                  Add one myself
                </Button>
              </>
            }
          />
        ) : null}

        {tab === "brief" ? (
          <div className="flex flex-col gap-4">
            {detail.briefs.length > 1 ? (
              <nav aria-label="Which schools" className="flex flex-wrap gap-2">
                {detail.briefs.map((item) => (
                  <Button
                    key={item.groupKey}
                    size="sm"
                    variant={item.groupKey === groupKey ? "secondary" : "quiet"}
                    onClick={() => go("brief", item.groupKey)}
                  >
                    {groupLabel(item.schools)}
                  </Button>
                ))}
              </nav>
            ) : null}

            {summary?.status === "building" ? (
              <BriefPlaceholder
                headings={[`A note from you`, "How to use this brief", "What admissions look for"]}
                message={buildingLine(first, detail.stories.length)}
              />
            ) : brief?.brief && brief.meta ? (
              <BriefSheet
                sections={briefSections(brief.brief, brief.meta, "applicant")}
                sourceLabel={sourceLabel}
                now={now}
                timeZone={timeZone}
                notice={
                  brief.stale ? (
                    <p className="text-needs">
                      {staleLine(
                        brief.builtAt ? Date.parse(brief.builtAt) : null,
                        summary?.costsRefinement ?? false,
                        timeZone,
                      )}
                    </p>
                  ) : null
                }
                toolbar={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={working === "export:pdf"}
                      onClick={() => void exportBrief("pdf")}
                    >
                      Download PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={working === "export:text"}
                      onClick={() => void exportBrief("text")}
                    >
                      Copy email text
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={working === "brief"}
                      onClick={() => void buildBrief(groupKey)}
                    >
                      {rebuildLabel(first)}
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-text-soft">
                  {summary?.status === "failed"
                    ? failedLine(first)
                    : `${first}'s brief isn't built yet. Their stories become the brief.`}
                </p>
                <Button
                  loading={working === "brief"}
                  disabled={detail.stories.length === 0}
                  onClick={() => void buildBrief(groupKey)}
                >
                  Build {first}&rsquo;s brief
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {tab === "coverage" ? (
          <div className="flex flex-col gap-6">
            <CoverageBoard
              coverage={detail.coverage}
              findings={detail.coverage.findings.filter((finding) => !finding.dismissed)}
            />
            <CoverageFindingsList
              findings={detail.coverage.findings.filter((finding) => !finding.dismissed)}
              actions={(finding) => (
                <Button
                  size="sm"
                  variant="quiet"
                  loading={working === "finding"}
                  onClick={() => void dismissFinding(finding.id)}
                >
                  These are different
                </Button>
              )}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                loading={working === "plan"}
                onClick={() => void rebuildPlan()}
              >
                Rebuild the plan
              </Button>
              {detail.coverage.planStale ? (
                <p className="text-sm text-needs">
                  Your stories have changed since this plan was made.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "status" ? (
          status ? (
            <StatusPanel
              firstName={first}
              status={status}
              timeZone={timeZone}
              working={working}
              onSend={(previewHash) =>
                void invite({ action: "send", previewHash }, `Invitation sent to ${first}`)
              }
              onSchedule={(previewHash) =>
                void invite({ action: "schedule", previewHash }, "Invitation scheduled")
              }
              onReissue={() => void invite({ action: "reissue" }, "A fresh link is on its way")}
              onRevoke={() => void invite({ action: "revoke" }, "The link is turned off")}
              onRead={(reminder) =>
                void patchReminder(reminder, { previewed: reminder.preview.previewHash })
              }
              onToggle={(reminder, on) =>
                void patchReminder(
                  reminder,
                  on ? { on: true, previewHash: reminder.preview.previewHash } : { on: false },
                )
              }
              onNote={(reminder, note) => void patchReminder(reminder, { note: note || null })}
            />
          ) : (
            <p className="text-text-soft">{recommenderPrivacyLine(first)}</p>
          )
        ) : null}
      </div>

      <Sheet open={telling} onOpenChange={setTelling}>
        <SheetContent title={`Tell ${first}'s stories`}>
          <IntakePanel
            firstName={first}
            given={detail.intake.answers}
            working={working === "intake"}
            blockedReason={detail.intake.lockedReason}
            onSubmit={(answers) => void tellStories(answers)}
            renderRecorder={(onDictated) => <IntakeRecordHost onDictated={onDictated} />}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={writing} onOpenChange={setWriting}>
        <SheetContent title="Add a story yourself">
          <StoryFieldsForm
            firstName={first}
            saveLabel="Add this story"
            onSave={(story) => void addStory(story)}
            onCancel={() => setWriting(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
