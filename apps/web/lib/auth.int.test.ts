// Sign-up through Better Auth's server API against the real schema: the user.create.after hook
// creates the profile and applicant role, and requireVerifiedEmail rejects an unverified user.

import { randomUUID } from "node:crypto";
import { createDb, getProfile, hasRole } from "@admitstory/db";
import { afterAll, describe, expect, it, vi } from "vitest";
import { EmailNotVerifiedError, createGuards } from "./guards";

vi.mock("server-only", () => ({}));

const { createAuth } = await import("./auth");
const { parseServerEnv } = await import("./env");

const handle = createDb(process.env.DATABASE_URL ?? "", { max: 2 });
const links: { email: string; url: string }[] = [];
const afterUserCreated = vi.fn(async () => {});
const auth = createAuth(parseServerEnv(process.env), {
  db: handle.db,
  sendMagicLink: async (message) => {
    links.push(message);
  },
  afterUserCreated,
});

const createdEmails: string[] = [];

afterAll(async () => {
  // apps/web has no drizzle-orm dependency, so cleanup uses parameterised SQL on the pool.
  if (createdEmails.length > 0)
    await handle.pool.query("delete from users where email = any($1)", [createdEmails]);
  await handle.pool.end();
});

/** Requests and follows a magic link; returns the user and the session cookie. */
async function signUpWithMagicLink() {
  const email = `test-${randomUUID()}@example.test`;
  createdEmails.push(email);
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
  const link = links.find((l) => l.email === email);
  expect(link, "magic link sent").toBeDefined();
  const token = new URL(link?.url ?? "").searchParams.get("token") ?? "";

  const { headers, response } = await auth.api.magicLinkVerify({
    query: { token },
    headers: new Headers(),
    returnHeaders: true,
  });
  const cookie = (headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { email, user: response.user, cookie };
}

describe("sign-up through Better Auth", () => {
  it("creates the user verified, with a profile and the applicant role", async () => {
    const { email, user } = await signUpWithMagicLink();
    expect(user.email).toBe(email);
    expect(user.emailVerified).toBe(true);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);

    const { db } = handle;
    const profile = await getProfile(db, user.id);
    expect(profile).not.toBeNull();
    expect(profile?.ageConfirmedAt).toBeNull();
    expect(await hasRole(db, user.id, "applicant")).toBe(true);
    expect(afterUserCreated).toHaveBeenCalledWith(user.id);
  });

  it("does not create a second account for the same email", async () => {
    const { email } = await signUpWithMagicLink();
    await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
    const link = links.filter((l) => l.email === email).at(-1);
    const token = new URL(link?.url ?? "").searchParams.get("token") ?? "";
    await auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
    const rows = await handle.db.query.users.findMany({ where: (u, { eq }) => eq(u.email, email) });
    expect(rows).toHaveLength(1);
  });
});

describe("requireVerifiedEmail with a real session", () => {
  it("passes a verified user and rejects the same user once unverified", async () => {
    const { user, cookie } = await signUpWithMagicLink();
    const guards = createGuards({
      getSession: () => auth.api.getSession({ headers: new Headers({ cookie }) }),
    });

    await expect(guards.requireVerifiedEmail()).resolves.toMatchObject({ user: { id: user.id } });

    await handle.pool.query("update users set email_verified = false where id = $1", [user.id]);
    await expect(guards.requireSession()).resolves.toMatchObject({ user: { id: user.id } });
    await expect(guards.requireVerifiedEmail()).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });
});
