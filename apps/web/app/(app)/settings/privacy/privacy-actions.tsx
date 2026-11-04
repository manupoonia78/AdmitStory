"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { buttonStyles } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";

// The quiet half of Settings › Privacy: the two downloads, "Help improve AdmitStories", and the way
// to delete the account. The delete dialog (Radix) loads only when it's opened (§6.11).

const DeleteDialog = dynamic(() => import("./delete-dialog").then((m) => m.DeleteDialog), {
  ssr: false,
});

type Download = "json" | "docx";

const FILES: Record<Download, { label: string; busy: string }> = {
  json: { label: "Your data (JSON)", busy: "Preparing your file…" },
  docx: { label: "Your drafts (Word)", busy: "Preparing your file…" },
};

export function PrivacyActions({
  improveOptIn,
  sessionFresh,
}: {
  improveOptIn: boolean;
  sessionFresh: boolean;
}) {
  const [busy, setBusy] = useState<Download | null>(null);
  const [optIn, setOptIn] = useState(improveOptIn);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function download(format: Download) {
    setBusy(format);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/account/export?format=${format}`);
      if (response.status === 429) {
        setError("You've downloaded three times this hour. Try again later.");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const name =
        /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ??
        `admitstory.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus("Your file has downloaded.");
    } catch {
      setError("That download didn't finish. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveOptIn(next: boolean) {
    setOptIn(next);
    setError(null);
    const response = await fetch("/api/account/privacy", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ improveOptIn: next }),
    }).catch(() => null);
    if (!response?.ok) {
      setOptIn(!next);
      setError("That didn't save. Try again.");
      return;
    }
    setStatus(next ? "Thanks. We may read drafts you rate." : "We won't read your drafts.");
  }

  return (
    <>
      <section aria-labelledby="download" className="flex flex-col gap-3 plane p-6">
        <h2
          id="download"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Download
        </h2>
        <p className="text-text-soft">
          Everything you&apos;ve told us, or every current draft in one Word file. Made when you
          ask, never stored.
        </p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(FILES) as Download[]).map((format) => (
            <button
              key={format}
              type="button"
              disabled={busy !== null}
              onClick={() => void download(format)}
              className={buttonStyles({ variant: "secondary" })}
            >
              {busy === format ? FILES[format].busy : FILES[format].label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="improve" className="flex flex-col gap-3 plane p-6">
        <h2
          id="improve"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Help improve AdmitStories
        </h2>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(event) => void saveOptIn(event.target.checked)}
            className="mt-0.5 size-5 accent-signal"
          />
          <span className="text-text-soft">
            Let us read your drafts when you rate them, and include them in our weekly quality
            review. We never train models on them. Off by default.
          </span>
        </label>
      </section>

      <section aria-labelledby="delete" className="flex flex-col gap-3 plane p-6">
        <h2 id="delete" className="flex items-center gap-2 text-lg font-semibold text-needs">
          <WarningIcon size={20} aria-hidden />
          Delete your account
        </h2>
        <p className="text-text-soft">
          Everything you&apos;ve written and said goes, with your kits and your recommenders&apos;
          briefs and links. It can&apos;t be undone.
        </p>
        <button
          type="button"
          className={`${buttonStyles({ variant: "danger" })} self-start`}
          onClick={() => setDeleting(true)}
        >
          Delete my account
        </button>
        {deleting ? (
          <DeleteDialog open={deleting} onOpenChange={setDeleting} sessionFresh={sessionFresh} />
        ) : null}
      </section>

      <StatusMessage message={status ?? undefined} />
      <AlertMessage message={error ?? undefined} />
    </>
  );
}
