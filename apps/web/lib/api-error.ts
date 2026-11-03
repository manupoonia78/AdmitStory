// The app's one API error type (lib/api handle() turns it into a response). Its own module so the
// rate limiter and idempotency helpers can throw it without importing lib/api.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
    /** A machine-readable reason the client can branch on, e.g. "paused" or "reauth". */
    readonly code?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
