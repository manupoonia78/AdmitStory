import {
  HonestFlagList,
  RoundPlanner,
  type HonestFlag,
  type PlannedApplication,
} from "@admitstory/ui";

// The honest flags and the round planner (spec §5.5, screen E). A server component: the client
// screen receives them already rendered, so neither ships any JavaScript.

/** SPEC §6.2's empty state: a flat line and one sentence, never a box. */
function EmptyLine({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span aria-hidden className="h-[1.25px] w-60 bg-edge-strong" />
      <p className="max-w-[60ch] text-sm text-text-soft">{children}</p>
    </div>
  );
}

export function StrategyDetails({
  flags,
  planner,
  hasPublished,
  now,
  timeZone,
}: {
  flags: HonestFlag[];
  planner: PlannedApplication[];
  hasPublished: boolean;
  now: string;
  timeZone: string;
}) {
  return (
    <>
      <section aria-labelledby="flags-heading" className="flex flex-col gap-4">
        <h2
          id="flags-heading"
          className="text-title text-text"
        >
          Honest flags
        </h2>
        {flags.length > 0 ? (
          <HonestFlagList flags={flags} />
        ) : (
          <EmptyLine>
            {hasPublished
              ? "Nothing to flag yet. Flags appear here as each school's read finishes."
              : "Flags appear once a school on your list has a published pack."}
          </EmptyLine>
        )}
      </section>

      <section aria-labelledby="planner-heading" className="flex flex-col gap-4">
        <h2
          id="planner-heading"
          className="text-title text-text"
        >
          Round planner
        </h2>
        {planner.length > 0 ? (
          <RoundPlanner items={planner} now={now} timeZone={timeZone} />
        ) : (
          <EmptyLine>The planner fills in once a school on your list has published rounds.</EmptyLine>
        )}
      </section>
    </>
  );
}
