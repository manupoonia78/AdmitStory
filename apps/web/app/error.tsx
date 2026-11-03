"use client";

import { buttonStyles, cx } from "@admitstory/ui";
import { useEffect } from "react";

// Shown when a page fails to render. Errors reach Sentry through instrumentation.ts
// (onRequestError) on the server; this boundary only offers a way forward.
//
// A plain <button> with buttonStyles(), not <Button>: this boundary is in every route's first
// load, and Button brings Radix Slot and the magnetic edge light (~3.5 KB gz) with it.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error.name);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-display-sm text-text">This page didn&apos;t load</h1>
      <p className="text-text-soft">
        Try loading it again. If it keeps happening, sign out and sign back in.
      </p>
      <button
        type="button"
        onClick={reset}
        className={cx(buttonStyles({ variant: "primary" }), "self-start")}
      >
        Load the page again
      </button>
    </div>
  );
}
