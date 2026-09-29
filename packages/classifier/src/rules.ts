import { platformLabel, type TaxonomyLabelType } from "@analytic-dashboard/shared";

import type { ClassificationInput, ClassificationListing } from "./input.js";

/** Bump when any rule, pattern, or confidence below changes; it feeds the input hash. */
export const RULES_VERSION = "rules-v1";

const STORE_GENRE_CONFIDENCE = 0.95;
const PRICE_CONFIDENCE = 0.95;
const TITLE_CONFIDENCE = 0.8;
const DESCRIPTION_CONFIDENCE = 0.55;
const DESCRIPTION_REPEATED_CONFIDENCE = 0.7;
const MAX_EVIDENCE_PER_LABEL = 3;
const EXCERPT_RADIUS = 60;

export interface RuleEvidence {
  field: "title" | "description" | "store_category" | "metadata";
  excerpt: string;
}

export interface RuleLabel {
  type: TaxonomyLabelType;
  slug: string;
  confidence: number;
  evidence: RuleEvidence[];
  ruleIds: string[];
}

type LabelRef = readonly [TaxonomyLabelType, string];

interface KeywordRule {
  id: string;
  labels: readonly LabelRef[];
  patterns: readonly RegExp[];
}

/** Store-declared genres map straight to taxonomy genres; they are the strongest signal. */
const STORE_GENRES: Record<string, string> = {
  // Google Play genreId (stable across locales, unlike the translated genre name).
  GAME_ACTION: "action",
  GAME_ADVENTURE: "adventure",
  GAME_ARCADE: "arcade",
  GAME_BOARD: "board",
  GAME_CARD: "card",
  GAME_CASINO: "casino",
  GAME_CASUAL: "casual",
  GAME_MUSIC: "music",
  GAME_PUZZLE: "puzzle",
  GAME_RACING: "racing",
  GAME_ROLE_PLAYING: "rpg",
  GAME_SIMULATION: "simulation",
  GAME_SPORTS: "sports",
  GAME_STRATEGY: "strategy",
  GAME_TRIVIA: "trivia",
  GAME_WORD: "word",
  // Apple `genres` entries.
  Action: "action",
  Adventure: "adventure",
  Arcade: "arcade",
  Board: "board",
  Card: "card",
  Casino: "casino",
  Casual: "casual",
  Music: "music",
  Puzzle: "puzzle",
  Racing: "racing",
  "Role-Playing": "rpg",
  Roleplaying: "rpg",
  Simulation: "simulation",
  Sports: "sports",
  Strategy: "strategy",
  Trivia: "trivia",
  Word: "word",
};

const w = (source: string) => new RegExp(`\\b(?:${source})\\b`, "gi");

