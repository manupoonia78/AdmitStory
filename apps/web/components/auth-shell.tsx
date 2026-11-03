import { APP_NAME } from "@admitstory/shared";
import { SkipLink } from "@admitstory/ui";
import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";

/**
 * The layout of AuthFrame without any client code: the brand and one focused glass panel over
 * `backdrop`. The root not-found page uses it directly with the CSS-lit stage alone, because the
 * root not-found's client components ship with every route, the marketing pages included.
 */
export function AuthShell({ children, backdrop }: { children: ReactNode; backdrop?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {backdrop ?? <div aria-hidden className="studio" />}
      <SkipLink targetId="main" />
      <header className="px-4 py-5 sm:px-10 sm:py-7">
        <p className="flex items-center gap-3 text-lg font-semibold tracking-tight text-text">
          <BrandMark />
          {APP_NAME}
        </p>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="auth-main flex flex-1 px-4 pb-16 pt-6 outline-none sm:px-10 sm:pt-[8vh] lg:pl-[9vw]"
      >
        <div className="flex w-full max-w-md flex-col gap-6 self-start rounded-sheet! plane p-7 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
