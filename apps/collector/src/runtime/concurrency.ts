/**
 * Runs `task` for every item with at most `limit` in flight. Tasks start in input order, and a task
 * that throws rejects the whole call, so callers that want to keep going catch inside `task`.
 * Database writes use it to overlap round trips without exceeding the connection pool.
 */
export async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      await task(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
