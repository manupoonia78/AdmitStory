-- pgvector for kb_chunks.embedding (spec §8.9). Added by hand: drizzle-kit does not emit extensions.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."ai_stance" AS ENUM('permitted', 'permitted_with_disclosure', 'limited', 'prohibited', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."cycle_status" AS ENUM('draft', 'live', 'archived');--> statement-breakpoint
CREATE TYPE "public"."kb_source_status" AS ENUM('pending', 'extracting', 'embedding', 'normalizing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."kb_source_type" AS ENUM('official', 'adcom', 'insider', 'interview_reports', 'coach_notes', 'third_party_reference', 'press');--> statement-breakpoint
CREATE TYPE "public"."pack_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."kb_proposal_status" AS ENUM('pending', 'accepted', 'rejected', 'edited');--> statement-breakpoint
CREATE TYPE "public"."school_region" AS ENUM('us', 'europe', 'asia_other');--> statement-breakpoint
CREATE TYPE "public"."kit_status" AS ENUM('preview', 'pending', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_school_status" AS ENUM('considering', 'preview', 'unlocked', 'submitted', 'interview', 'admitted', 'waitlisted', 'denied', 'withdrawn');--> statement-breakpoint
CREATE TABLE "ai_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school_cycle_id" uuid NOT NULL,
	"stance" "ai_stance" DEFAULT 'unknown' NOT NULL,
	"applies_to" text[] DEFAULT '{}'::text[] NOT NULL,
	"disclosure_text" text,
	"source_url" text,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"notes" text,
	CONSTRAINT "ai_policies_school_cycle_id_unique" UNIQUE("school_cycle_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"reason" text,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canon_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"rule_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	CONSTRAINT "canon_docs_slug_version_unique" UNIQUE("slug","version")
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"school_id" uuid,
	"cycle" text,
	"ord" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1024),
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english'::regconfig, "text")) STORED,
	"meta" jsonb,
	CONSTRAINT "kb_chunks_source_ord_unique" UNIQUE("source_id","ord")
);
--> statement-breakpoint
CREATE TABLE "kb_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid,
	"cycle_id" uuid NOT NULL,
	"pack_id" uuid,
	"field_path" text NOT NULL,
	"proposed" jsonb NOT NULL,
	"current" jsonb,
	"confidence" numeric(4, 3) NOT NULL,
	"evidence" jsonb,
	"status" "kb_proposal_status" DEFAULT 'pending' NOT NULL,
	"edited" jsonb,
	"conflict" jsonb,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kb_refresh_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school_cycle_id" uuid NOT NULL,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school_id" uuid,
	"cycle" text,
	"type" "kb_source_type" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"file_key" text,
	"trust" integer NOT NULL,
	"rights_note" text,
	"added_by" uuid,
	"text_encrypted" text,
	"content_hash" text,
	"verified_at" timestamp with time zone,
	"status" "kb_source_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"agent" text NOT NULL,
	"version" text NOT NULL,
	"template" text NOT NULL,
	"route_override" jsonb,
	"active" boolean DEFAULT false NOT NULL,
	"ab_weight" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "prompt_versions_agent_version_unique" UNIQUE("agent","version")
);
--> statement-breakpoint
CREATE TABLE "school_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school_id" uuid NOT NULL,
	"cycle" text NOT NULL,
	"status" "cycle_status" DEFAULT 'draft' NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "school_cycles_school_cycle_unique" UNIQUE("school_id","cycle")
);
--> statement-breakpoint
CREATE TABLE "school_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "pack_status" DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"compiled_prompt" text,
	"token_count" integer,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	CONSTRAINT "school_packs_cycle_version_unique" UNIQUE("cycle_id","version")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"country" text,
	"city" text,
	"website" text,
	"logo_key" text,
	"region" "school_region" NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_school_id" uuid NOT NULL,
	"status" "kit_status" DEFAULT 'preview' NOT NULL,
	"positioning" jsonb,
	"file_map" jsonb,
	"gaps" jsonb,
	"pipeline_run_id" text,
	"cost_usd" numeric(10, 5) DEFAULT 0 NOT NULL,
	"dossier_snapshot_version" integer,
	"pack_version" integer
);
--> statement-breakpoint
CREATE TABLE "profile_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"built_from_snapshot_version" integer,
	"model" text,
	CONSTRAINT "profile_reads_user_version_unique" UNIQUE("user_id","version")
);
--> statement-breakpoint
CREATE TABLE "school_interest_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	CONSTRAINT "school_interest_votes_user_school_unique" UNIQUE("user_id","school_id")
);
--> statement-breakpoint
CREATE TABLE "user_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_cycle_id" uuid NOT NULL,
	"round" text,
	"status" "user_school_status" DEFAULT 'considering' NOT NULL,
	"is_reapplicant" boolean DEFAULT false NOT NULL,
	"previous_outcome" text,
	"previous_materials_source_id" uuid,
	"fit" jsonb,
	"fit_pack_version" integer,
	CONSTRAINT "user_schools_user_cycle_unique" UNIQUE("user_id","school_cycle_id")
);
--> statement-breakpoint
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_school_cycle_id_school_cycles_id_fk" FOREIGN KEY ("school_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canon_docs" ADD CONSTRAINT "canon_docs_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_source_id_kb_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."kb_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_proposals" ADD CONSTRAINT "kb_proposals_source_id_kb_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."kb_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_proposals" ADD CONSTRAINT "kb_proposals_cycle_id_school_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_proposals" ADD CONSTRAINT "kb_proposals_pack_id_school_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."school_packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_proposals" ADD CONSTRAINT "kb_proposals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_refresh_snapshots" ADD CONSTRAINT "kb_refresh_snapshots_school_cycle_id_school_cycles_id_fk" FOREIGN KEY ("school_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_sources" ADD CONSTRAINT "kb_sources_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_sources" ADD CONSTRAINT "kb_sources_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_cycles" ADD CONSTRAINT "school_cycles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_packs" ADD CONSTRAINT "school_packs_cycle_id_school_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_packs" ADD CONSTRAINT "school_packs_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_user_school_id_user_schools_id_fk" FOREIGN KEY ("user_school_id") REFERENCES "public"."user_schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reads" ADD CONSTRAINT "profile_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_interest_votes" ADD CONSTRAINT "school_interest_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_interest_votes" ADD CONSTRAINT "school_interest_votes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_schools" ADD CONSTRAINT "user_schools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_schools" ADD CONSTRAINT "user_schools_school_cycle_id_school_cycles_id_fk" FOREIGN KEY ("school_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_schools" ADD CONSTRAINT "user_schools_previous_materials_source_id_sources_id_fk" FOREIGN KEY ("previous_materials_source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "kb_chunks_school_cycle_idx" ON "kb_chunks" USING btree ("school_id","cycle");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_hnsw_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "kb_chunks_tsv_gin_idx" ON "kb_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "kb_proposals_cycle_status_idx" ON "kb_proposals" USING btree ("cycle_id","status");--> statement-breakpoint
CREATE INDEX "kb_proposals_source_idx" ON "kb_proposals" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "kb_refresh_snapshots_cycle_url_idx" ON "kb_refresh_snapshots" USING btree ("school_cycle_id","url","fetched_at");--> statement-breakpoint
CREATE INDEX "kb_sources_school_cycle_idx" ON "kb_sources" USING btree ("school_id","cycle");--> statement-breakpoint
CREATE INDEX "kb_sources_content_hash_idx" ON "kb_sources" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "prompt_versions_agent_active_idx" ON "prompt_versions" USING btree ("agent","active");--> statement-breakpoint
CREATE UNIQUE INDEX "school_packs_one_draft_per_cycle" ON "school_packs" USING btree ("cycle_id") WHERE status = 'draft';--> statement-breakpoint
CREATE INDEX "school_packs_cycle_status_idx" ON "school_packs" USING btree ("cycle_id","status","version");--> statement-breakpoint
CREATE INDEX "kits_user_id_idx" ON "kits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kits_user_school_idx" ON "kits" USING btree ("user_school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kits_one_preview_per_user_school" ON "kits" USING btree ("user_school_id") WHERE status = 'preview';--> statement-breakpoint
CREATE INDEX "school_interest_votes_school_idx" ON "school_interest_votes" USING btree ("school_id");