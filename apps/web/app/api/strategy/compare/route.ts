import { z } from "zod";
import { handle, requireUser } from "@/lib/api";
import { loadStrategy } from "@/lib/strategy/page-data";

// GET /api/strategy/compare?ids=a,b (spec §11, §5.5 "List review"): the comparison of the caller's
// schools (all of them without `ids`), schools as columns and criteria as rows. Every number and
// median carries its source and verified date; ids not on the caller's list are ignored.

const Ids = z.array(z.guid()).max(12);

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const raw = new URL(request.url).searchParams.get("ids");
    const parsed = Ids.safeParse(raw ? raw.split(",").filter(Boolean) : []);
    const wanted = parsed.success && parsed.data.length > 0 ? new Set(parsed.data) : null;
    const data = await loadStrategy(session.user.id);
    const keep = (id: string) => wanted === null || wanted.has(id);
    return Response.json({
      columns: data.comparison.columns.filter((c) => keep(c.id)),
      groups: data.comparison.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({
          ...row,
          cells: Object.fromEntries(Object.entries(row.cells).filter(([id]) => keep(id))),
        })),
      })),
      flags: data.flags.filter((flag) => keep(flag.id.split(":")[0] ?? "")),
      planner: data.planner.filter((item) => keep(item.schoolId)),
      timeZone: data.applicant.timeZone,
    });
  });
}
