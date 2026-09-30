CREATE TYPE "public"."opportunity_decision_status" AS ENUM('shortlisted', 'rejected', 'prototype');--> statement-breakpoint
CREATE TABLE "opportunity_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"status" "opportunity_decision_status" NOT NULL,
	"note" text,
	"owner" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_decisions_note_length_chk" CHECK ("opportunity_decisions"."note" is null or char_length("opportunity_decisions"."note") <= 2000),
	CONSTRAINT "opportunity_decisions_owner_length_chk" CHECK ("opportunity_decisions"."owner" is null or char_length("opportunity_decisions"."owner") <= 200)
);
--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_opportunity_id_market_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."market_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_decisions_opportunity_created_idx" ON "opportunity_decisions" USING btree ("opportunity_id","created_at");