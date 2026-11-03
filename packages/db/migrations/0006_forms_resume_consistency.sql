CREATE TABLE "consistency_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"finding_id" text NOT NULL,
	CONSTRAINT "consistency_dismissals_user_finding_unique" UNIQUE("user_id","finding_id")
);
--> statement-breakpoint
CREATE TABLE "form_advice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"content" jsonb NOT NULL,
	"edits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trimmed" text[] DEFAULT '{}' NOT NULL,
	"dossier_snapshot_version" integer NOT NULL,
	"pack_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "form_advice_kit_unique" UNIQUE("kit_id")
);
--> statement-breakpoint
CREATE TABLE "resume_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"decisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"use_suggested_order" boolean DEFAULT true NOT NULL,
	"dossier_snapshot_version" integer NOT NULL,
	CONSTRAINT "resume_reviews_source_unique" UNIQUE("source_id")
);
--> statement-breakpoint
ALTER TABLE "consistency_dismissals" ADD CONSTRAINT "consistency_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_advice" ADD CONSTRAINT "form_advice_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_advice" ADD CONSTRAINT "form_advice_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_reviews" ADD CONSTRAINT "resume_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_reviews" ADD CONSTRAINT "resume_reviews_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_advice_user_id_idx" ON "form_advice" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_reviews_user_id_idx" ON "resume_reviews" USING btree ("user_id");