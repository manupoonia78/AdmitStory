ALTER TABLE "profiles" ADD COLUMN "speech_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "tts_voice" text DEFAULT 'warm' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "tts_speed" numeric(3, 2) DEFAULT 1 NOT NULL;