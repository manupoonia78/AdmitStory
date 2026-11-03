import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LorBrief, BriefMeta, LorStoryFields } from "@admitstory/shared/kit";
import type { DbHandle } from "../src/client";
import { decryptContent, getContentKeyring } from "../src/crypto/content";
import { hashEmail, newPortalToken } from "../src/crypto/tokens";
import {
  addPortalVoiceSeconds,
  addUserSchool,
  archiveRecommender,
  claimDueReminders,
  claimPortalAssist,
  createManualLorStory,
  createRecommender,
  deleteLorStory,
  deleteWorkspacesForRecommender,
  disableReminder,
  enableReminder,
  failLorBrief,
  findInviteForResend,
  finishReminder,
  getInviteStatus,
  getLorBrief,
  getLorPlan,
  getRecommender,
  issueInvite,
  listLorBriefs,
  listLorStories,
  listRecommenderStatuses,
  listRecommenders,
  listReminders,
  markLorBriefBuilding,
  markPortalOpened,
  previewReminder,
  readPortalWorkspace,
  replaceExtractedStories,
  resolvePortalToken,
  revokeInvite,
  rotateInviteToken,
  rotatePortalToken,
  saveIntake,
  saveLorBrief,
  saveLorPlan,
  setPortalSubmitted,
  setReminderNote,
  syncPlannedReminders,
  systemContext,
  updateLorStory,
  updateRecommender,
  wipePortalWorkspace,
  writePortalLetter,
  writePortalNotes,
  writePortalVoice,
  type PortalAccess,
} from "../src/repos";
import {
  recommenderInvites,
  recommenderReminders,
  recommenderWorkspaces,
  schoolCycles,
  schools,
} from "../src/schema";
import { connectTestDb, createUserFactory } from "./support/db";

// Phase 6 repositories against a real database (plan §9, foundation rows): ownership of every
// applicant function, status without content, hashed tokens and how links resolve, the workspace
// bound to the invited address, encrypted envelopes, and reminders claimed exactly once. Every
// school is FICTIONAL, every user synthetic, and all of it is removed afterwards.

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const schoolIds: string[] = [];
const tag = () => randomUUID().slice(0, 8);

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
});

afterAll(async () => {
  if (!handle) return;
  await factory.cleanup();
  if (schoolIds.length > 0) await handle.db.delete(schools).where(inArray(schools.id, schoolIds));
  await handle.pool.end();
});

async function fictionalSchool(userId: string) {
  const t = tag();
  const [school] = await handle.db
    .insert(schools)
    .values({
      slug: `fictional-marrow-${t}`,
      name: `Fictional Marrow ${t}`,
      shortName: "Marrow",
      region: "us",
    })
    .returning();
  schoolIds.push(school!.id);
  const [cycle] = await handle.db
    .insert(schoolCycles)
    .values({ schoolId: school!.id, cycle: "2026-27", status: "live" })
    .returning();
  const userSchool = await addUserSchool(handle.db, userId, { schoolCycleId: cycle!.id });
  return { cycleId: cycle!.id, userSchoolId: userSchool.id };
}

const story = (title: string): LorStoryFields => ({
  title,
  what_happened: "The lab feed dropped every fourth message at 2 a.m.",
  what_they_saw: "Ravi read the incident note the next morning.",
  your_actions: ["Rewrote the retry per message"],
  result: "The go-live held.",
  numbers: ["900-bed"],
  what_they_said: null,
  traits: ["delivers_under_pressure"],
  cites: ["S01"],
});

const brief: LorBrief = {
  cover_note: "Thank you, Ravi.",
  schools: [],
  traits_to_reinforce: [],
  other_recommender_covers: [],
  development_arc: null,
  key_facts: [],
};

