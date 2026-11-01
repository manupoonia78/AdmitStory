import { randomUUID } from "node:crypto";
import { SEED_SCHOOLS } from "@admitstory/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/client";
import {
  AdminRequiredError,
  KitAlreadyUnlockedError,
  ProposalAlreadyReviewedError,
  UserSchoolLockedError,
  activatePromptVersion,
  addKbSource,
  addUserSchool,
  countSchoolVotes,
  createCanonVersion,
  createChunkStore,
  createCycle,
  createPromptVersion,
  createProposals,
  createSchool,
  deleteKbSource,
  getActivePromptVersions,
  getKbSource,
  getKitForUserSchool,
  getLatestProfileRead,
  getPublishedPack,
  getSchoolBySlug,
  getUserSchool,
  getVerifiedAiPolicy,
  grantRole,
  insertChunks,
  insertDraftPack,
  listAuditLog,
  listKits,
  listSchoolVotes,
  listSourceChunks,
  listUserSchools,
  publishCanonVersion,
  publishPack,
  recordRefreshSnapshot,
  removeUserSchool,
  requireAdmin,
  reviewProposal,
  saveKitPreview,
  saveProfileRead,
  saveUserSchoolFit,
  searchSchools,
  setChunkEmbeddings,
  setKbSourceStatus,
  setPromptAbSplit,
  systemContext,
  updateKbSource,
  updateUserSchool,
  upsertAiPolicy,
  voteForSchool,
  withdrawSchoolVote,
  type AdminContext,
} from "../src/repos";
import {
  aiPolicies,
  auditLog,
  canonDocs,
  kbSources,
  kits,
  promptVersions,
  schoolCycles,
  schools,
  userSchools,
} from "../src/schema";
import {
  AI_POLICY_SEED_SOURCE,
  SEED_CYCLE,
  seedAiPolicies,
  seedSchools,
} from "../src/seed/schools";
import type { ChunkHit } from "../src/types";
import { connectTestDb, createUserFactory } from "./support/db";

// Phase 3 repositories against a real database: admin access and its audit trail, School Packs,
// the hybrid chunk store, the applicant's school list, votes, Profile Reads and kit previews, and
// the seeds. Every school here is FICTIONAL and removed afterwards; the Appendix H seed rows are
// reference data the dev database is meant to hold, so the seed test leaves them in place.

const JOB = "test:schools.int";
const tag = () => randomUUID().slice(0, 8);

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
let adminId: string;
let admin: AdminContext;
const schoolIds: string[] = [];
const canonIds: string[] = [];
const promptIds: string[] = [];
const userIds: string[] = [];

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
  adminId = await user();
  await grantRole(handle.db, adminId, "admin");
  admin = await requireAdmin(handle.db, adminId);
});

afterAll(async () => {
  if (!handle) return;
  const { db } = handle;
  // Audit rows outlive their actors (SET NULL), so remove ours before the users go.
  if (userIds.length > 0) await db.delete(auditLog).where(inArray(auditLog.actorId, userIds));
  await db.delete(auditLog).where(sql`${auditLog.meta}->>'job' = ${JOB}`);
  await factory.cleanup();
  // Cascades to cycles, packs, sources, chunks, proposals, policies, snapshots and votes.
  if (schoolIds.length > 0) await db.delete(schools).where(inArray(schools.id, schoolIds));
  if (canonIds.length > 0) await db.delete(canonDocs).where(inArray(canonDocs.id, canonIds));
  if (promptIds.length > 0)
    await db.delete(promptVersions).where(inArray(promptVersions.id, promptIds));
  await handle.pool.end();
});

async function user(): Promise<string> {
  const id = await factory.create();
  userIds.push(id);
  return id;
}

async function fictionalSchool(region: "us" | "europe" | "asia_other" = "us") {
  const t = tag();
  const school = await createSchool(admin, {
    slug: `fictional-harbour-${t}`,
    name: `Fictional Harbour School ${t}`,
    shortName: `Harbour ${t}`,
    country: "us",
    region,
  });
  schoolIds.push(school.id);
  const cycle = await createCycle(admin, { schoolId: school.id, cycle: "2026-27" });
  return { school, cycle };
}

/** A unit vector along `axis`, optionally nudged towards `towards`. */
function vec(axis: number, towards?: number, weight = 0.3): number[] {
  const v = Array.from({ length: 1024 }, () => 0);
  v[axis] = 1;
  if (towards !== undefined) v[towards] = weight;
  return v;
}

