import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const storeEnum = pgEnum("store", ["app_store", "google_play"]);

/** Platform ids as stored; the shared platform registry describes what each one publishes. */
export type StoreId = (typeof storeEnum.enumValues)[number];

export const labelTypeEnum = pgEnum("label_type", [
  "genre",
  "subgenre",
  "core_mechanic",
  "meta_mechanic",
  "theme",
  "multiplayer_mode",
  "monetization_clue",
]);

export const labelSourceEnum = pgEnum("label_source", [
  "rule",
  "ai",
  "manual",
]);

export const collectorRunStatusEnum = pgEnum("collector_run_status", [
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const apps = pgTable(
  "apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    developerName: text("developer_name"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("apps_normalized_name_idx").on(table.normalizedName),
    index("apps_first_seen_at_idx").on(table.firstSeenAt),
  ],
).enableRLS();

export const storeApps = pgTable(
  "store_apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "restrict" }),
    store: storeEnum("store").notNull(),
    externalId: text("external_id").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    developerName: text("developer_name"),
    developerExternalId: text("developer_external_id"),
    storeCategory: text("store_category"),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    currentVersion: text("current_version"),
    iconUrl: text("icon_url"),
    storeUrl: text("store_url").notNull(),
    metadataHash: text("metadata_hash").notNull(),
    rawMetadata: jsonb("raw_metadata"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("store_apps_listing_uidx").on(
      table.store,
      table.externalId,
      table.country,
      table.locale,
    ),
    index("store_apps_app_id_idx").on(table.appId),
    index("store_apps_release_date_idx").on(table.releaseDate),
    index("store_apps_last_seen_at_idx").on(table.lastSeenAt),
    check("store_apps_country_lowercase_chk", sql`${table.country} = lower(${table.country})`),
  ],
).enableRLS();

export const appSnapshots = pgTable(
  "app_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeAppId: uuid("store_app_id")
      .notNull()
      .references(() => storeApps.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    ratingCount: bigint("rating_count", { mode: "number" }),
    reviewCount: bigint("review_count", { mode: "number" }),
    minInstalls: bigint("min_installs", { mode: "number" }),
    maxInstalls: bigint("max_installs", { mode: "number" }),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }),
    version: text("version"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("app_snapshots_store_app_captured_uidx").on(
      table.storeAppId,
      table.capturedAt,
    ),
    index("app_snapshots_captured_at_idx").on(table.capturedAt),
    check(
      "app_snapshots_rating_range_chk",
      sql`${table.rating} is null or (${table.rating} >= 0 and ${table.rating} <= 5)`,
    ),
    check(
      "app_snapshots_counts_nonnegative_chk",
      sql`coalesce(${table.ratingCount}, 0) >= 0 and coalesce(${table.reviewCount}, 0) >= 0`,
    ),
    check(
      "app_snapshots_installs_range_chk",
      sql`coalesce(${table.minInstalls}, 0) >= 0 and (${table.maxInstalls} is null or ${table.maxInstalls} >= coalesce(${table.minInstalls}, 0))`,
    ),
    check(
      "app_snapshots_price_nonnegative_chk",
      sql`${table.price} is null or ${table.price} >= 0`,
    ),
  ],
).enableRLS();

export const chartEntries = pgTable(
  "chart_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeAppId: uuid("store_app_id")
      .notNull()
      .references(() => storeApps.id, { onDelete: "cascade" }),
    chartType: text("chart_type").notNull(),
    category: text("category").default("all").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    rank: integer("rank").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("chart_entries_observation_uidx").on(
      table.storeAppId,
      table.chartType,
      table.category,
      table.country,
      table.capturedAt,
    ),
    index("chart_entries_cohort_idx").on(
      table.country,
      table.chartType,
      table.category,
      table.capturedAt,
    ),
    check("chart_entries_rank_positive_chk", sql`${table.rank} > 0`),
    check("chart_entries_country_lowercase_chk", sql`${table.country} = lower(${table.country})`),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeAppId: uuid("store_app_id")
      .notNull()
      .references(() => storeApps.id, { onDelete: "cascade" }),
    externalReviewId: text("external_review_id").notNull(),
    rating: smallint("rating").notNull(),
    reviewText: text("review_text"),
    reviewDate: timestamp("review_date", { withTimezone: true }).notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reviews_store_external_uidx").on(
      table.storeAppId,
      table.externalReviewId,
    ),
    index("reviews_store_app_review_date_idx").on(
      table.storeAppId,
      table.reviewDate,
    ),
    check("reviews_rating_range_chk", sql`${table.rating} between 1 and 5`),
  ],
).enableRLS();

