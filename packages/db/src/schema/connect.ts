// Connect (Manu, 2026-11-04): applicants who own a school pack search a directory of alumni,
// current students and admissions-committee readers, and message them in the app.
//
// - `connect_people`: the directory. One row per person per school. `guideUserId` links the
//   people who work with us to their own account, so they answer from /connect themselves; for
//   everyone else a first message is an intro request that our team passes on. Rows come from
//   the import script (packages/db/scripts/connect-import.ts), never from the applicant, and only
//   `active` rows with `consentedAt` set are ever shown.
// - `connect_threads`: one conversation between an applicant and one person.
// - `connect_messages`: the conversation, oldest first.

import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { schools } from "./schools";

export const connectRelations = ["alum", "student", "adcom"] as const;
/** How the person knows the school: an alum, a current student, or an admissions reader. */
export type ConnectRelation = (typeof connectRelations)[number];

export const connectPersonStatuses = ["active", "hidden"] as const;
export type ConnectPersonStatus = (typeof connectPersonStatuses)[number];

export const connectThreadStatuses = ["requested", "open", "closed"] as const;
/** `requested`: an intro our team is arranging; `open`: the person can read and reply. */
export type ConnectThreadStatus = (typeof connectThreadStatuses)[number];

export const connectAuthors = ["applicant", "person", "team"] as const;
export type ConnectAuthor = (typeof connectAuthors)[number];

export const connectPeople = pgTable(
  "connect_people",
  {
    ...baseColumns(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    relation: text("relation").$type<ConnectRelation>().notNull(),
    /** Graduation year for alumni and students; null for admissions readers. */
    classYear: integer("class_year"),
    /** One line, LinkedIn-style: "Product lead at Stripe · ex-McKinsey". */
    headline: text("headline").notNull().default(""),
    location: text("location"),
    bio: text("bio").notNull().default(""),
    /** What they're glad to talk about: "career switch", "consulting recruiting", … */
    topics: text("topics").array().notNull().default([]),
    photoUrl: text("photo_url"),
    linkedinUrl: text("linkedin_url"),
    /** Where the row came from: "linkedin", "referral", "manual". */
    source: text("source").notNull().default("manual"),
    /** When they agreed to be listed. Rows without it are never shown. */
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    /** Works with us: the account that answers for them. Null for people we introduce. */
    guideUserId: uuid("guide_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<ConnectPersonStatus>().notNull().default("active"),
  },
  (t) => [
    index("connect_people_school_idx").on(t.schoolId, t.status),
    index("connect_people_guide_idx").on(t.guideUserId),
    unique("connect_people_school_linkedin_unique").on(t.schoolId, t.linkedinUrl),
  ],
);

export const connectThreads = pgTable(
  "connect_threads",
  {
    ...baseColumns(),
    /** The applicant who started it. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => connectPeople.id, { onDelete: "cascade" }),
    status: text("status").$type<ConnectThreadStatus>().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    /** What each side has read up to, for the unread dot. */
    applicantReadAt: timestamp("applicant_read_at", { withTimezone: true }),
    personReadAt: timestamp("person_read_at", { withTimezone: true }),
  },
  (t) => [
    unique("connect_threads_user_person_unique").on(t.userId, t.personId),
    index("connect_threads_user_idx").on(t.userId, t.lastMessageAt),
    index("connect_threads_person_idx").on(t.personId, t.lastMessageAt),
  ],
);

export const connectMessages = pgTable(
  "connect_messages",
  {
    ...baseColumns(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => connectThreads.id, { onDelete: "cascade" }),
    author: text("author").$type<ConnectAuthor>().notNull(),
    /** Who wrote it: the applicant, the guide's account, or a team member. */
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
  },
  (t) => [index("connect_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export type ConnectPersonRow = typeof connectPeople.$inferSelect;
export type ConnectThreadRow = typeof connectThreads.$inferSelect;
export type ConnectMessageRow = typeof connectMessages.$inferSelect;
