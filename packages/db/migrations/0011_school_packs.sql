ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_purchase_id_unique";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "schools" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "entitlements_purchase_id_idx" ON "entitlements" USING btree ("purchase_id");