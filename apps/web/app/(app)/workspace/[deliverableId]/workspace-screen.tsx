"use client";

import {
  AuthorshipBanner,
  Button,
  CheckList,
  CoachSheet,
  Dialog,
  DialogContent,
  ExportMenu,
  FilesPane,
  LimitCounter,
  NeedComposer,
  OptionSplit,
  OptionsTab,
  RefineTab,
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
} from "@admitstory/ui";
import type { DocEdit } from "@admitstory/ui/editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { WorkspaceView } from "@/lib/workspace/view";

// Screen G (spec §5.8, §6.10 G; direction doc G). Files on the left, the document in the middle,
// the Coach on the right. Edits save as the applicant's own version a moment after they stop
// typing; a refinement comes back as a new version with "Keep change" or "Undo".

const SAVE_DEBOUNCE_MS = 1_500;

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
  const [tab, setTab] = useState<CoachTab>("why");
  const [yourWords, setYourWords] = useState(false);
  const [need, setNeed] = useState<WorkspaceView["needs"][number] | null>(null);
  const [needStatus, setNeedStatus] = useState<"idle" | "saving">("idle");
  const [refineStatus, setRefineStatus] = useState<"idle" | "working" | "failed">("idle");
  const [lastRefine, setLastRefine] = useState<RefineRequest | null>(null);
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
    setLastRefine(request);
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
  const mustFix = view.checks.filter((c) => c.severity === "must").length;
  const openVerify = view.verify.filter((v) => v.status === "open").length;
  const current = view.options.find((o) => o.inUse);

  const documentPane = (
    <article className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">{deliverable.title}</h1>
        <p className="font-reading text-lg text-text-soft">{deliverable.prompt}</p>
        <div className="flex flex-wrap items-center gap-4">
          {deliverable.rule && draft ? (
            <LimitCounter
              count={counted}
              limit={deliverable.rule.limit}
              unit={deliverable.rule.unit}
            />
          ) : null}
          {draft && draft.paragraphs.length > 0 ? (
            <YourWordsToggle on={yourWords} onChange={setYourWords} />
          ) : null}
        </div>
        {yourWords ? <YourWordsLegend /> : null}
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

      {draft && draft.paragraphs.length > 0 && deliverable.rule ? (
        <ExportMenu
          text={draft.text}
          rule={deliverable.rule}
          onExport={(format) => void exportAs(format)}
          onMarkFinal={() => void markFinal()}
          final={draft.isFinal}
          onCopied={({ count }) =>
            setStatus(`Copied: ${count} counted the way ${view.school} counts.`)
          }
        />
      ) : null}

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
      <StatusMessage
        message={optionLanded ? `Option ${drafting} is drafted. Compare it side by side.` : status}
      />
      <AlertMessage message={error} />
    </article>
  );

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
      refine={
        <RefineTab
          onRefine={(r) => void refine(r)}
          status={refineStatus}
          {...(lastRefine ? { onRetry: () => void refine(lastRefine) } : {})}
          over={
            deliverable.rule && counted > deliverable.rule.limit
              ? {
                  by: counted - deliverable.rule.limit,
                  limit: deliverable.rule.limit,
                  unit: deliverable.rule.unit,
                }
              : null
          }
        />
      }
      checks={
        <CheckList
          findings={view.checks}
          paragraphIds={draft?.paragraphs.map((p) => p.id) ?? []}
          onFix={(finding) => {
            const row = view.checks.find((c) => c === finding);
            if (row) void send(`/api/checks/${row.id}`, "PATCH", { action: "fix" }).then(reload);
          }}
        />
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
        files={
          <FilesPane
            heading={view.heading}
            files={view.files}
            selectedKey={deliverable.id}
            onSelect={(key) => router.push(`/workspace/${key}`)}
            hrefFor={(key) => `/workspace/${key}`}
          />
        }
        document={documentPane}
        coach={coach}
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
