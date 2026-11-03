import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { decideProposal } from "@/lib/admin/packs";
import { ReviewBody } from "@/lib/admin/schemas";

// POST /api/admin/kb/proposals/:proposalId (spec §9.3 "accept / edit / reject each diff", screen
// M). Accepting applies the value to the cycle's draft in the same transaction; a value backed by
// a more trusted source is refused with code `outranked_by_current` unless `override` is sent.
export const POST = adminRoute<{ proposalId: string }>(async (admin, request, { proposalId }) => {
  const body = await readJson(request, ReviewBody);
  const proposal = await decideProposal(admin, proposalId, body);
  return Response.json({ proposal });
});