export const taxonomyLabels = pgTable(
  "taxonomy_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: labelTypeEnum("type").notNull(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    taxonomyVersion: text("taxonomy_version").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("taxonomy_labels_version_type_slug_uidx").on(
      table.taxonomyVersion,
      table.type,
      table.slug,
    ),
  ],
).enableRLS();

export const appLabels = pgTable(
  "app_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => taxonomyLabels.id, { onDelete: "restrict" }),
    source: labelSourceEnum("source").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    evidence: jsonb("evidence").default([]).notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    promptVersion: text("prompt_version").default("none").notNull(),
    model: text("model"),
    inputHash: text("input_hash").default("manual").notNull(),
    isManualOverride: boolean("is_manual_override").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("app_labels_provenance_uidx").on(
      table.appId,
      table.labelId,
      table.source,
      table.taxonomyVersion,
      table.promptVersion,
      table.inputHash,
    ),
    index("app_labels_app_id_idx").on(table.appId),
    check(
      "app_labels_confidence_range_chk",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
  ],
).enableRLS();

/**
 * The last automated classification of each app per source and taxonomy version. It is the
 * input-hash cache: an app whose input is unchanged is skipped even when the result had no labels.
 */
export const classificationRuns = pgTable(
  "classification_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    source: labelSourceEnum("source").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    classifierVersion: text("classifier_version").notNull(),
    model: text("model"),
    inputHash: text("input_hash").notNull(),
    labelCount: integer("label_count").notNull(),
    classifiedAt: timestamp("classified_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("classification_runs_app_source_version_uidx").on(
      table.appId,
      table.source,
      table.taxonomyVersion,
    ),
    check("classification_runs_automated_source_chk", sql`${table.source} <> 'manual'`),
    check("classification_runs_label_count_nonnegative_chk", sql`${table.labelCount} >= 0`),
  ],
).enableRLS();

export const watchlistStatusEnum = pgEnum("watchlist_status", [
  "watching",
  "priority",
  "archived",
]);

/**
 * The team's shared watchlist: one entry per store listing, so store and country context stay
 * attached. The baseline is the latest observation when the game was added, kept to show
 * movement since then; it stays null when nothing had been observed.
 */
export const watchlistEntries = pgTable(
  "watchlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeAppId: uuid("store_app_id")
      .notNull()
      .references(() => storeApps.id, { onDelete: "cascade" }),
    status: watchlistStatusEnum("status").default("watching").notNull(),
    note: text("note"),
    addedBy: text("added_by").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    baselineCapturedAt: timestamp("baseline_captured_at", { withTimezone: true }),
    baselineRating: numeric("baseline_rating", { precision: 3, scale: 2 }),
    baselineRatingCount: bigint("baseline_rating_count", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("watchlist_entries_store_app_uidx").on(table.storeAppId),
    index("watchlist_entries_status_idx").on(table.status),
    check("watchlist_entries_note_length_chk", sql`${table.note} is null or char_length(${table.note}) <= 2000`),
  ],
).enableRLS();

export const researchRunStatusEnum = pgEnum("research_run_status", ["succeeded", "failed"]);
export const opportunityDecisionStatusEnum = pgEnum("opportunity_decision_status", [
  "shortlisted",
  "rejected",
  "prototype",
]);

/**
 * One research calculation for one storefront. Runs are append-only so earlier recommendations
 * stay explainable; `input_hash` makes a rerun over identical inputs a no-op.
 */
export const researchRuns = pgTable(
  "research_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formulaVersion: text("formula_version").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    store: storeEnum("store").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    windowDays: integer("window_days").notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    inputHash: text("input_hash").notNull(),
    status: researchRunStatusEnum("status").notNull(),
    trackedGames: integer("tracked_games").notNull(),
    cohortsEvaluated: integer("cohorts_evaluated").notNull(),
    opportunitiesScored: integer("opportunities_scored").notNull(),
    historyDays: numeric("history_days", { precision: 6, scale: 2 }),
    freshness: text("freshness").notNull(),
    errorSample: text("error_sample"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("research_runs_input_uidx").on(
      table.formulaVersion,
      table.taxonomyVersion,
      table.store,
      table.country,
      table.inputHash,
    ),
    index("research_runs_latest_idx").on(table.store, table.country, table.formulaVersion, table.asOf),
    check("research_runs_country_lowercase_chk", sql`${table.country} = lower(${table.country})`),
  ],
).enableRLS();

