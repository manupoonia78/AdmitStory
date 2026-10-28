import { describe, expect, it } from "vitest";
import {
  ZOD_MESSAGE_REMOVED,
  scrubAttributes,
  scrubEvent,
  scrubSpan,
  scrubZodIssues,
} from "./sentry-scrub";
import { dataCollection, sentryOptions } from "./sentry-options";

// Synthetic content standing in for an applicant's essay (spec §0, §14.4).
const ESSAY = "It was 2 a.m. on go-live night when I saw that the lab-results feed was dropping.";

describe("scrubEvent", () => {
  it("drops request bodies, cookies, query strings and auth headers", () => {
    const event = scrubEvent({
      request: {
        url: "https://app.example.test/api/auth/magic-link/verify?token=secret-token#x",
        data: { essay: ESSAY },
        cookies: { "better-auth.session_token": "abc" },
        query_string: "token=secret-token",
        headers: {
          Cookie: "better-auth.session_token=abc",
          Authorization: "Bearer abc",
          "x-captcha-response": "turnstile-token",
          "user-agent": "test-agent",
        },
      },
    });
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.url).toBe("https://app.example.test/api/auth/magic-link/verify");
    expect(event.request?.headers).toEqual({ "user-agent": "test-agent" });
    expect(JSON.stringify(event)).not.toContain("secret-token");
  });

  it("drops client IP headers and server variables", () => {
    const event = scrubEvent({
      request: {
        headers: {
          "X-Forwarded-For": "203.0.113.9, 198.51.100.2",
          "x-real-ip": "203.0.113.9",
          "cf-connecting-ip": "203.0.113.9",
          "True-Client-IP": "203.0.113.9",
          forwarded: "for=203.0.113.9",
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-vercel-ip-city": "Springfield",
          accept: "text/html",
        },
        env: { REMOTE_ADDR: "203.0.113.9" },
      },
    });
    expect(event.request?.headers).toEqual({ accept: "text/html" });
    expect(event.request?.env).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("203.0.113.9");
  });

  it("scrubs the trace context and transaction spans", () => {
    const event = scrubEvent({
      transaction: "/api/auth/magic-link/verify?token=secret-token",
      contexts: {
        trace: {
          data: {
            "url.full": "https://app.example.test/api/auth/magic-link/verify?token=secret-token",
            "url.query": "token=secret-token",
            "client.address": "203.0.113.9",
            "http.request.method": "GET",
          },
        },
      },
      spans: [
        {
          description: "GET https://api.example.test/v1/messages?key=secret-token",
          data: {
            "http.url": "https://api.example.test/v1/messages?key=secret-token",
            "gen_ai.input.messages": ESSAY,
            "gen_ai.request.model": "model-x",
            "http.response.status_code": 200,
          },
        },
      ],
    });
    expect(event.transaction).toBe("/api/auth/magic-link/verify");
    expect(event.contexts?.trace).toEqual({
      data: {
        "url.full": "https://app.example.test/api/auth/magic-link/verify",
        "http.request.method": "GET",
      },
    });
    expect(event.spans?.[0]).toEqual({
      description: "GET https://api.example.test/v1/messages",
      data: {
        "http.url": "https://api.example.test/v1/messages",
        "http.response.status_code": 200,
      },
    });
    const sent = JSON.stringify(event);
    expect(sent).not.toContain("secret-token");
    expect(sent).not.toContain("go-live");
    expect(sent).not.toContain("203.0.113.9");
  });

  it("keeps only the user id", () => {
    const event = scrubEvent({
      user: { id: "u-1", email: "test-1@example.test", ip_address: "203.0.113.9", username: "x" },
    });
    expect(event.user).toEqual({ id: "u-1" });
    expect(scrubEvent({ user: { email: "test-1@example.test" } }).user).toEqual({});
  });

  it("replaces ZodError messages, which can quote the rejected input", () => {
    const event = scrubEvent({
      exception: {
        values: [
          { type: "ZodError", value: `[{"code":"too_big","input":"${ESSAY}"}]` },
          { type: "$ZodError", value: ESSAY },
          { type: "TypeError", value: "x is not a function" },
        ],
      },
    });
    expect(event.exception?.values?.[0]?.value).toBe(ZOD_MESSAGE_REMOVED);
    expect(event.exception?.values?.[1]?.value).toBe(ZOD_MESSAGE_REMOVED);
    expect(event.exception?.values?.[2]?.value).toBe("x is not a function");
  });

  it("removes Zod issue values from extra and contexts, keeping code and path", () => {
    const issue = { code: "too_big", path: ["essay"], input: ESSAY, message: `Too long: ${ESSAY}` };
    const event = scrubEvent({
      extra: { issues: [issue] },
      contexts: { validation: { issues: [issue], route: "/api/drafts" } },
    });
    expect(event.extra).toEqual({ issues: [{ code: "too_big", path: ["essay"] }] });
    expect(event.contexts).toEqual({
      validation: { issues: [{ code: "too_big", path: ["essay"] }], route: "/api/drafts" },
    });
    expect(JSON.stringify(event)).not.toContain("go-live");
  });

  it("strips bodies and query strings from breadcrumbs", () => {
    const event = scrubEvent({
      breadcrumbs: [
        {
          category: "fetch",
          data: { url: "/api/auth/sign-in/magic-link?x=1", body: ESSAY, method: "POST" },
        },
        { category: "navigation", data: { from: "/sign-in?error=INVALID_TOKEN", to: "/home?t=1" } },
        { category: "console", message: "no data" },
      ],
    });
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      url: "/api/auth/sign-in/magic-link",
      method: "POST",
    });
    expect(event.breadcrumbs?.[1]?.data).toEqual({ from: "/sign-in", to: "/home" });
    expect(event.breadcrumbs?.[2]).toEqual({ category: "console", message: "no data" });
  });

  it("leaves non-Zod objects in extra alone", () => {
    expect(scrubZodIssues({ a: { code: 1, path: "x", input: "kept" } })).toEqual({
      a: { code: 1, path: "x", input: "kept" },
    });
  });
});

