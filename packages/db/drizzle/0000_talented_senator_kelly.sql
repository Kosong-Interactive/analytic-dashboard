CREATE TYPE "public"."collector_run_status" AS ENUM('running', 'succeeded', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."label_source" AS ENUM('rule', 'ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."label_type" AS ENUM('genre', 'subgenre', 'core_mechanic', 'meta_mechanic', 'theme', 'multiplayer_mode', 'monetization_clue');--> statement-breakpoint
CREATE TYPE "public"."store" AS ENUM('app_store', 'google_play');--> statement-breakpoint
CREATE TABLE "app_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"source" "label_source" NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"taxonomy_version" text NOT NULL,
	"prompt_version" text DEFAULT 'none' NOT NULL,
	"model" text,
	"input_hash" text DEFAULT 'manual' NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_labels_confidence_range_chk" CHECK ("app_labels"."confidence" >= 0 and "app_labels"."confidence" <= 1)
);
--> statement-breakpoint
ALTER TABLE "app_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_app_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rating" numeric(3, 2),
	"rating_count" bigint,
	"review_count" bigint,
	"min_installs" bigint,
	"max_installs" bigint,
	"price" numeric(12, 2),
	"currency" varchar(3),
	"version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_snapshots_rating_range_chk" CHECK ("app_snapshots"."rating" is null or ("app_snapshots"."rating" >= 0 and "app_snapshots"."rating" <= 5)),
	CONSTRAINT "app_snapshots_counts_nonnegative_chk" CHECK (coalesce("app_snapshots"."rating_count", 0) >= 0 and coalesce("app_snapshots"."review_count", 0) >= 0),
	CONSTRAINT "app_snapshots_installs_range_chk" CHECK (coalesce("app_snapshots"."min_installs", 0) >= 0 and ("app_snapshots"."max_installs" is null or "app_snapshots"."max_installs" >= coalesce("app_snapshots"."min_installs", 0))),
	CONSTRAINT "app_snapshots_price_nonnegative_chk" CHECK ("app_snapshots"."price" is null or "app_snapshots"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"developer_name" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chart_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_app_id" uuid NOT NULL,
	"chart_type" text NOT NULL,
	"category" text DEFAULT 'all' NOT NULL,
	"country" varchar(2) NOT NULL,
	"rank" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_entries_rank_positive_chk" CHECK ("chart_entries"."rank" > 0),
	CONSTRAINT "chart_entries_country_lowercase_chk" CHECK ("chart_entries"."country" = lower("chart_entries"."country"))
);
--> statement-breakpoint
ALTER TABLE "chart_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collector_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "store" NOT NULL,
	"job_type" text NOT NULL,
	"country" varchar(2) NOT NULL,
	"locale" varchar(16) NOT NULL,
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
	CONSTRAINT "collector_runs_counts_nonnegative_chk" CHECK ("collector_runs"."discovered_count" >= 0 and "collector_runs"."changed_count" >= 0 and "collector_runs"."retry_count" >= 0 and "collector_runs"."error_count" >= 0),
	CONSTRAINT "collector_runs_country_lowercase_chk" CHECK ("collector_runs"."country" = lower("collector_runs"."country"))
);
--> statement-breakpoint
ALTER TABLE "collector_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"idempotency_key" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_attempts_range_chk" CHECK ("jobs"."attempts" >= 0 and "jobs"."max_attempts" > 0 and "jobs"."attempts" <= "jobs"."max_attempts")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_app_id" uuid NOT NULL,
	"external_review_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"review_text" text,
	"review_date" timestamp with time zone NOT NULL,
	"locale" varchar(16) NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range_chk" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "store_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"store" "store" NOT NULL,
	"external_id" text NOT NULL,
	"country" varchar(2) NOT NULL,
	"locale" varchar(16) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"developer_name" text,
	"developer_external_id" text,
	"store_category" text,
	"release_date" timestamp with time zone,
	"current_version" text,
	"icon_url" text,
	"store_url" text NOT NULL,
	"metadata_hash" text NOT NULL,
	"raw_metadata" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_apps_country_lowercase_chk" CHECK ("store_apps"."country" = lower("store_apps"."country"))
);
--> statement-breakpoint
ALTER TABLE "store_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "taxonomy_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "label_type" NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"taxonomy_version" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taxonomy_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_labels" ADD CONSTRAINT "app_labels_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_labels" ADD CONSTRAINT "app_labels_label_id_taxonomy_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."taxonomy_labels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_snapshots" ADD CONSTRAINT "app_snapshots_store_app_id_store_apps_id_fk" FOREIGN KEY ("store_app_id") REFERENCES "public"."store_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_store_app_id_store_apps_id_fk" FOREIGN KEY ("store_app_id") REFERENCES "public"."store_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_store_app_id_store_apps_id_fk" FOREIGN KEY ("store_app_id") REFERENCES "public"."store_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_apps" ADD CONSTRAINT "store_apps_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_labels_provenance_uidx" ON "app_labels" USING btree ("app_id","label_id","source","taxonomy_version","prompt_version","input_hash");--> statement-breakpoint
CREATE INDEX "app_labels_app_id_idx" ON "app_labels" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_snapshots_store_app_captured_uidx" ON "app_snapshots" USING btree ("store_app_id","captured_at");--> statement-breakpoint
CREATE INDEX "app_snapshots_captured_at_idx" ON "app_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "apps_normalized_name_idx" ON "apps" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "apps_first_seen_at_idx" ON "apps" USING btree ("first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_entries_observation_uidx" ON "chart_entries" USING btree ("store_app_id","chart_type","category","country","captured_at");--> statement-breakpoint
CREATE INDEX "chart_entries_cohort_idx" ON "chart_entries" USING btree ("country","chart_type","category","captured_at");--> statement-breakpoint
CREATE INDEX "collector_runs_health_idx" ON "collector_runs" USING btree ("source","country","job_type","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_key_uidx" ON "jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_lease_idx" ON "jobs" USING btree ("status","available_at","locked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_store_external_uidx" ON "reviews" USING btree ("store_app_id","external_review_id");--> statement-breakpoint
CREATE INDEX "reviews_store_app_review_date_idx" ON "reviews" USING btree ("store_app_id","review_date");--> statement-breakpoint
CREATE UNIQUE INDEX "store_apps_listing_uidx" ON "store_apps" USING btree ("store","external_id","country","locale");--> statement-breakpoint
CREATE INDEX "store_apps_app_id_idx" ON "store_apps" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "store_apps_release_date_idx" ON "store_apps" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "store_apps_last_seen_at_idx" ON "store_apps" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_labels_version_type_slug_uidx" ON "taxonomy_labels" USING btree ("taxonomy_version","type","slug");