const KEYWORD_RULES: readonly KeywordRule[] = [
  { id: "kw.match_3", labels: [["subgenre", "match_3"], ["core_mechanic", "matching"]], patterns: [w("match[- ]?3|match three|three in a row|cocokkan")] },
  { id: "kw.merge", labels: [["subgenre", "merge"], ["core_mechanic", "merging"]], patterns: [w("merge|merging|gabungkan")] },
  { id: "kw.block_puzzle", labels: [["subgenre", "block_puzzle"]], patterns: [w("block puzzle|block blast")] },
  { id: "kw.sort_puzzle", labels: [["subgenre", "sort_puzzle"], ["core_mechanic", "sorting"]], patterns: [w("(?:water|ball|color|colour|goods|nut|hexa) sort|sort(?:ing)? (?:puzzle|game)")] },
  { id: "kw.hidden_object", labels: [["subgenre", "hidden_object"]], patterns: [w("hidden objects?")] },
  { id: "kw.solitaire", labels: [["subgenre", "solitaire"]], patterns: [w("solitaire|klondike")] },
  { id: "kw.idle_rpg", labels: [["subgenre", "idle_rpg"]], patterns: [w("idle rpg|afk rpg|afk arena")] },
  { id: "kw.tower_defense", labels: [["subgenre", "tower_defense"], ["core_mechanic", "tower_placement"]], patterns: [w("tower defen[cs]e")] },
  { id: "kw.four_x", labels: [["subgenre", "four_x"]], patterns: [w("4x")] },
  { id: "kw.moba", labels: [["subgenre", "moba"], ["multiplayer_mode", "pvp"]], patterns: [w("moba|5v5")] },
  { id: "kw.battle_royale", labels: [["subgenre", "battle_royale"], ["multiplayer_mode", "pvp"]], patterns: [w("battle royale")] },
  { id: "kw.roguelike", labels: [["subgenre", "roguelike"]], patterns: [w("rogue-?(?:like|lite)")] },
  { id: "kw.tycoon", labels: [["subgenre", "tycoon"]], patterns: [w("tycoon")] },
  { id: "kw.farming", labels: [["subgenre", "farming"]], patterns: [w("farming|farm game|harvest|bertani")] },
  { id: "kw.city_builder", labels: [["subgenre", "city_builder"]], patterns: [w("city[- ]build(?:er|ing)|build (?:your|a) (?:own )?city")] },
  { id: "kw.endless_runner", labels: [["subgenre", "endless_runner"], ["core_mechanic", "running"]], patterns: [w("endless run(?:ner)?")] },
  { id: "kw.platformer", labels: [["subgenre", "platformer"]], patterns: [w("platformer")] },
  { id: "kw.idle", labels: [["core_mechanic", "idle_progression"]], patterns: [w("idle|afk|incremental")] },
  { id: "kw.deckbuilding", labels: [["core_mechanic", "deckbuilding"]], patterns: [w("deck[- ]?build(?:ing|er)?")] },
  { id: "kw.auto_battle", labels: [["core_mechanic", "auto_battle"]], patterns: [w("auto[- ]?(?:battle|battler|chess)")] },
  { id: "kw.base_building", labels: [["core_mechanic", "base_building"]], patterns: [w("base[- ]build(?:ing|er)?|build (?:your|a) base")] },
  { id: "kw.crafting", labels: [["core_mechanic", "crafting"]], patterns: [w("craft(?:ing)?")] },
  { id: "kw.physics", labels: [["core_mechanic", "physics"]], patterns: [w("physics")] },
  { id: "kw.runner", labels: [["core_mechanic", "running"]], patterns: [w("runner")] },
  { id: "kw.shooting", labels: [["core_mechanic", "shooting"]], patterns: [w("shooter|shooting|fps|sniper")] },
  { id: "kw.driving", labels: [["core_mechanic", "driving"]], patterns: [w("driving|drifting|drift")] },
  { id: "kw.word", labels: [["core_mechanic", "word_building"]], patterns: [w("crossword|word (?:game|puzzle|search|connect)|anagram")] },
  { id: "kw.turn_based", labels: [["core_mechanic", "turn_based_combat"]], patterns: [w("turn[- ]based")] },
  { id: "kw.real_time", labels: [["core_mechanic", "real_time_combat"]], patterns: [w("real[- ]time (?:combat|battles?|pvp|strategy)|hack and slash|hack-and-slash")] },
  { id: "kw.gacha", labels: [["meta_mechanic", "gacha"]], patterns: [w("gacha|summon (?:heroes|characters|units)")] },
  { id: "kw.collection", labels: [["meta_mechanic", "collection"]], patterns: [w("collect (?:over )?\\d+|collect (?:all )?(?:the )?(?:heroes|characters|cards|cars|pets|units)")] },
  { id: "kw.upgrades", labels: [["meta_mechanic", "upgrades"]], patterns: [w("upgrades?|level up")] },
  { id: "kw.daily_rewards", labels: [["meta_mechanic", "daily_rewards"]], patterns: [w("daily (?:rewards?|bonus(?:es)?|login|gifts?)")] },
  { id: "kw.leaderboards", labels: [["meta_mechanic", "leaderboards"]], patterns: [w("leaderboards?")] },
  { id: "kw.guilds", labels: [["meta_mechanic", "guilds"]], patterns: [w("guilds?|clans?|alliances?")] },
  { id: "kw.story", labels: [["meta_mechanic", "story_progression"]], patterns: [w("storyline|story mode|chapters?")] },
  { id: "kw.offline_progress", labels: [["meta_mechanic", "offline_progress"]], patterns: [w("offline (?:earnings|progress|rewards|income)|earn (?:money|gold|coins|cash) while (?:offline|away)")] },
  { id: "kw.live_events", labels: [["meta_mechanic", "live_events"]], patterns: [w("(?:live|special|weekly|seasonal|limited[- ]time) events?")] },
  { id: "kw.season_pass", labels: [["meta_mechanic", "season_pass"]], patterns: [w("season pass|battle pass")] },
  { id: "kw.fantasy", labels: [["theme", "fantasy"]], patterns: [w("fantasy|dragons?|wizards?")] },
  { id: "kw.sci_fi", labels: [["theme", "sci_fi"]], patterns: [w("sci[- ]?fi|futuristic|cyberpunk|robots?|mechs?")] },
  { id: "kw.anime", labels: [["theme", "anime"]], patterns: [w("anime|manga")] },
  { id: "kw.military", labels: [["theme", "military"]], patterns: [w("military|army|soldiers?|warships?|tanks")] },
  { id: "kw.medieval", labels: [["theme", "medieval"]], patterns: [w("medieval|knights?|castles?|kingdoms?")] },
  { id: "kw.horror", labels: [["theme", "horror"]], patterns: [w("horror|scary|creepy")] },
  { id: "kw.zombie", labels: [["theme", "zombie"]], patterns: [w("zombies?|undead")] },
  { id: "kw.food", labels: [["theme", "food"]], patterns: [w("cooking|cook|restaurant|kitchen|cafe|bakery|recipes?")] },
  { id: "kw.animals", labels: [["theme", "animals"]], patterns: [w("animals?|pets?|kittens?|puppies")] },
  { id: "kw.space", labels: [["theme", "space"]], patterns: [w("outer space|galax(?:y|ies)|spaceships?|planets?|astronauts?")] },
  { id: "kw.pirates", labels: [["theme", "pirates"]], patterns: [w("pirates?")] },
  { id: "kw.mythology", labels: [["theme", "mythology"]], patterns: [w("mytholog(?:y|ical)|(?:greek|norse|egyptian) (?:gods|myths?)")] },
  { id: "kw.cars", labels: [["theme", "cars"]], patterns: [w("cars|supercars?|motorcycles?")] },
  { id: "kw.pvp", labels: [["multiplayer_mode", "pvp"]], patterns: [w("pvp|player vs\\.? player|play against (?:real )?(?:players|friends|opponents)|online (?:battles?|matches|duels?)")] },
  { id: "kw.co_op", labels: [["multiplayer_mode", "co_op"]], patterns: [w("co-?op|cooperative|team up with (?:friends|players)")] },
  { id: "kw.mmo", labels: [["multiplayer_mode", "mmo"]], patterns: [w("mmo|mmorpg|massively multiplayer")] },
  { id: "kw.offline_play", labels: [["multiplayer_mode", "offline_play"]], patterns: [w("play offline|offline (?:game|mode|play)|no (?:wifi|wi-fi|internet)(?: needed| required)?|tanpa (?:internet|koneksi|wifi)")] },
  { id: "kw.single_player", labels: [["multiplayer_mode", "single_player"]], patterns: [w("single[- ]player")] },
  { id: "kw.iap", labels: [["monetization_clue", "in_app_purchases"]], patterns: [w("in-app purchases?|in app purchases?|optional purchases?|purchase items with real money")] },
  { id: "kw.ads", labels: [["monetization_clue", "ads"]], patterns: [w("watch (?:an )?ads?|remove ads|contains ads|ad-supported|rewarded (?:ads|videos?)")] },
  { id: "kw.subscription", labels: [["monetization_clue", "subscription"]], patterns: [w("subscriptions?|vip membership|auto-renew(?:ing|able)?")] },
];