const meta = (cycleId: string): BriefMeta => ({
  applicant: { name: "Test Applicant", firstName: "Test" },
  recommender: { name: "Ravi Menon", firstName: "Ravi", title: null, organisation: null },
  groupKey: "common",
  schools: [
    {
      schoolCycleId: cycleId,
      school: "Fictional Marrow",
      round: null,
      deadline: "2027-01-06",
      format: "gmac_common",
      howToSubmit: "The school emails a link.",
      packNotes: [],
      questions: [],
    },
  ],
  askBy: null,
  checkIns: [],
  builtAt: new Date().toISOString(),
});

async function applicant() {
  const userId = await factory.create();
  const school = await fictionalSchool(userId);
  const rec = await createRecommender(handle.db, userId, {
    name: "Ravi Menon",
    email: ` Ravi.Menon+${tag()}@Example.TEST `,
    relationship: "manager",
    title: "Engineering manager",
    userSchoolIds: [school.userSchoolId, randomUUID()],
  });
  return { userId, rec, ...school };
}

async function invite(userId: string, recommenderId: string, email: string, days = 30) {
  const token = newPortalToken();
  const now = new Date();
  const row = await issueInvite(handle.db, userId, recommenderId, {
    tokenHash: token.hash,
    emailHash: hashEmail(email),
    expiresAt: new Date(now.getTime() + days * 86_400_000),
    now,
  });
  return { token, row: row! };
}

