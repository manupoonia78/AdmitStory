ALTER TYPE "public"."source_kind" ADD VALUE 'recommender_intake';--> statement-breakpoint
CREATE TABLE "lor_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"group_key" text NOT NULL,
	"school_cycle_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text NOT NULL,
	"content" jsonb,
	"meta" jsonb,
	"input_hash" text,
	"plan_version" integer,
	"dossier_snapshot_version" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"charged_ref_id" uuid,
	"error" text,
	"built_at" timestamp with time zone,
	CONSTRAINT "lor_briefs_recommender_group_unique" UNIQUE("recommender_id","group_key")
);
--> statement-breakpoint
CREATE TABLE "lor_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"dossier_snapshot_version" integer NOT NULL,
	CONSTRAINT "lor_plans_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "lor_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"code" text NOT NULL,
	"fields" jsonb NOT NULL,
	"origin" text NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lor_stories_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "recommender_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"previous_token_hash" text,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_opened_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"send_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "recommender_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "recommender_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"deadline" date NOT NULL,
	"school_cycle_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"send_on" date NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"note" text,
	"preview_hash" text,
	"previewed_at" timestamp with time zone,
	"enabled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"skipped_reason" text,
	"delivery_id" text,
	CONSTRAINT "recommender_reminders_recommender_kind_deadline_unique" UNIQUE("recommender_id","kind","deadline")
);
--> statement-breakpoint
CREATE TABLE "recommender_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"invite_id" uuid,
	"email_hash" text NOT NULL,
	"private_notes_encrypted" text,
	"letter_draft_encrypted" text,
	"voice_encrypted" text,
	"opened_at" timestamp with time zone,
	"progress_at" timestamp with time zone,
	"submitted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assist_count" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"prefer_coach" boolean DEFAULT false NOT NULL,
	CONSTRAINT "recommender_workspaces_recommender_email_unique" UNIQUE("recommender_id","email_hash")
);
--> statement-breakpoint
CREATE TABLE "recommenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"title" text,
	"organisation" text,
	"relationship" text NOT NULL,
	"duration_text" text,
	"frequency_text" text,
	"user_school_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"intake" jsonb,
	"intake_source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "recommenders_user_ref_unique" UNIQUE("user_id","ref")
);
--> statement-breakpoint
ALTER TABLE "lor_briefs" ADD CONSTRAINT "lor_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lor_briefs" ADD CONSTRAINT "lor_briefs_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lor_plans" ADD CONSTRAINT "lor_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lor_stories" ADD CONSTRAINT "lor_stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lor_stories" ADD CONSTRAINT "lor_stories_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_invites" ADD CONSTRAINT "recommender_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_invites" ADD CONSTRAINT "recommender_invites_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_reminders" ADD CONSTRAINT "recommender_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_reminders" ADD CONSTRAINT "recommender_reminders_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_workspaces" ADD CONSTRAINT "recommender_workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_workspaces" ADD CONSTRAINT "recommender_workspaces_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_workspaces" ADD CONSTRAINT "recommender_workspaces_invite_id_recommender_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."recommender_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommenders" ADD CONSTRAINT "recommenders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lor_briefs_user_id_idx" ON "lor_briefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lor_stories_recommender_id_idx" ON "lor_stories" USING btree ("recommender_id");--> statement-breakpoint
CREATE INDEX "recommender_invites_previous_token_hash_idx" ON "recommender_invites" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE INDEX "recommender_invites_recommender_id_idx" ON "recommender_invites" USING btree ("recommender_id");--> statement-breakpoint
CREATE INDEX "recommender_invites_user_id_idx" ON "recommender_invites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommender_reminders_status_send_at_idx" ON "recommender_reminders" USING btree ("status","send_at");--> statement-breakpoint
CREATE INDEX "recommender_reminders_user_id_idx" ON "recommender_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommender_workspaces_user_id_idx" ON "recommender_workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommenders_user_id_idx" ON "recommenders" USING btree ("user_id");