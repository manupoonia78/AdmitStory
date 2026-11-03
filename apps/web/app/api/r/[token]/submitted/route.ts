import { getDb, setPortalSubmitted } from "@admitstory/db";
import { z } from "zod";
import { readJson } from "@/lib/api";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { portalContext, schoolIn } from "@/lib/portal/view";

// POST /api/r/:token/submitted (spec §5.11): "I've submitted my recommendation to Halvorsen".
// This is the one thing the applicant learns besides opened and started — and it stops the
// reminders for that school.

const Body = z.strictObject({ schoolCycleId: z.guid(), submitted: z.boolean() });

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("submitted", access.inviteId);
    const body = await readJson(request, Body);
    const loaded = await portalContext(access);
    const school = schoolIn(loaded, body.schoolCycleId);
    const submitted = await setPortalSubmitted(
      getDb(),
      access,
      school.schoolCycleId,
      body.submitted,
    );
    return portalJson({ submitted });
  });
}