describe("recommenders (applicant side)", () => {
  it("creates with a stable ref, a normalised address and only the applicant's own schools", async () => {
    const { userId, rec, userSchoolId } = await applicant();
    expect(rec.ref).toBe("rec1");
    expect(rec.email).toMatch(/^ravi\.menon\+[0-9a-f]{8}@example\.test$/);
    expect(rec.userSchoolIds).toEqual([userSchoolId]);
    const second = await createRecommender(handle.db, userId, {
      name: "Dr. Kavita Rao",
      email: `kavita-${tag()}@example.test`,
      relationship: "client",
    });
    expect(second.ref).toBe("rec2");
    await archiveRecommender(handle.db, userId, second.id);
    const third = await createRecommender(handle.db, userId, {
      name: "Someone Else",
      email: `else-${tag()}@example.test`,
      relationship: "other",
    });
    // An archived recommender keeps their ref: "rec2" never means two people.
    expect(third.ref).toBe("rec3");
    expect((await listRecommenders(handle.db, userId)).map((r) => r.ref)).toEqual(["rec1", "rec3"]);
    expect(await listRecommenders(handle.db, userId, { userSchoolId })).toHaveLength(1);
    expect(await getRecommender(handle.db, userId, second.id)).toBeNull();
    expect(
      await getRecommender(handle.db, userId, second.id, { includeArchived: true }),
    ).not.toBeNull();
  });

  it("gives another applicant nothing from any applicant-side function", async () => {
    const { userId, rec, cycleId } = await applicant();
    const other = await factory.create();
    const [stored] = await replaceExtractedStories(handle.db, userId, rec.id, [story("A")], []);
    await saveLorPlan(handle.db, userId, {
      content: { assignments: [], red_flags: [], warnings: [] },
      inputHash: "h",
      dossierSnapshotVersion: 1,
    });
    await saveLorBrief(handle.db, userId, rec.id, "common", {
      content: brief,
      meta: meta(cycleId),
      planVersion: 1,
      dossierSnapshotVersion: 1,
    });
    const { row: inv } = await invite(userId, rec.id, rec.email);
    const [reminder] = await syncPlannedReminders(handle.db, userId, rec.id, [
      {
        kind: "ask",
        deadline: "2027-01-06",
        sendOn: "2026-11-18",
        schoolCycleIds: [cycleId],
        sendAt: new Date("2026-11-18T03:30:00Z"),
      },
    ]);

    expect(await getRecommender(handle.db, other, rec.id)).toBeNull();
    expect(await listRecommenders(handle.db, other)).toEqual([]);
    expect(await updateRecommender(handle.db, other, rec.id, { name: "Stolen" })).toBeNull();
    expect(await archiveRecommender(handle.db, other, rec.id)).toBeNull();
    expect(
      await saveIntake(handle.db, other, rec.id, {
        intake: {
          relationship: { summary: "x", chose_you_for: null, cites: [] },
          strengths: [],
          growth: null,
          said_to_others: [],
          background: { knows_mba: "unknown", note: null },
          logistics: { prefers: null, remind_when: null },
          missing: [],
        },
        sourceIds: [],
      }),
    ).toBeNull();
    expect(await listLorStories(handle.db, other)).toEqual([]);
    expect(await listLorStories(handle.db, other, { recommenderId: rec.id })).toEqual([]);
    expect(await replaceExtractedStories(handle.db, other, rec.id, [story("B")], [])).toEqual([]);
    expect(await createManualLorStory(handle.db, other, rec.id, story("C"))).toBeNull();
    expect(await updateLorStory(handle.db, other, stored!.id, { title: "Stolen" })).toBeNull();
    expect(await deleteLorStory(handle.db, other, stored!.id)).toBe(false);
    expect(await getLorPlan(handle.db, other)).toBeNull();
    expect(await getLorBrief(handle.db, other, rec.id, "common")).toBeNull();
    expect(await listLorBriefs(handle.db, other)).toEqual([]);
    expect(
      await markLorBriefBuilding(handle.db, other, rec.id, {
        groupKey: "common",
        schoolCycleIds: [cycleId],
        inputHash: "x",
        chargedRefId: null,
      }),
    ).toBeNull();
    expect(
      await saveLorBrief(handle.db, other, rec.id, "common", {
        content: brief,
        meta: meta(cycleId),
        planVersion: null,
        dossierSnapshotVersion: 1,
      }),
    ).toBeNull();
    expect(await failLorBrief(handle.db, other, rec.id, "common", "x")).toBeNull();
    expect(
      await issueInvite(handle.db, other, rec.id, {
        tokenHash: newPortalToken().hash,
        emailHash: hashEmail("x@example.test"),
        expiresAt: new Date(Date.now() + 86_400_000),
        now: new Date(),
      }),
    ).toBeNull();
    expect(await rotateInviteToken(handle.db, other, inv.id, { tokenHash: "x" })).toBeNull();
    expect(await revokeInvite(handle.db, other, rec.id)).toBeNull();
    expect(await getInviteStatus(handle.db, other, rec.id)).toBeNull();
    expect(await deleteWorkspacesForRecommender(handle.db, other, rec.id)).toBe(0);
    expect(await listRecommenderStatuses(handle.db, other)).toEqual([]);
    expect(await listReminders(handle.db, other, rec.id)).toEqual([]);
    expect(await syncPlannedReminders(handle.db, other, rec.id, [])).toEqual([]);
    expect(await setReminderNote(handle.db, other, reminder!.id, "x")).toBeNull();
    expect(await previewReminder(handle.db, other, reminder!.id, "h")).toBeNull();
    expect(await enableReminder(handle.db, other, reminder!.id, "h")).toBeNull();
    expect(await disableReminder(handle.db, other, reminder!.id)).toBeNull();

    // And the owner's rows are untouched.
    expect((await getRecommender(handle.db, userId, rec.id))?.name).toBe("Ravi Menon");
    expect(await listLorStories(handle.db, userId, { recommenderId: rec.id })).toHaveLength(1);
    expect((await getInviteStatus(handle.db, userId, rec.id))?.status).toBe("active");
    expect(await listReminders(handle.db, userId, rec.id)).toHaveLength(1);
  });

  it("keeps edited and manual stories across a new extraction and never reuses a code", async () => {
    const { userId, rec } = await applicant();
    const first = await replaceExtractedStories(
      handle.db,
      userId,
      rec.id,
      [story("A"), story("B")],
      [],
    );
    expect(first.map((s) => s.code)).toEqual(["R01", "R02"]);
    const edited = await updateLorStory(handle.db, userId, first[0]!.id, { title: "A, edited" });
    expect(edited?.origin).toBe("edited");
    const manual = await createManualLorStory(handle.db, userId, rec.id, story("Manual"));
    expect(manual?.code).toBe("R03");
    const second = await replaceExtractedStories(handle.db, userId, rec.id, [story("C")], []);
    expect(second.map((s) => [s.code, s.origin])).toEqual([
      ["R01", "edited"],
      ["R03", "manual"],
      ["R04", "extracted"],
    ]);
    expect(second.find((s) => s.code === "R01")?.fields.title).toBe("A, edited");
  });

  it("saves plans and briefs with versions, and marks building and failed", async () => {
    const { userId, rec, cycleId } = await applicant();
    const plan = { assignments: [], red_flags: [], warnings: [] };
    expect(
      (
        await saveLorPlan(handle.db, userId, {
          content: plan,
          inputHash: "a",
          dossierSnapshotVersion: 1,
        })
      ).version,
    ).toBe(1);
    expect(
      (
        await saveLorPlan(handle.db, userId, {
          content: plan,
          inputHash: "b",
          dossierSnapshotVersion: 2,
        })
      ).version,
    ).toBe(2);
    const building = await markLorBriefBuilding(handle.db, userId, rec.id, {
      groupKey: "common",
      schoolCycleIds: [cycleId],
      inputHash: "in",
      chargedRefId: null,
    });
    expect(building).toMatchObject({ status: "building", version: 0 });
    const ready = await saveLorBrief(handle.db, userId, rec.id, "common", {
      content: brief,
      meta: meta(cycleId),
      planVersion: 2,
      dossierSnapshotVersion: 2,
    });
    expect(ready).toMatchObject({ status: "ready", version: 1, inputHash: "in" });
    expect(ready?.builtAt).toBeInstanceOf(Date);
    expect((await failLorBrief(handle.db, userId, rec.id, "common", "timeout"))?.status).toBe(
      "failed",
    );
  });
});

