import { InngestTestEngine } from "@inngest/test";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createSignupCompleted } = await import("./signup-completed");

const USER_ID = "5b1f7c2e-8d4a-4f0b-9c3e-2a6d1e7f8b90";

describe("analytics/signup-completed", () => {
  it("captures signup_completed in PostHog, identified by user id only", async () => {
    const capture = vi.fn(async () => {});
    const engine = new InngestTestEngine({ function: createSignupCompleted(capture) });

    const { result, error } = await engine.execute({
      events: [{ name: "user/created", data: { userId: USER_ID } }],
    });

    expect(error).toBeUndefined();
    expect(result).toEqual({ userId: USER_ID });
    expect(capture).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith({ distinctId: USER_ID, event: "signup_completed" });
  });

  it("has a stable id, so Inngest keeps its history across deploys", () => {
    const fn = createSignupCompleted(vi.fn(async () => {}));
    expect(fn.id()).toMatch(/analytics-signup-completed$/);
  });
});
