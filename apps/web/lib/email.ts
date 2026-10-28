import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Resend } from "resend";
import { z } from "zod";
import { isLocalAppUrl, serverEnv, type ServerEnv } from "./env";

// Transactional email (spec §7.1: Resend + React Email). Decision record: docs/decisions/0002.
//  - RESEND_API_KEY and EMAIL_FROM set → Resend.
//  - otherwise, only when APP_URL is localhost → JSON file in <repo>/.outbox (dev and e2e, also
//    under `next start`, where NODE_ENV is production).
//  - anywhere else → a clear error. There is no silent fallback on a deployed host.

export const OutgoingEmail = z.object({
  to: z.email(),
  subject: z.string().trim().min(1).max(200),
  html: z.string().min(1),
  text: z.string().min(1),
  /** Short label for logs and the outbox file name, e.g. "magic-link". Never personal data. */
  tag: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .default("email"),
});
export type OutgoingEmail = z.input<typeof OutgoingEmail>;

export type EmailTransport = "resend" | "outbox";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email is not configured: set RESEND_API_KEY and EMAIL_FROM. The local outbox is only used when APP_URL is localhost.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

export function chooseTransport(
  env: Pick<ServerEnv, "APP_URL" | "RESEND_API_KEY" | "EMAIL_FROM">,
): EmailTransport {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return "resend";
  if (isLocalAppUrl(env.APP_URL)) return "outbox";
  throw new EmailNotConfiguredError();
}

/** The monorepo root, found by walking up to pnpm-workspace.yaml (cwd is apps/web under Next). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export function outboxDir(): string {
  return join(findRepoRoot(), ".outbox");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export interface SentEmail {
  transport: EmailTransport;
  /** Resend message id or outbox file path. */
  id: string;
}

async function writeToOutbox(email: z.output<typeof OutgoingEmail>, from: string, dir: string) {
  await mkdir(dir, { recursive: true });
  const sentAt = new Date();
  const stamp = sentAt.toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `${stamp}-${email.tag}-${slug(email.to)}.json`);
  const payload = { ...email, from, sentAt: sentAt.toISOString() };
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return file;
}

export interface SendEmailOptions {
  /** Where the local outbox lives; tests point it at a temporary folder. */
  outboxDir?: string;
}

export async function sendEmail(
  input: OutgoingEmail,
  env: ServerEnv = serverEnv(),
  options: SendEmailOptions = {},
): Promise<SentEmail> {
  const email = OutgoingEmail.parse(input);
  const transport = chooseTransport(env);

  if (transport === "outbox") {
    const file = await writeToOutbox(
      email,
      env.EMAIL_FROM ?? "local-outbox@localhost",
      options.outboxDir ?? outboxDir(),
    );
    // Never log the link or the body; the file name is enough to find it.
    console.info(`[email] ${email.tag} written to the local outbox: ${file}`);
    return { transport, id: file };
  }

  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = env;
  if (!apiKey || !from) throw new EmailNotConfiguredError();
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: [{ name: "kind", value: email.tag }],
  });
  if (error || !data) {
    // Resend error messages describe the request, not its content.
    throw new Error(`Resend rejected the ${email.tag} email: ${error?.message ?? "no message id"}`);
  }
  return { transport, id: data.id };
}
