// The recommender portal's repository (spec §5.11, §14.3, §14.6), Phase 6. Token side: everything
// here is reached with a PortalAccess, which only resolvePortalToken() hands out for a live link.
//
// This is the ONLY module that reads or writes the workspace's encrypted columns
// (`private_notes_encrypted`, `letter_draft_encrypted`, `voice_encrypted`). Each holds JSON in an
// AES-256-GCM envelope (crypto/content.ts). Importers are limited to the portal's own code
// (apps/web/lib/portal, app/api/r, app/r) and tests; packages/db/test/portal-boundary.test.ts
// enforces both rules.

import type { PortalLetter, PortalNote, RecommenderVoice } from "@admitstory/shared/kit";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { decryptContent, encryptContent, getContentKeyring } from "../crypto/content";
import { hashPortalToken } from "../crypto/tokens";
import { recommenderInvites, recommenderWorkspaces, recommenders } from "../schema";
import { assertId } from "./ids";

export interface PortalAccess {
  inviteId: string;
  recommenderId: string;
  /** The applicant's id: model calls are metered to them, with no content (decision 20). */
  userId: string;
  workspaceId: string;
  expiresAt: Date;
}

export type PortalClosedReason = "unknown" | "expired" | "revoked" | "replaced";

export type PortalResolution =
  { ok: true; access: PortalAccess } | { ok: false; reason: PortalClosedReason };

const seal = (value: unknown) => encryptContent(getContentKeyring(), JSON.stringify(value));

function open<T>(envelope: string | null, fallback: T): T {
  if (envelope === null) return fallback;
  return JSON.parse(decryptContent(getContentKeyring(), envelope)) as T;
}

/**
 * The access a link grants, or why it doesn't: "unknown" (no such token, or malformed), "replaced"
 * (an older link of an invite that has a fresh one), "revoked", "expired" (a live invite past its
 * expiry is marked expired on the way). The workspace bound to the invite's address is created
 * if it is missing.
 */
export async function resolvePortalToken(
  db: DbExecutor,
  rawToken: string,
  now: Date = new Date(),
): Promise<PortalResolution> {
  const hash = hashPortalToken(rawToken);
  if (hash === "") return { ok: false, reason: "unknown" };
  const [invite] = await db
    .select()
    .from(recommenderInvites)
    .where(eq(recommenderInvites.tokenHash, hash))
    .limit(1);
  if (!invite) {
    const [older] = await db
      .select({ status: recommenderInvites.status })
      .from(recommenderInvites)
      .where(eq(recommenderInvites.previousTokenHash, hash))
      .limit(1);
    if (!older) return { ok: false, reason: "unknown" };
    return { ok: false, reason: older.status === "revoked" ? "revoked" : "replaced" };
  }
  if (invite.status === "revoked") return { ok: false, reason: "revoked" };
  if (invite.status === "expired" || invite.expiresAt.getTime() <= now.getTime()) {
    if (invite.status === "active")
      await db
        .update(recommenderInvites)
        .set({ status: "expired", updatedAt: sql`now()` })
        .where(and(eq(recommenderInvites.id, invite.id), eq(recommenderInvites.status, "active")));
    return { ok: false, reason: "expired" };
  }
  const [person] = await db
    .select({ id: recommenders.id })
    .from(recommenders)
    .where(and(eq(recommenders.id, invite.recommenderId), isNull(recommenders.archivedAt)))
    .limit(1);
  if (!person) return { ok: false, reason: "revoked" };

  const [workspace] = await db
    .insert(recommenderWorkspaces)
    .values({
      userId: invite.userId,
      recommenderId: invite.recommenderId,
      emailHash: invite.emailHash,
      inviteId: invite.id,
    })
    .onConflictDoUpdate({
      target: [recommenderWorkspaces.recommenderId, recommenderWorkspaces.emailHash],
      set: { inviteId: invite.id },
      setWhere: eq(recommenderWorkspaces.userId, invite.userId),
    })
    .returning({ id: recommenderWorkspaces.id });
  if (!workspace) return { ok: false, reason: "unknown" };
  return {
    ok: true,
    access: {
      inviteId: invite.id,
      recommenderId: invite.recommenderId,
      userId: invite.userId,
      workspaceId: workspace.id,
      expiresAt: invite.expiresAt,
    },
  };
}

const theWorkspace = (access: PortalAccess) =>
  and(
    eq(recommenderWorkspaces.id, assertId(access.workspaceId, "workspaceId")),
    eq(recommenderWorkspaces.recommenderId, assertId(access.recommenderId, "recommenderId")),
    eq(recommenderWorkspaces.userId, assertId(access.userId, "userId")),
  );

