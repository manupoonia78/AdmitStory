// The free kit preview (spec §5.5): the positioning headline for one school, the file map (which
// story goes where, titles only), the deliverables visibly present but locked, and the CTA,
// "Unlock {School} for $100". A school without a published pack can't be bought: its CTA becomes
// "Pack coming soon" and an offer to record interest (§5.5 AC). Server-safe; Button is the only
// client leaf. Pages usually show it in a Sheet opened from the school's "Preview kit".

import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import type { FileMapEntry, LockedDeliverable, PackStatus } from "./types";

/** The flat price of one school's kit (decided 2026-10-31). */
export const KIT_PRICE = "$100";

/** "Unlock Darden for $100" (spec §6.9). */
export function unlockLabel(schoolName: string): string {
  return `Unlock ${schoolName} for ${KIT_PRICE}`;
}

/** "Darden's". */
function possessive(name: string): string {
  return `${name}'s`;
}

/* Positioning --------------------------------------------------------------------------------- */

export interface PositioningBlockProps {
  /** One sentence about the applicant for this school, in the reading face. */
  headline: string;
  /** Up to a few short lines under it: what the school must see. */
  support?: readonly string[];
  className?: string;
}

/** The positioning headline, set as a sentence (Newsreader 21, 66 characters), not a banner. */
export function PositioningBlock({ headline, support = [], className }: PositioningBlockProps) {
  return (
    <div className={cx("flex max-w-essay flex-col gap-3", className)}>
      <p className="font-reading text-read-lg text-text">{headline}</p>
      {support.length > 0 ? (
        <ul className="flex flex-col gap-1 text-text-soft">
          {support.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* File map ------------------------------------------------------------------------------------ */

export interface FileMapListProps {
  entries: readonly FileMapEntry[];
  className?: string;
}

/** Deliverable, then the story it uses. Titles only: no draft text before the kit is bought. */
export function FileMapList({ entries, className }: FileMapListProps) {
  return (
    <dl
      className={cx(
        "grid grid-cols-1 border-t border-edge sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]",
        className,
      )}
    >
      {entries.map((entry) => (
        <div
          key={entry.key}
          data-entry={entry.key}
          className="grid grid-cols-subgrid border-b border-edge py-2 sm:col-span-2"
        >
          <dt className="font-medium text-text">{entry.deliverable}</dt>
          <dd className={entry.story ? "text-text" : "text-text-soft"}>
            {entry.story ?? "No single story leads this one"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* Locked deliverables -------------------------------------------------------------------------- */

export interface LockedDeliverablesProps {
  items: readonly LockedDeliverable[];
  className?: string;
}

/**
 * The drafts as rows that are visibly there: title, limit, the story it will use, faint ruled
 * lines where the draft will be, and a lock with the word "Locked". The rules are drawn, not text,
 * so nothing locked can be read or copied.
 */
export function LockedDeliverables({ items, className }: LockedDeliverablesProps) {
  return (
    <ul className={cx("flex flex-col border-t border-edge", className)}>
      {items.map((item) => (
        <li
          key={item.key}
          data-deliverable={item.key}
          data-locked=""
          className="flex flex-col gap-2 border-b border-edge py-3"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-medium text-text">
              {item.title}
              <span className="text-sm font-normal tabular-nums text-text-soft">
                , {item.limit}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-text-soft">
              <LockSimpleIcon size={16} aria-hidden />
              Locked
            </span>
          </span>
          {item.story ? (
            <span className="text-sm text-text-soft">From your story “{item.story}”</span>
          ) : null}
          <span aria-hidden="true" className="flex flex-col gap-2 pt-1">
            {[100, 92, 64].map((width) => (
              <span key={width} className="h-px bg-edge" style={{ width: `${width}%` }} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* The CTA ------------------------------------------------------------------------------------- */

interface UnlockCtaBase {
  schoolName: string;
  className?: string;
}

export interface PublishedUnlockCtaProps extends UnlockCtaBase {
  pack: "published";
  /** The checkout link, or use `onUnlock`. */
  href?: string;
  onUnlock?: () => void;
  /** Checkout is opening: the button keeps its place and says so. */
  loading?: boolean;
}

export interface ComingSoonUnlockCtaProps extends UnlockCtaBase {
  pack: "coming_soon";
  /** Records interest in the school (school_interest_votes). */
  onAskToCover?: () => void;
  /** The applicant already asked. */
  asked?: boolean;
}

export type UnlockCtaProps = PublishedUnlockCtaProps | ComingSoonUnlockCtaProps;

export function UnlockCta(props: UnlockCtaProps) {
  const { schoolName, className } = props;
  if (props.pack === "coming_soon") {
    return (
      <div data-pack="coming_soon" className={cx("flex flex-col items-start gap-3", className)}>
        <Button disabled>Pack coming soon</Button>
        <p className="max-w-essay text-text-soft">
          {`We sell a kit only once ${possessive(schoolName)} pack is verified against the school's own pages, so it can't be bought yet.`}
        </p>
        {props.asked ? (
          <p className="text-text">
            {`You asked us to cover ${schoolName}. Its kit can be bought once its pack is published.`}
          </p>
        ) : props.onAskToCover ? (
          <Button variant="secondary" onClick={props.onAskToCover}>
            Ask us to cover {schoolName}
          </Button>
        ) : null}
      </div>
    );
  }
  const label = unlockLabel(schoolName);
  return (
    <div data-pack="published" className={cx("flex flex-col items-start gap-2", className)}>
      {props.href && !props.loading ? (
        <Button asChild>
          <a href={props.href}>{label}</a>
        </Button>
      ) : (
        <Button onClick={props.onUnlock} loading={props.loading}>
          {props.loading ? "Opening checkout" : label}
        </Button>
      )}
      <p className="text-sm text-text-soft">
        {"One payment for this school's whole kit. Your preview carries over."}
      </p>
    </div>
  );
}

/* The whole preview --------------------------------------------------------------------------- */

export interface KitPreviewProps {
  schoolName: string;
  pack: PackStatus;
  positioning: PositioningBlockProps;
  fileMap: readonly FileMapEntry[];
  deliverables: readonly LockedDeliverable[];
  /** The CTA's own props, without the school and pack (taken from above). */
  cta?: Omit<PublishedUnlockCtaProps, "schoolName" | "pack"> &
    Omit<ComingSoonUnlockCtaProps, "schoolName" | "pack">;
  headingLevel?: 2 | 3;
  className?: string;
}

export function KitPreview({
  schoolName,
  pack,
  positioning,
  fileMap,
  deliverables,
  cta = {},
  headingLevel = 3,
  className,
}: KitPreviewProps) {
  const Heading = `h${headingLevel}` as const;
  const ctaProps: UnlockCtaProps =
    pack === "published"
      ? { pack, schoolName, href: cta.href, onUnlock: cta.onUnlock, loading: cta.loading }
      : { pack, schoolName, onAskToCover: cta.onAskToCover, asked: cta.asked };
  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <section className="flex flex-col gap-3">
        <Heading className="text-lg font-semibold text-text">{`How you'd position for ${schoolName}`}</Heading>
        <PositioningBlock {...positioning} />
      </section>
      <section className="flex flex-col gap-3">
        <Heading className="text-lg font-semibold text-text">Which story goes where</Heading>
        <FileMapList entries={fileMap} />
      </section>
      <section className="flex flex-col gap-3">
        <Heading className="text-lg font-semibold text-text">What the kit drafts</Heading>
        <LockedDeliverables items={deliverables} />
      </section>
      <UnlockCta {...ctaProps} />
    </div>
  );
}

/* Error --------------------------------------------------------------------------------------- */

export interface KitPreviewErrorProps {
  schoolName: string;
  /** Other previews that did finish. */
  othersReady?: boolean;
  onRetry: () => void;
  className?: string;
}

/** "Darden's preview didn't finish. Your other previews are ready. Try Darden again?" (§6.9). */
export function KitPreviewError({
  schoolName,
  othersReady = false,
  onRetry,
  className,
}: KitPreviewErrorProps) {
  return (
    <div role="status" className={cx("flex flex-col items-start gap-3", className)}>
      <p className="text-text">
        {`${possessive(schoolName)} preview didn't finish.${othersReady ? " Your other previews are ready." : ""} Try ${schoolName} again?`}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Preview {schoolName} again
      </Button>
    </div>
  );
}
