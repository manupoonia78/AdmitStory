import { costsCsv } from "@admitstory/db";
import { adminRoute } from "@/lib/admin/guard";
import { costRange } from "@/lib/admin/costs";

// GET /api/admin/costs/export?days=30&replay=0 (spec §5.18 "Costs"): the ledger as CSV, one row
// per day, task, model and mode.
export const GET = adminRoute(async (admin, request) => {
  const url = new URL(request.url);
  const range = costRange(url.searchParams.get("days"), url.searchParams.get("replay"));
  const csv = await costsCsv(admin, range);
  const name = `admitstory-costs-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
});
