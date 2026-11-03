import "server-only";

import {
  getDb,
  markPortalOpened,
  resolvePortalToken,
  type PortalAccess,
  type PortalClosedReason,
} from "@admitstory/db";
import { PORTAL_LIMITS, type PortalClosedView } from "@admitstory/shared/kit";
import { ApiError, checkRateLimit, type RateLimit } from "@/lib/api";

// The recommender portal's door (Phase 6 plan §1, §6, spec §14.3, §14.6). Every /r and /api/r
// request arrives with no session: the only credential is the random token in the path, which is
// stored hashed and resolved here. Nothing downstream ever sees a raw token again.
//
//  - A token that isn't a live link gets a closed page or a 404/410 with a PortalClosedView and no
//    other information: a closed link must not reveal who asked, or that it ever existed.
//  - Rate limits are keyed by invite id, so one recommender's page can't be used to hammer the app
//    on another's behalf, and an unknown token costs nothing but a hash lookup.
//  - Every response is `no-store`, and the token never leaves in a Referer (next.config adds the
//    headers for the whole subtree; the routes set them again, so a direct call is covered too).

/** Headers every portal response carries, whatever the status. */
export const PORTAL_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

/** A JSON response with the portal's headers. */
export function portalJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PORTAL_HEADERS });
}

/** Thrown when the token in the path is not a live link. */
export class PortalClosedError extends Error {
  constructor(readonly reason: PortalClosedReason) {
    super("That link no longer works.");
    this.name = "PortalClosedError";
  }
}

/** An unknown token is a 404; a link that existed and stopped working is a 410 (§6). */
export const closedStatus = (reason: PortalClosedReason): number =>
  reason === "unknown" ? 404 : 410;

/** The closed view a route or page renders. It never names the applicant for a dead token. */
export const closedView = (reason: PortalClosedReason): PortalClosedView => ({
  reason,
  applicantFirstName: null,
});

/**
 * The access a path token grants, or a PortalClosedError. `open: true` records the visit (the only
 * thing the applicant learns from a read).
 */
export async function portalAccess(
  token: string,
  options: { open?: boolean } = {},
): Promise<PortalAccess> {
  const resolution = await resolvePortalToken(getDb(), token);
  if (!resolution.ok) throw new PortalClosedError(resolution.reason);
  if (options.open) await markPortalOpened(getDb(), resolution.access);
  return resolution.access;
}

/** The token from the path, as Next hands dynamic segments over. */
export async function tokenParam(context: { params: Promise<{ token: string }> }): Promise<string> {
  const { token } = await context.params;
  return typeof token === "string" ? token : "";
}

/**
 * Runs a portal route handler. A closed link answers with its status and a PortalClosedView; an
 * ApiError keeps its own status; anything else is a 500 that says nothing about the request.
 */
export async function handlePortal(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PortalClosedError)
      return portalJson(closedView(error.reason), closedStatus(error.reason));
    if (error instanceof ApiError)
      return portalJson(
        { error: error.message, ...(error.issues ? { issues: error.issues } : {}) },
        error.status,
      );
    console.error("[portal] unhandled", error);
    return portalJson(
      { error: "Something failed on our side. Your words are saved; try again." },
      500,
    );
  }
}

/**
 * The portal's own limits (decision 21 plus runaway-client guards). In process, like the rest of
 * the app until Phase 9: enough to stop one page flooding the model and the transcriber.
 */
export const PORTAL_RATE_LIMITS = {
  view: { limit: 60, windowMs: 60_000 },
  notes: { limit: 60, windowMs: 60_000 },
  letter: { limit: 120, windowMs: 60_000 },
  assist: { limit: PORTAL_LIMITS.assistsPerHour, windowMs: 3_600_000 },
  stt: { limit: PORTAL_LIMITS.sttPerMinute, windowMs: 60_000 },
  voice: { limit: 60, windowMs: 60_000 },
  submitted: { limit: 30, windowMs: 60_000 },
  preferences: { limit: 20, windowMs: 60_000 },
  wipe: { limit: 5, windowMs: 3_600_000 },
  resend: { limit: 5, windowMs: 3_600_000 },
} as const satisfies Record<string, RateLimit>;

/** A portal limit, keyed by invite id (never by user id: one invite is one recommender). */
export async function portalLimit(
  name: keyof typeof PORTAL_RATE_LIMITS,
  inviteId: string,
): Promise<void> {
  await checkRateLimit(`portal:${name}`, inviteId, PORTAL_RATE_LIMITS[name]);
}