/** One evaluated label cohort of a research run, with its score, confidence, and evidence. */
export const marketOpportunities = pgTable(
  "market_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    opportunityKey: text("opportunity_key").notNull(),
    dimensions: jsonb("dimensions").notNull(),
    memberCount: integer("member_count").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }),
    reason: text("reason"),
    weightCoverage: numeric("weight_coverage", { precision: 4, scale: 3 }).notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    confidenceBand: text("confidence_band").notNull(),
    insightType: text("insight_type"),
    components: jsonb("components").notNull(),
    facts: jsonb("facts").notNull(),
    comparables: jsonb("comparables").notNull(),
    positives: jsonb("positives").notNull(),
    counterSignals: jsonb("counter_signals").notNull(),
    caveats: jsonb("caveats").notNull(),
  },
  (table) => [
    uniqueIndex("market_opportunities_run_key_uidx").on(table.runId, table.opportunityKey),
    index("market_opportunities_run_score_idx").on(table.runId, table.score),
    check(
      "market_opportunities_score_range_chk",
      sql`${table.score} is null or (${table.score} >= 0 and ${table.score} <= 100)`,
    ),
  ],
).enableRLS();

/**
 * Append-only team decisions for an opportunity. Keeping every event makes changes auditable and
 * preserves the reasoning attached to an earlier decision.
 */
export const opportunityDecisions = pgTable(
  "opportunity_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => marketOpportunities.id, { onDelete: "cascade" }),
    status: opportunityDecisionStatusEnum("status").notNull(),
    note: text("note"),
    owner: text("owner"),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("opportunity_decisions_opportunity_created_idx").on(table.opportunityId, table.createdAt),
    check(
      "opportunity_decisions_note_length_chk",
      sql`${table.note} is null or char_length(${table.note}) <= 2000`,
    ),
    check(
      "opportunity_decisions_owner_length_chk",
      sql`${table.owner} is null or char_length(${table.owner}) <= 200`,
    ),
  ],
).enableRLS();

/** Append-only, versioned studio capability profile used by deterministic Studio Fit scoring. */
export const studioProfiles = pgTable(
  "studio_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileKey: text("profile_key").default("default").notNull(),
    version: integer("version").notNull(),
    teamSize: integer("team_size").notNull(),
    targetDurationMonths: integer("target_duration_months").notNull(),
    supportedPlatforms: jsonb("supported_platforms").notNull(),
    inputMethods: jsonb("input_methods").notNull(),
    capability2d: text("capability_2d").notNull(),
    capability3d: text("capability_3d").notNull(),
    onlineBackendCapability: text("online_backend_capability").notNull(),
    contentProductionCapability: text("content_production_capability").notNull(),
    liveOpsCapability: text("live_ops_capability").notNull(),
    monetizationCapabilities: jsonb("monetization_capabilities").notNull(),
    preferredLabels: jsonb("preferred_labels").notNull(),
    avoidedLabels: jsonb("avoided_labels").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("studio_profiles_key_version_uidx").on(table.profileKey, table.version),
    index("studio_profiles_latest_idx").on(table.profileKey, table.version),
    check("studio_profiles_version_positive_chk", sql`${table.version} > 0`),
    check("studio_profiles_team_size_positive_chk", sql`${table.teamSize} > 0 and ${table.teamSize} <= 500`),
    check(
      "studio_profiles_duration_range_chk",
      sql`${table.targetDurationMonths} > 0 and ${table.targetDurationMonths} <= 120`,
    ),
    check(
      "studio_profiles_capability_levels_chk",
      sql`${table.capability2d} in ('none', 'basic', 'strong') and ${table.capability3d} in ('none', 'basic', 'strong') and ${table.onlineBackendCapability} in ('none', 'basic', 'strong') and ${table.contentProductionCapability} in ('none', 'basic', 'strong') and ${table.liveOpsCapability} in ('none', 'basic', 'strong')`,
    ),
  ],
).enableRLS();

