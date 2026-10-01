/** Structural subset of a storefront candidate, so this package never depends on the database package. */
export interface MarketCandidate {
  store: string;
  externalId: string;
  country: string;
  firstSeenAt: Date;
}

export interface MarketScoreLike {
  id: string;
  score: number | null;
}

export interface StorefrontSelection<C extends MarketCandidate, S extends MarketScoreLike> {
  country: string;
  candidates: readonly C[];
  /** Scores of this storefront's cohort, keyed by candidate id through `idOf`. */
  scores: readonly S[];
}

export interface MarketGame<C extends MarketCandidate, S extends MarketScoreLike> {
  /**
   * The listing shown for the game: the storefront whose score is the (lower) median of the scored
   * storefronts, so its ratings, chart rank, and score breakdown all belong to one real listing.
   * Without any score it is the first storefront in priority order.
   */
  candidate: C;
  score: S | undefined;
  /** Every storefront of the market that tracks the game, in priority order. */
  countriesObserved: string[];
  /** Storefronts that produced a score for the game. */
  scoredCountries: number;
  /** The storefront the shown listing and score come from. */
  shownCountry: string;
}

export interface MarketCoverage {
  /** Storefronts of the market that tracked at least one game. */
  collected: string[];
  /** Storefronts the market is defined to combine. */
  total: number;
}

export interface MarketAggregate<C extends MarketCandidate, S extends MarketScoreLike> {
  games: MarketGame<C, S>[];
  coverage: MarketCoverage;
}

/**
 * Combines per-storefront selections into one market view. A game is one game per platform: the
 * same store and external id seen in several storefronts is counted once. Raw metrics are never
 * summed (Google Play counts are worldwide per app); the market score is the median storefront
 * score, and `countriesObserved` / `scoredCountries` say how many storefronts stand behind it.
 * Unscored storefronts are left out of the median rather than counted as zero.
 */
export function aggregateMarketGames<C extends MarketCandidate, S extends MarketScoreLike>(input: {
  storefronts: readonly StorefrontSelection<C, S>[];
  /** Storefronts the market combines, in display priority order. */
  priority: readonly string[];
  idOf: (candidate: C) => string;
}): MarketAggregate<C, S> {
  const { storefronts, priority, idOf } = input;
  const rank = (country: string) => {
    const index = priority.indexOf(country);
    return index === -1 ? priority.length : index;
  };

  const groups = new Map<string, Array<{ country: string; candidate: C; score: S | undefined }>>();
  for (const storefront of storefronts) {
    const scoreById = new Map(storefront.scores.map((score) => [score.id, score]));
    for (const candidate of storefront.candidates) {
      const key = `${candidate.store}:${candidate.externalId}`;
      const members = groups.get(key) ?? [];
      members.push({ country: storefront.country, candidate, score: scoreById.get(idOf(candidate)) });
      groups.set(key, members);
    }
  }

  const games = [...groups.values()].map((members): MarketGame<C, S> => {
    members.sort((a, b) => rank(a.country) - rank(b.country));
    const scored = members
      .filter((member) => member.score?.score != null)
      .sort((a, b) => (a.score?.score ?? 0) - (b.score?.score ?? 0) || rank(a.country) - rank(b.country));
    const shown = scored.length > 0 ? scored[Math.floor((scored.length - 1) / 2)] : members[0];
    if (!shown) throw new Error("A market game group cannot be empty");
    const firstSeenAt = new Date(Math.min(...members.map((member) => member.candidate.firstSeenAt.getTime())));
    return {
      candidate: { ...shown.candidate, firstSeenAt },
      score: shown.score,
      countriesObserved: members.map((member) => member.country),
      scoredCountries: scored.length,
      shownCountry: shown.country,
    };
  });

  const collected = priority.filter((country) => storefronts.some((storefront) => storefront.country === country && storefront.candidates.length > 0));
  return { games, coverage: { collected, total: priority.length } };
}
