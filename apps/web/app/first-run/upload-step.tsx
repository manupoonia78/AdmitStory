"use client";

import { Button, StatusLabel, cx } from "@admitstory/ui";
import { useId, useRef, useState } from "react";
import { AlertMessage } from "@/components/live-message";

// "Bring what you have" (spec §5.1 step 3). Parsing starts immediately in the background: the file
// is uploaded as it is chosen, so by the time first run ends the Fact Sheet is already filling.
//
// Drag and drop is offered, but the file input is the real control and is never hidden from the
// keyboard — a drop zone that only works with a mouse is not a control (§6.12).

interface Uploaded {
  name: string;
  state: "uploading" | "reading" | "failed";
  message?: string;
}

const ACCEPT = ".pdf,.docx,.txt,.md";

export function UploadStep() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError("");
    for (const file of Array.from(list)) {
      setFiles((current) => [...current, { name: file.name, state: "uploading" }]);
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/uploads", { method: "POST", body });
        const result = (await response.json()) as { error?: string };
        setFiles((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? response.ok
                ? { ...entry, state: "reading" }
                : { ...entry, state: "failed", message: result.error }
              : entry,
          ),
        );
      } catch {
        setFiles((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? { ...entry, state: "failed", message: "That upload didn't go through." }
              : entry,
          ),
        );
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
        className={cx(
          "flex flex-col items-center gap-3 rounded-plane border border-dashed p-8 text-center",
          dragging ? "border-signal bg-veil" : "border-control-edge",
        )}
      >
        <p className="text-text-soft">Drop a file here, or choose one.</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          Choose a file
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => void upload(event.target.files)}
          className="sr-only"
          aria-label="Choose a CV, LinkedIn export, past essay or notes document"
        />
        <p className="text-sm text-text-soft">PDF, Word (.docx) or plain text, up to 15 MB.</p>
      </div>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-edge px-3 py-2"
            >
              <span className="truncate text-sm text-text">{file.name}</span>
              {file.state === "uploading" ? (
                <StatusLabel tone="neutral">Uploading</StatusLabel>
              ) : null}
              {file.state === "reading" ? (
                <StatusLabel tone="neutral">Reading it now</StatusLabel>
              ) : null}
              {file.state === "failed" ? (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusLabel tone="risk">Didn&apos;t work</StatusLabel>
                  <span className="text-sm text-text-soft">{file.message}</span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <AlertMessage message={error} />
    </div>
  );
}
