"use client";

import type { ResumeDoc, ResumeNarrative } from "@admitstory/shared/kit";
import { Button, ChatPanel, WorkspaceLayout } from "@admitstory/ui";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { useChat } from "@/lib/chat/use-chat";
import type { ResumeWorkView } from "@/lib/resume/view";

// The Résumé page (school workspace redesign). First the conversation that matters: what story
// should the résumé tell? Then we build it from the applicant's stories, a CV they paste, or the
// résumé they uploaded. After that it's the document in the middle and a chat on the right: "put
// education first", "make the Lagos bullet lead", "cut it to one page".

type BuildFrom = "dossier" | "pasted" | "upload";

const RESUME_ASKS = [
  "Fit it on one page",
  "Lead every bullet with the result",
  "Put education first",
  "Less jargon",
];

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  if (!response) return fallback;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

const field =
  "w-full rounded-control border border-control bg-depth px-3 py-2 text-text placeholder:text-text-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/* The narrative ---------------------------------------------------------------------------------- */

function NarrativeFields({
  narrative,
  onChange,
  compact = false,
}: {
  narrative: ResumeNarrative;
  onChange: (next: ResumeNarrative) => void;
  compact?: boolean;
}) {
  const id = useId();
  const label = compact ? "text-sm font-medium text-text" : "font-medium text-text";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-goal`} className={label}>
          Where you&apos;re headed after the MBA
        </label>
        <input
          id={`${id}-goal`}
          className={field}
          value={narrative.goal}
          maxLength={400}
          placeholder="Product lead in climate fintech"
          onChange={(e) => onChange({ ...narrative, goal: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-thread`} className={label}>
          The one thing a reader should remember
        </label>
        <textarea
          id={`${id}-thread`}
          className={`${field} min-h-20 resize-y`}
          value={narrative.thread}
          maxLength={600}
          placeholder="I build products people in hard places actually use"
          onChange={(e) => onChange({ ...narrative, thread: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-notes`} className={label}>
          Anything to lead with or leave out
        </label>
        <textarea
          id={`${id}-notes`}
          className={`${field} min-h-16 resize-y`}
          value={narrative.notes}
          maxLength={1_000}
          placeholder="Lead with the Kenya launch. Leave out the first internship."
          onChange={(e) => onChange({ ...narrative, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

/* The document ----------------------------------------------------------------------------------- */

function ResumePaper({ doc }: { doc: ResumeDoc }) {
  return (
    <article
      aria-label="Your résumé"
      className="mx-auto flex w-full max-w-[46rem] flex-col gap-6 rounded-plane border border-edge bg-depth px-6 py-10 shadow-[0_1px_0_var(--color-edge)] sm:px-12 sm:py-12"
    >
      <header className="flex flex-col items-center gap-1.5 text-center">
        {doc.header.name ? (
          <h2 className="font-display text-[2rem] leading-none tracking-[-0.015em] text-text">
            {doc.header.name}
          </h2>
        ) : null}
        {doc.header.lines.length > 0 ? (
          <p className="text-sm text-text-soft">{doc.header.lines.join("  ·  ")}</p>
        ) : null}
      </header>
      {doc.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-3">
          <h3 className="meta border-b border-edge pb-1.5 text-text">{section.heading}</h3>
          {section.roles.map((role) => (
            <div key={role.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold text-text">
                  {role.organisation}
                  {role.location ? (
                    <span className="font-normal text-text-soft">, {role.location}</span>
                  ) : null}
                </p>
                {role.dates ? (
                  <p className="text-sm tabular-nums text-text-soft">{role.dates}</p>
                ) : null}
              </div>
              {role.title ? <p className="italic text-text">{role.title}</p> : null}
              {role.bullets.length > 0 ? (
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 font-reading text-[1.0625rem] leading-snug text-text marker:text-text-soft">
                  {role.bullets.map((b) => (
                    <li key={b.id}>{b.text}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {section.lines.map((line) => (
            <p key={line} className="text-text">
              {line}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

/* The screen ------------------------------------------------------------------------------------- */

export function ResumeWork({
  initial,
  header,
}: {
  initial: ResumeWorkView;
  /** The school's tabs when opened inside a school; the page's own heading otherwise. */
  header?: ReactNode;
}) {
  const [view, setView] = useState(initial);
  const [narrative, setNarrative] = useState(initial.narrative);
  const [from, setFrom] = useState<BuildFrom>(initial.upload ? "upload" : "dossier");
  const [pasted, setPasted] = useState("");
  const [working, setWorking] = useState<"build" | "upload" | "save" | "export" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/resume/work").catch(() => null);
    if (response?.ok) setView((await response.json()) as ResumeWorkView);
  }, []);
  const chat = useChat("resume", { initial: initial.turns, onChanged: reload });

  async function build() {
    setWorking("build");
    setError("");
    const response = await fetch("/api/resume/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative, from, ...(from === "pasted" ? { pasted } : {}) }),
    }).catch(() => null);
    setWorking(null);
    if (!response?.ok) {
      setError(await errorOf(response, "The résumé wasn't built. Try again in a moment."));
      return;
    }
    const next = (await response.json()) as ResumeWorkView;
    setView(next);
    chat.setTurns(next.turns);
    setStatus("Your résumé is ready. Tell the chat what to change.");
  }

  async function upload(file: File) {
    setWorking("upload");
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "resume");
    const response = await fetch("/api/uploads", { method: "POST", body: form }).catch(() => null);
    setWorking(null);
    if (!response?.ok) {
      setError(await errorOf(response, "That upload didn't go through. Try again."));
      return;
    }
    await reload();
    setFrom("upload");
    setStatus(`${file.name} is uploaded. Build from it when you're ready.`);
  }

  async function saveNarrative() {
    setWorking("save");
    const response = await fetch("/api/resume/narrative", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(narrative),
    }).catch(() => null);
    setWorking(null);
    setStatus(response?.ok ? "Narrative saved." : "");
    if (!response?.ok) setError(await errorOf(response, "That didn't save. Try again."));
  }

  async function exportWord() {
    setWorking("export");
    const response = await fetch("/api/resume/work/export", { method: "POST" }).catch(() => null);
    setWorking(null);
    if (!response?.ok) {
      setError(await errorOf(response, "The export didn't finish. Try again."));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(view.doc?.header.name ?? "resume").replace(/\s+/g, "-").toLowerCase()}-resume.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (view.state === "locked")
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-14 sm:px-10">
        <p className="eyebrow">Résumé</p>
        <h1 className="text-display text-text">
          A résumé that tells <em>your</em> story
        </h1>
        <p className="text-lg text-text-soft">
          The résumé builder comes with your first School Kit. It writes your MBA résumé from the
          stories you tell in Story Studio, then you shape it by chatting.
        </p>
        <div>
          <Button asChild>
            <Link href="/schools">Choose a school</Link>
          </Button>
        </div>
      </div>
    );

  const sources = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-text">Build it from</legend>
      {(
        [
          ["dossier", "My stories", "Everything you've told Story Studio and your dossier."],
          ["pasted", "A CV I paste", "We rewrite it for an MBA reader, keeping every fact."],
          [
            "upload",
            "My uploaded résumé",
            view.upload
              ? (view.upload.fileName ?? "Your uploaded résumé")
              : "Upload a PDF or Word file first.",
          ],
        ] as const
      ).map(([value, title, hint]) => (
        <label
          key={value}
          className={`flex cursor-pointer gap-3 rounded-control border px-3.5 py-3 transition-colors ${
            from === value ? "border-text bg-veil" : "border-edge hover:border-text-soft"
          } ${value === "upload" && !view.upload ? "opacity-60" : ""}`}
        >
          <input
            type="radio"
            name="resume-from"
            value={value}
            checked={from === value}
            disabled={value === "upload" && !view.upload}
            onChange={() => setFrom(value)}
            className="mt-1 size-4 accent-signal"
          />
          <span className="flex flex-col">
            <span className="text-text">{title}</span>
            <span className="text-sm text-text-soft">{hint}</span>
          </span>
        </label>
      ))}
      {from === "pasted" ? (
        <textarea
          aria-label="Your CV"
          className={`${field} mt-1 min-h-48 resize-y font-mono text-sm`}
          value={pasted}
          maxLength={40_000}
          placeholder="Paste your CV here"
          onChange={(e) => setPasted(e.target.value)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="quiet"
          size="sm"
          disabled={working !== null}
          onClick={() => fileRef.current?.click()}
        >
          {working === "upload"
            ? "Uploading…"
            : view.upload
              ? "Upload a newer résumé"
              : "Upload a résumé"}
        </Button>
        {view.upload?.reviewed ? (
          <Link
            href="/resume/review"
            className="text-sm text-text-soft underline-offset-4 hover:text-text hover:underline"
          >
            See the line-by-line review
          </Link>
        ) : null}
      </div>
    </fieldset>
  );

  const limitLine = view.pageLimit
    ? `${view.pageLimit.schools.join(", ")} ${view.pageLimit.schools.length === 1 ? "asks" : "ask"} for ${view.pageLimit.pages} page${view.pageLimit.pages === 1 ? "" : "s"}.`
    : null;

  /* First visit: the narrative conversation, then build. */
  if (!view.doc)
    return (
      <div className="flex flex-col gap-6 p-3 sm:p-4">
        {header}
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-2 py-8 sm:px-6 sm:py-10">
          <header className="flex flex-col gap-4">
            <p className="eyebrow">Résumé</p>
            <h1 className="text-display text-text">
              What story should your résumé <em>tell</em>?
            </h1>
            <p className="max-w-essay text-lg text-text-soft">
              An MBA résumé isn&apos;t a list of jobs. It&apos;s evidence for one story: where
              you&apos;re going and why you&apos;ll get there. Tell us the story, and we&apos;ll
              choose and order every line to prove it.
            </p>
          </header>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
            <section aria-label="Your narrative" className="plane flex flex-col gap-5 p-6 sm:p-8">
              <NarrativeFields narrative={narrative} onChange={setNarrative} />
              {view.narrativeSet ? null : (
                <p className="text-sm text-text-soft">
                  We started these from your goals in the dossier. Make them yours.
                </p>
              )}
            </section>
            <div className="flex flex-col gap-5">
              {sources}
              {limitLine ? <p className="text-sm text-text-soft">{limitLine}</p> : null}
              <div>
                <Button
                  onClick={() => void build()}
                  disabled={
                    working !== null ||
                    (from === "pasted" && pasted.trim() === "") ||
                    (from === "upload" && !view.upload)
                  }
                >
                  {working === "build" ? "Building your résumé…" : "Build my résumé"}
                </Button>
              </div>
              <StatusMessage message={status} />
              <AlertMessage message={error} />
            </div>
          </div>
        </div>
      </div>
    );

  /* After the build: narrative left, résumé middle, chat right. */
  return (
    <WorkspaceLayout
      header={
        header ?? (
          <header className="flex flex-wrap items-baseline justify-between gap-3 px-1 pt-1">
            <h1 className="font-display text-[1.75rem] leading-none tracking-[-0.015em] text-text">
              Your résumé
            </h1>
            {limitLine ? <p className="meta text-text-soft">{limitLine}</p> : null}
          </header>
        )
      }
      files={
        <div className="flex flex-col gap-5 p-4">
          <p className="eyebrow">The story it tells</p>
          <NarrativeFields narrative={narrative} onChange={setNarrative} compact />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={working !== null}
              onClick={() => void saveNarrative()}
            >
              Save
            </Button>
          </div>
          <details className="group border-t border-edge pt-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-text">
              Rebuild from scratch
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              {sources}
              <Button
                size="sm"
                disabled={
                  working !== null ||
                  (from === "pasted" && pasted.trim() === "") ||
                  (from === "upload" && !view.upload)
                }
                onClick={() => void build()}
              >
                {working === "build" ? "Rebuilding…" : "Rebuild with this story"}
              </Button>
              <p className="text-xs text-text-soft">The chat keeps Undo for the old version.</p>
            </div>
          </details>
        </div>
      }
      document={
        <div className="flex flex-col gap-6 px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-[46rem] flex-wrap items-center justify-between gap-3">
            <p className="meta text-text-soft">
              Version {view.version}
              {view.origin === "pasted"
                ? " · from your CV"
                : view.origin === "review"
                  ? " · from your upload"
                  : " · from your stories"}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={working !== null}
              onClick={() => void exportWord()}
            >
              {working === "export" ? "Making the file…" : "Download Word"}
            </Button>
          </div>
          <ResumePaper doc={view.doc} />
          {view.asks.length > 0 ? (
            <section className="mx-auto flex w-full max-w-[46rem] flex-col gap-3 border-l-2 border-needs pl-4">
              <h2 className="font-medium text-text">Details that would make it stronger</h2>
              <ul className="flex flex-col gap-1.5 text-text-soft">
                {view.asks.map((ask) => (
                  <li key={ask}>{ask}</li>
                ))}
              </ul>
              <p className="text-sm text-text-soft">Answer any of these in the chat.</p>
            </section>
          ) : null}
          <StatusMessage message={status} />
          <AlertMessage message={error} />
        </div>
      }
      coach={
        <ChatPanel
          turns={chat.turns}
          busy={chat.busy || working === "build"}
          onSend={chat.send}
          onUndo={(id) => void chat.undo(id)}
          subject="your résumé"
          suggestions={RESUME_ASKS}
          placeholder="“Put the Kenya launch up top”"
          notice={chat.error ? <span className="text-risk">{chat.error}</span> : null}
        />
      }
    />
  );
}
