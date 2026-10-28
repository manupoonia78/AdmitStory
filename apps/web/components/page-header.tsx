import type { ReactNode } from "react";

/** Page frame inside the shell: the page title is the headline (spec §6.3). */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-2xl font-bold text-graphite">{title}</h1>
      {children}
    </div>
  );
}
