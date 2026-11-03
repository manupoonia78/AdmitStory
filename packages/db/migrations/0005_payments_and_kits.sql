CREATE TYPE "public"."checkout_status" AS ENUM('open', 'completed', 'failed', 'mismatch');--> statement-breakpoint
CREATE TYPE "public"."entitlement_kind" AS ENUM('school_kit', 'expert_session');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('completed', 'partially_refunded', 'refunded', 'chargeback');--> statement-breakpoint
CREATE TYPE "public"."angle_label" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."authorship_mode" AS ENUM('draft', 'coach', 'talking_points');--> statement-breakpoint
CREATE TYPE "public"."check_severity" AS ENUM('must', 'should', 'consider');--> statement-breakpoint
CREATE TYPE "public"."check_source" AS ENUM('linter', 'critic');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('open', 'fixed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('pending', 'drafting', 'draft_ready', 'needs_you', 'final');--> statement-breakpoint
CREATE TYPE "public"."deliverable_type" AS ENUM('essay', 'short_answer', 'goal_field', 'video', 'form_section', 'lor_question', 'interview_question');--> statement-breakpoint
CREATE TYPE "public"."draft_author" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."kit_stage_key" AS ENUM('context', 'positioning', 'file_map', 'gaps', 'angles', 'drafts', 'short_form', 'checks', 'forms', 'verify');--> statement-breakpoint
CREATE TYPE "public"."kit_stage_status" AS ENUM('pending', 'running', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."limit_kind" AS ENUM('words', 'chars_incl_spaces', 'chars_excl_spaces');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('open', 'answered', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('pending', 'ready', 'accepted', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verify_status" AS ENUM('open', 'confirmed', 'corrected');--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_checkout_id" text NOT NULL,
	"product_key" text NOT NULL,
	"school_cycle_id" uuid NOT NULL,
	"user_school_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "checkout_status" DEFAULT 'open' NOT NULL,
	CONSTRAINT "checkouts_provider_checkout_id_unique" UNIQUE("provider_checkout_id")
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "entitlement_kind" NOT NULL,
	"ref_id" uuid NOT NULL,
	"purchase_id" uuid,
	"limits" jsonb NOT NULL,
	"used" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	CONSTRAINT "entitlements_purchase_id_unique" UNIQUE("purchase_id")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_txn_id" text NOT NULL,
	"product_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "purchase_status" DEFAULT 'completed' NOT NULL,
	"discount_id" text,
	"raw" jsonb,
	CONSTRAINT "purchases_provider_txn_id_unique" UNIQUE("provider_txn_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" text,
	"detail" text,
	CONSTRAINT "webhook_events_provider_event_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "angles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"label" "angle_label" NOT NULL,
	"pitch" text NOT NULL,
	"opening" text NOT NULL,
	"stories" text[] DEFAULT '{}'::text[] NOT NULL,
	"beats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proves" text[] DEFAULT '{}'::text[] NOT NULL,
	"tradeoffs" text[] DEFAULT '{}'::text[] NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "angles_deliverable_label_unique" UNIQUE("deliverable_id","label")
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"source" "check_source" NOT NULL,
	"rule_id" text NOT NULL,
	"severity" "check_severity" NOT NULL,
	"location" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"fix_hint" text,
	"patch" jsonb,
	"status" "check_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" uuid NOT NULL,
	"type" "deliverable_type" NOT NULL,
	"pack_key" text NOT NULL,
	"title" text,
	"prompt_text" text NOT NULL,
	"limit_kind" "limit_kind",
	"limit_value" integer,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"status" "deliverable_status" DEFAULT 'pending' NOT NULL,
	"authorship_mode" "authorship_mode" DEFAULT 'draft' NOT NULL,
	CONSTRAINT "deliverables_kit_pack_key_unique" UNIQUE("kit_id","pack_key")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"angle_id" uuid,
	"version" integer NOT NULL,
	"author" "draft_author" NOT NULL,
	"content" jsonb NOT NULL,
	"plain_text" text NOT NULL,
	"word_count" integer NOT NULL,
	"char_count_incl" integer NOT NULL,
	"char_count_excl" integer NOT NULL,
	"voice_fidelity" numeric(5, 4),
	"parent_draft_id" uuid,
	"note" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"stale_reason" text,
	"locked_paragraphs" text[] DEFAULT '{}'::text[] NOT NULL,
	"user_edited_paragraphs" text[] DEFAULT '{}'::text[] NOT NULL,
	"used_fact_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"used_story_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"marked_final_at" timestamp with time zone,
	CONSTRAINT "drafts_deliverable_version_unique" UNIQUE("deliverable_id","version")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"rating" integer,
	"reason" text,
	"text" text
);
--> statement-breakpoint
CREATE TABLE "kit_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" uuid NOT NULL,
	"stage" "kit_stage_key" NOT NULL,
	"ordinal" integer NOT NULL,
	"status" "kit_stage_status" DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "kit_stages_kit_stage_unique" UNIQUE("kit_id","stage")
);
--> statement-breakpoint
CREATE TABLE "need_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" uuid NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"draft_id" uuid,
	"paragraph_id" text,
	"after_sentence" integer,
	"question" text NOT NULL,
	"approx_words" integer,
	"blocking" boolean DEFAULT false NOT NULL,
	"status" "need_status" DEFAULT 'open' NOT NULL,
	"answer_source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "revision_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"instruction" text NOT NULL,
	"quick_action" text,
	"target_paragraphs" text[] DEFAULT '{}'::text[] NOT NULL,
	"result_draft_id" uuid,
	"status" "revision_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "verify_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" uuid NOT NULL,
	"deliverable_id" uuid,
	"draft_id" uuid,
	"text" text NOT NULL,
	"reason" text NOT NULL,
	"cites" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text,
	"status" "verify_status" DEFAULT 'open' NOT NULL,
	"correction" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kits" ADD COLUMN "stage" jsonb;--> statement-breakpoint
ALTER TABLE "kits" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kits" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kits" ADD COLUMN "regenerations" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kits" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_school_cycle_id_school_cycles_id_fk" FOREIGN KEY ("school_cycle_id") REFERENCES "public"."school_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_user_school_id_user_schools_id_fk" FOREIGN KEY ("user_school_id") REFERENCES "public"."user_schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "angles" ADD CONSTRAINT "angles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "angles" ADD CONSTRAINT "angles_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_angle_id_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."angles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_parent_draft_id_drafts_id_fk" FOREIGN KEY ("parent_draft_id") REFERENCES "public"."drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_stages" ADD CONSTRAINT "kit_stages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_stages" ADD CONSTRAINT "kit_stages_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_answer_source_id_sources_id_fk" FOREIGN KEY ("answer_source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_result_draft_id_drafts_id_fk" FOREIGN KEY ("result_draft_id") REFERENCES "public"."drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_items" ADD CONSTRAINT "verify_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_items" ADD CONSTRAINT "verify_items_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_items" ADD CONSTRAINT "verify_items_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_items" ADD CONSTRAINT "verify_items_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkouts_user_id_idx" ON "checkouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entitlements_user_id_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_one_active" ON "entitlements" USING btree ("user_id","kind","ref_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "purchases_user_id_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "angles_user_id_idx" ON "angles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "checks_draft_idx" ON "checks" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "checks_user_id_idx" ON "checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deliverables_user_id_idx" ON "deliverables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drafts_user_id_idx" ON "drafts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_one_current_per_deliverable" ON "drafts" USING btree ("deliverable_id") WHERE is_current;--> statement-breakpoint
CREATE INDEX "drafts_used_fact_codes_idx" ON "drafts" USING gin ("used_fact_codes");--> statement-breakpoint
CREATE INDEX "drafts_used_story_codes_idx" ON "drafts" USING gin ("used_story_codes");--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_target_idx" ON "feedback" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "kit_stages_user_id_idx" ON "kit_stages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "need_items_deliverable_idx" ON "need_items" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "need_items_user_id_idx" ON "need_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revision_requests_draft_idx" ON "revision_requests" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "revision_requests_user_id_idx" ON "revision_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verify_items_kit_idx" ON "verify_items" USING btree ("kit_id");--> statement-breakpoint
CREATE INDEX "verify_items_user_id_idx" ON "verify_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kits_one_full_per_user_school" ON "kits" USING btree ("user_school_id") WHERE status <> 'preview';