describe("admin access", () => {
  it("requireAdmin refuses an account without the admin role", async () => {
    const applicant = await user();
    await expect(requireAdmin(handle.db, applicant)).rejects.toBeInstanceOf(AdminRequiredError);
    await expect(requireAdmin(handle.db, randomUUID())).rejects.toBeInstanceOf(AdminRequiredError);
  });

  it("refuses a hand-made context even for a real admin id", async () => {
    const forged = { db: handle.db, actorId: adminId, job: null } as AdminContext;
    await expect(
      createSchool(forged, {
        slug: `forged-${tag()}`,
        name: "Forged",
        shortName: "F",
        region: "us",
      }),
    ).rejects.toBeInstanceOf(AdminRequiredError);
  });

  it("writes an audit row for every mutation, with the actor", async () => {
    const { school, cycle } = await fictionalSchool();
    const rows = await listAuditLog(admin, { actorId: adminId, limit: 500 });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "schools.create",
          targetId: school.id,
          actorId: adminId,
        }),
        expect.objectContaining({ action: "school_cycles.create", targetId: cycle.id }),
      ]),
    );
  });

  it("names the job on a system context's audit rows", async () => {
    const { cycle } = await fictionalSchool();
    const system = systemContext(handle.db, JOB);
    await upsertAiPolicy(system, cycle.id, { stance: "unknown", appliesTo: [], verified: false });
    const [row] = await handle.db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.action, "ai_policies.upsert"), sql`${auditLog.meta}->>'job' = ${JOB}`),
      );
    expect(row).toMatchObject({ actorId: null, targetType: "ai_policy" });
  });

  it("writes no audit row when a mutation finds nothing to change", async () => {
    const missing = randomUUID();
    expect(await deleteKbSource(admin, missing, "cleanup")).toBe(false);
    expect(await updateKbSource(admin, missing, { title: "Nothing" })).toBeNull();
    expect(await listAuditLog(admin, { targetType: "kb_source", targetId: missing })).toEqual([]);
  });
});

describe("School Packs", () => {
  it("keeps drafts private until published, then serves the newest published version", async () => {
    const { school, cycle } = await fictionalSchool();
    const first = await insertDraftPack(admin, cycle.id, { school: { name: "Draft one" } });
    const again = await insertDraftPack(admin, cycle.id, { school: { name: "Draft one, edited" } });
    expect(again).toMatchObject({ id: first.id, version: 1, status: "draft" });
    expect(await getPublishedPack(handle.db, cycle.id)).toBeNull();
    expect((await getSchoolBySlug(handle.db, school.slug))?.publishedPack).toBeNull();

    await publishPack(admin, first.id, { compiledPrompt: "# Harbour\n", tokenCount: 3 });
    await expect(
      publishPack(admin, first.id, { compiledPrompt: "# again\n", tokenCount: 3 }),
    ).rejects.toThrow(/already published/);
    const second = await insertDraftPack(admin, cycle.id, { school: { name: "Draft two" } });
    expect(second.version).toBe(2);

    const published = await getPublishedPack(handle.db, cycle.id);
    expect(published).toMatchObject({
      version: 1,
      data: { school: { name: "Draft one, edited" } },
    });
    const [live] = await handle.db.select().from(schoolCycles).where(eq(schoolCycles.id, cycle.id));
    expect(live?.status).toBe("live");

    const [found] = await searchSchools(handle.db, school.name);
    expect(found).toMatchObject({ id: school.id, publishedPack: { version: 1 } });
    const audit = await listAuditLog(admin, { targetType: "school_pack", targetId: first.id });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["school_packs.save_draft", "school_packs.publish"]),
    );
  });

  it("shows an AI policy only once verified", async () => {
    const { cycle } = await fictionalSchool();
    await upsertAiPolicy(admin, cycle.id, {
      stance: "limited",
      appliesTo: ["essays"],
      sourceUrl: "https://example.test/ai-policy",
      verified: false,
    });
    expect(await getVerifiedAiPolicy(handle.db, cycle.id)).toBeNull();
    await upsertAiPolicy(admin, cycle.id, {
      stance: "limited",
      appliesTo: ["essays"],
      sourceUrl: "https://example.test/ai-policy",
      verified: true,
    });
    expect(await getVerifiedAiPolicy(handle.db, cycle.id)).toMatchObject({
      stance: "limited",
      verifiedBy: adminId,
    });
  });
});

