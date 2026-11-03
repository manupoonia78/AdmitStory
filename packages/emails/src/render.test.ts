import { APP_NAME } from "@admitstory/shared";
import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "./render";

const URL_ = "http://localhost:3000/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fhome";

describe("renderMagicLinkEmail", () => {
  it("names the product in the subject", async () => {
    const email = await renderMagicLinkEmail({ url: URL_ });
    expect(email.subject).toBe(`Your sign-in link for ${APP_NAME}`);
  });

  it("puts the link, the expiry and the ignore note in the HTML", async () => {
    const { html } = await renderMagicLinkEmail({ url: URL_, expiresInMinutes: 10 });
    const escaped = URL_.replaceAll("&", "&amp;");
    expect(html).toContain(`href="${escaped}"`);
    expect(html).toContain("10 minutes");
    expect(html).toContain("If you didn&#x27;t ask to sign in, you can ignore this email.");
    expect(html).toContain(`Sign in to ${APP_NAME}`);
  });

  it("is accessible HTML: language, a single h1, and layout tables marked as presentation", async () => {
    const { html } = await renderMagicLinkEmail({ url: URL_ });
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toMatch(/<html[^>]*dir="ltr"/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const table of html.match(/<table\b[^>]*>/g) ?? []) {
      expect(table).toContain('role="presentation"');
    }
  });

  it("has a plain-text alternative with the same content", async () => {
    const { text } = await renderMagicLinkEmail({ url: URL_, expiresInMinutes: 15 });
    expect(text).toContain(URL_);
    expect(text).toContain("15 minutes");
    expect(text).toContain("If you didn't ask to sign in, you can ignore this email.");
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("follows the voice rules (spec §6.7)", async () => {
    const { html, text, subject } = await renderMagicLinkEmail({ url: URL_ });
    for (const copy of [text, subject]) {
      expect(copy).not.toMatch(/!|oops|something went wrong|journey|unleash/i);
    }
    expect(html).not.toMatch(/oops|something went wrong|journey|unleash/i);
  });

  it("rejects relative or non-http URLs and bad expiries", async () => {
    await expect(renderMagicLinkEmail({ url: "/api/auth/magic-link/verify" })).rejects.toThrow(
      TypeError,
    );
    await expect(renderMagicLinkEmail({ url: "javascript:alert(1)" })).rejects.toThrow(TypeError);
    await expect(renderMagicLinkEmail({ url: URL_, expiresInMinutes: 0 })).rejects.toThrow(
      TypeError,
    );
  });
});