describe("invites, workspaces and the portal", () => {
  it("never stores the raw token, and resolves a live link to its workspace", async () => {
    const { userId, rec } = await applicant();
    const { token, row } = await invite(userId, rec.id, rec.email);
    const stored = await handle.db
      .select()
      .from(recommenderInvites)
      .where(eq(recommenderInvites.id, row.id));
    expect(JSON.stringify(stored)).not.toContain(token.raw);
    expect(stored[0]?.tokenHash).toBe(token.hash);

    const resolved = await resolvePortalToken(handle.db, token.raw);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.access).toMatchObject({ userId, recommenderId: rec.id, inviteId: row.id });
  });

  it("resolves unknown, expired, revoked and replaced links as closed", async () => {
    const { userId, rec } = await applicant();
    expect(await resolvePortalToken(handle.db, newPortalToken().raw)).toEqual({
      ok: false,
      reason: "unknown",
    });
    expect(await resolvePortalToken(handle.db, "not-a-token")).toEqual({
      ok: false,
      reason: "unknown",
    });

    const { token: old, row } = await invite(userId, rec.id, rec.email);
    const fresh = newPortalToken();
    expect(
      await rotateInviteToken(handle.db, userId, row.id, { tokenHash: fresh.hash }),
    ).toMatchObject({
      sendCount: 2,
      previousTokenHash: old.hash,
    });
    expect(await resolvePortalToken(handle.db, old.raw)).toEqual({ ok: false, reason: "replaced" });
    expect((await resolvePortalToken(handle.db, fresh.raw)).ok).toBe(true);

    // A resend from /r rotates too.
    const resent = newPortalToken();
    expect(await rotatePortalToken(handle.db, row.id, resent.hash)).toBe(true);
    expect(await resolvePortalToken(handle.db, fresh.raw)).toEqual({
      ok: false,
      reason: "replaced",
    });

    expect(await revokeInvite(handle.db, userId, rec.id)).not.toBeNull();
    expect(await resolvePortalToken(handle.db, resent.raw)).toEqual({
      ok: false,
      reason: "revoked",
    });

    const { token: expiring } = await invite(userId, rec.id, rec.email, 1);
    const later = new Date(Date.now() + 2 * 86_400_000);
    expect(await resolvePortalToken(handle.db, expiring.raw, later)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect((await getInviteStatus(handle.db, userId, rec.id))?.status).toBe("expired");
  });

  it("binds the workspace to the address: same address keeps it, a change can wipe it", async () => {
    const { userId, rec } = await applicant();
    const { token } = await invite(userId, rec.id, rec.email);
    const first = await resolvePortalToken(handle.db, token.raw);
    if (!first.ok) throw new Error("link should work");
    await writePortalNotes(handle.db, first.access, [
      {
        id: "n1",
        text: "Quokka lantern 7741 marmalade",
        at: new Date().toISOString(),
        spoken: null,
      },
    ]);

    // Reissue to the same address: the notes are still there under the new link.
    const { token: again } = await invite(userId, rec.id, rec.email.toUpperCase());
    const second = await resolvePortalToken(handle.db, again.raw);
    if (!second.ok) throw new Error("reissued link should work");
    expect(second.access.workspaceId).toBe(first.access.workspaceId);
    expect((await readPortalWorkspace(handle.db, second.access)).notes[0]?.text).toBe(
      "Quokka lantern 7741 marmalade",
    );

    // A different address starts empty.
    const { token: elsewhere } = await invite(userId, rec.id, `someone-${tag()}@example.test`);
    const third = await resolvePortalToken(handle.db, elsewhere.raw);
    if (!third.ok) throw new Error("new address link should work");
    expect(third.access.workspaceId).not.toBe(first.access.workspaceId);
    expect((await readPortalWorkspace(handle.db, third.access)).notes).toEqual([]);

    // The address change deletes every other workspace, then all of them.
    expect(
      await deleteWorkspacesForRecommender(handle.db, userId, rec.id, {
        exceptEmailHash: hashEmail(`x-${tag()}@example.test`),
      }),
    ).toBe(2);
    const left = await handle.db
      .select({ id: recommenderWorkspaces.id })
      .from(recommenderWorkspaces)
      .where(eq(recommenderWorkspaces.recommenderId, rec.id));
    expect(left).toEqual([]);
  });

  it("stores notes, letters and voice as v1 envelopes, and the applicant's status carries none of it", async () => {
    const { userId, rec, cycleId } = await applicant();
    const { token } = await invite(userId, rec.id, rec.email);
    const resolved = await resolvePortalToken(handle.db, token.raw);
    if (!resolved.ok) throw new Error("link should work");
    const access: PortalAccess = resolved.access;
    await markPortalOpened(handle.db, access);
    await writePortalNotes(handle.db, access, [
      {
        id: "n1",
        text: "Quokka lantern 7741 marmalade",
        at: new Date().toISOString(),
        spoken: null,
      },
    ]);
    await writePortalLetter(handle.db, access, "common/c2", {
      text: "Velvet abacus 0932",
      assisted: null,
      mode: "assist",
      updatedAt: new Date().toISOString(),
    });
    await writePortalLetter(handle.db, access, "common/c3", {
      text: "Second answer",
      assisted: null,
      mode: null,
      updatedAt: new Date().toISOString(),
    });
    await writePortalVoice(handle.db, access, {
      sentences: 4,
      meanWords: 11,
      cv: 0.4,
      contractions: 0.2,
      firstPerson: 0.5,
      register: "plain",
      opener: "time",
      card: "short plain sentences",
    });
    expect(await setPortalSubmitted(handle.db, access, cycleId, true)).toHaveProperty(cycleId);

    const [row] = await handle.db
      .select()
      .from(recommenderWorkspaces)
      .where(eq(recommenderWorkspaces.id, access.workspaceId));
    const raw = JSON.stringify(row);
    expect(raw).not.toContain("Quokka");
    expect(raw).not.toContain("Velvet");
    for (const value of [
      row!.privateNotesEncrypted,
      row!.letterDraftEncrypted,
      row!.voiceEncrypted,
    ]) {
      expect(value).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(() => decryptContent(getContentKeyring(), value!)).not.toThrow();
    }
    const read = await readPortalWorkspace(handle.db, access);
    expect(Object.keys(read.letters).sort()).toEqual(["common/c2", "common/c3"]);
    expect(read.voice?.card).toBe("short plain sentences");

    const [status] = await listRecommenderStatuses(handle.db, userId);
    expect(status?.openedAt).toBeInstanceOf(Date);
    expect(status?.progressAt).toBeInstanceOf(Date);
    expect(Object.keys(status!.submitted)).toEqual([cycleId]);
    expect(status?.invite?.status).toBe("active");
    expect(Object.keys(status!).sort()).toEqual(
      ["invite", "openedAt", "progressAt", "recommenderId", "submitted"].sort(),
    );
    const json = JSON.stringify(status);
    expect(json).not.toMatch(/encrypted|notes|letter|voice|Quokka|Velvet|v1\./i);

    await wipePortalWorkspace(handle.db, access);
    const wiped = await readPortalWorkspace(handle.db, access);
    expect(wiped).toMatchObject({ notes: [], letters: {}, voice: null, submitted: {} });
  });

  it("caps assists and dictation atomically", async () => {
    const { userId, rec } = await applicant();
    const { token } = await invite(userId, rec.id, rec.email);
    const resolved = await resolvePortalToken(handle.db, token.raw);
    if (!resolved.ok) throw new Error("link should work");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimPortalAssist(handle.db, resolved.access, 3)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await claimPortalAssist(handle.db, resolved.access, 3)).ok).toBe(false);
    expect(await addPortalVoiceSeconds(handle.db, resolved.access, 50, 60)).toEqual({
      ok: true,
      total: 50,
    });
    expect(await addPortalVoiceSeconds(handle.db, resolved.access, 50, 60)).toEqual({
      ok: true,
      total: 60,
    });
    expect(await addPortalVoiceSeconds(handle.db, resolved.access, 5, 60)).toEqual({
      ok: false,
      total: 60,
    });
  });

  it("finds a live invite for a resend by the address hash only", async () => {
    const { userId, rec } = await applicant();
    const { row } = await invite(userId, rec.id, rec.email);
    expect(await findInviteForResend(handle.db, hashEmail(rec.email))).toEqual({
      inviteId: row.id,
      userId,
      recommenderId: rec.id,
    });
    expect(
      await findInviteForResend(handle.db, hashEmail(`nobody-${tag()}@example.test`)),
    ).toBeNull();
    await revokeInvite(handle.db, userId, rec.id);
    expect(await findInviteForResend(handle.db, hashEmail(rec.email))).toBeNull();
  });

  it("archiving revokes the link, deletes the workspace and the unsent reminders", async () => {
    const { userId, rec, cycleId } = await applicant();
    const { token } = await invite(userId, rec.id, rec.email);
    await syncPlannedReminders(handle.db, userId, rec.id, [
      {
        kind: "ask",
        deadline: "2027-01-06",
        sendOn: "2026-11-18",
        schoolCycleIds: [cycleId],
        sendAt: new Date(),
      },
    ]);
    expect(await archiveRecommender(handle.db, userId, rec.id)).not.toBeNull();
    expect(await resolvePortalToken(handle.db, token.raw)).toEqual({
      ok: false,
      reason: "revoked",
    });
    const workspaces = await handle.db
      .select({ id: recommenderWorkspaces.id })
      .from(recommenderWorkspaces)
      .where(eq(recommenderWorkspaces.recommenderId, rec.id));
    expect(workspaces).toEqual([]);
    expect(await listReminders(handle.db, userId, rec.id)).toEqual([]);
  });
});