interface Hit {
  type: TaxonomyLabelType;
  slug: string;
  confidence: number;
  evidence: RuleEvidence;
  ruleId: string;
}

/**
 * Deterministic labels from store data and keywords. Every label carries the evidence that
 * produced it; description matches get lower confidence than title or store-declared genres.
 */
export function applyRules(input: ClassificationInput): RuleLabel[] {
  const hits = input.listings.flatMap((listing) => [
    ...storeGenreHits(listing),
    ...priceHits(listing),
    ...keywordHits(listing),
  ]);
  return mergeHits(hits);
}

function storeGenreHits(listing: ClassificationListing): Hit[] {
  return listing.storeGenres.flatMap((genre) => {
    const slug = STORE_GENRES[genre];
    if (!slug) return [];
    return [
      {
        type: "genre" as const,
        slug,
        confidence: STORE_GENRE_CONFIDENCE,
        evidence: { field: "store_category", excerpt: `${storeName(listing)} genre: ${genre}` },
        ruleId: "store.genre",
      },
    ];
  });
}

function priceHits(listing: ClassificationListing): Hit[] {
  if (listing.price === null) return [];
  const slug = listing.price > 0 ? "premium" : "free_to_play";
  return [
    {
      type: "monetization_clue",
      slug,
      confidence: PRICE_CONFIDENCE,
      evidence: { field: "metadata", excerpt: `${storeName(listing)} ${listing.country.toUpperCase()} price: ${listing.price}` },
      ruleId: "store.price",
    },
  ];
}

