"use client";

import { Button } from "@admitstory/ui";
import { useEffect } from "react";

// Shown when a page fails to render. Errors reach Sentry through instrumentation.ts
// (onRequestError) on the server; this boundary only offers a way forward.
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
      <Button className="self-start" onClick={reset}>
        Load the page again
      </Button>
    </div>
  );
}
