"use client";

import { Button, FieldError, type ButtonProps } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminRequest } from "./request";

const ConfirmDialog = dynamic(() => import("./confirm-dialog").then((m) => m.ConfirmDialog));

// One button, one admin call: "Publish version 7", "Activate v3", "Normalise again". A
// destructive call asks first, in a dialog whose button names the action (direction doc, M).

export interface ActionButtonProps {
  action: string;
  method?: "POST" | "DELETE" | "PUT";
  json?: unknown;
  label: string;
  done: string;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  /** Why it's disabled, said beside it. */
  disabledReason?: string | null;
  confirm?: { title: string; body: string };
  /** Where to go after success, instead of refreshing. */
  next?: string;
}

export function ActionButton({
  action,
  method = "POST",
  json,
  label,
  done,
  variant = "secondary",
  disabled,
  disabledReason,
  confirm,
  next,
}: ActionButtonProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setError(null);
    setStatus(null);
    const result = await adminRequest(action, { method, json });
    setOpen(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(done);
    startTransition(() => (next ? router.push(next) : router.refresh()));
  }

  const button = (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={disabled || busy}
      onClick={confirm ? undefined : run}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        {confirm ? (
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            trigger={button}
            title={confirm.title}
            body={confirm.body}
            label={label}
            onConfirm={() => void run()}
          />
        ) : (
          button
        )}
        {disabled && disabledReason ? (
          <p className="text-sm text-text-soft">{disabledReason}</p>
        ) : null}
        <p aria-live="polite" className="text-sm text-text-soft">
          {status}
        </p>
      </div>
      <div aria-live="assertive">{error ? <FieldError>{error}</FieldError> : null}</div>
    </div>
  );
}
