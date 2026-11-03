import "server-only";

import {
  getKbSource,
  getPackForAdmin,
  getProposal,
  inTransaction,
  listProposals,
  publishPack,
  reviewProposal,
  updateDraftPack,
  type AdminContext,
  type KbProposal,
  type SchoolPack as PackRow,
} from "@admitstory/db";
import {
  applyProposals,
  compilePack,
  publishBlockers,
  type BlockReason,
  type PublishBlocker,
} from "@admitstory/kb";
import { parseSchoolPack } from "@admitstory/kb/schema";
import { AdminActionError } from "./errors";
import { acceptedProposal, isoDay, packSourceFor, pendingLabel, tryParsePack } from "./pack";
import { ensureDraft, findCycle } from "./drafts";

// Reviewing proposals into the draft and publishing it (spec §9.3, screen M). A decision and the
// draft change it causes land in one transaction, so the pack never holds a value whose proposal
// still reads "pending", or the reverse.

export type ReviewDecision =
  | { decision: "accepted"; override?: boolean; reason?: string }
  | { decision: "edited"; edited: unknown; override?: boolean; reason?: string }
  | { decision: "rejected"; reason?: string };

/** A refusal from applyProposals, with the reason so the console can offer "Use this anyway". */
export class ProposalBlockedError extends AdminActionError {
  constructor(
    message: string,
    readonly reason: BlockReason,
  ) {
    super(message, 409);
    this.name = "ProposalBlockedError";
  }
}

export async function decideProposal(
  admin: AdminContext,
  proposalId: string,
  decision: ReviewDecision,
  now: Date = new Date(),
): Promise<KbProposal> {
  const proposal = await getProposal(admin, proposalId);
  if (!proposal) throw new AdminActionError("That proposal could not be found.", 404);
  if (proposal.status !== "pending")
    throw new AdminActionError(`That proposal is already ${proposal.status}.`);

  const review =
    decision.decision === "edited"
      ? { decision: "edited" as const, edited: decision.edited, reason: decision.reason }
      : { decision: decision.decision, reason: decision.reason };

  // Rejecting changes nothing in the pack; a refresh-check item is acknowledged, not applied.
  if (decision.decision === "rejected" || proposal.sourceId === null) {
    const row = await reviewProposal(admin, proposalId, review);
    if (!row) throw new AdminActionError("That proposal could not be found.", 404);
    return row;
  }

  const ref = await findCycle(admin, proposal.cycleId);
  if (!ref) throw new AdminActionError("That proposal's cycle could not be found.", 404);
  const source = await getKbSource(admin, proposal.sourceId);
  if (!source) throw new AdminActionError("That proposal's source was deleted.", 410);
  const draft = await ensureDraft(admin, ref);
  const pack = tryParsePack(draft.data);
  if (!pack)
    throw new AdminActionError(
      "The draft isn't a valid pack yet. Fix it in Edit draft, then accept this field.",
      422,
    );

  const result = applyProposals(
    pack,
    [
      acceptedProposal(proposal, {
        ...(decision.decision === "edited" ? { edited: decision.edited } : {}),
        override: decision.override === true,
      }),
    ],
    { verifiedOn: isoDay(now), sources: [packSourceFor(source)] },
  );
  const blocked = result.blocked[0];
  if (blocked) throw new ProposalBlockedError(blocked.detail, blocked.reason);
  if (!result.ok)
    throw new AdminActionError(
      `That value would make the pack invalid: ${result.issues.slice(0, 3).join("; ")}`,
      422,
    );

  return inTransaction(admin, async (tx) => {
    await updateDraftPack(tx, draft.id, result.pack as unknown as Record<string, unknown>);
    const row = await reviewProposal(tx, proposalId, review);
    if (!row) throw new AdminActionError("That proposal could not be found.", 404);
    return row;
  });
}

export interface PublishState {
  draft: PackRow;
  /** Pending proposals for the cycle: each must be decided before publishing. */
  pending: number;
  blockers: PublishBlocker[];
  /** The compiled L1 prompt as it would publish; null while the draft doesn't validate. */
  compiled: { text: string; tokenCount: number; excluded: number } | null;
  /** Why the button is disabled, in the console's words; null when it can publish. */
  disabledReason: string | null;
}

/** What "Publish version N" would do right now, for the review screen. */
export async function publishState(
  admin: AdminContext,
  draft: PackRow,
  cycle: string,
  now: Date = new Date(),
): Promise<PublishState> {
  const pending = (await listProposals(admin, { cycleId: draft.cycleId, status: "pending" }))
    .length;
  const blockers = publishBlockers(draft.data);
  const pack = tryParsePack(draft.data);
  let compiled: PublishState["compiled"] = null;
  if (pack) {
    const out = compilePack({ ...pack, version: draft.version }, { cycle, now });
    compiled = { text: out.text, tokenCount: out.tokenCount, excluded: out.excluded.length };
  }
  const disabledReason =
    pending > 0
      ? pendingLabel(pending)
      : blockers.length > 0
        ? blockers.length === 1
          ? `1 item blocks publishing: ${blockers[0]?.detail ?? ""}`
          : `${blockers.length} items block publishing, starting with: ${blockers[0]?.detail ?? ""}`
        : null;
  return { draft, pending, blockers, compiled, disabledReason };
}

/**
 * Publishes the draft as its version (§9.3 "Publish pack version N+1"): checks the gate again on
 * the server, compiles the L1 prompt by code, writes it with its token count, and returns what the
 * caller emits as `kb/pack.published`.
 */
export async function publishDraft(
  admin: AdminContext,
  packId: string,
  now: Date = new Date(),
): Promise<{ pack: PackRow; cycleId: string; version: number; tokenCount: number }> {
  const draft = await getPackForAdmin(admin, packId);
  if (!draft || draft.status !== "draft")
    throw new AdminActionError("That draft could not be found, or it's already published.", 404);
  const ref = await findCycle(admin, draft.cycleId);
  if (!ref) throw new AdminActionError("That pack's cycle could not be found.", 404);
  const state = await publishState(admin, draft, ref.cycle.cycle, now);
  if (state.disabledReason) throw new AdminActionError(state.disabledReason);

  const pack = parseSchoolPack({ ...draft.data, version: draft.version });
  const compiled = compilePack(pack, { cycle: ref.cycle.cycle, now });
  const published = await inTransaction(admin, async (tx) => {
    await updateDraftPack(tx, draft.id, pack as unknown as Record<string, unknown>);
    return publishPack(tx, draft.id, {
      compiledPrompt: compiled.text,
      tokenCount: compiled.tokenCount,
    });
  });
  return {
    pack: published,
    cycleId: published.cycleId,
    version: published.version,
    tokenCount: compiled.tokenCount,
  };
}

/** Saves an admin's hand edit of the draft JSON; it must still be a valid pack. */
export async function saveDraftJson(
  admin: AdminContext,
  packId: string,
  data: unknown,
): Promise<PackRow> {
  const draft = await getPackForAdmin(admin, packId);
  if (!draft || draft.status !== "draft")
    throw new AdminActionError("Published versions can't be edited. Edit the draft instead.", 409);
  let pack;
  try {
    pack = parseSchoolPack(data);
  } catch (error) {
    throw new AdminActionError(
      `That isn't a valid pack: ${error instanceof Error ? error.message.slice(0, 600) : "invalid"}`,
      422,
    );
  }
  return updateDraftPack(admin, packId, {
    ...(pack as unknown as Record<string, unknown>),
    version: draft.version,
  });
}
