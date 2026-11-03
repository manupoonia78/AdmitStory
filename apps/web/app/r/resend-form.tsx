"use client";

import { Button, RESEND_ANSWER, RESEND_COPY, TextField } from "@admitstory/ui";
import { useState } from "react";

// "Send me a fresh link" (decision 9): the only way back in for a recommender whose link expired
// or was replaced. The answer is the same whatever the address turns out to be, so this form can
// never be used to find out who was asked for a recommendation.

export function ResendForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (state === "sent")
    return (
      <p role="status" className="text-base text-text">
        {RESEND_ANSWER}
      </p>
    );

  return (
    <form
      className="flex flex-col gap-3 plane p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim().length < 3) return;
        setState("sending");
        void fetch("/api/r/resend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
          // The answer is constant, so there is nothing to read and nothing to report.
        }).finally(() => setState("sent"));
      }}
    >
      <p className="text-base text-text-soft">{RESEND_COPY.lead}</p>
      <TextField
        label={RESEND_COPY.emailLabel}
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" loading={state === "sending"} disabled={state === "sending"}>
        {state === "sending" ? RESEND_COPY.sending : RESEND_COPY.submit}
      </Button>
    </form>
  );
}