/** Sets the workspace's first-opened time once, and the invite's last-opened time every visit. */
export async function markPortalOpened(
  db: DbExecutor,
  access: PortalAccess,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(recommenderWorkspaces)
    .set({ openedAt: sql`coalesce(${recommenderWorkspaces.openedAt}, ${now})` })
    .where(theWorkspace(access));
  await db
    .update(recommenderInvites)
    .set({ lastOpenedAt: now })
    .where(
      and(
        eq(recommenderInvites.id, assertId(access.inviteId, "inviteId")),
        eq(recommenderInvites.recommenderId, access.recommenderId),
      ),
    );
}

export interface PortalWorkspace {
  notes: PortalNote[];
  letters: Record<string, PortalLetter>;
  voice: RecommenderVoice | null;
  submitted: Record<string, string>;
  assistCount: number;
  voiceSeconds: number;
  preferCoach: boolean;
}

export async function readPortalWorkspace(
  db: DbExecutor,
  access: PortalAccess,
): Promise<PortalWorkspace> {
  const [row] = await db
    .select({
      notes: recommenderWorkspaces.privateNotesEncrypted,
      letters: recommenderWorkspaces.letterDraftEncrypted,
      voice: recommenderWorkspaces.voiceEncrypted,
      submitted: recommenderWorkspaces.submitted,
      assistCount: recommenderWorkspaces.assistCount,
      voiceSeconds: recommenderWorkspaces.voiceSeconds,
      preferCoach: recommenderWorkspaces.preferCoach,
    })
    .from(recommenderWorkspaces)
    .where(theWorkspace(access))
    .limit(1);
  if (!row)
    return {
      notes: [],
      letters: {},
      voice: null,
      submitted: {},
      assistCount: 0,
      voiceSeconds: 0,
      preferCoach: false,
    };
  return {
    notes: open<PortalNote[]>(row.notes, []),
    letters: open<Record<string, PortalLetter>>(row.letters, {}),
    voice: open<RecommenderVoice | null>(row.voice, null),
    submitted: { ...row.submitted },
    assistCount: row.assistCount,
    voiceSeconds: row.voiceSeconds,
    preferCoach: row.preferCoach,
  };
}

/** Replaces the recommender's notes (encrypted) and records that they're writing. */
export async function writePortalNotes(
  db: DbExecutor,
  access: PortalAccess,
  notes: readonly PortalNote[],
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(recommenderWorkspaces)
    .set({ privateNotesEncrypted: seal(notes), progressAt: now, updatedAt: sql`now()` })
    .where(theWorkspace(access));
}

/** Saves one answer's draft under its letterKey, keeping the others. Row-locked read-modify-write. */
export async function writePortalLetter(
  db: DbExecutor,
  access: PortalAccess,
  key: string,
  letter: PortalLetter,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ letters: recommenderWorkspaces.letterDraftEncrypted })
      .from(recommenderWorkspaces)
      .where(theWorkspace(access))
      .for("update")
      .limit(1);
    if (!row) return;
    const letters = open<Record<string, PortalLetter>>(row.letters, {});
    letters[key] = letter;
    await tx
      .update(recommenderWorkspaces)
      .set({ letterDraftEncrypted: seal(letters), progressAt: now, updatedAt: sql`now()` })
      .where(theWorkspace(access));
  });
}

export async function writePortalVoice(
  db: DbExecutor,
  access: PortalAccess,
  voice: RecommenderVoice,
): Promise<void> {
  await db
    .update(recommenderWorkspaces)
    .set({ voiceEncrypted: seal(voice), updatedAt: sql`now()` })
    .where(theWorkspace(access));
}

/** Marks (or unmarks) one school as submitted; returns the marks after the change. */
export async function setPortalSubmitted(
  db: DbExecutor,
  access: PortalAccess,
  schoolCycleId: string,
  submitted: boolean,
  now: Date = new Date(),
): Promise<Record<string, string>> {
  const id = assertId(schoolCycleId, "schoolCycleId");
  const value = submitted
    ? sql`${recommenderWorkspaces.submitted} || jsonb_build_object(${id}::text, ${now.toISOString()}::text)`
    : sql`${recommenderWorkspaces.submitted} - ${id}::text`;
  const [row] = await db
    .update(recommenderWorkspaces)
    .set({ submitted: value, updatedAt: sql`now()` })
    .where(theWorkspace(access))
    .returning({ submitted: recommenderWorkspaces.submitted });
  return { ...(row?.submitted ?? {}) };
}

export async function setPortalPreferCoach(
  db: DbExecutor,
  access: PortalAccess,
  value: boolean,
): Promise<boolean> {
  const [row] = await db
    .update(recommenderWorkspaces)
    .set({ preferCoach: value, updatedAt: sql`now()` })
    .where(theWorkspace(access))
    .returning({ preferCoach: recommenderWorkspaces.preferCoach });
  return row?.preferCoach ?? value;
}

