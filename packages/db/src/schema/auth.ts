import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./columns";

// Better Auth 1.7 core tables plus the @better-auth/passkey table. Property names
// are the camelCase field names Better Auth reads and writes; column names are
// snake_case. Export keys are plural because apps/web configures the Drizzle
// adapter with `usePlural: true` and `advanced.database.generateId: "uuid"`.

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  ...baseColumns(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
});

export const sessions = pgTable(
  "sessions",
  {
    ...baseColumns(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    ...baseColumns(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    // Unused (no passwords, spec §5.1) but part of Better Auth's account model.
    password: text("password"),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_unique").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    ...baseColumns(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const passkeys = pgTable(
  "passkeys",
  {
    // The plugin never writes updated_at; the column exists for the §10 rule and
    // must keep its default so Better Auth's inserts succeed.
    ...baseColumns(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
  },
  (t) => [
    index("passkeys_user_id_idx").on(t.userId),
    uniqueIndex("passkeys_credential_id_unique").on(t.credentialID),
  ],
);