describe("knowledge base", () => {
  it("encrypts source text at rest and decrypts it for admins", async () => {
    const { school } = await fictionalSchool();
    const text = "Fictional Harbour essays are due on the first of the month.";
    const source = await addKbSource(admin, {
      schoolId: school.id,
      cycle: "2026-27",
      type: "official",
      title: "Fictional Harbour essays page",
      text,
    });
    expect(source.trust).toBe(5);
    const [raw] = await handle.db
      .select({ text: kbSources.textEncrypted })
      .from(kbSources)
      .where(eq(kbSources.id, source.id));
    expect(raw?.text).not.toContain("Harbour");
    expect((await getKbSource(admin, source.id))?.text).toBe(text);
  });

  it("replaces a source's chunks on re-ingest", async () => {
    const { school } = await fictionalSchool();
    const source = await addKbSource(admin, { schoolId: school.id, type: "press", title: "Note" });
    await insertChunks(admin, source.id, [
      { ord: 0, text: "First chunk.", embedding: vec(1) },
      { ord: 1, text: "Second chunk.", embedding: null },
    ]);
    await insertChunks(admin, source.id, [{ ord: 0, text: "Only chunk.", embedding: vec(2) }]);
    expect(await listSourceChunks(admin, source.id)).toEqual([
      expect.objectContaining({ ord: 0, text: "Only chunk.", embedded: true }),
    ]);
  });

  it("embeds chunks later and copies a re-tagged cycle onto them", async () => {
    const { school } = await fictionalSchool();
    const source = await addKbSource(admin, {
      schoolId: school.id,
      type: "official",
      title: "Fictional Harbour class profile",
    });
    await insertChunks(admin, source.id, [
      { ord: 0, text: "Harbour lighthouse.", embedding: null },
    ]);
    const [chunk] = await listSourceChunks(admin, source.id);
    expect(chunk?.embedded).toBe(false);
    expect(await setChunkEmbeddings(admin, [{ chunkId: chunk!.id, embedding: vec(40) }])).toEqual({
      updated: 1,
    });
    await updateKbSource(admin, source.id, { cycle: "2026-27" });

    const store = createChunkStore(handle.db);
    const hits = await store.vectorSearch({
      embedding: vec(40),
      filters: { schoolId: school.id, cycle: "2026-27" },
      limit: 5,
    });
    expect(hits).toEqual([expect.objectContaining({ chunkId: chunk!.id, cycle: "2026-27" })]);
  });

  it("reviews a proposal once", async () => {
    const { cycle } = await fictionalSchool();
    const [proposal] = await createProposals(admin, [
      {
        cycleId: cycle.id,
        fieldPath: "application.essays[goals].limit.value",
        proposed: 500,
        confidence: 0.9,
      },
    ]);
    expect(proposal).toMatchObject({ status: "pending", confidence: 0.9 });
    const edited = await reviewProposal(admin, proposal!.id, { decision: "edited", edited: 450 });
    expect(edited).toMatchObject({ status: "edited", edited: 450, reviewedBy: adminId });
    await expect(
      reviewProposal(admin, proposal!.id, { decision: "accepted" }),
    ).rejects.toBeInstanceOf(ProposalAlreadyReviewedError);
  });

  it("reports a refresh change only against an earlier fetch", async () => {
    const { cycle } = await fictionalSchool();
    const url = "https://example.test/deadlines";
    const [a, b] = ["a".repeat(64), "b".repeat(64)];
    const base = await recordRefreshSnapshot(admin, {
      schoolCycleId: cycle.id,
      url,
      contentHash: a,
    });
    expect(base).toMatchObject({ changed: false, previousHash: null });
    const same = await recordRefreshSnapshot(admin, {
      schoolCycleId: cycle.id,
      url,
      contentHash: a,
    });
    expect(same.changed).toBe(false);
    const moved = await recordRefreshSnapshot(admin, {
      schoolCycleId: cycle.id,
      url,
      contentHash: b,
    });
    expect(moved).toMatchObject({ changed: true, previousHash: a });
  });
});

