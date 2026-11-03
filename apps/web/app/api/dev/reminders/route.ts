import { z } from "zod";
import { ApiError, handle, readJson, requireUser } from "@/lib/api";
import { isLocalAppUrl, serverEnv } from "@/lib/env";
import { runDueReminders } from "@/lib/reminders/send";

// POST /api/dev/reminders (localhost only): runs the reminder loop now, the way the hourly cron
// runs it in the cloud, so the schedule can be watched without Inngest. Refuses anywhere else.

const Body = z.strictObject({ limit: z.number().int().min(1).max(200).optional() });

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    if (!isLocalAppUrl(serverEnv().APP_URL)) throw new ApiError(404, "Not available.");
    await requireUser();
    const { limit } = await readJson(request, Body);
    return Response.json(await runDueReminders({ limit }));
  });
}