/** Counts one assist against the invite's total, atomically; refused once `max` is reached. */
export async function claimPortalAssist(
  db: DbExecutor,
  access: PortalAccess,
  max: number,
): Promise<{ ok: boolean; count: number }> {
  const [row] = await db
    .update(recommenderWorkspaces)
    .set({ assistCount: sql`${recommenderWorkspaces.assistCount} + 1` })
    .where(and(theWorkspace(access), sql`${recommenderWorkspaces.assistCount} < ${max}`))
    .returning({ count: recommenderWorkspaces.assistCount });
  if (row) return { ok: true, count: row.count };
  const [current] = await db
    .select({ count: recommenderWorkspaces.assistCount })
    .from(recommenderWorkspaces)
    .where(theWorkspace(access))
    .limit(1);
  return { ok: false, count: current?.count ?? max };
}

/**
 * Meters dictation (decision 21): adds the seconds, capped at `max`. `ok` is false once the cap
 * was already reached before this note.
 */
export async function addPortalVoiceSeconds(
  db: DbExecutor,
  access: PortalAccess,
  seconds: number,
  max: number,
): Promise<{ ok: boolean; total: number }> {
  const add = Math.max(0, Math.ceil(seconds));
  const [row] = await db
    .update(recommenderWorkspaces)
    .set({ voiceSeconds: sql`least(${recommenderWorkspaces.voiceSeconds} + ${add}, ${max})` })
    .where(and(theWorkspace(access), sql`${recommenderWorkspaces.voiceSeconds} < ${max}`))
    .returning({ total: recommenderWorkspaces.voiceSeconds });
  if (row) return { ok: true, total: row.total };
  const [current] = await db
    .select({ total: recommenderWorkspaces.voiceSeconds })
    .from(recommenderWorkspaces)
    .where(theWorkspace(access))
    .limit(1);
  return { ok: false, total: current?.total ?? max };
}

/** "Delete everything I wrote": notes, letters, voice profile, progress and submitted marks. */
export async function wipePortalWorkspace(db: DbExecutor, access: PortalAccess): Promise<void> {
  await db
    .update(recommenderWorkspaces)
    .set({
      privateNotesEncrypted: null,
      letterDraftEncrypted: null,
      voiceEncrypted: null,
      progressAt: null,
      submitted: {},
      updatedAt: sql`now()`,
    })
    .where(theWorkspace(access));
}

/**
 * "Send me a fresh link" (decision 9): the newest live, unexpired invite for this address, if any.
 * The route answers the same whatever this returns.
 */
export async function findInviteForResend(
  db: DbExecutor,
  emailHash: string,
  now: Date = new Date(),
): Promise<{ inviteId: string; userId: string; recommenderId: string } | null> {
  const [row] = await db
    .select({
      inviteId: recommenderInvites.id,
      userId: recommenderInvites.userId,
      recommenderId: recommenderInvites.recommenderId,
    })
    .from(recommenderInvites)
    .innerJoin(recommenders, eq(recommenders.id, recommenderInvites.recommenderId))
    .where(
      and(
        eq(recommenderInvites.emailHash, emailHash),
        eq(recommenderInvites.status, "active"),
        gt(recommenderInvites.expiresAt, now),
        isNull(recommenders.archivedAt),
      ),
    )
    .orderBy(desc(recommenderInvites.sentAt))
    .limit(1);
  return row ?? null;
}

/** The system side of a resend: a fresh token for a live invite; the old link reads "replaced". */
export async function rotatePortalToken(
  db: DbExecutor,
  inviteId: string,
  tokenHash: string,
): Promise<boolean> {
  const rows = await db
    .update(recommenderInvites)
    .set({
      previousTokenHash: sql`${recommenderInvites.tokenHash}`,
      tokenHash,
      sendCount: sql`${recommenderInvites.sendCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(recommenderInvites.id, assertId(inviteId, "inviteId")),
        eq(recommenderInvites.status, "active"),
      ),
    )
    .returning({ id: recommenderInvites.id });
  return rows.length > 0;
}

/** Who the portal belongs to, for the page header and a resend email. */
export async function portalOwner(
  db: DbExecutor,
  access: PortalAccess,
): Promise<{
  userId: string;
  recommenderId: string;
  recommenderName: string;
  recommenderEmail: string;
} | null> {
  const [row] = await db
    .select({ name: recommenders.name, email: recommenders.email })
    .from(recommenders)
    .where(
      and(
        eq(recommenders.id, assertId(access.recommenderId, "recommenderId")),
        eq(recommenders.userId, assertId(access.userId, "userId")),
      ),
    )
    .limit(1);
  return row
    ? {
        userId: access.userId,
        recommenderId: access.recommenderId,
        recommenderName: row.name,
        recommenderEmail: row.email,
      }
    : null;
}
