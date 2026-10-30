import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

export const studioModes = ["express", "standard", "deep"] as const;
export const studioModeEnum = pgEnum("studio_mode", studioModes);

export const appRoles = ["applicant", "expert", "guide", "admin"] as const;
export const appRoleEnum = pgEnum("app_role", appRoles);

export type StudioMode = (typeof studioModes)[number];
export type AppRole = (typeof appRoles)[number];

/** Section scores keyed by section name, e.g. { quant: 85, verbal: 84 }. */
export type TestBreakdown = Record<string, number>;

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const profiles = pgTable("profiles", {
  ...baseColumns(),
  // The unique constraint doubles as the §10 user_id index.
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  country: text("country"),
  timezone: text("timezone"),
  programType: text("program_type").notNull().default("full_time_mba"),
  targetIntake: integer("target_intake"),
  yearsExperience: numeric("years_experience", { precision: 4, scale: 1, mode: "number" }),
  testType: text("test_type"),
  testScore: integer("test_score"),
  testBreakdown: jsonb("test_breakdown").$type<TestBreakdown>(),
  gpa: numeric("gpa", { precision: 6, scale: 2, mode: "number" }),
  gpaScale: numeric("gpa_scale", { precision: 6, scale: 2, mode: "number" }),
  languages: text("languages")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  studioMode: studioModeEnum("studio_mode"),
  readAloud: boolean("read_aloud").notNull().default(true),
  toneSetting: text("tone_setting"),
  // Spec §14.4: raw audio is not stored unless the user opts in.
  keepAudio: boolean("keep_audio").notNull().default(false),
  // Spec §10 names this improve_folio_opt_in; kept brand-neutral so a rename never needs a migration.
  improveProductOptIn: boolean("improve_product_opt_in").notNull().default(false),
  // Spec §14.4 (18+) and §14.7 (terms), captured at sign-up.
  ageConfirmedAt: timestamptz("age_confirmed_at"),
  termsVersion: text("terms_version"),
  termsAcceptedAt: timestamptz("terms_accepted_at"),

  // The rest of §10's profile columns, added in Phase 1 because they were not needed before.
  /** Voiceprint identity parameters (§6.2). Derived numbers only; no audio is stored. */
  voiceprint: jsonb("voiceprint").$type<VoiceprintIdentity>(),
  /** One of the 12 tuned hues; the applicant may swap it in Settings (§6.3). */
  voiceprintHue: integer("voiceprint_hue"),
  /** `night` | `day` | `system`. The theme cookie stays as the no-flash fast path. */
  theme: text("theme").notNull().default("system"),
  uiSounds: boolean("ui_sounds").notNull().default(false),

  /**
   * First-run additions (§5.1). `targetRounds` is a hint from "rounds if known" — the real
   * per-school round lives on `user_schools` in Phase 3. The applicant's one-line current role
   * is not here: it becomes a Fact Sheet fact, so it is never asked twice (§2, "tell it once").
   */
  targetRounds: text("target_rounds")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  firstRunCompletedAt: timestamptz("first_run_completed_at"),
});

/**
 * Identity parameters computed once from the applicant's speech, or seeded from their writing when
 * they never speak (spec §6.2). These few numbers are all that is needed to render a Voiceprint;
 * the audio they came from is not kept. The shape is `VoiceprintIdentity` from packages/ui, which
 * owns the contract — kept structurally here so packages/db does not depend on the UI.
 */
export interface VoiceprintIdentity {
  version: 1;
  avgPitchHz: number;
  paceWpm: number;
  pitchRangeSemitones: number;
  /** How regularly the speaker pauses, 0 (even) to 1 (irregular). */
  pauseRhythm: number;
  /** `text` when seeded from writing, `default` before there is anything to go on. */
  source: "voice" | "text" | "default";
}

export const roles = pgTable(
  "roles",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
  },
  // Leading user_id column makes this the §10 user_id index as well.
  (t) => [unique("roles_user_id_role_unique").on(t.userId, t.role)],
);
