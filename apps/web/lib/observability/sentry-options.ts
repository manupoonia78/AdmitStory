import type { BrowserOptions } from "@sentry/nextjs";
import { scrubEvent, scrubSpan } from "./sentry-scrub";

type DataCollection = NonNullable<BrowserOptions["dataCollection"]>;

/**
 * What the SDK may collect on its own (spec §14.4). In @sentry/* 11 `sendDefaultPii` no longer
 * exists, and every category below defaults to on (user info and IP, cookies, headers, bodies,
 * query strings, generative-AI inputs and outputs…), so each one is turned off explicitly.
 * `userInfo: false` also tells Sentry's ingest not to infer the IP address from the browser's
 * request. Only stack-frame source context (our own code) is kept.
 */
export function dataCollection(): DataCollection {
  return {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  };
}

/** Options shared by the browser, Node and edge Sentry SDKs. Only used when SENTRY_DSN is set. */
export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: process.env.NODE_ENV,
    dataCollection: dataCollection(),
    tracesSampleRate: 0.1,
    // Spans are streamed (the v11 default, stated so that a change is deliberate). In this mode
    // beforeSendTransaction never runs; every span goes through beforeSendSpan instead.
    traceLifecycle: "stream" as const,
    beforeSend: scrubEvent,
    beforeSendSpan: scrubSpan,
  };
}
