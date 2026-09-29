CREATE TABLE "classification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"source" "label_source" NOT NULL,
	"taxonomy_version" text NOT NULL,
	"classifier_version" text NOT NULL,
	"model" text,
	"input_hash" text NOT NULL,
	"label_count" integer NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classification_runs_automated_source_chk" CHECK ("classification_runs"."source" <> 'manual'),
	CONSTRAINT "classification_runs_label_count_nonnegative_chk" CHECK ("classification_runs"."label_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "classification_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "classification_runs" ADD CONSTRAINT "classification_runs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classification_runs_app_source_version_uidx" ON "classification_runs" USING btree ("app_id","source","taxonomy_version");--> statement-breakpoint
-- Backfill from existing automated labels; replacement keeps one input hash per app, source and version.
INSERT INTO "classification_runs" ("app_id", "source", "taxonomy_version", "classifier_version", "model", "input_hash", "label_count", "classified_at")
SELECT "app_id", "source", "taxonomy_version", max("prompt_version"), max("model"), max("input_hash"), count(*)::integer, max("updated_at")
FROM "app_labels"
WHERE "source" <> 'manual'
GROUP BY "app_id", "source", "taxonomy_version"
ON CONFLICT DO NOTHING;