describe("reminders", () => {
  it("only turns on with the text last read; a changed note or date needs a new read", async () => {
    const { userId, rec, cycleId } = await applicant();
    const plan = (sendOn: string) => ({
      kind: "checkin_3w" as const,
      deadline: "2027-01-06",
      sendOn,
      schoolCycleIds: [cycleId],
      sendAt: new Date(`${sendOn}T03:30:00Z`),
    });
    const [row] = await syncPlannedReminders(handle.db, userId, rec.id, [plan("2026-12-16")]);
    expect(row?.status).toBe("suggested");
    expect(await enableReminder(handle.db, userId, row!.id, "hash-a")).toBe("stale");
    await previewReminder(handle.db, userId, row!.id, "hash-a");
    expect(await enableReminder(handle.db, userId, row!.id, "hash-b")).toBe("stale");
    expect(await enableReminder(handle.db, userId, row!.id, "hash-a")).toBe("ok");

    const noted = await setReminderNote(handle.db, userId, row!.id, "Thank you again!");
    expect(noted).toMatchObject({ status: "changed", previewHash: null, note: "Thank you again!" });
    await previewReminder(handle.db, userId, row!.id, "hash-c");
    expect(await enableReminder(handle.db, userId, row!.id, "hash-c")).toBe("ok");

    // The deadline's date moved: an "on" reminder becomes "changed" and moves with it.
    const [moved] = await syncPlannedReminders(handle.db, userId, rec.id, [plan("2026-12-17")]);
    expect(moved).toMatchObject({ status: "changed", sendOn: "2026-12-17" });
    expect((await disableReminder(handle.db, userId, row!.id))?.status).toBe("off");
    // No longer planned: an unsent row goes.
    expect(await syncPlannedReminders(handle.db, userId, rec.id, [])).toEqual([]);
  });

  it("never hands the same due reminder to two concurrent runs", async () => {
    const { userId, rec, cycleId } = await applicant();
    const past = new Date(Date.now() - 60_000);
    const planned = ["2027-01-06", "2027-01-13", "2027-01-20", "2027-01-27"].map((deadline) => ({
      kind: "checkin_1w" as const,
      deadline,
      sendOn: "2026-11-01",
      schoolCycleIds: [cycleId],
      sendAt: past,
    }));
    const rows = await syncPlannedReminders(handle.db, userId, rec.id, planned);
    for (const row of rows) {
      await previewReminder(handle.db, userId, row.id, `h-${row.id}`);
      await enableReminder(handle.db, userId, row.id, `h-${row.id}`);
    }
    const ours = new Set(rows.map((r) => r.id));
    const ctx = systemContext(handle.db, "test:recommender-reminders");
    const [a, b] = await Promise.all([
      claimDueReminders(ctx, new Date(), 500),
      claimDueReminders(ctx, new Date(), 500),
    ]);
    const mine = [...a, ...b].filter((r) => ours.has(r.id)).map((r) => r.id);
    expect(mine.sort()).toEqual([...ours].sort());
    expect(new Set(mine).size).toBe(mine.length);
    expect((await claimDueReminders(ctx, new Date(), 500)).filter((r) => ours.has(r.id))).toEqual(
      [],
    );

    const first = rows[0]!;
    expect(
      await finishReminder(ctx, first.id, { status: "sent", deliveryId: "outbox-1" }),
    ).toMatchObject({
      status: "sent",
      deliveryId: "outbox-1",
    });
    expect(await finishReminder(ctx, first.id, { status: "sent" })).toBeNull();
    for (const row of rows.slice(1))
      await finishReminder(ctx, row.id, { status: "skipped", skippedReason: "test" });
    const after = await handle.db
      .select({ status: recommenderReminders.status })
      .from(recommenderReminders)
      .where(inArray(recommenderReminders.id, [...ours]));
    expect(after.every((r) => r.status === "sent" || r.status === "skipped")).toBe(true);
  });
});
