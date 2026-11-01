import "server-only";

import type { Deliverable, DraftRow } from "@admitstory/db";
import { packDeliverables } from "@/lib/strategy/deliverables";
import { draftEssay, load, type KitDeps } from "./pipeline";

// Options B and C (spec §5.7 stage 6, §5.8 Options tab): drafted when the applicant asks, saved as
// a version beside the current draft so "Use this option" is a deliberate switch.

export async function draftOption(
  deps: KitDeps,
  userId: string,
  deliverable: Deliverable,
  angleId: string,
): Promise<DraftRow> {
  const ref = { kitId: deliverable.kitId, userId };
  const l = await load(deps, ref);
  const source = packDeliverables(l.pack, l.ctx.isReapplicant).find(
    (d) => d.key === deliverable.packKey,
  );
  return draftEssay(deps, ref, l, deliverable, source, { angleId, makeCurrent: false });
}
