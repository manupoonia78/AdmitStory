import { SkipLink, Wordmark } from "@admitstory/ui";
import type { ReactNode } from "react";

/**
 * Signed-out layout: the form on paper at the left, an ink panel at the right carrying one line
 * of the product's promise and a page torn from a sample essay. No client code, so the root
 * not-found page can use it without adding to every route's first load.
 */
export function AuthShell({ children }: { children: ReactNode; backdrop?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <SkipLink targetId="main" />
      <div className="flex flex-col px-5 py-6 sm:px-12 sm:py-9">
        <header>
          {/* A plain anchor: next/link would add its client chunk to /sign-in's first load. */}
          <a href="/" className="inline-flex rounded-control" aria-label="AdmitStory home">
            <Wordmark size={24} />
          </a>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="auth-main flex flex-1 items-center py-12 outline-none sm:py-16"
        >
          <div className="mx-auto flex w-full max-w-[25rem] flex-col gap-7">{children}</div>
        </main>
        <p className="meta">Your words, your voice. Nothing is written for you.</p>
      </div>

      <aside
        aria-hidden
        data-theme="night"
        className="relative hidden overflow-hidden border-l border-edge lg:flex lg:flex-col lg:justify-between lg:p-14"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 50% at 70% 20%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
          }}
        />
        <p className="eyebrow relative">The application, in your own words</p>
        <figure className="relative flex flex-col gap-10">
          <blockquote className="max-w-[32rem] font-display text-[clamp(2rem,1rem+2vw,3rem)] leading-[1.08] tracking-[-0.02em] text-text">
            Tell your story once. <em>Every school hears it in your voice.</em>
          </blockquote>
          <div className="relative max-w-[30rem] rotate-[-1.2deg] rounded-[6px] bg-[#fbf9f5] p-8 text-[#1a1713] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#625b50]">
              Essay draft · Why this MBA
            </p>
            <p className="mt-4 font-reading text-[15px] leading-[1.7]">
              It was 2 a.m. in the Pune plant when the line stopped for the third time that week. I
              had spent two years learning to fix machines; that night I learned that what actually
              broke was the handover between people.
            </p>
            <p className="mt-4 border-t border-[#e2dbcf] pt-3 font-mono text-[11px] text-[#625b50]">
              94% your own words · 3 sources cited
            </p>
          </div>
        </figure>
      </aside>
    </div>
  );
}
