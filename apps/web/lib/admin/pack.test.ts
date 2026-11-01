import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { KbSource, School } from "@admitstory/db";
import { parseSchoolPack } from "@admitstory/kb/schema";
import { describe, expect, it } from "vitest";
import { AdminActionError } from "./errors";
import { withFrontMatterVersion } from "./front-matter";
import {
  acceptedProposal,
  allowedHosts,
  officialUrlsOf,
  packSourceFor,
  pendingLabel,
  proposalRows,
  skeletonPack,
} from "./pack";

const SCHOOL: School = {
  id: "5d0e6c1a-0f3e-4b8e-9a51-2f7f6a1c3b11",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  slug: "halvorsen",
  name: "Halvorsen School of Management",
  shortName: "Halvorsen",
  country: "NO",
  city: "Tromsø",
  website: "https://www.halvorsen.example",
  logoKey: null,
  region: "europe",
};

const SOURCE: KbSource = {
  id: "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d",
  createdAt: new Date("2026-10-20T09:00:00Z"),
  updatedAt: new Date("2026-10-20T09:00:00Z"),
  schoolId: SCHOOL.id,
  cycle: "2026-27",
  type: "official",
  title: "Halvorsen admissions: deadlines 2026-27",
  url: "https://www.halvorsen.example/admissions/deadlines",
  fileKey: null,
  trust: 5,
  rightsNote: null,
  addedBy: null,
  contentHash: null,
  verifiedAt: null,
  status: "normalizing",
  error: null,
  meta: null,
};

const halvorsen = () =>
  parseSchoolPack(
    JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/schools/halvorsen/pack.json"), "utf8"),
    ) as unknown,
  );

const TEXT = "Round 2: applications due 13 January 2027; decisions released 24 March 2027.";

describe("skeletonPack", () => {
  it("is a valid, unverified draft built from the school's identity", () => {
    const pack = skeletonPack(SCHOOL, "2027-28");
    expect(pack.status).toBe("draft");
    expect(pack.cycle).toBe("2027-28");
    expect(pack.school.website).toBe(SCHOOL.website);
    expect(pack.ai_policy.verified_at).toBeNull();
  });

  it("refuses to invent a school's country, city or website", () => {
    expect(() => skeletonPack({ ...SCHOOL, city: null, website: null }, "2026-27")).toThrow(
      AdminActionError,
    );
    expect(() => skeletonPack({ ...SCHOOL, city: null }, "2026-27")).toThrow(/city/);
  });
});

describe("proposalRows", () => {
  it("decodes values, keeps the span's quote and detects a conflict with every value's trust", () => {
    const pack = halvorsen();
    const [row] = proposalRows(
      {
        proposals: [
          {
            field_path: "rounds[name=R2].deadline",
            proposed: JSON.stringify("2027-01-13"),
            current: JSON.stringify("2027-01-06"),
            conflict: true,
            confidence: 0.95,
            source_span: { start: 0, end: 41 },
            rewritten_in_own_words: false,
            note: "",
          },
        ],
      },
      { source: SOURCE, text: TEXT, cycleId: SCHOOL.id, packId: null, pack },
    );
    expect(row?.proposed).toBe("2027-01-13");
    expect(row?.current).toBe("2027-01-06");
    expect(row?.evidence?.[0]?.quote).toBe("Round 2: applications due 13 January 2027");
    // Two official sources disagree: no default, so the field is blocked until the admin chooses.
    expect(row?.conflict?.values.map((v) => v.trust)).toEqual([5, 5]);
    expect(row?.conflict?.note).toMatch(/choose one/);
  });

  it("falls back to the model's conflict flag when the draft isn't a valid pack yet", () => {
    const [row] = proposalRows(
      {
        proposals: [
          {
            field_path: "rounds[name=R2].deadline",
            proposed: '"2027-01-13"',
            current: '"2027-01-06"',
            conflict: true,
            confidence: 0.9,
            source_span: null,
            rewritten_in_own_words: false,
            note: "",
          },
        ],
      },
      { source: SOURCE, text: TEXT, cycleId: SCHOOL.id, packId: null, pack: null },
    );
    expect(row?.evidence).toBeNull();
    expect(row?.conflict?.values).toHaveLength(2);
  });
});

describe("acceptedProposal", () => {
  const row = {
    id: "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceId: SOURCE.id,
    cycleId: SCHOOL.id,
    packId: null,
    fieldPath: "rounds[name=R2].deadline",
    proposed: "2027-01-13",
    current: "2027-01-06",
    confidence: 0.95,
    evidence: null,
    status: "pending" as const,
    edited: null,
    conflict: null,
    reviewedBy: null,
    reviewedAt: null,
  };

  it("uses the admin's edit and override when given", () => {
    expect(acceptedProposal(row).proposed).toBe("2027-01-13");
    const edited = acceptedProposal(row, { edited: "2027-01-14", override: true });
    expect(edited.proposed).toBe("2027-01-14");
    expect(edited.override).toBe(true);
  });

  it("refuses a refresh-check item, which has nothing to apply", () => {
    expect(() => acceptedProposal({ ...row, sourceId: null })).toThrow(AdminActionError);
  });
});

describe("packSourceFor", () => {
  it("keeps the source's type, trust and date for the pack's registry", () => {
    expect(packSourceFor(SOURCE)).toMatchObject({
      id: SOURCE.id,
      type: "official",
      trust: 5,
      retrieved_at: "2026-10-20",
    });
  });
});

describe("allowedHosts (§14.6 URL allowlist)", () => {
  it("is the website's host with and without www, plus the official URLs' hosts", () => {
    expect(
      allowedHosts("https://www.halvorsen.example", [
        { url: "https://apply.halvorsen.example/deadlines" },
        { url: "ftp://files.halvorsen.example/x" },
      ]),
    ).toEqual(["apply.halvorsen.example", "halvorsen.example", "www.halvorsen.example"]);
  });

  it("allows nothing when the school has no website or official URLs", () => {
    expect(allowedHosts(null, [])).toEqual([]);
  });

  it("reads official URLs from any draft shape", () => {
    expect(
      officialUrlsOf({ official_urls: [{ kind: "deadlines", url: "https://a.example" }, 3] }),
    ).toEqual([{ kind: "deadlines", url: "https://a.example" }]);
    expect(officialUrlsOf(null)).toEqual([]);
  });
});

describe("console copy and front matter", () => {
  it("names how many fields still need a decision", () => {
    expect(pendingLabel(1)).toBe("1 field still needs a decision");
    expect(pendingLabel(3)).toBe("3 fields still need a decision");
  });

  it("stamps the front matter's version", () => {
    const doc = "---\nslug: x\nversion: 1\n---\n\n# X\n";
    expect(withFrontMatterVersion(doc, 4)).toBe("---\nslug: x\nversion: 4\n---\n\n# X\n");
    expect(withFrontMatterVersion("---\nslug: x\n---\nbody", 2)).toBe(
      "---\nslug: x\nversion: 2\n---\nbody",
    );
  });
});
