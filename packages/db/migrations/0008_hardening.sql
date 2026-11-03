CREATE TABLE "account_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"reason" text,
	"provider_txn_ids" text[] DEFAULT '{}' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "admin_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"emailed_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	CONSTRAINT "admin_alerts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "break_glass_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eval_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rater_id" uuid,
	"sample_kind" text NOT NULL,
	"eval_sample_id" uuid,
	"draft_id" uuid,
	"user_id" uuid,
	"score" integer NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"week" text NOT NULL,
	CONSTRAINT "eval_ratings_rater_sample_unique" UNIQUE("rater_id","eval_sample_id"),
	CONSTRAINT "eval_ratings_rater_draft_unique" UNIQUE("rater_id","draft_id")
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"prompt_version_id" uuid,
	"canon_doc_id" uuid,
	"fingerprint" text NOT NULL,
	"metrics" jsonb,
	"gate" jsonb,
	"cost_usd" numeric(10, 5) DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_reason" text,
	"triggered_by" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "eval_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"task" text NOT NULL,
	"fixture" text NOT NULL,
	"output" jsonb,
	"judgement" jsonb,
	"invented" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"must_fix" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 5) DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"passed" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_switches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"message" text,
	"reason" text,
	"updated_by" uuid,
	CONSTRAINT "feature_switches_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "route_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"task" text NOT NULL,
	"override" jsonb NOT NULL,
	"reason" text NOT NULL,
	"set_by" uuid,
	CONSTRAINT "route_overrides_task_unique" UNIQUE("task")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "handled_by" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_alerts" ADD CONSTRAINT "admin_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_ratings" ADD CONSTRAINT "eval_ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_ratings" ADD CONSTRAINT "eval_ratings_eval_sample_id_eval_samples_id_fk" FOREIGN KEY ("eval_sample_id") REFERENCES "public"."eval_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_ratings" ADD CONSTRAINT "eval_ratings_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_ratings" ADD CONSTRAINT "eval_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_canon_doc_id_canon_docs_id_fk" FOREIGN KEY ("canon_doc_id") REFERENCES "public"."canon_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_samples" ADD CONSTRAINT "eval_samples_run_id_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_switches" ADD CONSTRAINT "feature_switches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_overrides" ADD CONSTRAINT "route_overrides_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_deletions_user_idx" ON "account_deletions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletions_status_idx" ON "account_deletions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_alerts_open_idx" ON "admin_alerts" USING btree ("acknowledged_at","last_at");--> statement-breakpoint
CREATE INDEX "break_glass_grants_user_idx" ON "break_glass_grants" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "eval_ratings_week_idx" ON "eval_ratings" USING btree ("week");--> statement-breakpoint
CREATE INDEX "eval_runs_created_at_idx" ON "eval_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "eval_runs_prompt_version_idx" ON "eval_runs" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "eval_samples_run_id_idx" ON "eval_samples" USING btree ("run_id");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status","created_at");