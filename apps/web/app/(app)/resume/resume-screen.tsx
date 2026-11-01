"use client";

import type { ConsistencyFinding, ConsistencyValue } from "@admitstory/linters";
import type { BulletDecision } from "@admitstory/shared/kit";
import { Button, EmptyState, ResumeSheet } from "@admitstory/ui";
import { FileArrowUpIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { ResumeView } from "@/lib/forms/resume-view";

// The Résumé page (spec §5.10). Upload when there is no résumé yet, one click to have it read,
// then the sheet: decisions save at once, the Word file is made on demand.

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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">{children}</div>
  );
}

export function ResumeScreen({ initial }: { initial: ResumeView }) {
  const [view, setView] = useState(initial);
  const [working, setWorking] = useState<"upload" | "review" | "export" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function review() {
    setWorking("review");
    setError("");
    const response = await send("/api/resume/review", "POST", {});
    setWorking(null);
    if (!response?.ok) {
      setError(await errorOf(response, "We couldn't read your résumé just now. Try again."));
      return;
    }
    setView((await response.json()) as ResumeView);
    setStatus("Your résumé is read. Start with the first line.");
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
    await review();
  }

  const uploader = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button
        icon={FileArrowUpIcon}
        loading={working === "upload" || working === "review"}
        onClick={() => fileInput.current?.click()}
      >
        {working === "upload"
          ? "Uploading"
          : working === "review"
            ? "Reading your résumé"
            : "Upload your résumé"}
      </Button>
    </>
  );

  if (view.state === "locked")
    return (
      <Frame>
        <EmptyState
          title="The Résumé Pass comes with your first School Kit"
          description="Unlock a kit for any school and your résumé gets a line-by-line read, shared by every kit after it."
          action={
            <Button asChild>
              <Link href="/schools">See your schools</Link>
            </Button>
          }
        />
      </Frame>
    );

  if (view.state !== "ready")
    return (
      <Frame>
        <EmptyState
          title={view.state === "no_resume" ? "No résumé yet" : "Your résumé is here, unread"}
          description={
            view.state === "no_resume"
              ? "Upload it as a PDF or Word file. We read every line and suggest what to change; you decide."
              : `${view.fileName ?? "Your résumé"} is uploaded. Have it read line by line.`
          }
          action={
            view.state === "no_resume" ? (
              uploader
            ) : (
              <Button loading={working === "review"} onClick={() => void review()}>
                {working === "review" ? "Reading your résumé" : "Read my résumé"}
              </Button>
            )
          }
        />
        <AlertMessage message={error} />
      </Frame>
    );

  const ready = view;

  function decide(bulletId: string, decision: BulletDecision | null) {
    const before = ready.decisions;
    const next = Object.fromEntries(
      Object.entries(before).filter(([id]) => id !== bulletId),
    ) as Record<string, BulletDecision>;
    if (decision) next[bulletId] = decision;
    setView({ ...ready, decisions: next });
    void send(`/api/resume/review/${ready.reviewId}/bullets/${bulletId}`, "PATCH", {
      decision,
    }).then(async (response) => {
      if (response?.ok) return;
      setView((v) => (v.state === "ready" ? { ...v, decisions: before } : v));
      setError(await errorOf(response, "That didn't save. Check your connection and try again."));
    });
  }

  function toggleOrder(useSuggestedOrder: boolean) {
    setView({ ...ready, useSuggestedOrder });
    void send(`/api/resume/review/${ready.reviewId}`, "PATCH", { useSuggestedOrder });
  }

  async function exportWord() {
    setWorking("export");
    const response = await send("/api/resume/export", "POST", {});
    setWorking(null);
    if (!response?.ok) {
      setError(await errorOf(response, "The Word file wasn't made. Try again."));
      return;
    }
    const name =
      /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
      "resume.docx";
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Your résumé is downloading as a Word file.");
  }

  async function reload() {
    const response = await send("/api/resume/review", "GET");
    if (response?.ok) setView((await response.json()) as ResumeView);
  }

  async function consistency(body: Record<string, string>, done: string) {
    const response = await send("/api/consistency", "POST", body);
    if (!response?.ok) {
      setError(await errorOf(response, "That didn't save. Try again in a moment."));
      return;
    }
    setStatus(done);
    await reload();
  }

  return (
    <Frame>
      {ready.newerUpload ? (
        <p className="flex flex-wrap items-center gap-3 border-b border-edge pb-4 text-text-soft">
          You uploaded a newer résumé since this read.
          <Button
            variant="secondary"
            size="sm"
            loading={working === "review"}
            onClick={() => void review()}
          >
            {working === "review" ? "Reading it" : "Read the new one"}
          </Button>
        </p>
      ) : null}
      <ResumeSheet
        review={ready.review}
        decisions={ready.decisions}
        pageLimit={ready.pageLimit}
        useSuggestedOrder={ready.useSuggestedOrder}
        onToggleOrder={toggleOrder}
        consistency={ready.consistency}
        onDecide={decide}
        onExport={() => void exportWord()}
        exporting={working === "export"}
        onUseExpected={(finding: ConsistencyFinding, value: ConsistencyValue) =>
          void consistency(
            { action: "use_expected", findingId: finding.id, docId: value.docId, ref: value.ref },
            `Changed to “${finding.expected ?? ""}” in your résumé.`,
          )
        }
        onDismiss={(finding: ConsistencyFinding) =>
          void consistency(
            { action: "dismiss", findingId: finding.id },
            "Marked as different things. We won't flag it again.",
          )
        }
        hrefFor={(value: ConsistencyValue) =>
          value.docKind === "fact_sheet"
            ? "/dossier"
            : value.docKind === "essay"
              ? `/workspace/${value.docId}`
              : null
        }
      />
      <StatusMessage message={status} />
      <AlertMessage message={error} />
    </Frame>
  );
}
