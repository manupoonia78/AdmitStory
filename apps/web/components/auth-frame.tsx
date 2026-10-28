import { APP_NAME } from "@admitstory/shared";
import { SkipLink } from "@admitstory/ui";
import type { ReactNode } from "react";

/** Frame for signed-out and first-run pages: brand, then one focused panel. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <SkipLink targetId="main" />
      <header className="px-4 py-4 sm:px-8">
        <p className="text-base font-bold text-graphite">{APP_NAME}</p>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 justify-center px-4 pb-16 pt-4 outline-none sm:pt-12"
      >
        <div className="flex w-full max-w-md flex-col gap-6 self-start rounded-panel border border-line bg-paper p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
