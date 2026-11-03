import { handle, requireUser } from "@/lib/api";
import { profileReadView } from "@/lib/profile-read/view";
import { loadProfileRead } from "@/lib/profile-read/server";

// GET /api/profile/read (spec §11, §5.4): the applicant's latest Profile Read, as screen D shows
// it, with every claim's evidence resolved to their own stories and facts. Scoped to the caller.

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const data = await loadProfileRead(session.user.id);
    return Response.json({
      version: data.version,
      builtAt: data.builtAt,
      behind: data.behind,
      view: data.read
        ? profileReadView({
            read: data.read.read,
            stories: data.stories,
            facts: data.facts,
            levels: data.levels,
          })
        : null,
    });
  });
}
