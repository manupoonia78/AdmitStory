import { getDb } from "@admitstory/db";
import { handle, requireUser } from "@/lib/api";
import { recommenderSummary } from "@/lib/recommenders/summary";

// GET /api/recommenders/summary: Home's "Recommenders: 1 of 2 invited" per school and the next
// step ("Ask Ravi for a recommendation by 18 Nov"). Status only, never content (§14.3).

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    return Response.json(await recommenderSummary(getDb(), session.user.id));
  });
}
