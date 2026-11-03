import "server-only";

import {
  AdminRequiredError,
  ProposalAlreadyReviewedError,
  getDb,
  requireAdmin,
  type AdminContext,
} from "@admitstory/db";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { ApiError, handle } from "@/lib/api";
import { getSession } from "@/lib/session";
import { AdminActionError } from "./errors";

// The admin console's one gate (spec §5.18, §14.4). Every admin page and every /api/admin route
// checks it on its own request: a layout's check never covers a route handler or a server action.
// A non-admin, signed in or not, gets a plain 404, so the console's existence isn't advertised.
// Mutations are audited by the packages/db admin repositories, which demand the AdminContext this
// returns.

/** Pages: the admin's context, or Next's notFound(). */
export async function requireAdminPage(): Promise<AdminContext> {
  const session = await getSession();
  if (!session) notFound();
  try {
    return await requireAdmin(getDb(), session.user.id);
  } catch (error) {
    if (error instanceof AdminRequiredError) notFound();
    throw error;
  }
}

const NOT_FOUND = "That could not be found.";

/** Route handlers: the admin's context, or an ApiError(404). */
export async function requireAdminApi(): Promise<AdminContext> {
  const session = await getSession();
  if (!session) throw new ApiError(404, NOT_FOUND);
  try {
    return await requireAdmin(getDb(), session.user.id);
  } catch (error) {
    if (error instanceof AdminRequiredError) throw new ApiError(404, NOT_FOUND);
    throw error;
  }
}

/** A mutation must come from this site: a cross-site form post is refused (§14.6 CSRF). */
function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (origin === null) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (host === null || originHost !== host)
    throw new ApiError(403, "Admin changes must come from the admin console.");
}

/** Repository validation and state errors become 400/409 rather than a 500. */
function asApiError(error: unknown): unknown {
  if (error instanceof ZodError)
    return new ApiError(
      400,
      "Some values in that request were not valid.",
      error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  if (error instanceof ProposalAlreadyReviewedError) return new ApiError(409, error.message + ".");
  return error;
}

export interface AdminRouteContext<P> {
  params: Promise<P>;
}

/**
 * Wraps an admin route handler: the admin check runs first, before the body or the params are
 * read, then the handler; errors become the app's one error shape (lib/api handle()).
 */
export function adminRoute<P = Record<string, never>>(
  run: (admin: AdminContext, request: Request, params: P) => Promise<Response>,
): (request: Request, context: AdminRouteContext<P>) => Promise<Response> {
  return (request, context) =>
    handle(async () => {
      const admin = await requireAdminApi();
      assertSameOrigin(request);
      try {
        return await run(admin, request, await context.params);
      } catch (error) {
        if (error instanceof AdminActionError)
          return Response.json(
            { error: error.message, ...("reason" in error ? { code: error.reason } : {}) },
            { status: error.status },
          );
        throw asApiError(error);
      }
    });
}
