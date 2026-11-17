// Where social proof will go (SPEC §4.1). Renders NOTHING until components/social-proof.ts holds
// real content: no wrapper, no heading, no spacing, no empty box. Server-safe.

import { SOCIAL_PROOF, type SocialProofItem } from "./social-proof";

export function SocialProofSlot({
  items = SOCIAL_PROOF,
  className,
}: {
  items?: readonly SocialProofItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label="What applicants say" className={className}>
      <ul
        role="list"
        className="mx-auto grid w-full max-w-[1440px] gap-x-6 gap-y-12 px-4 py-20 sm:px-8 lg:grid-cols-3 lg:px-12 lg:py-28"
      >
        {items.map((item) => (
          <li key={`${item.by}-${item.quote}`} className="border-t border-edge-strong pt-6">
            <blockquote className="font-accent text-[1.5rem] leading-[1.25] text-text-80 italic">
              “{item.quote}”
            </blockquote>
            <p className="mt-5 text-ui text-text">{item.by}</p>
            <p className="label mt-1">{item.context}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
