"use client";

import type { VoiceprintIdentity } from "@admitstory/shared";
import {
  Button,
  GapQuestionsPlane,
  KitAssembly,
  TextField,
  cx,
  type KitDeliverable,
  type KitStage,
} from "@admitstory/ui";
import { CaretLeftIcon, CheckIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { ModelCredit } from "@/components/model-seal";
import type { KitView } from "@/lib/kit/view";
import { schoolHref } from "@/lib/school/tabs";
import { ENOUGH_STORIES, type SchoolPrep } from "@/lib/school/prep-types";

// The school page before its drafts are ready (spec §5.7 screen F, school workspace redesign).
// Three steps, top to bottom: your stories (enough of them, or a nudge to Story Studio), the
// school's own questions with what the school offers for your goal, and the drafts assembling
// live. The moment the kit is ready the page opens the school's tabs.

const READABLE = new Set(["positioning", "file_map", "drafts", "short_form", "checks", "verify"]);

function stagesOf(view: KitView): KitStage[] {
  return view.stages
    .filter((s) => s.key !== "forms")
    .map((s) => ({
      id: s.key,
      label: s.label,
      status:
        s.status === "done" || s.status === "skipped"
          ? "done"
          : s.status === "running"
            ? "active"
            : "waiting",
      ...(s.status === "done" && READABLE.has(s.key) ? { actionLabel: "Read it now" } : {}),
    }));
}

function deliverablesOf(view: KitView): KitDeliverable[] {
  const failed = new Set(view.failed.map((f) => f.id));
  return view.deliverables.map((d) => ({
    key: d.id,
    title: d.title,
    prompt: d.prompt,
    limit: d.limit,
    status: failed.has(d.id)
      ? "failed"
      : d.status === "drafting"
        ? "drafting"
        : d.status === "pending"
          ? d.story
            ? "mapped"
            : "waiting"
          : "ready",
    storyId: d.story,
    text: d.firstLine ?? "",
  }));
}

function Step({
  n,
  title,
  done,
  wide = false,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  /** The body takes the whole row under the title (the assembly needs the width). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-5 border-t border-edge py-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
      <div className="flex items-baseline gap-3 lg:flex-col lg:gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-[0.06em] text-text-label uppercase tabular-nums">
          {done ? (
            <>
              <CheckIcon size={14} weight="bold" aria-hidden className="text-verified" />
              Done
            </>
          ) : (
            String(n).padStart(2, "0")
          )}
        </span>
        <h2 className="text-title text-text">{title}</h2>
      </div>
      <div className={cx("flex min-w-0 flex-col gap-4 text-text-80", wide && "lg:col-span-2")}>
        {children}
      </div>
    </li>
  );
}

export function KitScreen({
  initial,
  identity,
  prep,
}: {
  initial: KitView;
  identity: VoiceprintIdentity;
  prep: SchoolPrep;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [gapMode, setGapMode] = useState<"choices" | "typing" | "skipped" | "done">("choices");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (view.status === "ready" || view.status === "failed") return;
    const source = new EventSource(`/api/kits/${view.id}/events`);
    source.addEventListener("kit", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as KitView;
      setView(next);
      if (next.status === "ready") {
        setStatus(`Your ${next.school} drafts are ready.`);
        router.replace(schoolHref(prep.userSchoolId));
      }
    });
    return () => source.close();
    // One stream per kit; it closes itself once the kit settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id, view.status === "ready" || view.status === "failed"]);

  const stories = useMemo(
    () => view.stories.map((s) => ({ id: s.code, title: s.title })),
    [view.stories],
  );
  const firstDeliverable = view.deliverables.find((d) => d.status !== "pending");
  const starting = view.status === "pending" && view.stages.every((s) => s.status === "pending");
  const gapStage = view.stages.find((s) => s.key === "gaps");
  const gapCount = gapStage?.status === "done" ? view.gaps.length : null;

  function read() {
    if (firstDeliverable) router.push(`/workspace/${firstDeliverable.id}`);
  }

  const storiesReady = prep.stories >= ENOUGH_STORIES && prep.goalsSet;
  const answered = gapMode === "done" || gapMode === "skipped" || gapCount === 0;

  async function retry(deliverableId: string) {
    setError("");
    const response = await fetch(`/api/kits/${view.id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ only: [deliverableId] }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("That didn't start. Check your connection and try again.");
      return;
    }
    setView((v) => ({
      ...v,
      status: "pending",
      failed: v.failed.filter((f) => f.id !== deliverableId),
    }));
  }

  async function skip() {
    setGapMode("skipped");
    await fetch(`/api/kits/${view.id}/gaps/skip`, { method: "POST" }).catch(() => null);
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault();
    setError("");
    for (const gap of view.gaps) {
      const text = answers[gap.id]?.trim();
      if (!text) continue;
      const response = await fetch(`/api/kits/${view.id}/gaps/${gap.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, via: "text" }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("An answer didn't save. Check your connection and try again.");
        return;
      }
    }
    setGapMode("done");
  }

  const aside = (
    <GapQuestionsPlane
      count={gapCount}
      onTypeAnswers={() => setGapMode("typing")}
      onSkip={() => void skip()}
    >
      {gapMode === "typing" ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submitAnswers(e)}>
          {view.gaps.map((gap) => (
            <TextField
              key={gap.id}
              label={gap.question}
              hint={
                gap.approxWords
                  ? `About ${gap.approxWords} words · ${gap.deliverable}`
                  : gap.deliverable
              }
              value={answers[gap.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [gap.id]: e.target.value }))}
            />
          ))}
          <div className="flex gap-3">
            <Button type="submit">Save answers</Button>
            <Button type="button" variant="quiet" onClick={() => void skip()}>
              Skip, draft with gaps
            </Button>
          </div>
        </form>
      ) : gapMode === "done" ? (
        <p className="text-text">Thanks. Your answers go into the drafts.</p>
      ) : gapMode === "skipped" ? (
        <p className="text-text">Drafting now. The questions wait in the drafts as NEED chips.</p>
      ) : undefined}
    </GapQuestionsPlane>
  );

  return (
    <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-5 pt-6 pb-24 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="flex flex-col">
        <Link
          href="/schools"
          className="label -ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-full pr-2 pl-1 transition-colors duration-(--dur-hover) hover:text-text"
        >
          <CaretLeftIcon size={12} weight="bold" aria-hidden />
          Schools / {view.school} {prep.cycle}
        </Link>
        <h1 className="mt-2 text-display-2 text-text">
          {starting ? (
            <>
              Payment confirmed.{" "}
              <span className="serif-accent text-text-soft">
                Let&apos;s get {view.school} ready.
              </span>
            </>
          ) : view.status === "ready" ? (
            <>
              Your {view.school} application is{" "}
              <span className="serif-accent text-text-soft">ready</span>
            </>
          ) : (
            <>
              Getting <span className="serif-accent text-text-soft">{view.school}</span> ready
            </>
          )}
        </h1>
        <p className="mt-4 max-w-[60ch] text-lg text-text-soft">
          We draft every essay, form entry, video plan and recommender brief from your stories and
          what we know about {view.school}. Then you shape each one by chatting beside it.
        </p>
        {view.error ? (
          <p className="mt-5 max-w-[60ch] border-l-2 border-needs pl-4 text-text">
            {view.error} Your other essays are ready.
          </p>
        ) : null}
        {view.status === "ready" && firstDeliverable ? (
          <div className="mt-6">
            <Button asChild>
              <Link href={`/workspace/${firstDeliverable.id}`}>Open {view.school}</Link>
            </Button>
          </div>
        ) : null}
      </header>
      <StatusMessage message={status} />
      <AlertMessage message={error} />

      <ol className="mt-6 flex flex-col">
        <Step n={1} title="Your stories" done={storiesReady && prep.storiesSinceKit === 0}>
          <p className="text-text">
            {prep.stories === 0
              ? "You haven't told us any stories yet."
              : `${prep.stories} ${prep.stories === 1 ? "story" : "stories"} told`}
            {prep.goalsSet ? ", goals set." : ", and no goals yet."}
          </p>
          {storiesReady ? (
            <p className="text-text-soft">
              That&apos;s enough to draft from. More stories still make stronger drafts.
            </p>
          ) : (
            <p className="max-w-essay text-text-soft">
              Your drafts can only be as good as your stories. Tell Story Studio about your work,
              the moments you&apos;re proud of and where you&apos;re headed, in plain words. It asks
              the questions; you just talk.
            </p>
          )}
          {prep.storiesSinceKit > 0 && view.status === "ready" ? (
            <p className="text-text">
              You&apos;ve told {prep.storiesSinceKit} new{" "}
              {prep.storiesSinceKit === 1 ? "story" : "stories"} since these drafts were made. Ask
              the chat beside any draft to use one.
            </p>
          ) : null}
          <div>
            <Button asChild variant={storiesReady ? "secondary" : "primary"}>
              <Link href="/studio">
                {storiesReady ? "Add more in Story Studio" : "Tell your stories in Story Studio"}
              </Link>
            </Button>
          </div>
        </Step>

        <Step n={2} title={`Questions for ${view.school}`} done={answered}>
          {prep.offers.length > 0 || prep.outcome ? (
            <div className="card flex flex-col gap-3 p-6">
              <p className="label">What {view.school} offers for your goal</p>
              <ul className="flex flex-col">
                {prep.offers.map((o) => (
                  <li
                    key={o.value}
                    className="flex flex-col gap-0.5 border-t border-edge py-3 first:border-t-0"
                  >
                    <span className="text-ui text-text">{o.value}</span>
                    <span className="text-sm text-text-soft">{o.note}</span>
                  </li>
                ))}
              </ul>
              {prep.outcome ? <p className="text-text">{prep.outcome}</p> : null}
              <p className="text-sm text-text-soft">
                Name these in your why-{view.school} answers and your interview. Your drafts already
                do.
              </p>
            </div>
          ) : null}
          {aside}
        </Step>

        <Step n={3} title="Your drafts" done={view.status === "ready"} wide>
          <ModelCredit />
          <KitAssembly
            identity={identity}
            stories={stories}
            deliverables={deliverablesOf(view)}
            stages={stagesOf(view)}
            deliverablesHeading={`What ${view.school} asks for`}
            onStageAction={read}
            onRetry={(key) => void retry(key)}
          />
        </Step>
      </ol>
    </div>
  );
}
