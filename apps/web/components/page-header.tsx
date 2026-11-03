import type { ReactNode } from "react";

/**
 * Page frame inside the shell: an eyebrow, the serif title and an optional lede, a hairline under
 * them, then the page's sections on a steady 40px rhythm.
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4 border-b border-edge pb-8">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-display text-text">{title}</h1>
        {lede ? <p className="max-w-[60ch] text-lg text-text-soft">{lede}</p> : null}
      </header>
      {children}
    </div>
  );
}
