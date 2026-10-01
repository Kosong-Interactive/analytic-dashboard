CREATE TABLE "steam_app_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_app_id" uuid NOT NULL,
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
	CONSTRAINT "steam_app_labels_confidence_range_chk" CHECK ("steam_app_labels"."confidence" >= 0 and "steam_app_labels"."confidence" <= 1)
);
--> statement-breakpoint
ALTER TABLE "steam_app_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "steam_classification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_app_id" uuid NOT NULL,
	"source" "label_source" NOT NULL,
	"taxonomy_version" text NOT NULL,
	"classifier_version" text NOT NULL,
	"model" text,
	"input_hash" text NOT NULL,
	"label_count" integer NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "steam_classification_runs_automated_source_chk" CHECK ("steam_classification_runs"."source" <> 'manual'),
	CONSTRAINT "steam_classification_runs_label_count_nonnegative_chk" CHECK ("steam_classification_runs"."label_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "steam_classification_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "steam_app_labels" ADD CONSTRAINT "steam_app_labels_steam_app_id_steam_apps_id_fk" FOREIGN KEY ("steam_app_id") REFERENCES "public"."steam_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_app_labels" ADD CONSTRAINT "steam_app_labels_label_id_taxonomy_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."taxonomy_labels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_classification_runs" ADD CONSTRAINT "steam_classification_runs_steam_app_id_steam_apps_id_fk" FOREIGN KEY ("steam_app_id") REFERENCES "public"."steam_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "steam_app_labels_provenance_uidx" ON "steam_app_labels" USING btree ("steam_app_id","label_id","source","taxonomy_version","prompt_version","input_hash");--> statement-breakpoint
CREATE INDEX "steam_app_labels_app_idx" ON "steam_app_labels" USING btree ("steam_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "steam_classification_runs_app_source_version_uidx" ON "steam_classification_runs" USING btree ("steam_app_id","source","taxonomy_version");