function keywordHits(listing: ClassificationListing): Hit[] {
  const hits: Hit[] = [];
  for (const rule of KEYWORD_RULES) {
    const title = firstMatch(rule.patterns, listing.title);
    const description = listing.description ? matches(rule.patterns, listing.description) : [];

    let found: { field: "title" | "description"; confidence: number; excerpt: string } | null = null;
    if (title) {
      found = { field: "title", confidence: TITLE_CONFIDENCE, excerpt: listing.title };
    } else if (description.length > 0 && listing.description) {
      found = {
        field: "description",
        confidence: description.length > 1 ? DESCRIPTION_REPEATED_CONFIDENCE : DESCRIPTION_CONFIDENCE,
        excerpt: excerptAround(listing.description, description[0] ?? 0),
      };
    }
    if (!found) continue;

    for (const [type, slug] of rule.labels) {
      hits.push({
        type,
        slug,
        confidence: found.confidence,
        evidence: { field: found.field, excerpt: found.excerpt.slice(0, 500) },
        ruleId: rule.id,
      });
    }
  }
  return hits;
}

function firstMatch(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => new RegExp(pattern.source, pattern.flags).test(text));
}

function matches(patterns: readonly RegExp[], text: string): number[] {
  return patterns.flatMap((pattern) =>
    [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => match.index ?? 0),
  );
}

function excerptAround(text: string, index: number): string {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(text.length, index + EXCERPT_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

function storeName(listing: ClassificationListing): string {
  return platformLabel(listing.store);
}

/** One label per (type, slug): the strongest confidence wins; evidence is kept, deduplicated. */
function mergeHits(hits: readonly Hit[]): RuleLabel[] {
  const merged = new Map<string, RuleLabel>();
  for (const hit of hits) {
    const key = `${hit.type}:${hit.slug}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        type: hit.type,
        slug: hit.slug,
        confidence: hit.confidence,
        evidence: [hit.evidence],
        ruleIds: [hit.ruleId],
      });
      continue;
    }
    current.confidence = Math.max(current.confidence, hit.confidence);
    if (!current.ruleIds.includes(hit.ruleId)) current.ruleIds.push(hit.ruleId);
    const duplicate = current.evidence.some(
      (item) => item.field === hit.evidence.field && item.excerpt === hit.evidence.excerpt,
    );
    if (!duplicate && current.evidence.length < MAX_EVIDENCE_PER_LABEL) current.evidence.push(hit.evidence);
  }
  return [...merged.values()].sort(
    (a, b) => a.type.localeCompare(b.type) || a.slug.localeCompare(b.slug),
  );
}

/** Every (type, slug) any rule can emit, so tests can check them against the taxonomy. */
export function ruleLabelRefs(): LabelRef[] {
  const refs = new Map<string, LabelRef>();
  for (const slug of Object.values(STORE_GENRES)) refs.set(`genre:${slug}`, ["genre", slug]);
  refs.set("monetization_clue:premium", ["monetization_clue", "premium"]);
  refs.set("monetization_clue:free_to_play", ["monetization_clue", "free_to_play"]);
  for (const rule of KEYWORD_RULES) for (const ref of rule.labels) refs.set(`${ref[0]}:${ref[1]}`, ref);
  return [...refs.values()];
}
