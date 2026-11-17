import type { ReactNode } from "react";

/**
 * Page frame inside the casing's bay (SPEC §6.1): a label eyebrow, the title in display-2, one
 * line of lede, then the page's sections 48px under them on a steady 40px rhythm.
 */
export function Page({
  title,
  eyebrow,
  lede,
  children,
}: {
  title: string;
  eyebrow?: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[55rem] flex-col gap-10 px-5 pt-6 pb-14 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="mb-2 flex flex-col">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="text-display-2 text-text">{title}</h1>
        {lede ? <p className="mt-4 max-w-[60ch] text-lg text-text-soft">{lede}</p> : null}
      </header>
      {children}
    </div>
  );
}
