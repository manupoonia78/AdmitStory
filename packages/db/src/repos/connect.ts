// Connect (schema/connect.ts): the directory, the conversations and their messages. Access rules
// live here so no route can get them wrong:
//   - the directory shows only `active` people who consented to be listed;
//   - an applicant reads only their own threads; a guide reads only threads with the people
//     whose account they are (`guideUserId`).
// Who may use Connect at all (a school pack) is the web app's check (lib/connect/server.ts).

import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import {
  connectMessages,
  connectPeople,
  connectThreads,
  entitlements,
  profiles,
  schoolCycles,
  schools,
  type ConnectAuthor,
  type ConnectMessageRow,
  type ConnectPersonRow,
  type ConnectRelation,
  type ConnectThreadRow,
  type ConnectThreadStatus,
} from "../schema";
import { assertId } from "./ids";

export type { ConnectMessageRow, ConnectPersonRow, ConnectRelation, ConnectThreadRow };

/** A directory entry with its school, as the search and the chat header show it. */
export interface ConnectPerson {
  id: string;
  fullName: string;
  relation: ConnectRelation;
  classYear: number | null;
  headline: string;
  location: string | null;
  bio: string;
  topics: string[];
  photoUrl: string | null;
  linkedinUrl: string | null;
  /** Works with us: answers in the app. */
  guide: boolean;
  school: { id: string; name: string; shortName: string; slug: string };
}

const personColumns = {
  id: connectPeople.id,
  fullName: connectPeople.fullName,
  relation: connectPeople.relation,
  classYear: connectPeople.classYear,
  headline: connectPeople.headline,
  location: connectPeople.location,
  bio: connectPeople.bio,
  topics: connectPeople.topics,
  photoUrl: connectPeople.photoUrl,
  linkedinUrl: connectPeople.linkedinUrl,
  guideUserId: connectPeople.guideUserId,
  schoolId: schools.id,
  schoolName: schools.name,
  schoolShortName: schools.shortName,
  schoolSlug: schools.slug,
};

interface PersonSelect {
  id: string;
  fullName: string;
  relation: ConnectRelation;
  classYear: number | null;
  headline: string;
  location: string | null;
  bio: string;
  topics: string[];
  photoUrl: string | null;
  linkedinUrl: string | null;
  guideUserId: string | null;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
  schoolSlug: string;
}

function toPerson(row: PersonSelect): ConnectPerson {
  return {
    id: row.id,
    fullName: row.fullName,
    relation: row.relation,
    classYear: row.classYear,
    headline: row.headline,
    location: row.location,
    bio: row.bio,
    topics: row.topics,
    photoUrl: row.photoUrl,
    linkedinUrl: row.linkedinUrl,
    guide: row.guideUserId !== null,
    school: {
      id: row.schoolId,
      name: row.schoolName,
      shortName: row.schoolShortName,
      slug: row.schoolSlug,
    },
  };
}

/** Listed: active and consented. */
const listed = () => and(eq(connectPeople.status, "active"), isNotNull(connectPeople.consentedAt));

/* Who has a pack ---------------------------------------------------------------------------- */

/** The schools the applicant holds an active school-kit entitlement for. */
export async function listUnlockedSchoolIds(db: DbExecutor, userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ schoolId: schoolCycles.schoolId })
    .from(entitlements)
    .innerJoin(schoolCycles, eq(schoolCycles.id, entitlements.refId))
    .where(
      and(
        eq(entitlements.userId, assertId(userId, "userId")),
        eq(entitlements.kind, "school_kit"),
        sql`${entitlements.revokedAt} is null`,
        or(sql`${entitlements.expiresAt} is null`, gt(entitlements.expiresAt, sql`now()`)),
      ),
    );
  return rows.map((row) => row.schoolId);
}

/* The directory ----------------------------------------------------------------------------- */

export interface ConnectSearch {
  /** Free text: name, headline, bio, topics or school. */
  q?: string;
  schoolId?: string;
  relation?: ConnectRelation;
  /** These schools sort first (the applicant's unlocked ones). */
  preferSchoolIds?: readonly string[];
  limit?: number;
}

/** Escapes LIKE wildcards so a search for "100%" means the characters. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

/**
 * Directory search, LinkedIn-style. Guides (people who work with us) first, then the preferred
 * schools, then by name.
 */
