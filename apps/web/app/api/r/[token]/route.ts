import { getDb, wipePortalWorkspace } from "@admitstory/db";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { loadPortalView } from "@/lib/portal/view";

// GET /api/r/:token: the recommender's page. DELETE: "Delete everything I wrote" (spec §5.11,
// §14.3). No session: the token in the path is the only credential, and it is never returned.

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context), { open: true });
    await portalLimit("view", access.inviteId);
    return portalJson(await loadPortalView(access));
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("wipe", access.inviteId);
    await wipePortalWorkspace(getDb(), access);
    return portalJson({ wiped: true });
  });
}
