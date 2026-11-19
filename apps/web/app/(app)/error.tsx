"use client";

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { useEffect } from "react";

// A page inside the casing failed to render (SPEC §6.10). The casing and its navigation stay; only
// the bay shows this. The line breaks in the middle: the one drawing for "something stopped".
// A plain <button> with buttonStyles(), not <Button>, so this boundary stays light.
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error.name);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[55rem] flex-col px-5 pt-10 pb-14 sm:px-10 lg:px-14 lg:pt-14">
      <span aria-hidden className="mb-6 flex w-60 max-w-full items-center gap-4">
        <span className="h-[1.25px] flex-1 bg-edge-strong" />
        <span className="h-[1.25px] flex-1 bg-edge-strong" />
      </span>
      <h1 className="text-title text-text">This page didn&apos;t load</h1>
      <p className="mt-2 max-w-[52ch] text-base text-text-soft">
        Something went wrong on our side. Your work is saved.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className={buttonStyles({ variant: "primary" })}>
          Try again
        </button>
        <Link href="/home" className={cx(buttonStyles({ variant: "quiet" }))}>
          Go home
        </Link>
      </div>
    </div>
  );
}