export async function searchConnectPeople(
  db: DbExecutor,
  search: ConnectSearch,
): Promise<ConnectPerson[]> {
  const q = search.q?.trim() ?? "";
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const prefer = (search.preferSchoolIds ?? []).map((id) => assertId(id, "schoolId"));
  const conditions = [listed()];
  if (search.schoolId)
    conditions.push(eq(connectPeople.schoolId, assertId(search.schoolId, "schoolId")));
  if (search.relation) conditions.push(eq(connectPeople.relation, search.relation));
  for (const word of words) {
    const pattern = likePattern(word);
    const match = or(
      ilike(connectPeople.fullName, pattern),
      ilike(connectPeople.headline, pattern),
      ilike(connectPeople.bio, pattern),
      ilike(sql`array_to_string(${connectPeople.topics}, ' ')`, pattern),
      ilike(schools.name, pattern),
      ilike(schools.shortName, pattern),
    );
    if (match) conditions.push(match);
  }
  const rows = await db
    .select(personColumns)
    .from(connectPeople)
    .innerJoin(schools, eq(schools.id, connectPeople.schoolId))
    .where(and(...conditions))
    .orderBy(
      sql`(${connectPeople.guideUserId} is null)`,
      prefer.length > 0 ? sql`(${inArray(connectPeople.schoolId, prefer)}) desc` : sql`1`,
      asc(connectPeople.fullName),
    )
    .limit(Math.min(search.limit ?? 40, 100));
  return rows.map(toPerson);
}

export async function getConnectPerson(
  db: DbExecutor,
  personId: string,
): Promise<ConnectPerson | null> {
  const [row] = await db
    .select(personColumns)
    .from(connectPeople)
    .innerJoin(schools, eq(schools.id, connectPeople.schoolId))
    .where(and(eq(connectPeople.id, assertId(personId, "personId")), listed()))
    .limit(1);
  return row ? toPerson(row) : null;
}

/** Schools with anyone listed, for the school filter, with how many people each has. */
export async function listConnectSchools(
  db: DbExecutor,
): Promise<{ id: string; name: string; shortName: string; people: number }[]> {
  const rows = await db
    .select({
      id: schools.id,
      name: schools.name,
      shortName: schools.shortName,
      people: sql<number>`count(*)::int`,
    })
    .from(connectPeople)
    .innerJoin(schools, eq(schools.id, connectPeople.schoolId))
    .where(listed())
    .groupBy(schools.id, schools.name, schools.shortName)
    .orderBy(asc(schools.name));
  return rows;
}

/* Conversations ----------------------------------------------------------------------------- */

export type ConnectSide = "applicant" | "person";

/** A conversation as the inbox lists it. */
export interface ConnectThreadSummary {
  id: string;
  status: ConnectThreadStatus;
  person: ConnectPerson;
  /** The applicant's name, for the guide's side of the inbox. */
  applicantName: string | null;
  lastMessage: { body: string; author: ConnectAuthor; at: Date } | null;
  lastMessageAt: Date;
  unread: boolean;
}

/** The newest message's body and author, as correlated subqueries on the thread row. */
const lastMessage = {
  body: sql<
    string | null
  >`(select m.body from connect_messages m where m.thread_id = ${connectThreads.id} order by m.created_at desc limit 1)`,
  author: sql<ConnectAuthor | null>`(select m.author from connect_messages m where m.thread_id = ${connectThreads.id} order by m.created_at desc limit 1)`,
};

