import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { inngest } = await import("./client");
const { SEND_TIMEOUT_MS, emitUserCreated } = await import("./events");

const USER_ID = "0c9e8d7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the Inngest client", () => {
  // The client used to force isDev for any non-empty INNGEST_DEV, so "0" turned signing off.
  it("leaves INNGEST_DEV to the SDK: 0 and false keep cloud mode (signed requests)", async () => {
    const modeFor = async (value: string) => {
      vi.stubEnv("INNGEST_DEV", value);
      vi.resetModules();
      return (await import("./client")).inngest.mode;
    };
    expect(await modeFor("0")).toBe("cloud");
    expect(await modeFor("false")).toBe("cloud");
    expect(await modeFor("")).toBe("cloud");
    expect(await modeFor("1")).toBe("dev");
    expect(await modeFor("true")).toBe("dev");
    expect(await modeFor("http://127.0.0.1:8288")).toBe("dev");
  });
});

describe("emitUserCreated", () => {
  it("does nothing when Inngest isn't configured", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "");
    vi.stubEnv("INNGEST_DEV", "");
    const send = vi.spyOn(inngest, "send");
    await emitUserCreated(USER_ID);
    expect(send).not.toHaveBeenCalled();
  });

  it('treats INNGEST_DEV="0" or "false" as not configured, as the SDK does', async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "");
    const send = vi.spyOn(inngest, "send");
    for (const off of ["0", "false"]) {
      vi.stubEnv("INNGEST_DEV", off);
      await emitUserCreated(USER_ID);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("sends in dev mode without an event key", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "");
    vi.stubEnv("INNGEST_DEV", "1");
    const send = vi.spyOn(inngest, "send").mockResolvedValue({ ids: ["evt_1"] } as never);
    await emitUserCreated(USER_ID);
    expect(send).toHaveBeenCalledOnce();
  });

  it("sends user/created with the user id only", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "test-event-key");
    const send = vi.spyOn(inngest, "send").mockResolvedValue({ ids: ["evt_1"] } as never);
    await emitUserCreated(USER_ID);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      name: "user/created",
      data: { userId: USER_ID },
    });
  });

  it("never throws when Inngest is unreachable, and logs no personal data", async () => {
    vi.stubEnv("INNGEST_EVENT_KEY", "test-event-key");
    vi.spyOn(inngest, "send").mockRejectedValue(new Error("connect ECONNREFUSED"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(emitUserCreated(USER_ID)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/@/);
  });

  it("gives up after the timeout instead of holding up sign-up", async () => {
    vi.useFakeTimers();
    vi.stubEnv("INNGEST_EVENT_KEY", "test-event-key");
    vi.spyOn(inngest, "send").mockReturnValue(new Promise(() => {}) as never);
    const pending = emitUserCreated(USER_ID);
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBeUndefined();
  });
});