describe("scrubSpan (streamed spans)", () => {
  it("removes queries, client addresses, headers, bodies and generative-AI content", () => {
    const span = scrubSpan({
      name: "GET /sign-in?error=INVALID_TOKEN",
      attributes: {
        "url.full": "https://app.example.test/api/auth/magic-link/verify?token=secret-token",
        "http.url": "https://app.example.test/home?t=1",
        "http.target": "/api/auth/magic-link/verify?token=secret-token",
        "url.path": "/home",
        "url.query": "token=secret-token",
        "http.query": "token=secret-token",
        "client.address": "203.0.113.9",
        "http.client_ip": "203.0.113.9",
        "net.peer.ip": "203.0.113.9",
        "user.email": "test-1@example.test",
        "user.ip_address": "203.0.113.9",
        "user.id": "u-1",
        "http.request.header.cookie": "better-auth.session_token=abc",
        "http.request.header.x_forwarded_for": "203.0.113.9",
        "http.request.body": ESSAY,
        "gen_ai.input.messages": ESSAY,
        "gen_ai.output.messages": ESSAY,
        "gen_ai.request.model": "model-x",
        "http.request.method": "GET",
        "http.response.status_code": 200,
        // Streamed span attributes can also be { value, unit } objects.
        "sentry.op": { value: "http.server" },
      },
    });
    expect(span).toEqual({
      name: "GET /sign-in",
      attributes: {
        "url.full": "https://app.example.test/api/auth/magic-link/verify",
        "http.url": "https://app.example.test/home",
        "http.target": "/api/auth/magic-link/verify",
        "url.path": "/home",
        "user.id": "u-1",
        "http.request.method": "GET",
        "http.response.status_code": 200,
        "sentry.op": { value: "http.server" },
      },
    });
  });

  it("strips the query from URL attributes given as { value } objects", () => {
    expect(scrubAttributes({ "url.full": { value: "https://a.example.test/?token=x" } })).toEqual({
      "url.full": { value: "https://a.example.test/" },
    });
  });
});

describe("sentryOptions", () => {
  const options = sentryOptions("https://public@o0.ingest.example.test/1");

  it("turns off every category the v11 SDK would otherwise collect", () => {
    // In @sentry/* 11, sendDefaultPii does nothing; dataCollection defaults to collecting all.
    expect(options).not.toHaveProperty("sendDefaultPii");
    expect(options.dataCollection).toEqual(dataCollection());
    expect(options.dataCollection).toMatchObject({
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
    });
  });

  it("scrubs every error event and every streamed span", () => {
    expect(options.beforeSend).toBe(scrubEvent);
    // With traceLifecycle "stream" beforeSendTransaction is never called, so spans need their own.
    expect(options.traceLifecycle).toBe("stream");
    expect(options.beforeSendSpan).toBe(scrubSpan);
  });
});
