CREATE TABLE "opportunity_research_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"brief" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_research_briefs_tokens_nonnegative_chk" CHECK ("opportunity_research_briefs"."input_tokens" >= 0 and "opportunity_research_briefs"."output_tokens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "opportunity_research_briefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunity_research_briefs" ADD CONSTRAINT "opportunity_research_briefs_opportunity_id_market_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."market_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_research_briefs_input_uidx" ON "opportunity_research_briefs" USING btree ("opportunity_id","prompt_version","input_hash");--> statement-breakpoint
CREATE INDEX "opportunity_research_briefs_latest_idx" ON "opportunity_research_briefs" USING btree ("opportunity_id","created_at");