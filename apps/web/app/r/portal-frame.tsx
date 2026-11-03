import { APP_NAME } from "@admitstory/shared";
import { SkipLink } from "@admitstory/ui";
import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";

// The recommender portal's frame (spec §6.7): outside the signed-in shell, so no dock, no command
// palette and no analytics. One reading column, phone-first, in whichever theme the recommender's
// own system asks for (the root layout's cookie is "system" for anyone who has never signed in).

export function PortalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink targetId="main" />
      <header className="px-4 py-5 sm:px-8">
        <p className="flex items-center gap-2.5 text-sm font-medium text-text-soft">
          <BrandMark size={20} />
          {APP_NAME}
        </p>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="auth-main flex flex-1 justify-center px-4 pb-24 pt-2 outline-none sm:px-8 sm:pt-8"
      >
        <div className="flex w-full max-w-[680px] flex-col gap-10">{children}</div>
      </main>
    </div>
  );
}
