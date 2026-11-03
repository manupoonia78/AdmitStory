"use client";

import { Button, FieldError, type ButtonProps } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { adminRequest } from "./request";

// A form that sends its fields to an /api/admin route as JSON, then refreshes the page's server
// data. Field types come from the inputs: `data-json="number"`, `"boolean"` (checkbox), `"array"`
// (checkboxes sharing a name), `"json"` (a textarea holding JSON). Empty text becomes null.
// `multipart` sends the FormData itself (file uploads).

export interface AdminFormProps {
  action: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  submitLabel: string;
  /** Said in the live region after a success, e.g. "Cycle created". */
  done?: string;
  multipart?: boolean;
  /** Where to go after success; `{id}` is replaced by the response's first id-like field. */
  next?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  children?: ReactNode;
}

function toJson(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    )
      continue;
    const name = element.name;
    if (!name || element.disabled) continue;
    const kind = element.dataset.json;
    if (kind === "array") {
      const list = (out[name] as unknown[] | undefined) ?? [];
      if (element instanceof HTMLInputElement && element.checked) list.push(element.value);
      out[name] = list;
      continue;
    }
    if (kind === "boolean" && element instanceof HTMLInputElement) {
      out[name] = element.checked;
      continue;
    }
    const raw = element.value;
    if (kind === "number") out[name] = raw.trim() === "" ? undefined : Number(raw);
    else if (kind === "json") {
      try {
        out[name] = JSON.parse(raw);
      } catch {
        throw new Error(`${element.getAttribute("aria-label") ?? name} isn't valid JSON.`);
      }
    } else if (kind === "keep") out[name] = raw;
    else out[name] = raw.trim() === "" ? null : raw;
  }
  return out;
}

export function AdminForm({
  action,
  method = "POST",
  submitLabel,
  done,
  multipart,
  next,
  variant = "primary",
  className,
  children,
}: AdminFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setStatus(null);
    let payload: { json?: unknown; form?: FormData };
    try {
      payload = multipart ? { form: new FormData(form) } : { json: toJson(form) };
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "A field isn't valid.");
      return;
    }
    const result = await adminRequest(action, { method, ...payload });
    if (!result.ok) {
      const detail = result.issues.map((i) => `${i.path || "form"}: ${i.message}`).join("; ");
      setError(detail ? `${result.error} ${detail}` : result.error);
      return;
    }
    setStatus(done ?? "Saved");
    startTransition(() => {
      if (next) {
        const data = result.data ?? {};
        const id = Object.entries(data).find(([key]) => /id$/i.test(key))?.[1];
        router.push(next.replace("{id}", typeof id === "string" ? id : ""));
      } else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate={false}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {submitLabel}
        </Button>
        <p aria-live="polite" className="text-sm text-text-soft">
          {status}
        </p>
      </div>
      <div aria-live="assertive">
        {error ? <FieldError className="mt-2">{error}</FieldError> : null}
      </div>
    </form>
  );
}
