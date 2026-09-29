/**
 * Mid-rank percentile in [0, 1] within a cohort; `null` inputs stay `null`.
 * Fewer than `minCohortSize` comparable values gives `null` for everyone, because a
 * percentile of a tiny group says nothing about momentum.
 */
export function percentileRanks(
  values: readonly (number | null)[],
  minCohortSize = 3,
): (number | null)[] {
  const present = values.filter((v): v is number => v !== null);
  const size = present.length;

  if (size < Math.max(2, minCohortSize)) {
    return values.map(() => null);
  }

  return values.map((value) => {
    if (value === null) return null;
    const below = present.filter((other) => other < value).length;
    const equal = present.filter((other) => other === value).length;
    return (below + (equal - 1) / 2) / (size - 1);
  });
}
