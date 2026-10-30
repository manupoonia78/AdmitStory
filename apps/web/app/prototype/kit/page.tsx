import type { Metadata } from "next";
import { KitPrototype } from "./kit-prototype-host";
import { KIT_DURATION_MS } from "./script";

// Kit assembly prototype (spec §6.7 Kit generation, §16 Phase 0.5): a scripted ~40 second run on
// fake data. ?at=<ms> starts part-way through, for reviews and tests (?at=40000 is the finished kit).

export const metadata: Metadata = { title: "Kit assembly" };

export default async function KitPrototypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const at = Number((await searchParams).at);
  const startAt = Number.isFinite(at) ? Math.min(KIT_DURATION_MS, Math.max(0, at)) : 0;
  return <KitPrototype startAt={startAt} />;
}