async function listThreads(
  db: DbExecutor,
  side: ConnectSide,
  userId: string,
): Promise<ConnectThreadSummary[]> {
  const owner = assertId(userId, "userId");
  const rows = await db
    .select({
      ...personColumns,
      threadId: connectThreads.id,
      status: connectThreads.status,
      lastMessageAt: connectThreads.lastMessageAt,
      applicantReadAt: connectThreads.applicantReadAt,
      personReadAt: connectThreads.personReadAt,
      applicantName: profiles.displayName,
      lastBody: lastMessage.body,
      lastAuthor: lastMessage.author,
    })
    .from(connectThreads)
    .innerJoin(connectPeople, eq(connectPeople.id, connectThreads.personId))
    .innerJoin(schools, eq(schools.id, connectPeople.schoolId))
    .leftJoin(profiles, eq(profiles.userId, connectThreads.userId))
    .where(
      side === "applicant"
        ? eq(connectThreads.userId, owner)
        : eq(connectPeople.guideUserId, owner),
    )
    .orderBy(desc(connectThreads.lastMessageAt))
    .limit(200);
  return rows.map((row) => {
    const readAt = side === "applicant" ? row.applicantReadAt : row.personReadAt;
    const mine = side === "applicant" ? "applicant" : "person";
    return {
      id: row.threadId,
      status: row.status,
      person: toPerson(row),
      applicantName: side === "person" ? row.applicantName : null,
      lastMessage:
        row.lastBody !== null && row.lastAuthor !== null
          ? { body: row.lastBody, author: row.lastAuthor, at: row.lastMessageAt }
          : null,
      lastMessageAt: row.lastMessageAt,
      unread:
        row.lastAuthor !== null &&
        row.lastAuthor !== mine &&
        (readAt === null || readAt < row.lastMessageAt),
    };
  });
}

/** The applicant's conversations, newest first. */
export function listApplicantThreads(db: DbExecutor, userId: string) {
  return listThreads(db, "applicant", userId);
}

/** The conversations a guide answers (people whose account they are), newest first. */
export function listGuideThreads(db: DbExecutor, guideUserId: string) {
  return listThreads(db, "person", guideUserId);
}

/** Whether this account answers for anyone in the directory. */
export async function isConnectGuide(db: DbExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: connectPeople.id })
    .from(connectPeople)
    .where(eq(connectPeople.guideUserId, assertId(userId, "userId")))
    .limit(1);
  return row !== undefined;
}

/**
 * One thread, if the viewer is on it: as the applicant who started it, or as the guide who
 * answers for the person. Null otherwise, so a route can 404.
 */
export async function getThreadForViewer(
  db: DbExecutor,
  viewerId: string,
  threadId: string,
): Promise<{ thread: ConnectThreadRow; side: ConnectSide } | null> {
  const viewer = assertId(viewerId, "userId");
  const [row] = await db
    .select({ thread: connectThreads, guideUserId: connectPeople.guideUserId })
    .from(connectThreads)
    .innerJoin(connectPeople, eq(connectPeople.id, connectThreads.personId))
    .where(eq(connectThreads.id, assertId(threadId, "threadId")))
    .limit(1);
  if (!row) return null;
  if (row.thread.userId === viewer) return { thread: row.thread, side: "applicant" };
  if (row.guideUserId === viewer) return { thread: row.thread, side: "person" };
  return null;
}

