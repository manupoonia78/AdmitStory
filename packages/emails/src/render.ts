import { render } from "@react-email/render";
import { createElement } from "react";
import { MagicLinkEmail, magicLinkCopy, magicLinkSubject } from "./magic-link-email";

export interface RenderedEmail {
  subject: string;
  html: string;
  /** Plain-text alternative, for clients and readers that don't use HTML. */
  text: string;
}

export interface MagicLinkEmailInput {
  url: string;
  /** Defaults to 10, matching apps/web's magic-link expiry. */
  expiresInMinutes?: number;
}

export const DEFAULT_MAGIC_LINK_MINUTES = 10;

// Inputs are validated by hand: this package has no zod dependency, and the checks are small.
function assertInput(input: MagicLinkEmailInput): Required<MagicLinkEmailInput> {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new TypeError("Magic link url must be an absolute URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TypeError("Magic link url must use http or https");
  }
  const minutes = input.expiresInMinutes ?? DEFAULT_MAGIC_LINK_MINUTES;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) {
    throw new TypeError("expiresInMinutes must be a whole number of minutes between 1 and 1440");
  }
  return { url: parsed.toString(), expiresInMinutes: minutes };
}

function magicLinkText(url: string, expiresInMinutes: number): string {
  const copy = magicLinkCopy(expiresInMinutes);
  return [copy.heading, "", copy.intro, "", url, "", copy.ignore, ""].join("\n");
}

/** Subject, HTML and plain-text bodies for the sign-in email (spec §5.1). */
export async function renderMagicLinkEmail(input: MagicLinkEmailInput): Promise<RenderedEmail> {
  const { url, expiresInMinutes } = assertInput(input);
  const html = await render(createElement(MagicLinkEmail, { url, expiresInMinutes }));
  return { subject: magicLinkSubject(), html, text: magicLinkText(url, expiresInMinutes) };
}
