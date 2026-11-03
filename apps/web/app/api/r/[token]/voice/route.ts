import { PORTAL_LIMITS } from "@admitstory/shared/kit";
import { z } from "zod";
import { readJson } from "@/lib/api";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { meterPortalVoice } from "@/lib/portal/notes";

// POST /api/r/:token/voice: the seconds a dictated note took, metered against the invite's hour
// (decision 21). Seconds only — no audio is ever sent here, or kept anywhere (decision 5).

const Body = z.strictObject({
  seconds: z.number().int().min(0).max(PORTAL_LIMITS.voiceSeconds),
  language: z.string().trim().max(35).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("voice", access.inviteId);
    const { seconds } = await readJson(request, Body);
    return portalJson(await meterPortalVoice(access, seconds));
  });
}
