CREATE TABLE "desktop_opportunity_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) NOT NULL,
	"label_type" "label_type" NOT NULL,
	"label_slug" text NOT NULL,
	"label_display_name" text NOT NULL,
	"formula_version" text NOT NULL,
	"steam_taxonomy_version" text NOT NULL,
	"mobile_taxonomy_version" text NOT NULL,
	"status" "opportunity_decision_status" NOT NULL,
	"note" text,
	"owner" text,
	"actor" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "desktop_opportunity_decisions_country_lowercase_chk" CHECK ("desktop_opportunity_decisions"."country" = lower("desktop_opportunity_decisions"."country")),
	CONSTRAINT "desktop_opportunity_decisions_note_length_chk" CHECK ("desktop_opportunity_decisions"."note" is null or char_length("desktop_opportunity_decisions"."note") <= 2000),
	CONSTRAINT "desktop_opportunity_decisions_owner_length_chk" CHECK ("desktop_opportunity_decisions"."owner" is null or char_length("desktop_opportunity_decisions"."owner") <= 200)
);
--> statement-breakpoint
ALTER TABLE "desktop_opportunity_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "desktop_opportunity_decisions_identity_created_idx" ON "desktop_opportunity_decisions" USING btree ("country","label_type","label_slug","created_at");