describe("chunk store (hybrid retrieval)", () => {
  let schoolA: string;
  let schoolB: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    schoolA = (await fictionalSchool()).school.id;
    schoolB = (await fictionalSchool()).school.id;
    const verifiedAt = new Date("2026-09-15T12:00:00Z");
    const add = async (
      key: string,
      schoolId: string,
      type: "official" | "insider" | "third_party_reference",
      cycle: string | null,
      text: string,
      embedding: number[],
    ) => {
      const source = await addKbSource(admin, {
        schoolId,
        cycle,
        type,
        title: `Fictional ${key}`,
        url: `https://example.test/${key}`,
        verifiedAt,
      });
      await insertChunks(admin, source.id, [{ ord: 0, text, embedding }]);
      ids[key] = source.id;
    };
    await add(
      "a-official",
      schoolA,
      "official",
      "2026-27",
      "Harbour quayside essay deadline is in January.",
      vec(10),
    );
    await add(
      "a-evergreen",
      schoolA,
      "insider",
      null,
      "Harbour interviews are blind and quayside friendly.",
      vec(10, 11, 0.5),
    );
    await add(
      "a-old-cycle",
      schoolA,
      "official",
      "2025-26",
      "Last year the quayside essay deadline was in December.",
      vec(10, 12, 0.1),
    );
    await add(
      "a-third-party",
      schoolA,
      "third_party_reference",
      "2026-27",
      "Paid note: quayside essay tips.",
      vec(10, 13, 0.1),
    );
    await add(
      "a-failed",
      schoolA,
      "official",
      "2026-27",
      "Broken quayside essay extraction.",
      vec(10, 14, 0.1),
    );
    await setKbSourceStatus(admin, ids["a-failed"]!, "failed", "fixture failure");
    await add(
      "b-official",
      schoolB,
      "official",
      "2026-27",
      "Another quayside essay deadline in January.",
      vec(10),
    );
  });

  const sources = (hits: ChunkHit[]) => hits.map((h) => h.sourceId);

  it("vector search filters by school, cycle (with evergreen), type, trust and status", async () => {
    const store = createChunkStore(handle.db);
    const hits = await store.vectorSearch({
      embedding: vec(10),
      filters: { schoolId: schoolA, cycle: "2026-27" },
      limit: 10,
    });
    expect(sources(hits)).toEqual([ids["a-official"], ids["a-evergreen"]]);
    expect(hits[0]).toMatchObject({
      schoolId: schoolA,
      cycle: "2026-27",
      sourceType: "official",
      trust: 5,
      title: "Fictional a-official",
      url: "https://example.test/a-official",
      verifiedAt: "2026-09-15",
    });
    expect(hits[0]!.score).toBeCloseTo(1, 5);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);

    const trusted = await store.vectorSearch({
      embedding: vec(10),
      filters: { schoolId: schoolA, cycle: "2026-27", minTrust: 4 },
      limit: 10,
    });
    expect(sources(trusted)).toEqual([ids["a-official"]]);

    const reference = await store.vectorSearch({
      embedding: vec(10),
      filters: { schoolId: schoolA, sourceTypes: ["third_party_reference"] },
      limit: 10,
    });
    expect(sources(reference)).toEqual([ids["a-third-party"]]);
  });

  it("text search ranks matches and applies the same filters", async () => {
    const store = createChunkStore(handle.db);
    const hits = await store.textSearch({
      query: "quayside essay deadline",
      filters: { schoolId: schoolA, cycle: "2026-27" },
      limit: 10,
    });
    expect(sources(hits)).toEqual([ids["a-official"]]);
    expect(hits[0]!.score).toBeGreaterThan(0);

    const anyCycle = await store.textSearch({
      query: "quayside",
      filters: { schoolId: schoolA, sourceTypes: ["official", "insider"] },
      limit: 10,
    });
    expect(new Set(sources(anyCycle))).toEqual(
      new Set([ids["a-official"], ids["a-evergreen"], ids["a-old-cycle"]]),
    );

    // No sourceTypes: paid third-party notes and failed sources stay out (§9.6).
    const byDefault = await store.textSearch({
      query: "quayside",
      filters: { schoolId: schoolA },
      limit: 10,
    });
    expect(new Set(sources(byDefault))).toEqual(
      new Set([ids["a-official"], ids["a-evergreen"], ids["a-old-cycle"]]),
    );

    const otherSchool = await store.textSearch({
      query: "quayside",
      filters: { schoolId: schoolB },
      limit: 10,
    });
    expect(sources(otherSchool)).toEqual([ids["b-official"]]);
  });
});

