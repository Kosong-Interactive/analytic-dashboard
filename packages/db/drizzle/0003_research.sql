CREATE TYPE "public"."research_run_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "market_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"opportunity_key" text NOT NULL,
	"dimensions" jsonb NOT NULL,
	"member_count" integer NOT NULL,
	"score" numeric(5, 2),
	"reason" text,
	"weight_coverage" numeric(4, 3) NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"confidence_band" text NOT NULL,
	"insight_type" text,
	"components" jsonb NOT NULL,
	"facts" jsonb NOT NULL,
	"comparables" jsonb NOT NULL,
	"positives" jsonb NOT NULL,
	"counter_signals" jsonb NOT NULL,
	"caveats" jsonb NOT NULL,
	CONSTRAINT "market_opportunities_score_range_chk" CHECK ("market_opportunities"."score" is null or ("market_opportunities"."score" >= 0 and "market_opportunities"."score" <= 100))
);
--> statement-breakpoint
ALTER TABLE "market_opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formula_version" text NOT NULL,
	"taxonomy_version" text NOT NULL,
	"store" "store" NOT NULL,
	"country" varchar(2) NOT NULL,
	"window_days" integer NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"input_hash" text NOT NULL,
	"status" "research_run_status" NOT NULL,
	"tracked_games" integer NOT NULL,
	"cohorts_evaluated" integer NOT NULL,
	"opportunities_scored" integer NOT NULL,
	"history_days" numeric(6, 2),
	"freshness" text NOT NULL,
	"error_sample" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_runs_country_lowercase_chk" CHECK ("research_runs"."country" = lower("research_runs"."country"))
);
--> statement-breakpoint
ALTER TABLE "research_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "market_opportunities" ADD CONSTRAINT "market_opportunities_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "market_opportunities_run_key_uidx" ON "market_opportunities" USING btree ("run_id","opportunity_key");--> statement-breakpoint
CREATE INDEX "market_opportunities_run_score_idx" ON "market_opportunities" USING btree ("run_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "research_runs_input_uidx" ON "research_runs" USING btree ("formula_version","taxonomy_version","store","country","input_hash");--> statement-breakpoint
CREATE INDEX "research_runs_latest_idx" ON "research_runs" USING btree ("store","country","formula_version","as_of");