// Sentry scrubbers (spec §14.4: no essay or transcript content, and no personal data, leaves the
// app). They remove, rather than mask:
//  - request bodies, cookies, query strings, auth headers and client IP headers (sign-in links carry
//    tokens in the query);
//  - user fields other than the id;
//  - the message of any ZodError and the input values of anything shaped like a Zod issue;
//  - span and trace attributes that carry URLs with queries, client addresses, headers, bodies or
//    generative-AI content (`scrubSpan` for streamed spans, and the same rules inside events).
// Kept pure and structural so it can be unit-tested without the Sentry SDK. The SDK is also told
// not to collect any of this in the first place (`dataCollection` in sentry-options.ts); this is the
// second line of defence.

const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "x-captcha-response",
  "proxy-authorization",
  // The client's IP address, as set by proxies and CDNs.
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "forwarded",
  "x-client-ip",
  "x-cluster-client-ip",
  "fastly-client-ip",
  "x-vercel-forwarded-for",
  "x-vercel-proxied-for",
]);

/** Vercel's geolocation headers (x-vercel-ip-city, -country, -latitude…). */
const SENSITIVE_HEADER_PREFIXES = ["x-vercel-ip-"];

function isSensitiveHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return SENSITIVE_HEADERS.has(lower) || SENSITIVE_HEADER_PREFIXES.some((p) => lower.startsWith(p));
}

/** Span attributes that are dropped outright. */
const DROPPED_ATTRIBUTES = new Set([
  "url.query",
  "url.fragment",
  "http.query",
  "http.fragment",
  "client.address",
  "client.port",
  "http.client_ip",
  "net.peer.ip",
  "net.sock.peer.addr",
  "network.peer.address",
  "user.email",
  "user.ip_address",
  "user.name",
  "user.username",
  "user.full_name",
  "user.geo.city",
  "user.geo.country_code",
  "user.geo.region",
  "user.geo.subdivision",
]);

/** Prefixes of span attributes that are dropped: headers, bodies and generative-AI content. */
const DROPPED_ATTRIBUTE_PREFIXES = [
  "gen_ai.",
  "http.request.header.",
  "http.response.header.",
  "http.request.body",
  "http.response.body",
];

/** Span attributes that hold a URL or path: kept, without the query string or fragment. */
const URL_ATTRIBUTES = new Set(["url.full", "http.url", "http.target", "url.path", "http.route"]);

const ZOD_VALUE_KEYS = new Set(["input", "received", "values", "options", "params"]);

export const ZOD_MESSAGE_REMOVED = "Validation failed (details removed before sending)";

interface ScrubbableEvent {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    env?: unknown;
    headers?: Record<string, string>;
  };
  user?: { id?: string | number; [key: string]: unknown };
  exception?: { values?: { type?: string; value?: string }[] };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: { category?: string; message?: string; data?: Record<string, unknown> }[];
  spans?: { description?: string; data?: Record<string, unknown> }[];
  transaction?: string;
  message?: string;
}

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function isZodIssue(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    Array.isArray((value as { path?: unknown }).path)
  );
}

/** Deep copy with Zod issue input values removed. */
export function scrubZodIssues(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubZodIssues(item, depth + 1));
  const zodIssue = isZodIssue(value);
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (zodIssue && ZOD_VALUE_KEYS.has(key)) continue;
    // A custom Zod message can quote the rejected value, so only the code and path survive.
    if (zodIssue && key === "message") continue;
    out[key] = scrubZodIssues(inner, depth + 1);
  }
  return out;
}

type AttributeValue = unknown;

function stripQueryFromAttribute(value: AttributeValue): AttributeValue {
  if (typeof value === "string") return stripQuery(value);
  // Streamed span attributes may be { value, unit } objects.
  if (typeof value === "object" && value !== null && "value" in value) {
    const inner = (value as { value: unknown }).value;
    if (typeof inner === "string") return { ...value, value: stripQuery(inner) };
  }
  return value;
}

/** A copy of span or trace attributes without URL queries, addresses, headers, bodies or AI content. */
export function scrubAttributes<A extends Record<string, unknown>>(attributes: A): A {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (DROPPED_ATTRIBUTES.has(key)) continue;
    if (DROPPED_ATTRIBUTE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    out[key] = URL_ATTRIBUTES.has(key) ? stripQueryFromAttribute(value) : value;
  }
  return out as A;
}

interface ScrubbableSpan {
  name?: string;
  attributes?: Record<string, unknown>;
}

/**
 * `beforeSendSpan` for the default `traceLifecycle: "stream"`, where spans are sent on their own and
 * `beforeSendTransaction` never runs. Span names never carry query strings either.
 */
export function scrubSpan<S extends ScrubbableSpan>(span: S): S {
  if (span.attributes) span.attributes = scrubAttributes(span.attributes);
  if (typeof span.name === "string") span.name = stripQuery(span.name);
  return span;
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    // REMOTE_ADDR and other server variables.
    delete event.request.env;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(([name]) => !isSensitiveHeader(name)),
      );
    }
  }

  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.type === "ZodError" || exception.type === "$ZodError") {
      exception.value = ZOD_MESSAGE_REMOVED;
    }
  }

  if (event.extra) event.extra = scrubZodIssues(event.extra) as Record<string, unknown>;
  if (event.contexts) {
    event.contexts = scrubZodIssues(event.contexts) as Record<string, unknown>;
    // The trace context of an error or transaction carries the active span's attributes.
    const trace = event.contexts.trace as { data?: Record<string, unknown> } | undefined;
    if (trace?.data) trace.data = scrubAttributes(trace.data);
  }

  // Child spans of a transaction (traceLifecycle "static").
  if (event.spans) {
    for (const span of event.spans) {
      if (span.data) span.data = scrubAttributes(span.data);
      if (typeof span.description === "string") span.description = stripQuery(span.description);
    }
  }
  if (typeof event.transaction === "string") event.transaction = stripQuery(event.transaction);

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (!crumb.data) return crumb;
      const data = { ...crumb.data };
      delete data.body;
      delete data.request_body;
      delete data.response_body;
      if (typeof data.url === "string") data.url = stripQuery(data.url);
      if (typeof data.to === "string") data.to = stripQuery(data.to);
      if (typeof data.from === "string") data.from = stripQuery(data.from);
      return { ...crumb, data };
    });
  }

  return event;
}
