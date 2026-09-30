CREATE TABLE "studio_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_key" text DEFAULT 'default' NOT NULL,
	"version" integer NOT NULL,
	"team_size" integer NOT NULL,
	"target_duration_months" integer NOT NULL,
	"supported_platforms" jsonb NOT NULL,
	"input_methods" jsonb NOT NULL,
	"capability_2d" text NOT NULL,
	"capability_3d" text NOT NULL,
	"online_backend_capability" text NOT NULL,
	"content_production_capability" text NOT NULL,
	"live_ops_capability" text NOT NULL,
	"monetization_capabilities" jsonb NOT NULL,
	"preferred_labels" jsonb NOT NULL,
	"avoided_labels" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_profiles_version_positive_chk" CHECK ("studio_profiles"."version" > 0),
	CONSTRAINT "studio_profiles_team_size_positive_chk" CHECK ("studio_profiles"."team_size" > 0 and "studio_profiles"."team_size" <= 500),
	CONSTRAINT "studio_profiles_duration_range_chk" CHECK ("studio_profiles"."target_duration_months" > 0 and "studio_profiles"."target_duration_months" <= 120),
	CONSTRAINT "studio_profiles_capability_levels_chk" CHECK ("studio_profiles"."capability_2d" in ('none', 'basic', 'strong') and "studio_profiles"."capability_3d" in ('none', 'basic', 'strong') and "studio_profiles"."online_backend_capability" in ('none', 'basic', 'strong') and "studio_profiles"."content_production_capability" in ('none', 'basic', 'strong') and "studio_profiles"."live_ops_capability" in ('none', 'basic', 'strong'))
);
--> statement-breakpoint
ALTER TABLE "studio_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_profiles_key_version_uidx" ON "studio_profiles" USING btree ("profile_key","version");--> statement-breakpoint
CREATE INDEX "studio_profiles_latest_idx" ON "studio_profiles" USING btree ("profile_key","version");