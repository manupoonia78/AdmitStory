import type { ReactNode } from "react";

/**
 * Page frame inside the shell: the page title is the headline (spec §6.3), set large in chrome
 * (render.css) with an optional eyebrow line above it. The studio object floats to the right of
 * the column on wide screens.
 */
export function Page({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-16 xl:mx-0 xl:ml-[8vw]">
      <div className="flex flex-col gap-4">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-display text-text sm:text-display-lg">{title}</h1>
      </div>
      {children}
    </div>
  );
}
