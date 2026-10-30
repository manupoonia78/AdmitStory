CREATE TYPE "public"."studio_chapter" AS ENUM('roots', 'education', 'work', 'beyond_work', 'turning_points', 'people_and_values', 'goals', 'schools', 'recommenders');--> statement-breakpoint
CREATE TYPE "public"."fact_status" AS ENUM('confirmed', 'needs_confirmation', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."interviewer_move" AS ENUM('DIG', 'NEXT', 'CONFIRM', 'CARE');--> statement-breakpoint
CREATE TYPE "public"."sensitivity" AS ENUM('none', 'personal', 'sensitive');--> statement-breakpoint
CREATE TYPE "public"."slot_state" AS ENUM('empty', 'partial', 'filled');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('voice_turn', 'text_turn', 'upload', 'import', 'conversation_note', 'need_answer');--> statement-breakpoint
CREATE TYPE "public"."story_context" AS ENUM('professional', 'academic', 'community', 'personal');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('confirmed', 'partial', 'unconfirmed');--> statement-breakpoint
CREATE TYPE "public"."studio_session_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."turn_role" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"positioning_line" text,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "brand_user_version_unique" UNIQUE("user_id","version")
);
--> statement-breakpoint
CREATE TABLE "dossier_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"compact_text" text NOT NULL,
	"token_count" integer NOT NULL,
	"built_from" jsonb,
	CONSTRAINT "dossier_snapshots_user_version_unique" UNIQUE("user_id","version")
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"note" text,
	"approved_phrasing" text,
	"status" "fact_status" DEFAULT 'needs_confirmation' NOT NULL,
	"sensitivity" "sensitivity" DEFAULT 'none' NOT NULL,
	"consent_to_use" boolean DEFAULT true NOT NULL,
	"evidence" jsonb,
	"conflict" jsonb,
	CONSTRAINT "facts_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"short_term" text,
	"long_term" text,
	"plan_b" text,
	"why_mba" text,
	"why_now" text,
	CONSTRAINT "goals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "golden_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"story_id" uuid,
	"text" text NOT NULL,
	"english" text,
	"source_id" uuid,
	"span" jsonb,
	"starred" boolean DEFAULT false NOT NULL,
	CONSTRAINT "golden_lines_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"role_in_life" text NOT NULL,
	"may_name" boolean DEFAULT false NOT NULL,
	CONSTRAINT "people_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "slots_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"state" "slot_state" DEFAULT 'empty' NOT NULL,
	"evidence_story_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"last_asked_at" timestamp with time zone,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "slots_state_user_slot_unique" UNIQUE("user_id","slot_key")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "source_kind" NOT NULL,
	"text_encrypted" text,
	"language" text,
	"audio_object_key" text,
	"file_object_key" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"nickname" text NOT NULL,
	"era" text,
	"context" "story_context" DEFAULT 'professional' NOT NULL,
	"chapter" "studio_chapter",
	"situation" text,
	"stakes" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" text,
	"reflection" text,
	"numbers" jsonb,
	"traits" text[] DEFAULT '{}'::text[] NOT NULL,
	"lenses" text[] DEFAULT '{}'::text[] NOT NULL,
	"archetypes" text[] DEFAULT '{}'::text[] NOT NULL,
	"slot_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "story_status" DEFAULT 'unconfirmed' NOT NULL,
	"missing" jsonb,
	"sensitivity" "sensitivity" DEFAULT 'none' NOT NULL,
	"consent_to_use" boolean DEFAULT true NOT NULL,
	"evidence" jsonb,
	"merged_into" uuid,
	"confidence" text,
	CONSTRAINT "stories_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "studio_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"current_chapter" "studio_chapter" DEFAULT 'roots' NOT NULL,
	"status" "studio_session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"openers_asked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "turn_role" NOT NULL,
	"text" text,
	"move" "interviewer_move",
	"slot" text,
	"story_ref" text,
	"source_id" uuid,
	"latency_ms" integer,
	"client_turn_id" text,
	CONSTRAINT "studio_turns_client_turn_id_unique" UNIQUE("user_id","client_turn_id")
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"stats" jsonb,
	"card" text,
	CONSTRAINT "voice_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "voiceprint" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "voiceprint_hue" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "theme" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ui_sounds" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "target_rounds" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "first_run_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_snapshots" ADD CONSTRAINT "dossier_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_lines" ADD CONSTRAINT "golden_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_lines" ADD CONSTRAINT "golden_lines_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_lines" ADD CONSTRAINT "golden_lines_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots_state" ADD CONSTRAINT "slots_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_sessions" ADD CONSTRAINT "studio_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_turns" ADD CONSTRAINT "studio_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_turns" ADD CONSTRAINT "studio_turns_session_id_studio_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."studio_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_turns" ADD CONSTRAINT "studio_turns_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facts_user_key_idx" ON "facts" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "golden_lines_story_idx" ON "golden_lines" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "sources_user_id_idx" ON "sources" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "stories_user_status_idx" ON "stories" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "studio_sessions_user_id_idx" ON "studio_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "studio_turns_session_idx" ON "studio_turns" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "studio_turns_user_id_idx" ON "studio_turns" USING btree ("user_id");