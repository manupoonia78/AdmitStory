import { formatDate } from "../../strategy/time-scale";
import { cx } from "../../lib/cx";

/** A school fact's source (spec §0: every school-specific fact carries a source and a date). */
export interface PackSource {
  /** The pack item, "K17". */
  id: string;
  /** Where it was published: "Darden essay prompts page". */
  label: string;
  url?: string;
  /** When an admin last verified it (ISO date). */
  verifiedAt: string;
}

export function verifiedDate(at: string): string {
  return formatDate(at, "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Source: Darden essay prompts page, verified 12 Sep 2026", the label linking out. */
export function SourceLine({
  sources,
  className,
}: {
  sources: readonly PackSource[];
  className?: string;
}) {
  if (sources.length === 0) return null;
  return (
    <p className={cx("text-sm text-text-soft", className)}>
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((source, index) => (
        <span key={source.id}>
          {index > 0 ? "; " : null}
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
            >
              {source.label}
            </a>
          ) : (
            source.label
          )}
          , verified {verifiedDate(source.verifiedAt)}
        </span>
      ))}
    </p>
  );
}
