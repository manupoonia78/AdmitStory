import "server-only";

import {
  accounts,
  getDb,
  onUserCreated,
  passkeys,
  sessions,
  users,
  verifications,
  type Database,
} from "@admitstory/db";
import { renderMagicLinkEmail } from "@admitstory/emails";
import { APP_NAME } from "@admitstory/shared";
import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins/captcha";
import { magicLink } from "better-auth/plugins/magic-link";
import { emitUserCreated } from "../inngest/events";
import {
  CAPTCHA_ENDPOINTS,
  MAGIC_LINK_MINUTES,
  MAGIC_LINK_RATE_LIMIT,
  TURNSTILE_ACTION,
} from "./auth-constants";
import { isLocalAppUrl, serverEnv, type ServerEnv } from "./env";
import { sendEmail } from "./email";

export interface AuthDeps {
  db: Database;
  sendMagicLink: (args: { email: string; url: string }) => Promise<void>;
  /** Runs after the profile and applicant role exist. Must never throw. */
  afterUserCreated: (userId: string) => Promise<void>;
}

export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  const rendered = await renderMagicLinkEmail({ url, expiresInMinutes: MAGIC_LINK_MINUTES });
  await sendEmail({ to: email, ...rendered, tag: "magic-link" });
}

/** Google is offered only when both credentials are set; the button is hidden otherwise. */
export function socialProviders(env: ServerEnv): BetterAuthOptions["socialProviders"] {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
  if (!clientId || !clientSecret) return {};
  // Google reports email_verified, which Better Auth copies to users.email_verified.
  return { google: { clientId, clientSecret, prompt: "select_account" } };
}

function captchaPlugins(env: ServerEnv) {
  const local = isLocalAppUrl(env.APP_URL);
  if (!env.TURNSTILE_SECRET_KEY) {
    // Fail closed on a deployed host: sign-up must be bot-protected there (spec §5.1, §12.4).
    if (!local) throw new Error("TURNSTILE_SECRET_KEY is required when APP_URL is not localhost");
    return [];
  }
  return [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY,
      endpoints: CAPTCHA_ENDPOINTS,
      // Cloudflare's test keys report example.com and no action, so the hostname and action
      // checks only run on real hosts. They stop a token minted elsewhere from being replayed.
      ...(local
        ? {}
        : { allowedHostnames: [new URL(env.APP_URL).hostname], expectedAction: TURNSTILE_ACTION }),
    }),
  ];
}

/** Pure options builder, so the configuration can be unit-tested without a database. */
export function createAuthOptions(env: ServerEnv, deps: AuthDeps) {
  const appUrl = new URL(env.APP_URL);
  return {
    appName: APP_NAME,
    baseURL: appUrl.origin,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications, passkeys },
    }),
    // No passwords anywhere (spec §5.1).
    emailAndPassword: { enabled: false },
    socialProviders: socialProviders(env),
    advanced: { database: { generateId: "uuid" } },
    rateLimit: {
      // Explicit, so the sign-in route is limited wherever this runs, not only in production.
      enabled: env.NODE_ENV !== "test",
      storage: "memory",
      customRules: { "/sign-in/magic-link": MAGIC_LINK_RATE_LIMIT },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await onUserCreated(deps.db, user.id);
            await deps.afterUserCreated(user.id);
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_MINUTES * 60,
        storeToken: "hashed",
        rateLimit: MAGIC_LINK_RATE_LIMIT,
        sendMagicLink: ({ email, url }) => deps.sendMagicLink({ email, url }),
      }),
      // Passkeys are bound to this hostname. They only work on localhost until the production
      // domain is decided (spec §18.1); registering them anywhere else needs a new rpID.
      passkey({ rpID: appUrl.hostname, rpName: APP_NAME, origin: appUrl.origin }),
      ...captchaPlugins(env),
      // Must stay last: it copies Set-Cookie headers from auth.api calls in server actions.
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(env: ServerEnv, deps: AuthDeps) {
  return betterAuth(createAuthOptions(env, deps));
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

const globalForAuth = globalThis as typeof globalThis & { __admitstoryAuth?: Auth };

/** The app's Better Auth instance, created on first use so `next build` needs no secrets. */
export function getAuth(): Auth {
  globalForAuth.__admitstoryAuth ??= createAuth(serverEnv(), {
    db: getDb(),
    sendMagicLink: sendMagicLinkEmail,
    afterUserCreated: emitUserCreated,
  });
  return globalForAuth.__admitstoryAuth;
}