describe("canon and prompt registries", () => {
  it("versions canon docs and publishes one", async () => {
    const slug = `test-canon-${tag()}`;
    const one = await createCanonVersion(admin, { slug, content: "v1", ruleIds: ["CRAFT-01"] });
    const two = await createCanonVersion(admin, { slug, content: "v2" });
    canonIds.push(one.id, two.id);
    expect([one.version, two.version]).toEqual([1, 2]);
    expect((await publishCanonVersion(admin, two.id)).publishedBy).toBe(adminId);
  });

  it("activates one prompt version or splits traffic between several", async () => {
    const agent = `test.agent_${tag().replace(/[^a-z]/g, "x")}`;
    const v1 = await createPromptVersion(admin, { agent, version: "v1", template: "one" });
    const v2 = await createPromptVersion(admin, { agent, version: "v2", template: "two" });
    promptIds.push(v1.id, v2.id);
    await activatePromptVersion(admin, v1.id);
    expect((await getActivePromptVersions(handle.db, agent)).map((p) => p.id)).toEqual([v1.id]);
    await setPromptAbSplit(admin, agent, [
      { promptVersionId: v2.id, weight: 70 },
      { promptVersionId: v1.id, weight: 30 },
    ]);
    const active = await getActivePromptVersions(handle.db, agent);
    expect(active.map((p) => [p.id, p.abWeight])).toEqual([
      [v2.id, 70],
      [v1.id, 30],
    ]);
  });
});

describe("applicant repositories are scoped to their owner", () => {
  it("user_schools: only the owner reads, edits, scores or removes a row", async () => {
    const { cycle } = await fictionalSchool();
    const [owner, other] = [await user(), await user()];
    const row = await addUserSchool(handle.db, owner, { schoolCycleId: cycle.id, round: "R1" });
    expect((await addUserSchool(handle.db, owner, { schoolCycleId: cycle.id })).id).toBe(row.id);

    expect(await getUserSchool(handle.db, other, row.id)).toBeNull();
    expect(await listUserSchools(handle.db, other)).toEqual([]);
    expect(await updateUserSchool(handle.db, other, row.id, { round: "R2" })).toBeNull();
    expect(await saveUserSchoolFit(handle.db, other, row.id, { lane: "x" }, 1)).toBeNull();
    expect(await removeUserSchool(handle.db, other, row.id)).toBe(false);
    // Another applicant's (or a missing) source can't be linked as previous materials.
    expect(
      await updateUserSchool(handle.db, owner, row.id, { previousMaterialsSourceId: randomUUID() }),
    ).toBeNull();

    const [listed] = await listUserSchools(handle.db, owner);
    expect(listed).toMatchObject({ id: row.id, round: "R1", cycle: { id: cycle.id } });
    expect(await saveUserSchoolFit(handle.db, owner, row.id, { lane: "x" }, 1)).toMatchObject({
      fit: { lane: "x" },
      fitPackVersion: 1,
    });
    expect(await removeUserSchool(handle.db, owner, row.id)).toBe(true);
    expect(await getUserSchool(handle.db, owner, row.id)).toBeNull();
  });

  it("school_interest_votes: one vote per applicant, withdrawn only by its owner", async () => {
    const { school } = await fictionalSchool();
    const [owner, other] = [await user(), await user()];
    expect(await voteForSchool(handle.db, owner, school.id)).toBe(true);
    expect(await voteForSchool(handle.db, owner, school.id)).toBe(false);
    expect(await listSchoolVotes(handle.db, other)).toEqual([]);
    expect(await withdrawSchoolVote(handle.db, other, school.id)).toBe(false);
    expect(await countSchoolVotes(handle.db, school.id)).toBe(1);
    expect(await withdrawSchoolVote(handle.db, owner, school.id)).toBe(true);
    expect(await countSchoolVotes(handle.db, school.id)).toBe(0);
  });

  it("profile_reads: versions count per applicant and stay private", async () => {
    const [owner, other] = [await user(), await user()];
    await saveProfileRead(handle.db, owner, { content: { v: 1 }, builtFromSnapshotVersion: 1 });
    const second = await saveProfileRead(handle.db, owner, {
      content: { v: 2 },
      builtFromSnapshotVersion: 2,
      model: "model-under-test",
    });
    expect(second.version).toBe(2);
    expect(await getLatestProfileRead(handle.db, owner)).toMatchObject({ content: { v: 2 } });
    expect(await getLatestProfileRead(handle.db, other)).toBeNull();
    expect(
      (await saveProfileRead(handle.db, other, { content: {}, builtFromSnapshotVersion: null }))
        .version,
    ).toBe(1);
  });

  it("kits: one preview per school, owner only, frozen once a full kit exists", async () => {
    const { cycle } = await fictionalSchool();
    const [owner, other] = [await user(), await user()];
    const row = await addUserSchool(handle.db, owner, { schoolCycleId: cycle.id });
    const preview = {
      positioning: { thesis: "fictional" },
      fileMap: { goals: ["story-1"] },
      dossierSnapshotVersion: 3,
      packVersion: 1,
      costUsd: 0.01234,
    };

    expect(await saveKitPreview(handle.db, other, row.id, preview)).toBeNull();
    const kit = await saveKitPreview(handle.db, owner, row.id, preview);
    expect(kit).toMatchObject({ status: "preview", userId: owner, costUsd: 0.01234 });
    const again = await saveKitPreview(handle.db, owner, row.id, { ...preview, packVersion: 2 });
    // Replaced in place; the cost of both runs is kept.
    expect(again).toMatchObject({ id: kit!.id, packVersion: 2 });
    expect(again!.costUsd).toBeCloseTo(0.02468, 5);
    expect((await getUserSchool(handle.db, owner, row.id))?.status).toBe("preview");

    expect(await getKitForUserSchool(handle.db, other, row.id)).toBeNull();
    expect(await listKits(handle.db, other)).toEqual([]);
    expect((await listKits(handle.db, owner)).map((k) => k.id)).toEqual([kit!.id]);

    // Checkout (Phase 4) moves the kit on; the preview can then no longer be overwritten and the
    // school can no longer be removed.
    await handle.db.update(kits).set({ status: "pending" }).where(eq(kits.id, kit!.id));
    await handle.db
      .update(userSchools)
      .set({ status: "unlocked" })
      .where(eq(userSchools.id, row.id));
    await expect(saveKitPreview(handle.db, owner, row.id, preview)).rejects.toBeInstanceOf(
      KitAlreadyUnlockedError,
    );
    await expect(removeUserSchool(handle.db, owner, row.id)).rejects.toBeInstanceOf(
      UserSchoolLockedError,
    );
  });
});

