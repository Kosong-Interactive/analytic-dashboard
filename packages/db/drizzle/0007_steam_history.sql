CREATE TABLE "steam_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"developer_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"publisher_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"release_state" text NOT NULL,
	"release_date" timestamp with time zone,
	"supports_windows" boolean NOT NULL,
	"supports_macos" boolean NOT NULL,
	"supports_linux" boolean NOT NULL,
	"is_free" boolean NOT NULL,
	"header_image_url" text,
	"store_url" text NOT NULL,
	"source" text NOT NULL,
	"metadata_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_apps_external_id_chk" CHECK ("steam_apps"."external_id" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "steam_apps_release_state_chk" CHECK ("steam_apps"."release_state" in ('released', 'early_access', 'upcoming', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "steam_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steam_chart_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_app_id" uuid NOT NULL,
	"chart" text NOT NULL,
	"rank" integer NOT NULL,
	"last_week_rank" integer,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_chart_entries_chart_chk" CHECK ("steam_chart_entries"."chart" in ('top_sellers', 'most_played', 'steam_deck')),
	CONSTRAINT "steam_chart_entries_rank_chk" CHECK ("steam_chart_entries"."rank" between 1 and 100 and ("steam_chart_entries"."last_week_rank" is null or "steam_chart_entries"."last_week_rank" >= 1))
);
--> statement-breakpoint
ALTER TABLE "steam_chart_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steam_collector_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"status" "collector_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_sample" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_collector_runs_counts_nonnegative_chk" CHECK ("steam_collector_runs"."discovered_count" >= 0 and "steam_collector_runs"."changed_count" >= 0 and "steam_collector_runs"."retry_count" >= 0 and "steam_collector_runs"."error_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "steam_collector_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steam_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_app_id" uuid NOT NULL,
	"country" varchar(2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"initial_price" numeric(14, 2) NOT NULL,
	"final_price" numeric(14, 2) NOT NULL,
	"discount_percent" smallint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_prices_country_lowercase_chk" CHECK ("steam_prices"."country" = lower("steam_prices"."country")),
	CONSTRAINT "steam_prices_currency_uppercase_chk" CHECK ("steam_prices"."currency" = upper("steam_prices"."currency")),
	CONSTRAINT "steam_prices_values_chk" CHECK ("steam_prices"."initial_price" >= 0 and "steam_prices"."final_price" >= 0 and "steam_prices"."final_price" <= "steam_prices"."initial_price"
        and "steam_prices"."discount_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "steam_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steam_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_app_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"review_positive" bigint,
	"review_negative" bigint,
	"review_total" bigint,
	"reviews_captured_at" timestamp with time zone,
	"review_purchase_scope" text,
	"review_language_scope" text[],
	"review_off_topic_filtered" boolean,
	"current_players" bigint,
	"players_captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_snapshots_reviews_group_chk" CHECK (("steam_snapshots"."review_total" is null and "steam_snapshots"."review_positive" is null and "steam_snapshots"."review_negative" is null and "steam_snapshots"."reviews_captured_at" is null)
        or ("steam_snapshots"."review_positive" >= 0 and "steam_snapshots"."review_negative" >= 0
            and "steam_snapshots"."review_total" = "steam_snapshots"."review_positive" + "steam_snapshots"."review_negative"
            and "steam_snapshots"."reviews_captured_at" is not null and "steam_snapshots"."review_purchase_scope" is not null)),
	CONSTRAINT "steam_snapshots_players_group_chk" CHECK (("steam_snapshots"."current_players" is null and "steam_snapshots"."players_captured_at" is null)
        or ("steam_snapshots"."current_players" >= 0 and "steam_snapshots"."players_captured_at" is not null)),
	CONSTRAINT "steam_snapshots_has_signal_chk" CHECK ("steam_snapshots"."review_total" is not null or "steam_snapshots"."current_players" is not null)
);
--> statement-breakpoint
ALTER TABLE "steam_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steam_chart_entries" ADD CONSTRAINT "steam_chart_entries_steam_app_id_steam_apps_id_fk" FOREIGN KEY ("steam_app_id") REFERENCES "public"."steam_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_prices" ADD CONSTRAINT "steam_prices_steam_app_id_steam_apps_id_fk" FOREIGN KEY ("steam_app_id") REFERENCES "public"."steam_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_snapshots" ADD CONSTRAINT "steam_snapshots_steam_app_id_steam_apps_id_fk" FOREIGN KEY ("steam_app_id") REFERENCES "public"."steam_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "steam_apps_external_id_uidx" ON "steam_apps" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "steam_apps_release_date_idx" ON "steam_apps" USING btree ("release_date");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_chart_entries_observation_uidx" ON "steam_chart_entries" USING btree ("steam_app_id","chart","captured_at");--> statement-breakpoint
CREATE INDEX "steam_chart_entries_chart_captured_idx" ON "steam_chart_entries" USING btree ("chart","captured_at");--> statement-breakpoint
CREATE INDEX "steam_collector_runs_health_idx" ON "steam_collector_runs" USING btree ("job_type","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_prices_observation_uidx" ON "steam_prices" USING btree ("steam_app_id","country","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_snapshots_app_captured_uidx" ON "steam_snapshots" USING btree ("steam_app_id","captured_at");--> statement-breakpoint
CREATE INDEX "steam_snapshots_captured_at_idx" ON "steam_snapshots" USING btree ("captured_at");