import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "./test-env";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { EmailNotConfiguredError, chooseTransport, sendEmail } = await import("./email");

const MESSAGE = {
  to: "test-5d2c@example.test",
  subject: "Your sign-in link",
  html: "<p>link</p>",
  text: "link",
  tag: "magic-link",
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "outbox-"));
  send.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("chooseTransport", () => {
  it("uses Resend when both RESEND_API_KEY and EMAIL_FROM are set", () => {
    expect(
      chooseTransport(testEnv({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Sender <a@example.test>" })),
    ).toBe("resend");
  });

  it("uses the outbox only on localhost", () => {
    expect(chooseTransport(testEnv())).toBe("outbox");
    expect(chooseTransport(testEnv({ APP_URL: "http://127.0.0.1:3000" }))).toBe("outbox");
    expect(chooseTransport(testEnv({ RESEND_API_KEY: "re_x" }))).toBe("outbox");
  });

  it("fails clearly on any other host without Resend", () => {
    expect(() => chooseTransport(testEnv({ APP_URL: "https://app.example.test" }))).toThrow(
      EmailNotConfiguredError,
    );
  });
});

describe("sendEmail", () => {
  it("writes the message as JSON to the outbox on localhost", async () => {
    const sent = await sendEmail(MESSAGE, testEnv(), { outboxDir: dir });
    expect(sent.transport).toBe("outbox");
    const [file] = await readdir(dir);
    expect(file).toMatch(/-magic-link-test-5d2c-example-test\.json$/);
    const payload = JSON.parse(await readFile(join(dir, file ?? ""), "utf8"));
    expect(payload).toMatchObject({ to: MESSAGE.to, subject: MESSAGE.subject, text: "link" });
    expect(send).not.toHaveBeenCalled();
  });

  it("never logs the body or link", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendEmail({ ...MESSAGE, text: "https://localhost:3000/verify?token=secret" }, testEnv(), {
      outboxDir: dir,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("token=secret");
  });

  it("sends through Resend when configured", async () => {
    send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const env = testEnv({
      APP_URL: "https://app.example.test",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "a@example.test",
    });
    await expect(sendEmail(MESSAGE, env)).resolves.toEqual({ transport: "resend", id: "msg_1" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "a@example.test",
        to: MESSAGE.to,
        text: "link",
        html: "<p>link</p>",
      }),
    );
  });

  it("surfaces a Resend rejection", async () => {
    send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    const env = testEnv({
      APP_URL: "https://app.example.test",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "a@example.test",
    });
    await expect(sendEmail(MESSAGE, env)).rejects.toThrow(/domain not verified/);
  });

  it("validates the message", async () => {
    await expect(
      sendEmail({ ...MESSAGE, to: "not-an-email" }, testEnv(), { outboxDir: dir }),
    ).rejects.toThrow();
    expect(await readdir(dir)).toHaveLength(0);
  });
});
