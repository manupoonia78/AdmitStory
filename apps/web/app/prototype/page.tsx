import Link from "next/link";

// The four signature moments (spec §6.13) plus the Voiceprint lab and route transitions.
const PROTOTYPES = [
  {
    href: "/prototype/studio",
    title: "Story Studio",
    description:
      "Speak to your Voiceprint. A story in the transcript lights up and flies to the shelf.",
  },
  {
    href: "/prototype/kit",
    title: "Kit assembly",
    description: "Threads of light carry stories to essays as each one starts drafting.",
  },
  {
    href: "/prototype/workspace",
    title: "Your words, lit",
    description: "Your own sentences glow in your hue, and an accepted change morphs in place.",
  },
  {
    href: "/prototype/duet",
    title: "Live mock",
    description: "Two Voiceprints face each other, each answering whoever is speaking.",
  },
  {
    href: "/prototype/voiceprint",
    title: "Voiceprint",
    description:
      "Live microphone input, a three-minute identity sample and every performance tier.",
  },
  {
    href: "/prototype/transitions",
    title: "Route transitions",
    description: "Shared elements travel between two sample pages.",
  },
] as const;

export default function PrototypeIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-col gap-6">
        <h1 className="max-w-[12ch] text-display-lg text-text">Your voice becomes light</h1>
        <p className="max-w-prose text-lg text-text-soft">
          Look and feel prototypes for review. Everything here runs on fake data for a fictional
          applicant.
        </p>
      </div>

      <ul className="flex flex-col border-t border-edge">
        {PROTOTYPES.map((prototype) => (
          <li key={prototype.href} className="border-b border-edge">
            <Link
              href={prototype.href}
              className="group flex flex-col gap-2 rounded-control py-6 sm:flex-row sm:items-baseline sm:gap-8"
            >
              <span className="text-display-sm text-text underline decoration-transparent decoration-2 underline-offset-[0.15em] group-hover:decoration-current sm:w-80 sm:shrink-0">
                {prototype.title}
              </span>
              <span className="text-text-soft">{prototype.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-text-soft">
        Add <code className="font-ui text-text">?hud=1</code> to any prototype address to show the
        frame rate, frame time and performance tier.
      </p>
    </div>
  );
}
