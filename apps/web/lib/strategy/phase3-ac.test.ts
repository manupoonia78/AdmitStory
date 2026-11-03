import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareToMedian } from "@admitstory/shared/kit";
import { describe, expect, it, vi } from "vitest";
import { allowedMode, authorshipFor } from "@/lib/kit/authorship";
import { shouldBuild, AUTO_REBUILD_INTERVAL_MS } from "@/lib/profile-read/policy";
import { comparisonModel, uncitedFigures } from "./comparison";
import { asPack } from "./pack";
import { previewDecision } from "./preview-policy";

vi.mock("server-only", () => ({}));

// Phase 3 ACs (spec §16 Phase 3, §5.4, §5.5, §14.2) that are pure decisions: every number on the
// comparison carries a source and a verified date; a "Pack coming soon" school is never previewed;
// a preview is reused while the dossier hasn't changed; the Profile Read rebuilds at most daily.

const root = process.cwd().endsWith("apps/web") ? join(process.cwd(), "../..") : process.cwd();
const pack = (slug: string) =>
  asPack(JSON.parse(readFileSync(join(root, `fixtures/schools/${slug}/pack.json`), "utf8")));
const now = new Date("2026-11-01T10:00:00Z");

describe("comparison (§5.5): every displayed number has a source and a date", () => {
  const applicant = {
    numbers: { gmat_focus: 655, gpa: 3.4, years_experience: 5 } as never,
    targetFunction: "Product management",
    brandTraits: [] as never[],
  };
  it("has no uncited figure across the fixture schools", () => {
    const model = comparisonModel(
      [
        { id: "a", name: "Kestrel Lake", pack: pack("kestrel-lake"), fit: null },
        { id: "b", name: "Halvorsen", pack: pack("halvorsen"), fit: null },
        { id: "c", name: "Coming soon", pack: null, fit: null },
      ],
      applicant,
    );
    const figures = model.groups.flatMap((g) =>
      g.rows.flatMap((r) =>
        Object.values(r.cells).filter((c) => c.kind === "number" || c.kind === "median"),
      ),
    );
    expect(figures.length).toBeGreaterThan(0);
    expect(uncitedFigures(model.groups)).toEqual([]);
  });

  it("fails loudly when a figure loses its citation", () => {
    const model = comparisonModel(
      [{ id: "a", name: "Kestrel Lake", pack: pack("kestrel-lake"), fit: null }],
      applicant,
    );
    const row = model.groups
      .flatMap((g) => g.rows)
      .find((r) => Object.values(r.cells).some((c) => c.kind === "median" || c.kind === "number"))!;
    const cell = Object.values(row.cells).find(
      (c) => c.kind === "median" || c.kind === "number",
    )! as { citation?: unknown };
    delete cell.citation;
    expect(uncitedFigures(model.groups).length).toBeGreaterThan(0);
  });

  it("maps the applicant's numbers against the class medians in code", () => {
    const profile = pack("kestrel-lake").class_profile ?? {};
    const compared = compareToMedian({ gmat_focus: 655, gpa: 3.4 } as never, profile as never);
    expect(
      Array.isArray(compared) ? compared.length : Object.keys(compared).length,
    ).toBeGreaterThan(0);
  });
});

describe("kit preview (§5.5, decision 2026-10-31)", () => {
  const base = { published: true, packVersion: 2, snapshotVersion: 7, job: null, now };
  it("is never offered for a school without a published pack", () => {
    expect(previewDecision({ ...base, published: false, kit: null })).toBe("coming_soon");
  });
  it("is reused while the dossier snapshot and pack version are unchanged", () => {
    expect(previewDecision({ ...base, kit: { dossierSnapshotVersion: 7, packVersion: 2 } })).toBe(
      "reuse",
    );
    expect(previewDecision({ ...base, kit: { dossierSnapshotVersion: 6, packVersion: 2 } })).toBe(
      "generate",
    );
    expect(previewDecision({ ...base, kit: { dossierSnapshotVersion: 7, packVersion: 1 } })).toBe(
      "generate",
    );
  });
});

describe("Profile Read debounce (§5.4)", () => {
  const basis = (n: number) => ({
    storyCodes: Array.from({ length: n }, (_, i) => `S0${i + 1}`),
    factCodes: [],
  });
  const latest = (hoursAgo: number) => ({
    createdAt: new Date(now.getTime() - hoursAgo * 3_600_000),
    snapshotVersion: 3,
    basis: basis(2),
  });
  it("waits when the dossier is thin, and rebuilds at most once a day on its own", () => {
    expect(
      shouldBuild({
        reason: "first_visit",
        latest: null,
        snapshot: { version: 1, basis: basis(1) },
        storyCount: 1,
        now,
      }),
    ).toEqual({ build: false, why: "thin" });
    expect(
      shouldBuild({
        reason: "dossier_changed",
        latest: latest(2),
        snapshot: { version: 4, basis: basis(5) },
        storyCount: 5,
        now,
      }),
    ).toEqual({ build: false, why: "too_soon" });
    expect(
      shouldBuild({
        reason: "dossier_changed",
        latest: latest(25),
        snapshot: { version: 4, basis: basis(5) },
        storyCount: 5,
        now,
      }),
    ).toEqual({ build: true });
    expect(AUTO_REBUILD_INTERVAL_MS).toBe(24 * 3_600_000);
  });
  it("rebuilds whenever the applicant asks", () => {
    expect(
      shouldBuild({
        reason: "manual",
        latest: latest(1),
        snapshot: { version: 3, basis: basis(2) },
        storyCount: 2,
        now,
      }),
    ).toEqual({ build: true });
  });
});

describe("authorship mode (§14.2, §8.10)", () => {
  it("coaches for limited and prohibited policies and never scripts a video", () => {
    expect(authorshipFor("essay", "unknown")).toBe("draft");
    expect(authorshipFor("essay", "permitted_with_disclosure")).toBe("draft");
    expect(authorshipFor("essay", "limited")).toBe("coach");
    expect(authorshipFor("short_answer", "prohibited")).toBe("coach");
    expect(authorshipFor("video", "permitted")).toBe("talking_points");
  });
  it("lets the applicant choose only a stricter mode", () => {
    expect(allowedMode("draft", "coach")).toBe(true);
    expect(allowedMode("coach", "draft")).toBe(false);
    expect(allowedMode("talking_points", "draft")).toBe(false);
  });
});
