import "server-only";

import { FeatureDisabledError } from "@admitstory/ai";
import { ApiError } from "@/lib/api-error";
import { pausedMessage } from "@/lib/features";
import { EmailNotVerifiedError, NotSignedInError, WelcomeNotCompletedError } from "@/lib/guards";
import { requireOnboardedUser, type AppUser } from "@/lib/app-user";
import type { z } from "zod";

// Shared plumbing for the route handlers of spec §11: every input Zod-validated, every user-scoped
// route ownership-checked, and one error shape so the client never has to guess.
//
// Rate limits live in lib/rate-limit.ts (Upstash, with an in-process fallback) and are re-exported
// here for the routes that import them from this module.

export { ApiError } from "@/lib/api-error";
export { RATE_LIMITS, checkIpRateLimit, checkRateLimit, type RateLimit } from "@/lib/rate-limit";

export interface ApiErrorBody {
  error: string;
  /** Only set when a field failed validation, so a form can point at it. */
  issues?: { path: string; message: string }[];
}

export function badRequest(message: string, issues?: { path: string; message: string }[]): never {
  throw new ApiError(400, message, issues);
}

export function notFound(what = "That"): never {
  throw new ApiError(404, `${what} could not be found.`);
}

/** Runs a handler and turns the errors the app throws into responses. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError)
      return Response.json(
        {
          error: error.message,
          ...(error.issues ? { issues: error.issues } : {}),
          ...(error.code ? { code: error.code } : {}),
          ...error.extra,
        },
        { status: error.status },
      );
    // A kill switch (Phase 9b): the feature's own calm line, and a code the client can show.
    if (error instanceof FeatureDisabledError)
      return Response.json(
        { error: await pausedMessage(error.feature), code: "paused", feature: error.feature },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    if (
      error instanceof NotSignedInError ||
      error instanceof EmailNotVerifiedError ||
      error instanceof WelcomeNotCompletedError
    )
      return Response.json({ error: error.message }, { status: error.status });
    console.error("[api] unhandled", error);
    return Response.json(
      { error: "Something failed on our side. Your work is saved; try again." },
      { status: 500 },
    );
  }
}

/** The signed-in, onboarded user for a route handler, or a 401/403 response. */
export function requireUser(): Promise<AppUser> {
  return requireOnboardedUser("api");
}

/** Parses a JSON body against a schema, reporting field errors the form can use. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    badRequest("The request body must be JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    badRequest(
      "Some values in that request were not valid.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  return parsed.data;
}
