import "server-only";

import { EmailNotVerifiedError, NotSignedInError, WelcomeNotCompletedError } from "@/lib/guards";
import { requireOnboardedUser, type AppUser } from "@/lib/app-user";
import type { z } from "zod";

// Shared plumbing for the route handlers of spec §11: every input Zod-validated, every user-scoped
// route ownership-checked, and one error shape so the client never has to guess.
//
// Rate limits are in-process (spec §12.4 specifies Upstash; it is not configured and is not part of
// Phase 1 — see docs/phase-1.md). That protects a single instance from a runaway client, which is
// what a development and beta deployment needs; it is not a defence across instances.

export interface ApiErrorBody {
  error: string;
  /** Only set when a field failed validation, so a form can point at it. */
  issues?: { path: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
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
        { error: error.message, ...(error.issues ? { issues: error.issues } : {}) },
        { status: error.status },
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
  return requireOnboardedUser("action");
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

/* Rate limiting ------------------------------------------------------------------------------ */

const buckets = new Map<string, number[]>();

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

/** Spec §12.4's Studio limits. TTS and drills join them in Phase 2 and Phase 7. */
export const RATE_LIMITS = {
  studioTurns: { limit: 30, windowMs: 60_000 },
  uploads: { limit: 10, windowMs: 60_000 },
  dossierWrites: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimit>;

export function checkRateLimit(key: string, userId: string, { limit, windowMs }: RateLimit): void {
  const bucketKey = `${key}:${userId}`;
  const now = Date.now();
  const recent = (buckets.get(bucketKey) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit)
    throw new ApiError(429, "That's faster than we can keep up with. Try again in a moment.");
  recent.push(now);
  buckets.set(bucketKey, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 10_000)
    for (const [candidate, times] of buckets)
      if (times.every((at) => now - at >= windowMs)) buckets.delete(candidate);
}
