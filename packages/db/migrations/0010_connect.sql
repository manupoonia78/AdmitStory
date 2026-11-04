CREATE TABLE "connect_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author" text NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connect_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"school_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"relation" text NOT NULL,
	"class_year" integer,
	"headline" text DEFAULT '' NOT NULL,
	"location" text,
	"bio" text DEFAULT '' NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"photo_url" text,
	"linkedin_url" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"consented_at" timestamp with time zone,
	"guide_user_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "connect_people_school_linkedin_unique" UNIQUE("school_id","linkedin_url")
);
--> statement-breakpoint
CREATE TABLE "connect_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applicant_read_at" timestamp with time zone,
	"person_read_at" timestamp with time zone,
	CONSTRAINT "connect_threads_user_person_unique" UNIQUE("user_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "connect_messages" ADD CONSTRAINT "connect_messages_thread_id_connect_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."connect_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_messages" ADD CONSTRAINT "connect_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_people" ADD CONSTRAINT "connect_people_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_people" ADD CONSTRAINT "connect_people_guide_user_id_users_id_fk" FOREIGN KEY ("guide_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_threads" ADD CONSTRAINT "connect_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_threads" ADD CONSTRAINT "connect_threads_person_id_connect_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."connect_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connect_messages_thread_idx" ON "connect_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "connect_people_school_idx" ON "connect_people" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "connect_people_guide_idx" ON "connect_people" USING btree ("guide_user_id");--> statement-breakpoint
CREATE INDEX "connect_threads_user_idx" ON "connect_threads" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "connect_threads_person_idx" ON "connect_threads" USING btree ("person_id","last_message_at");