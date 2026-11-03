import { StatusLabel } from "@admitstory/ui";
import { Page as PageFrame } from "@/components/page-header";

export interface ComingSoonPageProps {
  title: string;
  /** One reading-size line: what this area will be for. */
  headline: string;
  /** The label above the headline, always "Coming soon". */
  status: string;
  /** One quiet line under it: what is true today, and any promise attached. */
  line: string;
  parts: readonly { name: string; line: string }[];
}

/**
 * An area that is not open yet (Interview Studio, Connect, Tracker). It says so plainly and
 * describes what is coming, without implying any of it works today (spec §14.5). Server-only and
 * static: a deferred area costs the bundle nothing.
 */
export function ComingSoonPage({ title, headline, status, line, parts }: ComingSoonPageProps) {
  return (
    <PageFrame title={title}>
      <section className="plane flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <StatusLabel tone="neutral">{status}</StatusLabel>
          <p className="max-w-[34ch] font-reading text-reading-lg text-balance text-text">
            {headline}
          </p>
          <p className="max-w-prose text-sm text-text-soft">{line}</p>
        </div>
        <ul className="flex flex-col divide-y divide-edge border-t border-edge">
          {parts.map((part) => (
            <li key={part.name} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
              <span className="text-sm font-medium text-text sm:w-48 sm:shrink-0">{part.name}</span>
              <span className="text-sm text-text-soft">{part.line}</span>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
