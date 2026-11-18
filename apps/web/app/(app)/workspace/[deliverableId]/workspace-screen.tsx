"use client";

import {
  AuthorshipBanner,
  Button,
  ChatPanel,
  CheckList,
  CoachSheet,
  ConsistencyList,
  Dialog,
  DialogContent,
  ExportMenu,
  FeedbackControl,
  FileStrip,
  LimitCounter,
  NeedComposer,
  OptionSplit,
  OptionsTab,
  VerifyList,
  VersionScrubber,
  WhyThisDraft,
  WorkspaceLayout,
  YourWordsLegend,
  YourWordsText,
  YourWordsToggle,
  countFor,
  type AiPolicyStance,
  type CoachTab,
  type ExportFormat,
  type OptionSummary,
  type RefineRequest,
  type WorkspaceView as LayoutView,
} from "@admitstory/ui";
import { ChatCircleTextIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import type { DocEdit } from "@admitstory/ui/editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { ModelCredit } from "@/components/model-seal";
import { SchoolHeader } from "@/components/school-header";
import { useChat } from "@/lib/chat/use-chat";
import { MarginNotes, notesFromWhy } from "./margin-notes";
import { filesForTab, schoolHref, schoolTabs, tabOfGroup } from "@/lib/school/tabs";
import type { WorkspaceView } from "@/lib/workspace/view";

// Screen G (spec §5.8, §6.10 G; direction doc G), inside the school's tabs. The tab's items on
// the left, the document in the middle, the chat on the right: say what to change and the draft
// changes, with Undo on every change. Edits save as the applicant's own version a moment after
// they stop typing.

const SAVE_DEBOUNCE_MS = 1_500;

/** One-tap requests in the chat, by kind of document. */
const ESSAY_ASKS = [
  "Make the opening stronger",
  "Cut it to the limit",
  "Sound more like me",
  "Make the reflection deeper",
  "Try a different story",
];
const VIDEO_ASKS = ["Make the points shorter", "Add a point about my goals", "Less formal"];

/** What the canvas shows before TipTap arrives: the same draft, as text, in the same place. */
const CanvasStandIn = createContext<ReactNode>(null);

function CanvasLoading() {
  return <>{useContext(CanvasStandIn)}</>;
}

/** TipTap loads after first paint (spec §6.11); until then the draft renders as text. */
const DocCanvas = dynamic(() => import("./doc-canvas-view").then((mod) => mod.DocCanvas), {
  ssr: false,
  loading: () => <CanvasLoading />,
});

async function send(url: string, method: string, body?: unknown): Promise<Response | null> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
}

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  if (!response) return fallback;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function WorkspaceScreen({ initial }: { initial: WorkspaceView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [tab, setTab] = useState<CoachTab>("chat");
  const [yourWords, setYourWords] = useState(false);
  /** The sweep plays only when the view is turned on by pointer (SPEC §6.9). */
  const [sweep, setSweep] = useState(false);
  const [layoutView, setLayoutView] = useState<LayoutView>("document");
  const [coachOpen, setCoachOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [need, setNeed] = useState<WorkspaceView["needs"][number] | null>(null);
  const [needStatus, setNeedStatus] = useState<"idle" | "saving">("idle");
  const [, setRefineStatus] = useState<"idle" | "working" | "failed">("idle");
  const [undo, setUndo] = useState<{ previousId: string; summary: string } | null>(null);
  const [compare, setCompare] = useState<{
    label: string;
    paragraphs: string[];
    draftId: string;
  } | null>(null);
  const [drafting, setDrafting] = useState<OptionSummary["label"] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<DocEdit | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { deliverable, draft } = view;
  const reload = useCallback(async () => {
    const response = await send(`/api/deliverables/${deliverable.id}`, "GET");
    if (response?.ok) setView((await response.json()) as WorkspaceView);
  }, [deliverable.id]);

  const chat = useChat(`deliverable:${deliverable.id}`, {
    onChanged: async () => {
      await flush();
      await reload();
    },
  });
  const fileHref = (key: string) =>
    key === "resume"
      ? schoolHref(view.userSchoolId, "resume")
      : key === "recommenders"
        ? schoolHref(view.userSchoolId, "recommenders")
        : `/workspace/${key}`;
  const activeTab = tabOfGroup(view.files.find((f) => f.key === deliverable.id)?.group ?? "essays");
  const tabs = schoolTabs(
    { userSchoolId: view.userSchoolId, school: view.school, cycle: view.cycle },
    view.files,
  );

  // While an option drafts in the background, look again every few seconds until it lands.
  const optionLanded =
    drafting !== null && view.options.some((o) => o.label === drafting && o.drafted);
  const draftingNow = optionLanded ? null : drafting;
  useEffect(() => {
    if (!draftingNow) return;
    const t = setInterval(() => void reload(), 3_000);
    return () => clearInterval(t);
  }, [draftingNow, reload]);

  const flush = useCallback(async () => {
    const edit = pending.current;
    pending.current = null;
    if (!edit || !draft) return;
    const response = await send(`/api/drafts/${draft.id}/save`, "POST", {
      paragraphs: edit.paragraphs.map((p) => ({ id: p.id, sentences: p.sentences })),
      lockedParagraphs: edit.paragraphs.filter((p) => p.locked).map((p) => p.id),
    });
    if (!response?.ok) {
      setError(
        await errorOf(
          response,
          "Your edits didn't save. Check your connection; they're still here.",
        ),
      );
      return;
    }
    await reload();
  }, [draft, reload]);

  function onEdit(edit: DocEdit) {
    pending.current = edit;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  async function refine(request: RefineRequest) {
    if (!draft) return;
    setRefineStatus("working");
    setError("");
    await flush();
    const response = await send(`/api/drafts/${draft.id}/refine`, "POST", {
      instruction: request.instruction,
    });
    if (!response?.ok) {
      setRefineStatus("failed");
      setError(await errorOf(response, "Nothing changed. Try again, or say it another way."));
      return;
    }
    const body = (await response.json()) as { changed: string[]; summary: string; over: number };
    setRefineStatus("idle");
    const ids = draft.paragraphs.map((p) => p.id);
    const first = body.changed.map((id) => ids.indexOf(id) + 1).find((n) => n > 0);
    setUndo({ previousId: draft.id, summary: body.summary });
    setStatus(
      `${first ? `Paragraph ${first} rewritten.` : "Draft revised."} Review the change.${body.over > 0 ? ` ${body.over} over the limit.` : ""}`,
    );
    await reload();
  }

  async function undoChange() {
    if (!undo) return;
    const response = await send(`/api/drafts/${undo.previousId}/restore`, "POST");
    setUndo(null);
    if (response?.ok) {
      setStatus("Change undone.");
      await reload();
    }
  }

  async function answerNeed(answer: string) {
    if (!need) return;
    setNeedStatus("saving");
    const response = await send(`/api/needs/${need.id}/answer`, "POST", {
      text: answer,
      via: "text",
    });
    setNeedStatus("idle");
    if (!response?.ok) {
      setError(await errorOf(response, "Your answer didn't save. Try again."));
      return;
    }
    setNeed(null);
    setStatus("Saved to your dossier. The paragraph now uses it.");
    await reload();
  }

  async function exportAs(format: ExportFormat) {
    if (!draft) return;
    const response = await send(`/api/drafts/${draft.id}/export`, "POST", { format });
    if (!response?.ok) {
      setError(await errorOf(response, "The export didn't finish. Try again."));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deliverable.title}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function markFinal() {
    const response = await send(`/api/deliverables/${deliverable.id}/mark-final`, "POST", {
      final: !draft?.isFinal,
    });
    if (!response?.ok) return;
    const body = (await response.json()) as { open: { mustFix: number; verify: number } };
    const open = body.open.mustFix + body.open.verify;
    setStatus(
      draft?.isFinal
        ? "Marked as not final."
        : open > 0
          ? `Marked final. ${open} ${open === 1 ? "item is" : "items are"} still open in Checks and Verify.`
          : "Marked final.",
    );
    await reload();
  }

  async function openCompare(label: OptionSummary["label"]) {
    const option = view.options.find((o) => o.label === label);
    if (!option?.draftId) return;
    const response = await send(`/api/drafts/${option.draftId}`, "GET");
    if (!response?.ok) return;
    const body = (await response.json()) as {
      draft: { content: { paragraphs: { sentences: { text: string }[] }[] } };
    };
    setCompare({
      label: `Option ${label}`,
      draftId: option.draftId,
      paragraphs: body.draft.content.paragraphs.map((p) =>
        p.sentences.map((s) => s.text).join(" "),
      ),
    });
  }

  async function applyOption(draftId: string) {
    const response = await send(`/api/deliverables/${deliverable.id}/use-option`, "POST", {
      draftId,
    });
    setCompare(null);
    if (response?.ok) {
      setStatus("Option in use. The previous draft is in the version history.");
      await reload();
    }
  }

  const canvasNeeds = view.needs.flatMap((n) =>
    n.paragraphId
      ? [
          {
            paragraph_id: n.paragraphId,
            after_sentence: n.afterSentence ?? 0,
            question: n.question,
            approx_words: n.approxWords,
          },
        ]
      : [],
  );
  const counted = draft && deliverable.rule ? countFor(draft.text, deliverable.rule) : 0;
  const mustFix = view.checks.filter((c) => c.severity === "must").length + view.consistency.length;
  const openVerify = view.verify.filter((v) => v.status === "open").length;
  const current = view.options.find((o) => o.inUse);

  const toggleYourWords = (on: boolean, via: "pointer" | "key") => {
    setSweep(on && via === "pointer");
    setYourWords(on);
  };
  const openPanel = (next: CoachTab) => {
    setTab(next);
    setLayoutView("coach");
    setCoachOpen(true);
  };
  const notes = useMemo(() => notesFromWhy(view.why), [view.why]);
  const prose = Boolean(draft && draft.paragraphs.length > 0 && !draft.coach && !draft.video);

  const documentPane = (
    <article className="ws-sheet mx-auto flex w-full max-w-[44rem] flex-col gap-6 rounded-paper bg-sheet px-6 py-8 text-sheet-text shadow-(--shadow-paper) sm:px-12 sm:py-12 lg:px-14 min-[90rem]:max-w-[57.5rem]">
      <header className="flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <h1 className="label pt-0.5">{deliverable.title}</h1>
          {deliverable.rule && draft ? (
            <LimitCounter
              count={counted}
              limit={deliverable.rule.limit}
              unit={deliverable.rule.unit}
            />
          ) : null}
        </div>
        <p className="mt-4 max-w-[38rem] font-reading text-lg leading-normal text-text-soft italic">
          {deliverable.prompt}
        </p>
        {view.why.story && prose ? (
          <p className="note mt-3 text-accent">{`From your story: ${view.why.story.title}`}</p>
        ) : null}
        {draft && draft.paragraphs.length > 0 ? (
          <div className="mt-5">
            <ModelCredit />
          </div>
        ) : null}
        {yourWords ? <YourWordsLegend className="mt-5 max-w-[38rem]" /> : null}
        <div className="mt-5 max-w-[38rem] empty:hidden">
          <AuthorshipBanner
            mode={deliverable.mode}
            stance={(view.policy?.stance ?? "unknown") as AiPolicyStance}
            school={view.school}
            policy={
              view.policy?.url && view.policy.verifiedAt
                ? { url: view.policy.url, verifiedAt: view.policy.verifiedAt }
                : null
            }
            disclosure={
              view.policy?.stance === "permitted_with_disclosure"
                ? { text: view.policy.disclosure ?? "", onChange: () => {} }
                : null
            }
            onChooseMode={(mode) =>
              void send(`/api/deliverables/${deliverable.id}`, "PATCH", {
                authorshipMode: mode,
              }).then(reload)
            }
          />
        </div>
        <span aria-hidden className="mt-8 h-px w-full bg-edge" />
      </header>

      {draft?.stale ? (
        <div className="flex flex-col items-start gap-2 border-l-2 border-needs pl-4">
          <p className="text-text">
            {draft.staleReason ? `${draft.staleReason}. ` : ""}This draft was written before that
            change. Update it?
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() =>
                void refine({
                  instruction: `Update the draft to match my dossier: ${draft.staleReason ?? "a fact changed"}.`,
                  action: null,
                })
              }
            >
              Update the draft
            </Button>
            <Button
              variant="quiet"
              onClick={() =>
                void send(`/api/drafts/${draft.id}`, "PATCH", { stale: false }).then(reload)
              }
            >
              Keep it as it is
            </Button>
          </div>
        </div>
      ) : null}

      {!draft ? (
        <p className="text-text-soft">
          This one isn&apos;t drafted yet. It appears here as soon as it is.
        </p>
      ) : draft.coach ? (
        <section className="flex flex-col gap-6" aria-label="Coaching beats">
          <p className="text-text">
            {view.school}&apos;s policy asks you to write this one yourself. Here is the shape, with
            your own lines to build from.
          </p>
          <ol className="flex flex-col gap-5">
            {draft.coach.beats.map((beat, i) => (
              <li key={i} className="flex flex-col gap-2 border-t border-edge pt-4">
                <p className="font-medium text-text">
                  {beat.beat}{" "}
                  <span className="text-sm text-text-soft">· about {beat.words} words</span>
                </p>
                {beat.your_lines.map((line) => (
                  <blockquote key={line.source} className="font-reading text-voice">
                    “{line.text}”
                  </blockquote>
                ))}
                {beat.questions.map((q) => (
                  <p key={q} className="text-text-soft">
                    {q}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </section>
      ) : draft.video ? (
        <section className="flex flex-col gap-6" aria-label="Talking points">
          <p className="text-text">Talking points, not a script: say it your way on camera.</p>
          {draft.video.questions.map((q) => (
            <div key={q.question} className="flex flex-col gap-2 border-t border-edge pt-4">
              <p className="font-medium text-text">{q.question}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-text">
                {q.points.map((p) => (
                  <li key={p.text}>{p.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <div className="grid min-[90rem]:grid-cols-[minmax(0,38rem)_168px] min-[90rem]:gap-8">
          <div
            ref={textRef}
            data-sweep={sweep ? "" : undefined}
            className="min-w-0 max-w-[38rem] font-reading text-read"
          >
            <CanvasStandIn
              value={
                <YourWordsText
                  paragraphs={draft.paragraphs}
                  on={yourWords}
                  sources={view.sources}
                  needs={canvasNeeds}
                />
              }
            >
              <DocCanvas
                paragraphs={draft.paragraphs}
                needs={canvasNeeds}
                sources={view.sources}
                yourWords={yourWords}
                label={`${deliverable.title} draft`}
                editable={!draft.isFinal}
                onChange={onEdit}
                onNeedSelect={(n) =>
                  setNeed(
                    view.needs.find(
                      (x) => x.paragraphId === n.paragraph_id && x.question === n.question,
                    ) ?? null,
                  )
                }
              />
            </CanvasStandIn>
          </div>
          {/* The reasoning, level with the paragraphs (from 1440px; below, it's in "Why this"). */}
          <div className="hidden border-l border-edge pl-5 min-[90rem]:block">
            <MarginNotes notes={notes} textRef={textRef} />
          </div>
        </div>
      )}

      {need ? (
        <NeedComposer
          question={need.question}
          approxWords={need.approxWords}
          status={needStatus}
          onSubmit={(answer) => void answerNeed(answer)}
          onCancel={() => setNeed(null)}
        />
      ) : null}

      {undo ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
          <p className="text-text">{undo.summary}</p>
          <Button variant="secondary" onClick={() => setUndo(null)}>
            Keep change
          </Button>
          <Button variant="quiet" onClick={() => void undoChange()}>
            Undo
          </Button>
        </div>
      ) : null}

      <StatusMessage
        message={optionLanded ? `Option ${drafting} is drafted. Compare it side by side.` : status}
      />
      <AlertMessage message={error} />
    </article>
  );

  /** Under the sheet: the version timeline and the feedback, then the floating toolbar. */
  const underSheet = (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 min-[90rem]:max-w-[57.5rem]">
      {draft && view.versions.length > 1 ? (
        <VersionScrubber
          versions={view.versions}
          currentId={draft.id}
          onRestore={(id) =>
            void send(`/api/drafts/${id}/restore`, "POST").then(() => {
              setStatus("Version restored. The one before it is still in the history.");
              return reload();
            })
          }
        />
      ) : null}
      {draft && draft.paragraphs.length > 0 ? (
        <FeedbackControl key={draft.id} targetType="draft" targetId={draft.id} />
      ) : null}
    </div>
  );

  /** The floating toolbar (SPEC §6.9): your words, the chat, the options, export and final. */
  const toolbar =
    draft && draft.paragraphs.length > 0 ? (
      <div className="pointer-events-none sticky bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-20 mt-10 flex justify-center lg:bottom-[calc(24px+env(safe-area-inset-bottom,0px))]">
        <div
          role="toolbar"
          aria-label="Draft tools"
          className="ws-toolbar frost pointer-events-auto flex items-center gap-0.5 rounded-full p-1.5 shadow-overlay"
        >
          {prose ? <YourWordsToggle on={yourWords} onChange={toggleYourWords} /> : null}
          {prose ? <span aria-hidden className="mx-1 h-5 w-px bg-edge" /> : null}
          <button type="button" className="ws-tool" onClick={() => openPanel("chat")}>
            <ChatCircleTextIcon size={18} aria-hidden />
            <span className="max-sm:sr-only">Chat</span>
          </button>
          {view.options.length > 0 ? (
            <button type="button" className="ws-tool" onClick={() => openPanel("options")}>
              <SlidersHorizontalIcon size={18} aria-hidden />
              <span className="max-sm:sr-only">Options</span>
            </button>
          ) : null}
          {deliverable.rule ? (
            <ExportMenu
              compact
              text={draft.text}
              rule={deliverable.rule}
              onExport={(format) => void exportAs(format)}
              onMarkFinal={() => void markFinal()}
              final={draft.isFinal}
              onCopied={({ count }) =>
                setStatus(`Copied: ${count} counted the way ${view.school} counts.`)
              }
              onError={setError}
            />
          ) : null}
        </div>
      </div>
    ) : null;

  const coach = (
    <CoachSheet
      value={tab}
      onValueChange={setTab}
      counts={{ checks: mustFix, verify: openVerify }}
      why={
        <WhyThisDraft
          story={view.why.story}
          whyThisStory={view.why.whyThisStory}
          whatItProves={view.why.whatItProves}
          shows={view.why.shows}
          promptParts={view.why.promptParts}
          schoolFit={view.why.schoolFit}
          recommenderCovers={view.why.recommenderCovers}
        />
      }
      options={
        <OptionsTab
          options={view.options}
          drafting={draftingNow}
          onDraft={(label) => {
            const option = view.options.find((o) => o.label === label);
            if (!option) return;
            setDrafting(label);
            void send(`/api/deliverables/${deliverable.id}/angles/${option.angleId}/draft`, "POST");
          }}
          onCompare={(label) => void openCompare(label)}
          onUse={(label) => {
            const option = view.options.find((o) => o.label === label);
            if (option?.draftId) void applyOption(option.draftId);
          }}
        />
      }
      chat={
        <ChatPanel
          turns={chat.turns}
          busy={chat.busy}
          onSend={chat.send}
          onUndo={(id) => void chat.undo(id)}
          subject={draft?.video ? "these talking points" : `"${deliverable.title}"`}
          suggestions={
            draft?.video
              ? VIDEO_ASKS
              : counted > (deliverable.rule?.limit ?? Infinity)
                ? ["Cut it to the limit", ...ESSAY_ASKS.slice(0, 1), ...ESSAY_ASKS.slice(2)]
                : ESSAY_ASKS
          }
          notice={
            chat.error ? (
              <span className="text-risk">{chat.error}</span>
            ) : draft?.coach ? (
              `${view.school} asks you to write this one yourself, so the chat can't rewrite it.`
            ) : null
          }
        />
      }
      checks={
        <div className="flex flex-col gap-4">
          {view.consistency.length > 0 ? (
            <ConsistencyList
              findings={view.consistency}
              hrefFor={(value) =>
                value.docKind === "fact_sheet"
                  ? "/dossier"
                  : value.docKind === "resume"
                    ? "/resume"
                    : value.docId === deliverable.id || value.docKind === "form"
                      ? null
                      : `/workspace/${value.docId}`
              }
              onDismiss={(finding) =>
                void send("/api/consistency", "POST", {
                  action: "dismiss",
                  findingId: finding.id,
                }).then(reload)
              }
            />
          ) : null}
          <CheckList
            findings={view.checks}
            paragraphIds={draft?.paragraphs.map((p) => p.id) ?? []}
            onFix={(finding) => {
              const row = view.checks.find((c) => c === finding);
              if (row) void send(`/api/checks/${row.id}`, "PATCH", { action: "fix" }).then(reload);
            }}
          />
        </div>
      }
      verify={
        <VerifyList
          items={view.verify}
          onConfirm={(id) =>
            void send(`/api/verify/${id}`, "PATCH", { status: "confirmed" }).then(reload)
          }
          onCorrect={(id, correction) =>
            void send(`/api/verify/${id}`, "PATCH", { status: "corrected", correction }).then(
              reload,
            )
          }
        />
      }
    />
  );

  return (
    <>
      <WorkspaceLayout
        header={<SchoolHeader view={tabs} active={activeTab} />}
        strip={
          <FileStrip
            label={tabs.tabs.find((t) => t.id === activeTab)?.label ?? view.heading}
            files={filesForTab(view.files, activeTab)}
            selectedKey={deliverable.id}
            onSelect={(key) => router.push(fileHref(key))}
            hrefFor={fileHref}
          />
        }
        document={
          <>
            {documentPane}
            <div className="mt-8">{underSheet}</div>
            {toolbar}
          </>
        }
        coach={coach}
        view={layoutView}
        onViewChange={setLayoutView}
        coachOpen={coachOpen}
        onCoachOpenChange={setCoachOpen}
      />
      <Dialog open={compare !== null} onOpenChange={(open) => !open && setCompare(null)}>
        <DialogContent
          title="Compare side by side"
          description="Drag the divider, or use the arrow keys."
        >
          {compare && draft ? (
            <OptionSplit
              left={{
                label: current ? `Option ${current.label} (in use)` : "In use",
                paragraphs: draft.paragraphs.map((p) => p.sentences.map((s) => s.text).join(" ")),
              }}
              right={{ label: compare.label, paragraphs: compare.paragraphs }}
              onUse={(side) =>
                side === "right" ? void applyOption(compare.draftId) : setCompare(null)
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
