"use client";

import { Button, FieldError } from "@admitstory/ui";
import { DEFAULT_TRUST, KB_SOURCE_TYPES, type KbSourceType } from "@admitstory/kb/types";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminRequest } from "./request";

// Add a knowledge source (spec §5.18, §9.1, §9.3): paste text, upload a PDF or DOCX, or enter one
// of the school's URLs. Trust defaults by type (§9.1) and can be changed. Audio isn't accepted
// yet: packages/voice has live dictation only, no transcription of a recording.

const TYPE_LABEL: Record<KbSourceType, string> = {
  official: "Official (school-published)",
  adcom: "Admissions staff",
  insider: "Student or alum",
  interview_reports: "Interview reports",
  coach_notes: "Coach notes",
  third_party_reference: "Third-party reference (never shown)",
  press: "Press",
};

type Mode = "paste" | "file" | "url" | "audio";

const control =
  "min-h-9 w-full rounded-control border border-control bg-depth px-2 text-base text-text";

export function SourceForm({
  schools,
  defaultSchoolId,
  defaultCycle,
}: {
  schools: { id: string; name: string }[];
  defaultSchoolId?: string;
  defaultCycle?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [type, setType] = useState<KbSourceType>("official");
  const [trust, setTrust] = useState<number>(DEFAULT_TRUST.official);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "audio") return;
    setError(null);
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const tags = {
      schoolId: String(data.get("schoolId") ?? ""),
      cycle: String(data.get("cycle") ?? "").trim() || null,
      type,
      title: String(data.get("title") ?? ""),
      trust,
      rightsNote: String(data.get("rightsNote") ?? "").trim() || null,
    };
    const result =
      mode === "file"
        ? await adminRequest<{ sourceId: string }>("/api/admin/kb/sources", { form: data })
        : await adminRequest<{ sourceId: string }>("/api/admin/kb/sources", {
            json:
              mode === "paste"
                ? { ...tags, mode, text: String(data.get("text") ?? "") }
                : { ...tags, mode, url: String(data.get("url") ?? "").trim() },
          });
    setBusy(false);
    if (!result.ok || !result.data) {
      const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      setError(detail ? `${result.error} ${detail}` : result.error);
      return;
    }
    router.push(`/admin/sources/${result.data.sourceId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-4xl flex-col gap-3">
      <fieldset className="flex flex-wrap gap-4 text-base">
        <legend className="mb-1 text-sm font-medium text-text">Add by</legend>
        {(
          [
            ["paste", "Pasting text"],
            ["file", "Uploading a PDF or DOCX"],
            ["url", "Entering a URL"],
            ["audio", "Audio or video"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">School</span>
          <select name="schoolId" required defaultValue={defaultSchoolId ?? ""} className={control}>
            <option value="" disabled>
              Choose a school
            </option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Cycle</span>
          <input
            name="cycle"
            defaultValue={defaultCycle ?? "2026-27"}
            pattern="\d{4}-\d{2}"
            className={control}
          />
          <span className="text-sm text-text-soft">Empty for evergreen material</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Type</span>
          <select
            name="type"
            value={type}
            onChange={(e) => {
              const next = e.target.value as KbSourceType;
              setType(next);
              setTrust(DEFAULT_TRUST[next]);
            }}
            className={control}
          >
            {KB_SOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Trust, 1 to 5</span>
          <input
            name="trust"
            type="number"
            min={1}
            max={5}
            value={trust}
            onChange={(e) => setTrust(Number(e.target.value))}
            className={control}
          />
          <span className="text-sm text-text-soft">
            Default for this type: {DEFAULT_TRUST[type]}
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Title</span>
        <input name="title" required maxLength={300} className={control} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Rights note</span>
        <input
          name="rightsNote"
          maxLength={2000}
          className={control}
          placeholder="Where it came from and what we may do with it"
        />
        {type === "third_party_reference" ? (
          <span className="text-sm text-text-soft">
            Reference for your own thinking only (§9.6): never shown to users or copied into a pack.
          </span>
        ) : null}
      </label>

      {mode === "paste" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">Text</span>
          <textarea name="text" required rows={10} className={`${control} py-2 text-sm`} />
        </label>
      ) : null}
      {mode === "file" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">File</span>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.txt,.md,.html,application/pdf"
            className="text-base"
          />
          <span className="text-sm text-text-soft">
            PDF, DOCX, text or HTML, up to 25 MB. Only the text is kept.
          </span>
        </label>
      ) : null}
      {mode === "url" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">URL</span>
          <input name="url" type="url" required placeholder="https://" className={control} />
          <span className="text-sm text-text-soft">
            Only the school&apos;s own site and its pack&apos;s official URLs can be fetched.
          </span>
        </label>
      ) : null}
      {mode === "audio" ? (
        <p className="text-base text-text">
          Audio and video can&apos;t be added yet: transcription of a recording isn&apos;t
          connected. Paste the transcript as text instead.
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={busy || mode === "audio"}>
          Add source
        </Button>
      </div>
      <div aria-live="assertive">{error ? <FieldError>{error}</FieldError> : null}</div>
    </form>
  );
}
