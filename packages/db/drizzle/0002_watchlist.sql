CREATE TYPE "public"."watchlist_status" AS ENUM('watching', 'priority', 'archived');--> statement-breakpoint
CREATE TABLE "watchlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_app_id" uuid NOT NULL,
	"status" "watchlist_status" DEFAULT 'watching' NOT NULL,
	"note" text,
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"baseline_captured_at" timestamp with time zone,
	"baseline_rating" numeric(3, 2),
	"baseline_rating_count" bigint,
	CONSTRAINT "watchlist_entries_note_length_chk" CHECK ("watchlist_entries"."note" is null or char_length("watchlist_entries"."note") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "watchlist_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_store_app_id_store_apps_id_fk" FOREIGN KEY ("store_app_id") REFERENCES "public"."store_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_entries_store_app_uidx" ON "watchlist_entries" USING btree ("store_app_id");--> statement-breakpoint
CREATE INDEX "watchlist_entries_status_idx" ON "watchlist_entries" USING btree ("status");