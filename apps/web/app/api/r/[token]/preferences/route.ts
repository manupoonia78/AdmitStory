import { getDb, setPortalPreferCoach } from "@admitstory/db";
import { z } from "zod";
import { readJson } from "@/lib/api";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";

// POST /api/r/:token/preferences: "I'd rather write it myself" (decision 20). The recommender can
// always choose the planning mode for themselves, whatever the schools allow.

const Body = z.strictObject({ preferCoach: z.boolean() });

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("preferences", access.inviteId);
    const { preferCoach } = await readJson(request, Body);
    return portalJson({ preferCoach: await setPortalPreferCoach(getDb(), access, preferCoach) });
  });
}