/** Append-only AI brief over one immutable opportunity and a bounded evidence snapshot. */
export const opportunityResearchBriefs = pgTable(
  "opportunity_research_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => marketOpportunities.id, { onDelete: "cascade" }),
    inputHash: text("input_hash").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    brief: jsonb("brief").notNull(),
    evidence: jsonb("evidence").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("opportunity_research_briefs_input_uidx").on(
      table.opportunityId,
      table.promptVersion,
      table.inputHash,
    ),
    index("opportunity_research_briefs_latest_idx").on(table.opportunityId, table.createdAt),
    check(
      "opportunity_research_briefs_tokens_nonnegative_chk",
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`,
    ),
  ],
).enableRLS();

export const collectorRuns = pgTable(
  "collector_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: storeEnum("source").notNull(),
    jobType: text("job_type").notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    status: collectorRunStatusEnum("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    discoveredCount: integer("discovered_count").default(0).notNull(),
    changedCount: integer("changed_count").default(0).notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    errorSample: text("error_sample"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collector_runs_health_idx").on(
      table.source,
      table.country,
      table.jobType,
      table.startedAt,
    ),
    check(
      "collector_runs_counts_nonnegative_chk",
      sql`${table.discoveredCount} >= 0 and ${table.changedCount} >= 0 and ${table.retryCount} >= 0 and ${table.errorCount} >= 0`,
    ),
    check("collector_runs_country_lowercase_chk", sql`${table.country} = lower(${table.country})`),
  ],
).enableRLS();

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    idempotencyKey: text("idempotency_key").notNull(),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jobs_idempotency_key_uidx").on(table.idempotencyKey),
    index("jobs_lease_idx").on(table.status, table.availableAt, table.lockedAt),
    check(
      "jobs_attempts_range_chk",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
  ],
).enableRLS();

/**
 * Steam is a Global desktop platform with its own observation semantics, so it lives in its own
 * tables rather than the country-scoped `store_apps`. Canonical cross-platform matching (`apps`)
 * is deliberately absent until it can be reviewed; Steam rows never join mobile rows implicitly.
 */
export const steamApps = pgTable(
  "steam_apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    developerNames: text("developer_names").array().default(sql`'{}'::text[]`).notNull(),
    publisherNames: text("publisher_names").array().default(sql`'{}'::text[]`).notNull(),
    genres: text("genres").array().default(sql`'{}'::text[]`).notNull(),
    categories: text("categories").array().default(sql`'{}'::text[]`).notNull(),
    tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
    releaseState: text("release_state").notNull(),
    releaseDate: timestamp("release_date", { withTimezone: true }),
    supportsWindows: boolean("supports_windows").notNull(),
    supportsMacos: boolean("supports_macos").notNull(),
    supportsLinux: boolean("supports_linux").notNull(),
    isFree: boolean("is_free").notNull(),
    headerImageUrl: text("header_image_url"),
    storeUrl: text("store_url").notNull(),
    source: text("source").notNull(),
    metadataHash: text("metadata_hash").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("steam_apps_external_id_uidx").on(table.externalId),
    index("steam_apps_release_date_idx").on(table.releaseDate),
    check("steam_apps_external_id_chk", sql`${table.externalId} ~ '^[1-9][0-9]*$'`),
    check(
      "steam_apps_release_state_chk",
      sql`${table.releaseState} in ('released', 'early_access', 'upcoming', 'unknown')`,
    ),
  ],
).enableRLS();

/**
 * Review totals and concurrent players, each with its own capture time. A group is either fully
 * present or fully null: missing is never stored as zero.
 */
export const steamSnapshots = pgTable(
  "steam_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    steamAppId: uuid("steam_app_id")
      .notNull()
      .references(() => steamApps.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    reviewPositive: bigint("review_positive", { mode: "number" }),
    reviewNegative: bigint("review_negative", { mode: "number" }),
    reviewTotal: bigint("review_total", { mode: "number" }),
    reviewsCapturedAt: timestamp("reviews_captured_at", { withTimezone: true }),
    reviewPurchaseScope: text("review_purchase_scope"),
    reviewLanguageScope: text("review_language_scope").array(),
    reviewOffTopicFiltered: boolean("review_off_topic_filtered"),
    currentPlayers: bigint("current_players", { mode: "number" }),
    playersCapturedAt: timestamp("players_captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("steam_snapshots_app_captured_uidx").on(table.steamAppId, table.capturedAt),
    index("steam_snapshots_captured_at_idx").on(table.capturedAt),
    check(
      "steam_snapshots_reviews_group_chk",
      sql`(${table.reviewTotal} is null and ${table.reviewPositive} is null and ${table.reviewNegative} is null and ${table.reviewsCapturedAt} is null)
        or (${table.reviewPositive} >= 0 and ${table.reviewNegative} >= 0
            and ${table.reviewTotal} = ${table.reviewPositive} + ${table.reviewNegative}
            and ${table.reviewsCapturedAt} is not null and ${table.reviewPurchaseScope} is not null)`,
    ),
    check(
      "steam_snapshots_players_group_chk",
      sql`(${table.currentPlayers} is null and ${table.playersCapturedAt} is null)
        or (${table.currentPlayers} >= 0 and ${table.playersCapturedAt} is not null)`,
    ),
    check(
      "steam_snapshots_has_signal_chk",
      sql`${table.reviewTotal} is not null or ${table.currentPlayers} is not null`,
    ),
  ],
).enableRLS();

export const steamChartEntries = pgTable(
  "steam_chart_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    steamAppId: uuid("steam_app_id")
      .notNull()
      .references(() => steamApps.id, { onDelete: "cascade" }),
    chart: text("chart").notNull(),
    rank: integer("rank").notNull(),
    lastWeekRank: integer("last_week_rank"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("steam_chart_entries_observation_uidx").on(table.steamAppId, table.chart, table.capturedAt),
    index("steam_chart_entries_chart_captured_idx").on(table.chart, table.capturedAt),
    check("steam_chart_entries_chart_chk", sql`${table.chart} in ('top_sellers', 'most_played', 'steam_deck')`),
    check(
      "steam_chart_entries_rank_chk",
      sql`${table.rank} between 1 and 100 and (${table.lastWeekRank} is null or ${table.lastWeekRank} >= 1)`,
    ),
  ],
).enableRLS();

/** Regional prices. Stored on change (plus a daily heartbeat), per country and currency. */
export const steamPrices = pgTable(
  "steam_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    steamAppId: uuid("steam_app_id")
      .notNull()
      .references(() => steamApps.id, { onDelete: "cascade" }),
    country: varchar("country", { length: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    initialPrice: numeric("initial_price", { precision: 14, scale: 2 }).notNull(),
    finalPrice: numeric("final_price", { precision: 14, scale: 2 }).notNull(),
    discountPercent: smallint("discount_percent").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("steam_prices_observation_uidx").on(table.steamAppId, table.country, table.capturedAt),
    check("steam_prices_country_lowercase_chk", sql`${table.country} = lower(${table.country})`),
    check("steam_prices_currency_uppercase_chk", sql`${table.currency} = upper(${table.currency})`),
    check(
      "steam_prices_values_chk",
      sql`${table.initialPrice} >= 0 and ${table.finalPrice} >= 0 and ${table.finalPrice} <= ${table.initialPrice}
        and ${table.discountPercent} between 0 and 100`,
    ),
  ],
).enableRLS();

/** Health record per Steam collection run (Global market, so no country or locale). */
export const steamCollectorRuns = pgTable(
  "steam_collector_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobType: text("job_type").notNull(),
    status: collectorRunStatusEnum("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    discoveredCount: integer("discovered_count").default(0).notNull(),
    changedCount: integer("changed_count").default(0).notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    errorSample: text("error_sample"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("steam_collector_runs_health_idx").on(table.jobType, table.startedAt),
    check(
      "steam_collector_runs_counts_nonnegative_chk",
      sql`${table.discoveredCount} >= 0 and ${table.changedCount} >= 0 and ${table.retryCount} >= 0 and ${table.errorCount} >= 0`,
    ),
  ],
).enableRLS();

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type StoreApp = typeof storeApps.$inferSelect;
export type NewStoreApp = typeof storeApps.$inferInsert;
export type AppSnapshot = typeof appSnapshots.$inferSelect;
export type NewAppSnapshot = typeof appSnapshots.$inferInsert;
export type SteamApp = typeof steamApps.$inferSelect;
export type SteamSnapshot = typeof steamSnapshots.$inferSelect;