describe("seeds", () => {
  it("seedSchools is idempotent for a fictional list", async () => {
    const t = tag();
    const list = [
      { name: `Fictional Lantern School ${t}`, region: "europe" as const },
      { name: `Fictional Orchard School ${t} (Testland)`, region: "asia_other" as const },
    ];
    const first = await seedSchools(handle.db, list, "2026-27");
    schoolIds.push(...first.schoolIds);
    expect(first).toMatchObject({ schools: 2, cycles: 2 });
    const second = await seedSchools(handle.db, list, "2026-27");
    expect(second).toEqual({ schools: 0, cycles: 0, schoolIds: first.schoolIds });
    const cycles = await handle.db
      .select({ status: schoolCycles.status })
      .from(schoolCycles)
      .where(inArray(schoolCycles.schoolId, first.schoolIds));
    expect(cycles).toEqual([{ status: "draft" }, { status: "draft" }]);
  });

  it("seeds Appendix H and the §14.2 policies once, unverified", async () => {
    await seedSchools(handle.db);
    await seedAiPolicies(handle.db);
    const again = await seedSchools(handle.db);
    expect(again).toMatchObject({ schools: 0, cycles: 0 });
    expect(again.schoolIds).toHaveLength(SEED_SCHOOLS.length);
    expect((await seedAiPolicies(handle.db)).inserted).toBe(0);

    const policies = await handle.db
      .select({ verifiedAt: aiPolicies.verifiedAt, sourceUrl: aiPolicies.sourceUrl })
      .from(aiPolicies)
      .innerJoin(schoolCycles, eq(schoolCycles.id, aiPolicies.schoolCycleId))
      .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
      .where(and(eq(schools.slug, "stanford-gsb"), eq(schoolCycles.cycle, SEED_CYCLE)));
    expect(policies).toEqual([{ verifiedAt: null, sourceUrl: AI_POLICY_SEED_SOURCE }]);
  });
});