/** The applicant's thread with this person, if they have one. */
export async function findApplicantThread(
  db: DbExecutor,
  userId: string,
  personId: string,
): Promise<ConnectThreadRow | null> {
  const [row] = await db
    .select()
    .from(connectThreads)
    .where(
      and(
        eq(connectThreads.userId, assertId(userId, "userId")),
        eq(connectThreads.personId, assertId(personId, "personId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** How many conversations the applicant has started since `since` (the intro rate limit). */
export async function countThreadsStartedSince(
  db: DbExecutor,
  userId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(connectThreads)
    .where(
      and(
        eq(connectThreads.userId, assertId(userId, "userId")),
        gt(connectThreads.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Starts a conversation with its first message, or adds the message to the one that exists.
 * With a guide it opens at once; with anyone else it is an intro request our team arranges.
 */
export async function startConnectThread(
  db: DbExecutor,
  userId: string,
  input: { personId: string; guide: boolean; body: string },
): Promise<{ thread: ConnectThreadRow; message: ConnectMessageRow; created: boolean }> {
  const owner = assertId(userId, "userId");
  const personId = assertId(input.personId, "personId");
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(connectThreads)
      .values({ userId: owner, personId, status: input.guide ? "open" : "requested" })
      .onConflictDoNothing({ target: [connectThreads.userId, connectThreads.personId] })
      .returning();
    const thread = inserted ?? (await findApplicantThread(tx, owner, personId));
    if (!thread) throw new Error("connect thread upsert returned nothing");
    const message = await insertMessage(tx, thread.id, {
      author: "applicant",
      authorUserId: owner,
      body: input.body,
    });
    await tx
      .update(connectThreads)
      .set({ lastMessageAt: message.createdAt, applicantReadAt: message.createdAt })
      .where(eq(connectThreads.id, thread.id));
    return { thread, message, created: inserted !== undefined };
  });
}

async function insertMessage(
  db: DbExecutor,
  threadId: string,
  input: { author: ConnectAuthor; authorUserId: string | null; body: string },
): Promise<ConnectMessageRow> {
  const [row] = await db
    .insert(connectMessages)
    .values({ threadId, author: input.author, authorUserId: input.authorUserId, body: input.body })
    .returning();
  if (!row) throw new Error("connect message insert returned nothing");
  return row;
}

/**
 * A message on a thread the caller has already been checked against (getThreadForViewer).
 * A guide's first reply opens a requested thread.
 */
export async function addConnectMessage(
  db: DbExecutor,
  threadId: string,
  input: { side: ConnectSide; authorUserId: string; body: string },
): Promise<ConnectMessageRow> {
  const id = assertId(threadId, "threadId");
  return db.transaction(async (tx) => {
    const message = await insertMessage(tx, id, {
      author: input.side,
      authorUserId: assertId(input.authorUserId, "userId"),
      body: input.body,
    });
    await tx
      .update(connectThreads)
      .set({
        lastMessageAt: message.createdAt,
        ...(input.side === "applicant"
          ? { applicantReadAt: message.createdAt }
          : { personReadAt: message.createdAt, status: "open" as const }),
      })
      .where(eq(connectThreads.id, id));
    return message;
  });
}

/** A thread's messages, oldest first; only those after `after` when given (polling). */
export async function listConnectMessages(
  db: DbExecutor,
  threadId: string,
  after?: Date,
): Promise<ConnectMessageRow[]> {
  const id = assertId(threadId, "threadId");
  return db
    .select()
    .from(connectMessages)
    .where(
      after
        ? and(eq(connectMessages.threadId, id), gt(connectMessages.createdAt, after))
        : eq(connectMessages.threadId, id),
    )
    .orderBy(asc(connectMessages.createdAt))
    .limit(500);
}

export async function markConnectThreadRead(
  db: DbExecutor,
  threadId: string,
  side: ConnectSide,
): Promise<void> {
  await db
    .update(connectThreads)
    .set(side === "applicant" ? { applicantReadAt: sql`now()` } : { personReadAt: sql`now()` })
    .where(eq(connectThreads.id, assertId(threadId, "threadId")));
}

/* Import (scripts/connect-import.ts) -------------------------------------------------------- */

export interface ConnectPersonImport {
  schoolSlug: string;
  fullName: string;
  relation: ConnectRelation;
  classYear: number | null;
  headline: string;
  location: string | null;
  bio: string;
  topics: string[];
  photoUrl: string | null;
  linkedinUrl: string | null;
  source: string;
  consentedAt: Date | null;
  guideUserId: string | null;
}

/** Adds a person, or updates the one with the same school and LinkedIn URL. */
export async function upsertConnectPerson(
  db: DbExecutor,
  input: ConnectPersonImport,
): Promise<"added" | "updated" | "unknown_school"> {
  const [school] = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.slug, input.schoolSlug))
    .limit(1);
  if (!school) return "unknown_school";
  const values = {
    schoolId: school.id,
    fullName: input.fullName,
    relation: input.relation,
    classYear: input.classYear,
    headline: input.headline,
    location: input.location,
    bio: input.bio,
    topics: input.topics,
    photoUrl: input.photoUrl,
    linkedinUrl: input.linkedinUrl,
    source: input.source,
    consentedAt: input.consentedAt,
    guideUserId: input.guideUserId,
  };
  if (input.linkedinUrl) {
    const [existing] = await db
      .select({ id: connectPeople.id })
      .from(connectPeople)
      .where(
        and(
          eq(connectPeople.schoolId, school.id),
          eq(connectPeople.linkedinUrl, input.linkedinUrl),
        ),
      )
      .limit(1);
    if (existing) {
      await db.update(connectPeople).set(values).where(eq(connectPeople.id, existing.id));
      return "updated";
    }
  }
  await db.insert(connectPeople).values(values);
  return "added";
}
