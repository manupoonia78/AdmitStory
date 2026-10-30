import { relations } from "drizzle-orm";
import { accounts, passkeys, sessions, users } from "./auth";
import { profiles, roles } from "./profiles";
import { goldenLines, sources, stories, studioSessions, studioTurns } from "./studio";

// Relation keys follow what Better Auth's Drizzle adapter expects for joins
// with usePlural (one-to-many keys are the plural table export names).
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  passkeys: many(passkeys),
  profile: one(profiles),
  roles: many(roles),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const passkeysRelations = relations(passkeys, ({ one }) => ({
  user: one(users, { fields: [passkeys.userId], references: [users.id] }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const rolesRelations = relations(roles, ({ one }) => ({
  user: one(users, { fields: [roles.userId], references: [users.id] }),
}));

/* Story Studio and the Dossier (Phase 1) ----------------------------------------------------- */

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  user: one(users, { fields: [sources.userId], references: [users.id] }),
  turns: many(studioTurns),
  goldenLines: many(goldenLines),
}));

export const studioSessionsRelations = relations(studioSessions, ({ one, many }) => ({
  user: one(users, { fields: [studioSessions.userId], references: [users.id] }),
  turns: many(studioTurns),
}));

export const studioTurnsRelations = relations(studioTurns, ({ one }) => ({
  session: one(studioSessions, {
    fields: [studioTurns.sessionId],
    references: [studioSessions.id],
  }),
  source: one(sources, { fields: [studioTurns.sourceId], references: [sources.id] }),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, { fields: [stories.userId], references: [users.id] }),
  goldenLines: many(goldenLines),
}));

export const goldenLinesRelations = relations(goldenLines, ({ one }) => ({
  story: one(stories, { fields: [goldenLines.storyId], references: [stories.id] }),
  source: one(sources, { fields: [goldenLines.sourceId], references: [sources.id] }),
}));
